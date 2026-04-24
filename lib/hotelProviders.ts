/**
 * Hotel Provider Abstraction Layer
 *
 * Unified interface for searching hotels across multiple providers.
 * Currently supports:
 *   - Amadeus Hotel Offers API (live pricing)
 *   - Booking.com via RapidAPI (live pricing + reviews + photos)
 *   - Local JSON database (210+ hotels, 27 cities)
 *
 * Provider priority: Amadeus + Booking.com in parallel → Local DB fallback
 * Deduplication: fuzzy name matching across all providers
 */

import {
  searchAmadeusHotels,
  isAmadeusHotelAvailable,
  enrichAmadeusHotels,
  type AmadeusHotelSearchParams,
  type EnrichedAmadeusHotel,
} from './amadeusHotelService'
import {
  searchBookingHotels,
  isBookingComAvailable,
  type BookingHotelResult,
} from './bookingComService'
import {
  findHotelsForCity,
  pickHotelForResult,
  getSeasonalMultiplier,
  type HotelPreferences,
} from './hotelService'

// --- Unified Hotel Result ---

export type UnifiedHotelResult = {
  id: string
  name: string
  stars: number
  pricePerNight: number
  totalPrice: number
  rating: number
  reviewsCount: number
  distanceFromCenter: number
  facilities: string[]
  image: string
  images: string[]
  description: string
  location: { lat: number; lng: number; city: string; country: string }
  freeCancellation: boolean
  cancellationPolicy: string
  checkInTime: string
  checkOutTime: string
  breakfastIncluded: boolean
  roomType?: string
  boardType?: string
  source: 'amadeus-live' | 'booking-live' | 'local-database' | 'fallback'
  offerId?: string
  fetchedAt?: number // timestamp when data was fetched from live provider
}

// --- Provider Interface ---

export type HotelSearchParams = {
  destination: string
  checkIn: string
  checkOut: string
  adults: number
  maxBudgetPerNight?: number
  minStars?: number
  hotelPreferences?: HotelPreferences | null
  limit?: number
}

type ProviderStatus = {
  name: string
  available: boolean
  resultCount?: number
  reason?: string
}

// --- Fuzzy Name Matching ---

const normalizeHotelName = (name: string): string =>
  name.toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\b(hotel|resort|inn|suites?|residences?|boutique|the|a|an)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim()

const nameTokens = (name: string): string[] =>
  normalizeHotelName(name).split(' ').filter(t => t.length > 2)

const fuzzyNameMatch = (a: string, b: string): number => {
  const tokensA = nameTokens(a)
  const tokensB = nameTokens(b)
  if (tokensA.length === 0 || tokensB.length === 0) return 0

  let matches = 0
  for (const ta of tokensA) {
    for (const tb of tokensB) {
      if (ta === tb || ta.includes(tb) || tb.includes(ta)) {
        matches++
        break
      }
    }
  }
  return matches / Math.max(tokensA.length, tokensB.length)
}

/**
 * Deduplicate hotels across providers using fuzzy name matching.
 * Prefers live sources over local, and earlier entries over later ones.
 */
const deduplicateHotels = (hotels: UnifiedHotelResult[]): UnifiedHotelResult[] => {
  const result: UnifiedHotelResult[] = []
  const usedNames: string[] = []

  for (const hotel of hotels) {
    const normalized = normalizeHotelName(hotel.name)
    const isDuplicate = usedNames.some(existing => {
      if (existing === normalized) return true
      return fuzzyNameMatch(hotel.name, existing) >= 0.5
    })

    if (!isDuplicate) {
      result.push(hotel)
      usedNames.push(normalized)
    }
  }

  return result
}

// --- Provider: Amadeus ---

const searchAmadeus = async (params: HotelSearchParams): Promise<UnifiedHotelResult[]> => {
  if (!isAmadeusHotelAvailable()) return []

  const amadeusParams: AmadeusHotelSearchParams = {
    destination: params.destination,
    checkIn: params.checkIn,
    checkOut: params.checkOut,
    adults: params.adults,
    maxBudgetPerNight: params.maxBudgetPerNight,
    minStars: params.minStars,
    limit: params.limit ?? 10,
  }

  const raw = await searchAmadeusHotels(amadeusParams)
  if (raw.length === 0) return []

  const enriched = enrichAmadeusHotels(raw)
  return enriched.map(amadeusToUnified)
}

const amadeusToUnified = (h: EnrichedAmadeusHotel): UnifiedHotelResult => ({
  id: h.hotelId || h.localMatchId || h.offerId,
  name: h.name,
  stars: h.stars,
  pricePerNight: h.pricePerNight,
  totalPrice: h.totalPrice,
  rating: h.rating,
  reviewsCount: h.reviewsCount,
  distanceFromCenter: h.distanceFromCenter,
  facilities: h.facilities,
  image: h.image,
  images: h.images,
  description: h.description,
  location: h.location,
  freeCancellation: h.freeCancellation,
  cancellationPolicy: h.cancellationPolicy,
  checkInTime: h.checkInTime,
  checkOutTime: h.checkOutTime,
  breakfastIncluded: h.facilities.some(f => f.toLowerCase() === 'breakfast'),
  roomType: h.roomType,
  boardType: h.boardType,
  source: 'amadeus-live',
  offerId: h.offerId,
  fetchedAt: Date.now(),
})

