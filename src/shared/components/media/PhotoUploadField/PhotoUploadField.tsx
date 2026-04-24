import { useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react'
import { FaTrashAlt } from 'react-icons/fa'
import { isCloudinaryConfigured } from '@/config/env'
import { getErrorMessage } from '@/shared/api/api-error'
import { cloudinaryService } from '@/shared/api/cloudinary.service'
import type { ToastVariant } from '@/shared/components/feedback/Toast'
import ConfirmModal from '@/shared/components/ui/ConfirmModal/ConfirmModal'
import styles from './PhotoUploadField.module.css'

type PhotoUploadFieldProps = {
  cameraButtonLabel?: string
  choosePhotoButtonLabel?: string
  cropAspectRatio?: number
  disabled?: boolean
  helperText?: string
  onChange: (nextPhoto: string) => void
  onNotify?: (message: string, variant: ToastVariant) => void
  previewAlt?: string
  removeButtonLabel?: string
  required?: boolean
  subtitle?: string
  title?: string
  uploadFolder?: string
  value: string
}

type CropRect = {
  height: number
  width: number
  x: number
  y: number
}

const notifyFallback = () => {}
const DEFAULT_CROP_RATIO = 3 / 4
const SQUARE_CROP_RATIO = 1
const JPEG_QUALITY = 0.92

const normalizeHttpLikeUrl = (value: string) => {
  const normalizedValue = value.trim()

  if (!normalizedValue) {
    return ''
  }

  const protocolIndex = normalizedValue.search(/https?:\/\//i)

  if (protocolIndex > 0) {
    return normalizedValue.slice(protocolIndex)
  }

  if (normalizedValue.startsWith('//')) {
    return `https:${normalizedValue}`
  }

  return normalizedValue
}

const resolveCenteredCrop = (sourceWidth: number, sourceHeight: number, targetRatio: number): CropRect => {
  const sourceRatio = sourceWidth / sourceHeight

  if (sourceRatio > targetRatio) {
    const width = Math.max(1, Math.round(sourceHeight * targetRatio))
    return {
      height: sourceHeight,
      width,
      x: Math.max(0, Math.floor((sourceWidth - width) / 2)),
      y: 0,
    }
  }

  const height = Math.max(1, Math.round(sourceWidth / targetRatio))
  return {
    height,
    width: sourceWidth,
    x: 0,
    y: Math.max(0, Math.floor((sourceHeight - height) / 2)),
  }
}

const canvasToBlob = (canvas: HTMLCanvasElement, type: string, quality: number) =>
  new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('Unable to process image.'))
        return
      }
      resolve(blob)
    }, type, quality)
  })

const cropImageBlobToAspectRatio = async (sourceBlob: Blob, targetRatio: number) => {
  const sourceUrl = URL.createObjectURL(sourceBlob)

  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const nextImage = new Image()
      nextImage.onload = () => resolve(nextImage)
      nextImage.onerror = () => reject(new Error('Unable to read selected image.'))
      nextImage.src = sourceUrl
    })

    const crop = resolveCenteredCrop(image.naturalWidth, image.naturalHeight, targetRatio)
    const canvas = document.createElement('canvas')
    canvas.width = crop.width
    canvas.height = crop.height

    const context = canvas.getContext('2d')
    if (!context) {
      throw new Error('Unable to process selected image.')
    }

    context.drawImage(
      image,
      crop.x,
      crop.y,
      crop.width,
      crop.height,
      0,
      0,
      crop.width,
      crop.height,
    )

    return canvasToBlob(canvas, 'image/jpeg', JPEG_QUALITY)
  } finally {
    URL.revokeObjectURL(sourceUrl)
  }
}

