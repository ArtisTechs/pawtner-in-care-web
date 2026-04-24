import { CLOUDINARY_CONFIG, isCloudinaryConfigured } from '@/config/env'
import { startFullScreenLoaderRequest } from '@/shared/api/full-screen-loader-store'
import { wasRecentlyTriggeredByUserAction } from '@/shared/api/user-action-tracker'

interface CloudinaryUploadResponse {
  error?: {
    message?: string
  }
  secure_url?: string
  url?: string
}

type UploadAssetOptions = {
  folder?: string
}

type CloudinaryResourceType = 'image' | 'video' | 'raw' | 'auto'

const buildCloudinaryUploadUrl = (resourceType: CloudinaryResourceType) =>
  `https://api.cloudinary.com/v1_1/${CLOUDINARY_CONFIG.cloudName}/${resourceType}/upload`

const parseUploadPayload = async (response: Response) => {
  try {
    return (await response.json()) as CloudinaryUploadResponse
  } catch {
    return null
  }
}

const uploadAsset = async (
  file: File,
  resourceType: CloudinaryResourceType,
  options?: UploadAssetOptions,
) => {
  if (!isCloudinaryConfigured) {
    throw new Error(
      'Cloudinary is not configured. Set VITE_CLOUDINARY_CLOUD_NAME and VITE_CLOUDINARY_UPLOAD_PRESET.',
    )
  }

  const formData = new FormData()
  formData.append('file', file)
  formData.append('upload_preset', CLOUDINARY_CONFIG.uploadPreset)

  const resolvedFolder = options?.folder?.trim() || CLOUDINARY_CONFIG.folder
  if (resolvedFolder) {
    formData.append('folder', resolvedFolder)
  }

  const stopLoaderRequest = wasRecentlyTriggeredByUserAction() ? startFullScreenLoaderRequest() : null

  try {
    const attemptedResourceTypes = Array.from(
      new Set<CloudinaryResourceType>([resourceType, 'auto']),
    )
    let lastUploadErrorMessage = 'Cloudinary upload failed.'

    for (const resourceTypeToTry of attemptedResourceTypes) {
      let response: Response

      try {
        response = await fetch(buildCloudinaryUploadUrl(resourceTypeToTry), {
          body: formData,
          method: 'POST',
        })
      } catch {
        throw new Error('Unable to reach Cloudinary. Check your internet connection and try again.')
      }

      const payload = await parseUploadPayload(response)

      if (!response.ok) {
        lastUploadErrorMessage = payload?.error?.message?.trim() || 'Cloudinary upload failed.'
        continue
      }

      const uploadedUrl = payload?.secure_url?.trim() || payload?.url?.trim()
      if (!uploadedUrl) {
        lastUploadErrorMessage = 'Upload completed but Cloudinary did not return a media URL.'
        continue
      }

      return uploadedUrl
    }

    throw new Error(lastUploadErrorMessage)
  } finally {
    stopLoaderRequest?.()
  }
}

const uploadPhoto = async (file: File, options?: UploadAssetOptions) => {
  return uploadAsset(file, 'image', options)
}

const uploadVideo = async (file: File, options?: UploadAssetOptions) => {
  return uploadAsset(file, 'video', options)
}

const uploadRaw = async (file: File, options?: UploadAssetOptions) => {
  return uploadAsset(file, 'raw', options)
}

const uploadFile = async (file: File, options?: UploadAssetOptions) => {
  const mimeType = file.type.toLowerCase()

  if (mimeType.startsWith('image/')) {
    return uploadPhoto(file, options)
  }

  if (mimeType.startsWith('video/')) {
    return uploadVideo(file, options)
  }

  return uploadRaw(file, options)
}

export const cloudinaryService = {
  uploadFile,
  uploadPhoto,
  uploadRaw,
  uploadVideo,
}
