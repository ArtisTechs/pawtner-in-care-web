import { useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react'
import { FaTrashAlt } from 'react-icons/fa'
import { isCloudinaryConfigured } from '@/config/env'
import { getErrorMessage } from '@/shared/api/api-error'
import { cloudinaryService } from '@/shared/api/cloudinary.service'
import type { ToastVariant } from '@/shared/components/feedback/Toast'
import ConfirmModal from '@/shared/components/ui/ConfirmModal/ConfirmModal'
import styles from './VideoUploadField.module.css'

type VideoUploadFieldProps = {
  chooseVideoButtonLabel?: string
  disabled?: boolean
  helperText?: string
  maxDurationSeconds?: number
  maxSizeMb?: number
  onChange: (nextVideo: string) => void
  onNotify?: (message: string, variant: ToastVariant) => void
  recordButtonLabel?: string
  removeButtonLabel?: string
  subtitle?: string
  title?: string
  uploadFolder?: string
  value: string
}

type RecordedVideoState = {
  blob: Blob
  durationSeconds: number
  previewUrl: string
}

const notifyFallback = () => {}
const DURATION_READ_TIMEOUT_MS = 12000
const DURATION_TOLERANCE_SECONDS = 0.5

const getPreferredRecorderMimeType = () => {
  if (typeof MediaRecorder === 'undefined') {
    return ''
  }

  const candidates = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm',
  ]

  return candidates.find((candidate) => MediaRecorder.isTypeSupported(candidate)) ?? ''
}

const formatSeconds = (seconds: number) => {
  const clampedSeconds = Math.max(0, Math.floor(seconds))
  const minutesPart = Math.floor(clampedSeconds / 60)
  const secondsPart = clampedSeconds % 60
  return `${minutesPart}:${secondsPart.toString().padStart(2, '0')}`
}

const getDurationLabel = (maxDurationSeconds: number) => {
  if (maxDurationSeconds === 60) {
    return '1 minute'
  }

  return `${maxDurationSeconds} seconds`
}

const getVideoDurationSeconds = (videoBlob: Blob) =>
  new Promise<number>((resolve, reject) => {
    const objectUrl = URL.createObjectURL(videoBlob)
    const video = document.createElement('video')
    let isSettled = false

    const settle = (resolver: (value: number) => void, value: number) => {
      if (isSettled) {
        return
      }

      isSettled = true
      window.clearTimeout(timeoutId)
      video.onloadedmetadata = null
      video.ondurationchange = null
      video.onseeked = null
      video.onerror = null
      URL.revokeObjectURL(objectUrl)
      resolver(value)
    }

    const settleError = (message: string) => {
      if (isSettled) {
        return
      }

      isSettled = true
      window.clearTimeout(timeoutId)
      video.onloadedmetadata = null
      video.ondurationchange = null
      video.onseeked = null
      video.onerror = null
      URL.revokeObjectURL(objectUrl)
      reject(new Error(message))
    }

    const tryResolveDuration = () => {
      const duration = video.duration
      if (Number.isFinite(duration) && duration > 0) {
        settle(resolve, duration)
      }
    }

    const timeoutId = window.setTimeout(() => {
      settleError('Unable to read video duration.')
    }, DURATION_READ_TIMEOUT_MS)

    video.preload = 'metadata'
    video.muted = true
    video.playsInline = true
    video.onloadedmetadata = () => {
      tryResolveDuration()

      if (!isSettled) {
        try {
          video.currentTime = Number.MAX_SAFE_INTEGER
        } catch {
          /* no-op */
        }
      }
    }
    video.ondurationchange = tryResolveDuration
    video.onseeked = tryResolveDuration
    video.onerror = () => {
      settleError('Unable to read selected video.')
    }
    video.src = objectUrl
    video.load()
  })

