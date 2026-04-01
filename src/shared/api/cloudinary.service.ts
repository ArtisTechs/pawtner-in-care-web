import { CLOUDINARY_CONFIG, isCloudinaryConfigured } from '@/config/env'

interface CloudinaryUploadResponse {
  error?: {
    message?: string
  }
  secure_url?: string
  url?: string
}

type UploadPhotoOptions = {
  folder?: string
}

type CloudinaryResourceType = 'image' | 'video'

const buildCloudinaryUploadUrl = (resourceType: CloudinaryResourceType) =>
  `https://api.cloudinary.com/v1_1/${CLOUDINARY_CONFIG.cloudName}/${resourceType}/upload`

const uploadAsset = async (
  file: File,
  resourceType: CloudinaryResourceType,
  options?: UploadPhotoOptions,
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

  let response: Response

  try {
    response = await fetch(buildCloudinaryUploadUrl(resourceType), {
      body: formData,
      method: 'POST',
    })
  } catch {
    throw new Error('Unable to reach Cloudinary. Check your internet connection and try again.')
  }

  let payload: CloudinaryUploadResponse | null = null
  try {
    payload = (await response.json()) as CloudinaryUploadResponse
  } catch {
    payload = null
  }

  if (!response.ok) {
    throw new Error(payload?.error?.message?.trim() || 'Cloudinary upload failed.')
  }

  const uploadedUrl = payload?.secure_url?.trim() || payload?.url?.trim()
  if (!uploadedUrl) {
    throw new Error('Upload completed but Cloudinary did not return a media URL.')
  }

  return uploadedUrl
}

const uploadPhoto = async (file: File, options?: UploadPhotoOptions) => {
  return uploadAsset(file, 'image', options)
}

const uploadVideo = async (file: File, options?: UploadPhotoOptions) => {
  return uploadAsset(file, 'video', options)
}

export const cloudinaryService = {
  uploadPhoto,
  uploadVideo,
}