// --- Provider: Booking.com ---

const searchBooking = async (params: HotelSearchParams): Promise<UnifiedHotelResult[]> => {
  if (!isBookingComAvailable()) return []

  const raw = await searchBookingHotels({
    destination: params.destination,
    checkIn: params.checkIn,
    checkOut: params.checkOut,
    adults: params.adults,
    maxBudgetPerNight: params.maxBudgetPerNight,
    minStars: params.minStars,
    limit: params.limit ?? 10,
  })

  return raw.map(bookingToUnified)
}

const bookingToUnified = (h: BookingHotelResult): UnifiedHotelResult => ({
  id: h.hotelId,
  name: h.name,
  stars: h.stars,
  pricePerNight: h.pricePerNight,
  totalPrice: h.totalPrice,
  rating: h.rating,
  reviewsCount: h.reviewCount,
  distanceFromCenter: h.distanceFromCenter,
  facilities: h.facilities,
  image: h.photoUrl,
  images: h.photoUrl ? [h.photoUrl] : [],
  description: `${h.name} — hotel ${h.stars}★ în ${h.cityName}. Prețuri live Booking.com.${h.roomType ? ` Cameră: ${h.roomType}.` : ''}`,
  location: {
    lat: h.latitude,
    lng: h.longitude,
    city: h.cityName,
    country: h.countryName,
  },
  freeCancellation: h.freeCancellation,
  cancellationPolicy: h.freeCancellation ? 'Anulare gratuită' : 'Non-refundable',
  checkInTime: '14:00',
  checkOutTime: '11:00',
  breakfastIncluded: false,
  roomType: h.roomType,
  source: 'booking-live',
  fetchedAt: Date.now(),
})

// --- Provider: Local Database ---

const searchLocal = (params: HotelSearchParams): UnifiedHotelResult[] => {
  const nights = Math.max(1, Math.round(
    (new Date(params.checkOut).getTime() - new Date(params.checkIn).getTime()) / (1000 * 60 * 60 * 24),
  ))
  const maxPerNight = params.maxBudgetPerNight ?? 999

  const candidates = findHotelsForCity(
    params.destination,
    maxPerNight,
    params.hotelPreferences,
    params.checkIn,
    params.checkOut,
  )

  const seasonMultiplier = getSeasonalMultiplier(params.checkIn)
  const limit = params.limit ?? 10

  return candidates.slice(0, limit).map((hotel) => {
    const dynamicPrice = Math.round(hotel.pricePerNight * seasonMultiplier)
    return {
      id: hotel.id,
      name: hotel.name,
      stars: hotel.stars,
      pricePerNight: dynamicPrice,
      totalPrice: dynamicPrice * nights,
      rating: hotel.rating,
      reviewsCount: hotel.reviewsCount,
      distanceFromCenter: hotel.distanceFromCenter,
      facilities: hotel.facilities,
      image: hotel.image,
      images: hotel.images,
      description: hotel.description,
      location: hotel.location,
      freeCancellation: hotel.freeCancellation,
      cancellationPolicy: hotel.cancellationPolicy,
      checkInTime: hotel.checkInTime,
      checkOutTime: hotel.checkOutTime,
      breakfastIncluded: hotel.facilities.some(f => f.toLowerCase() === 'breakfast'),
      source: 'local-database' as const,
    }
  })
}

// --- Aggregated Search ---

/**
 * Search hotels across all available providers.
 * Amadeus and Booking.com are searched in parallel.
 * Results are deduped using fuzzy name matching.
 * Live results first, then local DB results.
 */
export const searchHotelsMultiProvider = async (
  params: HotelSearchParams,
): Promise<{
  results: UnifiedHotelResult[]
  liveCount: number
  localCount: number
  providers: ProviderStatus[]
  fetchedAt: number
}> => {
  const providers: ProviderStatus[] = []
  const fetchedAt = Date.now()

  // Search live providers in parallel
  const livePromises: Promise<{ name: string; results: UnifiedHotelResult[] }>[] = []

  if (isAmadeusHotelAvailable()) {
    livePromises.push(
      searchAmadeus(params)
        .then(results => {
          providers.push({ name: 'Amadeus', available: true, resultCount: results.length })
          return { name: 'Amadeus', results }
        })
        .catch(error => {
          console.error('[HotelProviders] Amadeus search failed:', error)
          providers.push({ name: 'Amadeus', available: false, reason: 'API error' })
          return { name: 'Amadeus', results: [] }
        })
    )
  } else {
    providers.push({ name: 'Amadeus', available: false, reason: 'No credentials' })
  }

  if (isBookingComAvailable()) {
    livePromises.push(
      searchBooking(params)
        .then(results => {
          providers.push({ name: 'Booking.com', available: true, resultCount: results.length })
          return { name: 'Booking.com', results }
        })
        .catch(error => {
          console.error('[HotelProviders] Booking.com search failed:', error)
          providers.push({ name: 'Booking.com', available: false, reason: 'API error' })
          return { name: 'Booking.com', results: [] }
        })
    )
  } else {
    providers.push({ name: 'Booking.com', available: false, reason: 'No RAPIDAPI_KEY' })
  }

  const liveResponses = await Promise.all(livePromises)
  const allLiveResults: UnifiedHotelResult[] = []
  for (const response of liveResponses) {
    allLiveResults.push(...response.results)
  }

  // Deduplicate live results across providers (Amadeus + Booking.com may overlap)
  const dedupedLive = deduplicateHotels(allLiveResults)

  // Local DB (always available)
  const localResults = searchLocal(params)
  providers.push({ name: 'Local Database', available: true, resultCount: localResults.length })

  // Deduplicate local against live results
  const dedupedLocal = localResults.filter(local => {
    return !dedupedLive.some(live => fuzzyNameMatch(live.name, local.name) >= 0.4)
  })

  // Merge: live first, then local
  const combined = [...dedupedLive, ...dedupedLocal]

  return {
    results: combined.slice(0, params.limit ?? 20),
    liveCount: dedupedLive.length,
    localCount: dedupedLocal.length,
    providers,
    fetchedAt,
  }
}