function PhotoUploadField({
  cameraButtonLabel = 'Open Camera',
  choosePhotoButtonLabel = 'Choose Photo to Upload',
  cropAspectRatio = DEFAULT_CROP_RATIO,
  disabled = false,
  helperText,
  onChange,
  onNotify = notifyFallback,
  previewAlt = 'Uploaded image preview',
  required = false,
  removeButtonLabel = 'Remove Photo',
  subtitle = 'Upload from your device or camera.',
  title = 'Photo',
  uploadFolder,
  value,
}: PhotoUploadFieldProps) {
  const previewUrl = normalizeHttpLikeUrl(value)
  const usesSquareCrop = Math.abs(cropAspectRatio - SQUARE_CROP_RATIO) < 0.001
  const resolvedHelperText =
    helperText ??
    (usesSquareCrop
      ? 'Photos are automatically center-cropped to 1:1 before upload.'
      : 'Photos are automatically center-cropped to 3:4 before upload.')
  const [isUploading, setIsUploading] = useState(false)
  const [isCameraModalOpen, setIsCameraModalOpen] = useState(false)
  const [isStartingCamera, setIsStartingCamera] = useState(false)
  const [isCapturing, setIsCapturing] = useState(false)
  const [isRemoveConfirmOpen, setIsRemoveConfirmOpen] = useState(false)
  const [cameraError, setCameraError] = useState('')
  const [capturedPhoto, setCapturedPhoto] = useState<{ blob: Blob; previewUrl: string } | null>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)

  const stopCameraStream = useCallback(() => {
    const currentStream = streamRef.current
    if (currentStream) {
      currentStream.getTracks().forEach((track) => {
        track.stop()
      })
      streamRef.current = null
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
  }, [])

  const clearCapturedPhoto = useCallback(() => {
    setCapturedPhoto((currentPhoto) => {
      if (currentPhoto) {
        URL.revokeObjectURL(currentPhoto.previewUrl)
      }
      return null
    })
  }, [])

  useEffect(() => {
    return () => {
      stopCameraStream()
      clearCapturedPhoto()
    }
  }, [clearCapturedPhoto, stopCameraStream])

  const uploadSelectedFile = useCallback(
    async (selectedFile: File) => {
      if (!selectedFile.type.startsWith('image/')) {
        onNotify('Please choose an image file.', 'error')
        return false
      }

      setIsUploading(true)
      try {
        const uploadedPhoto = await cloudinaryService.uploadPhoto(selectedFile, { folder: uploadFolder })
        onChange(uploadedPhoto)
        onNotify('Photo uploaded successfully.', 'success')
        return true
      } catch (error) {
        onNotify(getErrorMessage(error, 'Unable to upload photo right now.'), 'error')
        return false
      } finally {
        setIsUploading(false)
      }
    },
    [onChange, onNotify, uploadFolder],
  )

  const startCameraStream = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError('Camera is not supported on this browser.')
      return
    }

    setIsStartingCamera(true)
    setCameraError('')

    try {
      let stream: MediaStream
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { facingMode: { ideal: 'environment' } },
        })
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: true })
      }

      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
    } catch {
      setCameraError('Unable to access camera. Allow camera permission and try again.')
    } finally {
      setIsStartingCamera(false)
    }
  }, [])

  const handleFilePick = async (event: ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0]
    event.target.value = ''

    if (!selectedFile) {
      return
    }

    try {
      const croppedBlob = await cropImageBlobToAspectRatio(selectedFile, cropAspectRatio)
      const croppedFile = new File([croppedBlob], `upload-crop-${Date.now()}.jpg`, {
        type: croppedBlob.type || 'image/jpeg',
      })
      await uploadSelectedFile(croppedFile)
    } catch {
      onNotify('Unable to crop selected image. Uploading original photo instead.', 'info')
      await uploadSelectedFile(selectedFile)
    }
  }

  const openCameraModal = () => {
    if (disabled || isUploading || !isCloudinaryConfigured) {
      return
    }

    setIsCameraModalOpen(true)
    setCameraError('')
    clearCapturedPhoto()
    void startCameraStream()
  }

  const closeCameraModal = useCallback(() => {
    setIsCameraModalOpen(false)
    setCameraError('')
    setIsCapturing(false)
    stopCameraStream()
    clearCapturedPhoto()
  }, [clearCapturedPhoto, stopCameraStream])

  const handleCapturePhoto = async () => {
    const videoElement = videoRef.current
    const canvasElement = canvasRef.current

    if (!videoElement || !canvasElement) {
      setCameraError('Camera preview is not ready yet.')
      return
    }

    if (videoElement.videoWidth === 0 || videoElement.videoHeight === 0) {
      setCameraError('Camera preview is still loading. Please try again.')
      return
    }

    setIsCapturing(true)
    setCameraError('')

    try {
      const crop = resolveCenteredCrop(videoElement.videoWidth, videoElement.videoHeight, cropAspectRatio)
      canvasElement.width = crop.width
      canvasElement.height = crop.height

      const context = canvasElement.getContext('2d')
      if (!context) {
        throw new Error('Unable to prepare camera capture.')
      }

      context.drawImage(
        videoElement,
        crop.x,
        crop.y,
        crop.width,
        crop.height,
        0,
        0,
        crop.width,
        crop.height,
      )

      const blob = await canvasToBlob(canvasElement, 'image/jpeg', JPEG_QUALITY)

      clearCapturedPhoto()
      const previewUrl = URL.createObjectURL(blob)
      setCapturedPhoto({ blob, previewUrl })
      stopCameraStream()
    } catch (error) {
      setCameraError(getErrorMessage(error, 'Unable to capture photo right now.'))
    } finally {
      setIsCapturing(false)
    }
  }

  const handleRetryCamera = () => {
    clearCapturedPhoto()
    setCameraError('')
    void startCameraStream()
  }

  const handleUseCapturedPhoto = async () => {
    if (!capturedPhoto) {
      return
    }

    const capturedFile = new File([capturedPhoto.blob], `camera-capture-${Date.now()}.jpg`, {
      type: capturedPhoto.blob.type || 'image/jpeg',
    })

    const isUploaded = await uploadSelectedFile(capturedFile)
    if (isUploaded) {
      closeCameraModal()
    }
  }

  const handleRemovePhoto = () => {
    setIsRemoveConfirmOpen(true)
  }

  const handleConfirmRemovePhoto = () => {
    setIsRemoveConfirmOpen(false)
    onChange('')
    onNotify('Photo removed.', 'info')
  }

  const isFieldDisabled = disabled || isUploading || !isCloudinaryConfigured

  return (
    <section className={styles.root} aria-label={title}>
      <div className={styles.header}>
        <h3 className={styles.title}>
          {title}
          {required ? <span className={styles.requiredAsterisk}>*</span> : null}
        </h3>
        <p className={styles.subtitle}>{subtitle}</p>
      </div>

      {previewUrl ? (
        <div className={`${styles.previewBox} ${usesSquareCrop ? styles.previewBoxSquare : ''}`}>
          <img src={previewUrl} alt={previewAlt} className={styles.previewImage} />
          <button
            type="button"
            className={styles.previewRemoveButton}
            onClick={handleRemovePhoto}
            disabled={isUploading}
            aria-label={removeButtonLabel}
          >
            <FaTrashAlt aria-hidden="true" />
          </button>
        </div>
      ) : null}

      <div className={styles.panel}>
        <div className={styles.uploadActions}>
          <label className={`${styles.uploadButton} ${isFieldDisabled ? styles.uploadButtonDisabled : ''}`}>
            <input
              type="file"
              accept="image/*"
              className={styles.hiddenInput}
              onChange={(event) => {
                void handleFilePick(event)
              }}
              disabled={isFieldDisabled}
            />
            {isUploading ? 'Uploading...' : choosePhotoButtonLabel}
          </label>

          <button
            type="button"
            className={`${styles.cameraButton} ${isFieldDisabled ? styles.uploadButtonDisabled : ''}`}
            onClick={openCameraModal}
            disabled={isFieldDisabled}
          >
            {cameraButtonLabel}
          </button>
        </div>
        <p className={styles.helperText}>
          {isCloudinaryConfigured
            ? resolvedHelperText
            : 'Set VITE_CLOUDINARY_CLOUD_NAME and VITE_CLOUDINARY_UPLOAD_PRESET to enable uploads.'}
        </p>
      </div>

      {isCameraModalOpen ? (
        <div className={styles.cameraModalOverlay}>
          <div className={styles.cameraModalCard} role="dialog" aria-modal="true" aria-label="Camera capture">
            <div className={styles.cameraModalHeader}>
              <h4 className={styles.cameraModalTitle}>Camera</h4>
              <button type="button" className={styles.cameraCloseButton} onClick={closeCameraModal}>
                x
              </button>
            </div>

            <div className={`${styles.cameraViewport} ${usesSquareCrop ? styles.cameraViewportSquare : ''}`}>
              {capturedPhoto ? (
                <img src={capturedPhoto.previewUrl} alt="Captured preview" className={styles.cameraCapturedImage} />
              ) : (
                <video ref={videoRef} className={styles.cameraVideo} autoPlay muted playsInline />
              )}
            </div>

            {cameraError ? <p className={styles.cameraError}>{cameraError}</p> : null}

            <div className={styles.cameraActions}>
              {capturedPhoto ? (
                <>
                  <button
                    type="button"
                    className={styles.cameraSecondaryButton}
                    onClick={handleRetryCamera}
                    disabled={isUploading || isCapturing}
                  >
                    Retry
                  </button>
                  <button
                    type="button"
                    className={styles.cameraPrimaryButton}
                    onClick={() => {
                      void handleUseCapturedPhoto()
                    }}
                    disabled={isUploading || isCapturing}
                  >
                    {isUploading ? 'Uploading...' : 'Use Photo'}
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    className={styles.cameraSecondaryButton}
                    onClick={closeCameraModal}
                    disabled={isStartingCamera || isCapturing}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className={styles.cameraPrimaryButton}
                    onClick={() => {
                      void handleCapturePhoto()
                    }}
                    disabled={isStartingCamera || isCapturing || Boolean(cameraError)}
                  >
                    {isCapturing ? 'Capturing...' : 'Capture'}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      ) : null}

      <ConfirmModal
        isOpen={isRemoveConfirmOpen}
        title="Clear photo?"
        message="This removes the current photo from the form."
        confirmLabel="Clear Photo"
        cancelLabel="Keep Photo"
        ariaLabel="Clear photo confirmation"
        isBusy={isUploading}
        onCancel={() => {
          setIsRemoveConfirmOpen(false)
        }}
        onConfirm={handleConfirmRemovePhoto}
      />

      <canvas ref={canvasRef} className={styles.hiddenCanvas} aria-hidden="true" />
    </section>
  )
}

export default PhotoUploadField
