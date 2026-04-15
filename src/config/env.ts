const fallbackBaseUrl = 'http://192.168.0.229:8080/api'
const configuredBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim() || fallbackBaseUrl

const configuredCloudinaryCloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME?.trim() ?? ''
const configuredCloudinaryUploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET?.trim() ?? ''
const configuredCloudinaryFolder = import.meta.env.VITE_CLOUDINARY_FOLDER?.trim() ?? ''

export const API_CONFIG = {
  baseUrl: configuredBaseUrl.replace(/\/+$/, ''),
} as const

export const CLOUDINARY_CONFIG = {
  cloudName: configuredCloudinaryCloudName,
  folder: configuredCloudinaryFolder,
  uploadPreset: configuredCloudinaryUploadPreset,
} as const

export const isCloudinaryConfigured = Boolean(
  CLOUDINARY_CONFIG.cloudName && CLOUDINARY_CONFIG.uploadPreset,
)