function VideoUploadField({
  chooseVideoButtonLabel = 'Choose Video to Upload',
  disabled = false,
  helperText = 'Video must be 1 minute or less and 30MB or less.',
  maxDurationSeconds = 60,
  maxSizeMb = 30,
  onChange,
  onNotify = notifyFallback,
  recordButtonLabel = 'Record Video',
  removeButtonLabel = 'Remove Video',
  subtitle = 'Upload or record a short video clip.',
  title = 'Video',
  uploadFolder,
  value,
}: VideoUploadFieldProps) {
  const [isUploading, setIsUploading] = useState(false)
  const [isRecorderModalOpen, setIsRecorderModalOpen] = useState(false)
  const [isPreparingRecorder, setIsPreparingRecorder] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [isRemoveConfirmOpen, setIsRemoveConfirmOpen] = useState(false)
  const [recordingSeconds, setRecordingSeconds] = useState(0)
  const [recorderError, setRecorderError] = useState('')
  const [recordedVideo, setRecordedVideo] = useState<RecordedVideoState | null>(null)
  const liveVideoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const recordedChunksRef = useRef<Blob[]>([])
  const recordingStartedAtRef = useRef<number | null>(null)
  const recordingIntervalRef = useRef<number | null>(null)
  const recordingTimeoutRef = useRef<number | null>(null)

  const maxAllowedBytes = maxSizeMb * 1024 * 1024
  const maxDurationLabel = getDurationLabel(maxDurationSeconds)

  const stopRecordingTimers = useCallback(() => {
    if (recordingIntervalRef.current !== null) {
      window.clearInterval(recordingIntervalRef.current)
      recordingIntervalRef.current = null
    }

    if (recordingTimeoutRef.current !== null) {
      window.clearTimeout(recordingTimeoutRef.current)
      recordingTimeoutRef.current = null
    }
  }, [])

  const stopRecorderStream = useCallback(() => {
    const currentStream = streamRef.current
    if (currentStream) {
      currentStream.getTracks().forEach((track) => {
        track.stop()
      })
      streamRef.current = null
    }

    if (liveVideoRef.current) {
      liveVideoRef.current.srcObject = null
    }
  }, [])

  const clearRecordedVideo = useCallback(() => {
    setRecordedVideo((currentVideo) => {
      if (currentVideo) {
        URL.revokeObjectURL(currentVideo.previewUrl)
      }
      return null
    })
  }, [])

  useEffect(() => {
    return () => {
      const activeRecorder = recorderRef.current
      if (activeRecorder?.state === 'recording') {
        activeRecorder.stop()
      }

      recorderRef.current = null
      stopRecordingTimers()
      stopRecorderStream()
      clearRecordedVideo()
    }
  }, [clearRecordedVideo, stopRecorderStream, stopRecordingTimers])

  const validateVideoConstraints = useCallback(
    async (videoBlob: Blob, fallbackDurationSeconds?: number) => {
      if (videoBlob.size > maxAllowedBytes) {
        throw new Error(`Video exceeds ${maxSizeMb}MB limit.`)
      }

      const hasFallbackDuration =
        typeof fallbackDurationSeconds === 'number' &&
        Number.isFinite(fallbackDurationSeconds) &&
        fallbackDurationSeconds > 0

      const durationSeconds = hasFallbackDuration
        ? fallbackDurationSeconds
        : await getVideoDurationSeconds(videoBlob)

      if (durationSeconds > maxDurationSeconds + DURATION_TOLERANCE_SECONDS) {
        throw new Error(`Video is longer than ${maxDurationLabel}.`)
      }

      return durationSeconds
    },
    [maxAllowedBytes, maxDurationLabel, maxDurationSeconds, maxSizeMb],
  )

  const uploadVideoBlob = useCallback(
    async (videoBlob: Blob, fileName: string) => {
      try {
        await validateVideoConstraints(videoBlob)
      } catch (error) {
        onNotify(getErrorMessage(error, 'Video does not meet the upload requirements.'), 'error')
        return false
      }

      const uploadFile = new File([videoBlob], fileName, { type: videoBlob.type || 'video/webm' })

      setIsUploading(true)
      try {
        const uploadedVideoUrl = await cloudinaryService.uploadVideo(uploadFile, { folder: uploadFolder })
        onChange(uploadedVideoUrl)
        onNotify('Video uploaded successfully.', 'success')
        return true
      } catch (error) {
        onNotify(getErrorMessage(error, 'Unable to upload video right now.'), 'error')
        return false
      } finally {
        setIsUploading(false)
      }
    },
    [onChange, onNotify, uploadFolder, validateVideoConstraints],
  )

  const finalizeRecording = useCallback(
    async (recordedMimeType: string) => {
      stopRecordingTimers()
      setIsRecording(false)
      setRecordingSeconds(0)

      const capturedChunks = recordedChunksRef.current
      recordedChunksRef.current = []

      if (capturedChunks.length === 0) {
        setRecorderError('No video captured. Please try again.')
        return
      }

      const capturedBlob = new Blob(capturedChunks, { type: recordedMimeType || 'video/webm' })
      const recordingStartedAt = recordingStartedAtRef.current
      recordingStartedAtRef.current = null
      const elapsedRecordingSeconds =
        recordingStartedAt === null ? undefined : Math.max((Date.now() - recordingStartedAt) / 1000, 0.1)

      try {
        const durationSeconds = await validateVideoConstraints(capturedBlob, elapsedRecordingSeconds)
        clearRecordedVideo()
        const previewUrl = URL.createObjectURL(capturedBlob)
        setRecordedVideo({
          blob: capturedBlob,
          durationSeconds,
          previewUrl,
        })
        stopRecorderStream()
      } catch (error) {
        setRecorderError(getErrorMessage(error, 'Unable to use the recorded video.'))
      }
    },
    [clearRecordedVideo, stopRecorderStream, stopRecordingTimers, validateVideoConstraints],
  )

  const startRecorderStream = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setRecorderError('Video recording is not supported on this browser.')
      return
    }

    if (typeof MediaRecorder === 'undefined') {
      setRecorderError('MediaRecorder is not supported on this browser.')
      return
    }

    setIsPreparingRecorder(true)
    setRecorderError('')

    try {
      let stream: MediaStream
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { facingMode: { ideal: 'environment' } },
        })
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: true,
        })
      }

      streamRef.current = stream
      if (liveVideoRef.current) {
        liveVideoRef.current.srcObject = stream
        await liveVideoRef.current.play()
      }
    } catch {
      setRecorderError('Unable to access camera. Allow permission and try again.')
    } finally {
      setIsPreparingRecorder(false)
    }
  }, [])

  const stopRecording = useCallback(() => {
    const activeRecorder = recorderRef.current
    if (!activeRecorder || activeRecorder.state !== 'recording') {
      return
    }

    activeRecorder.stop()
  }, [])

  const startRecording = async () => {
    const activeStream = streamRef.current
    if (!activeStream) {
      setRecorderError('Camera preview is not ready yet.')
      return
    }

    recordedChunksRef.current = []
    clearRecordedVideo()
    setRecorderError('')

    const preferredMimeType = getPreferredRecorderMimeType()
    let recorder: MediaRecorder

    try {
      recorder = preferredMimeType
        ? new MediaRecorder(activeStream, { mimeType: preferredMimeType })
        : new MediaRecorder(activeStream)
    } catch {
      setRecorderError('Unable to start recording with this browser/device.')
      return
    }

    recorderRef.current = recorder

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        recordedChunksRef.current.push(event.data)
      }
    }

    recorder.onerror = () => {
      setRecorderError('Recording failed unexpectedly. Please retry.')
    }

    recorder.onstop = () => {
      void finalizeRecording(recorder.mimeType || preferredMimeType || 'video/webm')
    }

    try {
      recorder.start(300)
      setIsRecording(true)
      setRecordingSeconds(0)
      recordingStartedAtRef.current = Date.now()
      stopRecordingTimers()

      recordingIntervalRef.current = window.setInterval(() => {
        setRecordingSeconds((seconds) => seconds + 1)
      }, 1000)

      recordingTimeoutRef.current = window.setTimeout(() => {
        if (recorder.state === 'recording') {
          setRecorderError(`Recording stopped. Maximum is ${maxDurationLabel}.`)
          recorder.stop()
        }
      }, maxDurationSeconds * 1000)
    } catch {
      setRecorderError('Unable to begin recording. Please try again.')
      setIsRecording(false)
      recordingStartedAtRef.current = null
    }
  }

  const openRecorderModal = () => {
    if (disabled || isUploading || !isCloudinaryConfigured) {
      return
    }

    setIsRecorderModalOpen(true)
    setRecorderError('')
    clearRecordedVideo()
    setIsRecording(false)
    setRecordingSeconds(0)
    void startRecorderStream()
  }

  const closeRecorderModal = useCallback(() => {
    const activeRecorder = recorderRef.current
    if (activeRecorder?.state === 'recording') {
      activeRecorder.onstop = null
      activeRecorder.onerror = null
      activeRecorder.stop()
    }

    recordingStartedAtRef.current = null
    recordedChunksRef.current = []
    recorderRef.current = null
    stopRecordingTimers()
    stopRecorderStream()
    clearRecordedVideo()
    setIsRecorderModalOpen(false)
    setIsPreparingRecorder(false)
    setIsRecording(false)
    setRecordingSeconds(0)
    setRecorderError('')
  }, [clearRecordedVideo, stopRecorderStream, stopRecordingTimers])

  const handleFilePick = async (event: ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0]
    event.target.value = ''

    if (!selectedFile) {
      return
    }

    if (!selectedFile.type.startsWith('video/')) {
      onNotify('Please choose a valid video file.', 'error')
      return
    }

    const extension = selectedFile.name.split('.').pop() || 'mp4'
    await uploadVideoBlob(selectedFile, `upload-video-${Date.now()}.${extension}`)
  }

  const handleRetryRecording = () => {
    clearRecordedVideo()
    setRecorderError('')
    setRecordingSeconds(0)
    void startRecorderStream()
  }

  const handleUseRecordedVideo = async () => {
    if (!recordedVideo) {
      return
    }

    const extension = recordedVideo.blob.type.includes('mp4') ? 'mp4' : 'webm'
    const isUploaded = await uploadVideoBlob(recordedVideo.blob, `recorded-video-${Date.now()}.${extension}`)
    if (isUploaded) {
      closeRecorderModal()
    }
  }

  const handleRemoveVideo = () => {
    setIsRemoveConfirmOpen(true)
  }

  const handleConfirmRemoveVideo = () => {
    setIsRemoveConfirmOpen(false)
    onChange('')
    onNotify('Video removed.', 'info')
  }

  const isFieldDisabled = disabled || isUploading || !isCloudinaryConfigured

  return (
    <section className={styles.root} aria-label={title}>
      <div className={styles.header}>
        <h3 className={styles.title}>{title}</h3>
        <p className={styles.subtitle}>{subtitle}</p>
      </div>

      {value ? (
        <div className={styles.previewBox}>
          <video src={value} className={styles.previewVideo} controls preload="metadata" />
          <button
            type="button"
            className={styles.previewRemoveButton}
            onClick={handleRemoveVideo}
            disabled={isUploading}
            aria-label={removeButtonLabel}
          >
            <FaTrashAlt aria-hidden="true" />
          </button>
        </div>
      ) : null}

      <div className={styles.uploadActions}>
        <label className={`${styles.uploadButton} ${isFieldDisabled ? styles.uploadButtonDisabled : ''}`}>
          <input
            type="file"
            accept="video/*"
            className={styles.hiddenInput}
            onChange={(event) => {
              void handleFilePick(event)
            }}
            disabled={isFieldDisabled}
          />
          {isUploading ? 'Uploading...' : chooseVideoButtonLabel}
        </label>

        <button
          type="button"
          className={`${styles.recordButton} ${isFieldDisabled ? styles.uploadButtonDisabled : ''}`}
          onClick={openRecorderModal}
          disabled={isFieldDisabled}
        >
          {recordButtonLabel}
        </button>
      </div>

      <p className={styles.helperText}>
        {isCloudinaryConfigured
          ? helperText
          : 'Set VITE_CLOUDINARY_CLOUD_NAME and VITE_CLOUDINARY_UPLOAD_PRESET to enable uploads.'}
      </p>

      {isRecorderModalOpen ? (
        <div className={styles.recorderModalOverlay}>
          <div className={styles.recorderModalCard} role="dialog" aria-modal="true" aria-label="Video recorder">
            <div className={styles.recorderModalHeader}>
              <h4 className={styles.recorderModalTitle}>Record Video</h4>
              <button type="button" className={styles.recorderCloseButton} onClick={closeRecorderModal}>
                x
              </button>
            </div>

            <div className={styles.recorderViewport}>
              {recordedVideo ? (
                <video
                  src={recordedVideo.previewUrl}
                  className={styles.recorderPlaybackVideo}
                  controls
                  preload="metadata"
                />
              ) : (
                <video ref={liveVideoRef} className={styles.recorderLiveVideo} autoPlay muted playsInline />
              )}
            </div>

            <p className={styles.recorderMetaText}>
              Max duration: {maxDurationLabel} | Max size: {maxSizeMb}MB
              {isRecording ? ` | Recording: ${formatSeconds(recordingSeconds)}` : ''}
              {recordedVideo ? ` | Clip: ${formatSeconds(recordedVideo.durationSeconds)}` : ''}
            </p>

            {recorderError ? <p className={styles.recorderError}>{recorderError}</p> : null}

            <div className={styles.recorderActions}>
              {recordedVideo ? (
                <>
                  <button
                    type="button"
                    className={styles.recorderSecondaryButton}
                    onClick={handleRetryRecording}
                    disabled={isUploading}
                  >
                    Retry
                  </button>
                  <button
                    type="button"
                    className={styles.recorderPrimaryButton}
                    onClick={() => {
                      void handleUseRecordedVideo()
                    }}
                    disabled={isUploading}
                  >
                    {isUploading ? 'Uploading...' : 'Use Video'}
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    className={styles.recorderSecondaryButton}
                    onClick={closeRecorderModal}
                    disabled={isRecording || isPreparingRecorder}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className={styles.recorderPrimaryButton}
                    onClick={() => {
                      if (isRecording) {
                        stopRecording()
                        return
                      }
                      void startRecording()
                    }}
                    disabled={isPreparingRecorder}
                  >
                    {isPreparingRecorder ? 'Starting camera...' : isRecording ? 'Stop' : 'Record'}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      ) : null}

      <ConfirmModal
        isOpen={isRemoveConfirmOpen}
        title="Clear video?"
        message="This removes the current video from the form."
        confirmLabel="Clear Video"
        cancelLabel="Keep Video"
        ariaLabel="Clear video confirmation"
        isBusy={isUploading}
        onCancel={() => {
          setIsRemoveConfirmOpen(false)
        }}
        onConfirm={handleConfirmRemoveVideo}
      />
    </section>
  )
}

export default VideoUploadField
