import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import L from 'leaflet'
import { FaCrosshairs } from 'react-icons/fa'
import redPinIcon from '@/assets/red-pin-icon.png'
import type { LeafletEvent } from 'leaflet'
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { startFullScreenLoaderRequest } from '@/shared/api/full-screen-loader-store'
import { wasRecentlyTriggeredByUserAction } from '@/shared/api/user-action-tracker'
import styles from './LocationPickerMap.module.css'

const DEFAULT_LATITUDE = 14.5995
const DEFAULT_LONGITUDE = 120.9842
const DEFAULT_ZOOM = 16
const SEARCH_MIN_LENGTH = 3
const SEARCH_DEBOUNCE_MS = 320
const COORDINATE_PRECISION = 7

const parseCoordinate = (value: string) => {
  const parsedValue = Number.parseFloat(value.trim())
  return Number.isFinite(parsedValue) ? parsedValue : undefined
}

const formatCoordinate = (value: number) => value.toFixed(COORDINATE_PRECISION)

const isAbortError = (error: unknown) =>
  error instanceof DOMException && error.name === 'AbortError'

interface LocationSuggestion {
  address: string
  latitude: string
  longitude: string
}

interface NominatimSearchResult {
  display_name?: string
  lat?: string
  lon?: string
}

interface NominatimReverseResult {
  display_name?: string
}

export interface LocationPickerValue {
  address: string
  latitude: string
  longitude: string
}

interface LocationPickerMapProps {
  showCoordinateInputs?: boolean
  value: LocationPickerValue
  onChange: (nextValue: LocationPickerValue) => void
}

const redPinMarkerIcon = new L.Icon({
  iconUrl: redPinIcon,
  iconRetinaUrl: redPinIcon,
  iconSize: [34, 42],
  iconAnchor: [17, 41],
})

interface MapPickerEventsProps {
  onMapSelect: (latitude: number, longitude: number) => void
}

function MapPickerEvents({ onMapSelect }: MapPickerEventsProps) {
  useMapEvents({
    click: (event) => {
      onMapSelect(event.latlng.lat, event.latlng.lng)
    },
  })

  return null
}

interface MapViewportSyncProps {
  latitude: number
  longitude: number
}

function MapViewportSync({ latitude, longitude }: MapViewportSyncProps) {
  const map = useMap()

  useEffect(() => {
    map.panTo([latitude, longitude])
  }, [latitude, longitude, map])

  return null
}

