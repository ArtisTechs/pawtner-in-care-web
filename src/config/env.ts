const fallbackBaseUrl = 'http://192.168.0.229:8080/api'
const configuredBaseUrl = import.meta.env.VITE_API_BASE_URL ?? fallbackBaseUrl

export const API_CONFIG = {
  baseUrl: configuredBaseUrl.replace(/\/+$/, ''),
} as const