/**
 * Pick a single hotel for a search result (used in main search route).
 * Tries live provider first, falls back to local DB.
 */
export const pickHotelForSearchResult = async (
  destination: string,
  nights: number,
  hotelBudget: number,
  index: number,
  checkIn: string,
  checkOut: string,
  adults: number,
  hotelPreferences?: HotelPreferences | null,
  liveHotelCache?: Map<string, UnifiedHotelResult[]>,
): Promise<UnifiedHotelResult> => {
  const destKey = destination.toLowerCase().split(',')[0].trim()

  // Check cache for pre-fetched live results
  if (liveHotelCache) {
    const cached = liveHotelCache.get(destKey)
    if (cached && cached.length > 0) {
      return cached[index % cached.length]
    }
  }

  // Fallback to local DB
  const picked = pickHotelForResult(destination, nights, hotelBudget, index, hotelPreferences, checkIn, checkOut)

  return {
    id: picked.id ?? `fallback-${index}`,
    name: picked.name,
    stars: picked.stars,
    pricePerNight: picked.pricePerNight,
    totalPrice: picked.totalCost,
    rating: picked.rating,
    reviewsCount: 0,
    distanceFromCenter: picked.distanceFromCenter,
    facilities: picked.facilities,
    image: picked.image,
    images: picked.images,
    description: picked.description,
    location: { lat: 0, lng: 0, city: destination.split(',')[0].trim(), country: '' },
    freeCancellation: picked.freeCancellation,
    cancellationPolicy: picked.cancellationPolicy,
    checkInTime: picked.checkInTime,
    checkOutTime: picked.checkOutTime,
    breakfastIncluded: picked.breakfastIncluded,
    source: picked.source,
  }
}

/**
 * Pre-fetch live hotels for multiple destinations in parallel.
 * Uses all available live providers (Amadeus + Booking.com).
 * Returns a Map of destination → UnifiedHotelResult[] for quick lookup.
 */
export const prefetchLiveHotels = async (
  destinations: string[],
  checkIn: string,
  checkOut: string,
  adults: number,
  maxBudgetPerNight?: number,
  minStars?: number,
  limit = 10,
): Promise<Map<string, UnifiedHotelResult[]>> => {
  const cache = new Map<string, UnifiedHotelResult[]>()

  const hasAnyLive = isAmadeusHotelAvailable() || isBookingComAvailable()
  if (!hasAnyLive) return cache

  const uniqueDests = [...new Set(destinations.map(d => d.split(',')[0].trim()))]
  const destsToSearch = uniqueDests.slice(0, 8)

  console.log(`[HotelProviders] Prefetching live hotels for ${destsToSearch.length} destinations`)

  await Promise.all(
    destsToSearch.map(async (dest) => {
      try {
        const allResults: UnifiedHotelResult[] = []

        // Search both providers in parallel for each destination
        const promises: Promise<UnifiedHotelResult[]>[] = []

        if (isAmadeusHotelAvailable()) {
          promises.push(
            searchAmadeus({ destination: dest, checkIn, checkOut, adults, maxBudgetPerNight, minStars, limit })
              .catch(() => [])
          )
        }

        if (isBookingComAvailable()) {
          promises.push(
            searchBooking({ destination: dest, checkIn, checkOut, adults, maxBudgetPerNight, minStars, limit })
              .catch(() => [])
          )
        }

        const responses = await Promise.all(promises)
        for (const results of responses) {
          allResults.push(...results)
        }

        if (allResults.length > 0) {
          const deduped = deduplicateHotels(allResults)
          cache.set(dest.toLowerCase(), deduped)
        }
      } catch (error) {
        console.error(`[HotelProviders] Prefetch failed for ${dest}:`, error)
      }
    }),
  )

  console.log(`[HotelProviders] Prefetched live hotels for ${cache.size}/${destsToSearch.length} destinations`)
  return cache
}