function LocationPickerMap({
  showCoordinateInputs = true,
  value,
  onChange,
}: LocationPickerMapProps) {
  const searchInputId = useId()
  const [searchQuery, setSearchQuery] = useState(value.address)
  const [suggestions, setSuggestions] = useState<LocationSuggestion[]>([])
  const [isSearchFocused, setIsSearchFocused] = useState(false)
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false)
  const [searchError, setSearchError] = useState('')
  const [resolveError, setResolveError] = useState('')
  const [isLocating, setIsLocating] = useState(false)
  const hasAttemptedAutoLocateRef = useRef(false)
  const blurTimeoutRef = useRef<number | null>(null)
  const isSelectingSuggestionRef = useRef(false)

  const parsedLatitude = useMemo(() => parseCoordinate(value.latitude), [value.latitude])
  const parsedLongitude = useMemo(() => parseCoordinate(value.longitude), [value.longitude])
  const hasValidCoordinates = parsedLatitude !== undefined && parsedLongitude !== undefined
  const mapCenter: [number, number] = hasValidCoordinates
    ? [parsedLatitude, parsedLongitude]
    : [DEFAULT_LATITUDE, DEFAULT_LONGITUDE]
  const shouldShowSuggestionsPanel = isSearchFocused && searchQuery.trim().length >= SEARCH_MIN_LENGTH

  const applyLocation = useCallback((nextLocation: LocationPickerValue) => {
    setResolveError('')
    onChange(nextLocation)
  }, [onChange])

  const resolveAddressByCoordinates = useCallback(async (latitude: number, longitude: number) => {
    const searchParams = new URLSearchParams({
      format: 'jsonv2',
      lat: String(latitude),
      lon: String(longitude),
    })

    const stopLoaderRequest = wasRecentlyTriggeredByUserAction() ? startFullScreenLoaderRequest() : null
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/reverse?${searchParams}`)
      if (!response.ok) {
        throw new Error('Unable to resolve address.')
      }

      const payload = (await response.json()) as NominatimReverseResult
      return payload.display_name?.trim() ?? ''
    } finally {
      stopLoaderRequest?.()
    }
  }, [])

  const applyCoordinates = useCallback(async (latitude: number, longitude: number, resolveAddress: boolean) => {
    const nextLatitude = formatCoordinate(latitude)
    const nextLongitude = formatCoordinate(longitude)

    let nextAddress = value.address
    if (resolveAddress) {
      setResolveError('')

      try {
        const resolvedAddress = await resolveAddressByCoordinates(latitude, longitude)
        if (resolvedAddress) {
          nextAddress = resolvedAddress
          setSearchQuery(resolvedAddress)
        } else {
          setResolveError('No readable address found for these coordinates.')
        }
      } catch {
        setResolveError('Unable to resolve address right now.')
      }
    }

    applyLocation({
      address: nextAddress,
      latitude: nextLatitude,
      longitude: nextLongitude,
    })
  }, [applyLocation, resolveAddressByCoordinates, value.address])

  const detectCurrentLocation = useCallback((options?: { resolveAddress: boolean }) => {
    if (!navigator.geolocation) {
      return
    }

    setIsLocating(true)

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const nextLatitude = position.coords.latitude
        const nextLongitude = position.coords.longitude

        void applyCoordinates(nextLatitude, nextLongitude, options?.resolveAddress ?? false)
        setIsLocating(false)
      },
      () => {
        setIsLocating(false)
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      },
    )
  }, [applyCoordinates])

  useEffect(() => {
    if (hasAttemptedAutoLocateRef.current || hasValidCoordinates) {
      return
    }

    hasAttemptedAutoLocateRef.current = true
    detectCurrentLocation({ resolveAddress: true })
  }, [detectCurrentLocation, hasValidCoordinates])

  useEffect(() => {
    return () => {
      if (blurTimeoutRef.current !== null) {
        window.clearTimeout(blurTimeoutRef.current)
      }
    }
  }, [])

  useEffect(() => {
    const trimmedQuery = searchQuery.trim()
    if (!isSearchFocused || trimmedQuery.length < SEARCH_MIN_LENGTH) {
      setSuggestions([])
      setSearchError('')
      setIsLoadingSuggestions(false)
      return
    }

    const controller = new AbortController()

    const timeoutId = window.setTimeout(() => {
      const loadSuggestions = async () => {
        setIsLoadingSuggestions(true)
        setSearchError('')

        try {
          const stopLoaderRequest = wasRecentlyTriggeredByUserAction() ? startFullScreenLoaderRequest() : null
          const searchParams = new URLSearchParams({
            format: 'jsonv2',
            limit: '6',
            addressdetails: '1',
            q: trimmedQuery,
          })

          try {
            const response = await fetch(`https://nominatim.openstreetmap.org/search?${searchParams}`, {
              signal: controller.signal,
            })

            if (!response.ok) {
              throw new Error('Unable to fetch location suggestions.')
            }

            const payload = (await response.json()) as NominatimSearchResult[]
            const mappedSuggestions = payload
              .map((item) => ({
                address: item.display_name?.trim() ?? '',
                latitude: item.lat?.trim() ?? '',
                longitude: item.lon?.trim() ?? '',
              }))
              .filter((item) => item.address && item.latitude && item.longitude)

            setSuggestions(mappedSuggestions)
          } finally {
            stopLoaderRequest?.()
          }
        } catch (error) {
          if (isAbortError(error)) {
            return
          }

          setSuggestions([])
          setSearchError('Unable to load suggestions right now.')
        } finally {
          setIsLoadingSuggestions(false)
        }
      }

      void loadSuggestions()
    }, SEARCH_DEBOUNCE_MS)

    return () => {
      window.clearTimeout(timeoutId)
      controller.abort()
    }
  }, [isSearchFocused, searchQuery])

  const handleSuggestionSelect = (suggestion: LocationSuggestion) => {
    setSearchQuery(suggestion.address)
    setIsSearchFocused(false)
    applyLocation({
      address: suggestion.address,
      latitude: suggestion.latitude,
      longitude: suggestion.longitude,
    })
  }

  return (
    <div className={styles.root}>
      <div className={styles.searchGroup}>
        <label className={styles.fieldLabel} htmlFor={searchInputId}>
          Search Address *
        </label>
        <input
          id={searchInputId}
          type="text"
          value={searchQuery}
          onChange={(event) => {
            const nextQuery = event.target.value
            setSearchQuery(nextQuery)
            setSearchError('')
            applyLocation({
              ...value,
              address: nextQuery,
            })
          }}
          onFocus={() => {
            if (blurTimeoutRef.current !== null) {
              window.clearTimeout(blurTimeoutRef.current)
              blurTimeoutRef.current = null
            }
            setIsSearchFocused(true)
          }}
          onBlur={() => {
            if (isSelectingSuggestionRef.current) {
              return
            }

            blurTimeoutRef.current = window.setTimeout(() => {
              setIsSearchFocused(false)
              blurTimeoutRef.current = null
            }, 120)
          }}
          className={styles.searchInput}
          placeholder="Search for city, street, or landmark"
        />

        {shouldShowSuggestionsPanel ? (
          <div className={styles.suggestionPanel}>
            {isLoadingSuggestions ? (
              <p className={styles.suggestionState}>Loading suggestions...</p>
            ) : searchError ? (
              <p className={styles.suggestionError}>{searchError}</p>
            ) : suggestions.length > 0 ? (
              <ul className={styles.suggestionList}>
                {suggestions.map((suggestion) => (
                  <li key={`${suggestion.latitude}-${suggestion.longitude}-${suggestion.address}`}>
                    <button
                      type="button"
                      className={styles.suggestionButton}
                      onPointerDown={() => {
                        isSelectingSuggestionRef.current = true
                      }}
                      onPointerUp={() => {
                        isSelectingSuggestionRef.current = false
                      }}
                      onPointerCancel={() => {
                        isSelectingSuggestionRef.current = false
                      }}
                      onMouseDown={(event) => {
                        event.preventDefault()
                      }}
                      onClick={() => {
                        handleSuggestionSelect(suggestion)
                        isSelectingSuggestionRef.current = false
                      }}
                    >
                      {suggestion.address}
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className={styles.suggestionState}>Keep typing to see location suggestions.</p>
            )}
          </div>
        ) : null}
      </div>

      {showCoordinateInputs ? (
        <div className={styles.coordinateGrid}>
          <label className={styles.fieldLabel}>
            <span>Longitude *</span>
            <input
              type="number"
              step="any"
              value={value.longitude}
              onChange={(event) => {
                applyLocation({
                  ...value,
                  longitude: event.target.value,
                })
              }}
              className={styles.coordinateInput}
              placeholder="e.g. 121.0437000"
            />
          </label>

          <label className={styles.fieldLabel}>
            <span>Latitude *</span>
            <input
              type="number"
              step="any"
              value={value.latitude}
              onChange={(event) => {
                applyLocation({
                  ...value,
                  latitude: event.target.value,
                })
              }}
              className={styles.coordinateInput}
              placeholder="e.g. 14.6760000"
            />
          </label>
        </div>
      ) : null}

      {resolveError ? <p className={styles.resolveError}>{resolveError}</p> : null}

      <div className={styles.mapFrameWrap}>
        <MapContainer
          center={mapCenter}
          zoom={DEFAULT_ZOOM}
          scrollWheelZoom
          className={styles.mapCanvas}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          />
          <MapPickerEvents
            onMapSelect={(latitude, longitude) => {
              void applyCoordinates(latitude, longitude, true)
            }}
          />
          <MapViewportSync latitude={mapCenter[0]} longitude={mapCenter[1]} />

          <Marker
            draggable
            position={mapCenter}
            icon={redPinMarkerIcon}
            eventHandlers={{
              dragend: (event: LeafletEvent) => {
                const marker = event.target as L.Marker
                const nextPosition = marker.getLatLng()
                void applyCoordinates(nextPosition.lat, nextPosition.lng, true)
              },
            }}
          />
        </MapContainer>
        <button
          type="button"
          className={styles.mapLocateButton}
          onClick={() => {
            detectCurrentLocation({ resolveAddress: true })
          }}
          aria-label="Get current user location data"
          disabled={isLocating}
        >
          <FaCrosshairs aria-hidden="true" />
        </button>
      </div>
    </div>
  )
}

export default LocationPickerMap
