// Booking.com Hotel Search via RapidAPI
// Provides a second live hotel data source alongside Amadeus

const RAPIDAPI_HOST = 'booking-com.p.rapidapi.com'
const RAPIDAPI_BASE = `https://${RAPIDAPI_HOST}`

// --- Types ---

export type BookingHotelResult = {
  hotelId: string
  name: string
  cityName: string
  countryName: string
  latitude: number
  longitude: number
  stars: number
  rating: number
  reviewCount: number
  pricePerNight: number
  totalPrice: number
  currency: string
  checkIn: string
  checkOut: string
  freeCancellation: boolean
  photoUrl: string
  distanceFromCenter: number
  facilities: string[]
  roomType?: string
  source: 'booking-live'
}

type BookingDestinationResult = {
  dest_id: string
  dest_type: string
  city_name?: string
  country?: string
  label?: string
  latitude?: number
  longitude?: number
}

type BookingSearchResult = {
  hotel_id: number
  hotel_name: string
  city: string
  country_trans?: string
  latitude: number
  longitude: number
  class: number
  review_score: number
  review_nr: number
  min_total_price: number
  composite_price_breakdown?: {
    gross_amount_per_night?: { value: number; currency: string }
    gross_amount?: { value: number; currency: string }
  }
  currency_code?: string
  is_free_cancellable?: number
  max_photo_url?: string
  max_1440_photo_url?: string
  distance_to_cc?: number
  distance_to_cc_formatted?: string
  unit_configuration_label?: string
}

// --- API Key Check ---

export const isBookingComAvailable = (): boolean => {
  return !!process.env.RAPIDAPI_KEY
}

// --- Retry Helper ---

const fetchWithRetry = async (
  url: string,
  options: RequestInit,
  maxRetries = 2,
): Promise<Response> => {
  let lastError: unknown
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, options)
      if ((response.status === 429 || response.status >= 500) && attempt < maxRetries) {
        const delay = Math.min(1000 * Math.pow(2, attempt), 4000)
        console.warn(`[BookingCom] ${response.status} on attempt ${attempt + 1}, retrying in ${delay}ms`)
        await new Promise(r => setTimeout(r, delay))
        continue
      }
      return response
    } catch (error) {
      lastError = error
      if (attempt < maxRetries) {
        const delay = Math.min(1000 * Math.pow(2, attempt), 4000)
        console.warn(`[BookingCom] Network error on attempt ${attempt + 1}, retrying in ${delay}ms`)
        await new Promise(r => setTimeout(r, delay))
      }
    }
  }
  throw lastError
}

const rapidApiHeaders = (): Record<string, string> => ({
  'x-rapidapi-key': process.env.RAPIDAPI_KEY!,
  'x-rapidapi-host': RAPIDAPI_HOST,
})

// --- Destination Resolution ---

// Map city names to known Booking.com dest_ids to avoid lookup calls
const knownDestIds: Record<string, { dest_id: string; dest_type: string }> = {
  lisbon: { dest_id: '-2167973', dest_type: 'city' },
  barcelona: { dest_id: '-372490', dest_type: 'city' },
  rome: { dest_id: '-126693', dest_type: 'city' },
  nice: { dest_id: '-1454990', dest_type: 'city' },
  dubrovnik: { dest_id: '-89043', dest_type: 'city' },
  athens: { dest_id: '-814876', dest_type: 'city' },
  prague: { dest_id: '-553173', dest_type: 'city' },
  amsterdam: { dest_id: '-2140479', dest_type: 'city' },
  porto: { dest_id: '-2167025', dest_type: 'city' },
  valencia: { dest_id: '-406131', dest_type: 'city' },
  vienna: { dest_id: '-1995499', dest_type: 'city' },
  berlin: { dest_id: '-1746443', dest_type: 'city' },
  paris: { dest_id: '-1456928', dest_type: 'city' },
  milan: { dest_id: '-121726', dest_type: 'city' },
  budapest: { dest_id: '-850553', dest_type: 'city' },
  cairo: { dest_id: '-290692', dest_type: 'city' },
  'cape town': { dest_id: '-1217214', dest_type: 'city' },
  johannesburg: { dest_id: '-1222896', dest_type: 'city' },
  tunis: { dest_id: '-36758', dest_type: 'city' },
  dubai: { dest_id: '-782831', dest_type: 'city' },
  bangkok: { dest_id: '-3414440', dest_type: 'city' },
  singapore: { dest_id: '-73635', dest_type: 'city' },
  'kuala lumpur': { dest_id: '-2403010', dest_type: 'city' },
  'rio de janeiro': { dest_id: '-666610', dest_type: 'city' },
  santiago: { dest_id: '-599539', dest_type: 'city' },
  lima: { dest_id: '-394544', dest_type: 'city' },
  bogota: { dest_id: '-592318', dest_type: 'city' },
}

// Romanian → English city name mapping for lookup
const cityNameToEnglish: Record<string, string> = {
  lisabona: 'lisbon', roma: 'rome', nisa: 'nice', atena: 'athens',
  praga: 'prague', viena: 'vienna', milano: 'milan', budapesta: 'budapest',
}

const resolveDestination = async (
  destination: string,
): Promise<{ dest_id: string; dest_type: string } | null> => {
  const lower = destination.toLowerCase().split(',')[0].trim()
  const englishName = cityNameToEnglish[lower] || lower

  // Check known dest_ids first
  if (knownDestIds[englishName]) {
    return knownDestIds[englishName]
  }

  // Try API lookup
  const apiKey = process.env.RAPIDAPI_KEY
  if (!apiKey) return null

  try {
    const query = new URLSearchParams({
      name: englishName,
      locale: 'en-gb',
    })

    const response = await fetchWithRetry(
      `${RAPIDAPI_BASE}/v1/hotels/locations?${query}`,
      { headers: rapidApiHeaders() },
    )

    if (!response.ok) {
      console.error('[BookingCom] Destination lookup failed:', response.status)
      return null
    }

    const data = (await response.json()) as BookingDestinationResult[]
    const city = data.find(d => d.dest_type === 'city')
    if (city?.dest_id) {
      return { dest_id: city.dest_id, dest_type: city.dest_type }
    }
    if (data[0]?.dest_id) {
      return { dest_id: data[0].dest_id, dest_type: data[0].dest_type }
    }

    return null
  } catch (error) {
    console.error('[BookingCom] Destination lookup error:', error)
    return null
  }
}

// --- Search Cache ---

type SearchCacheEntry = { data: BookingHotelResult[]; timestamp: number }
const searchCache = new Map<string, SearchCacheEntry>()
const CACHE_TTL = 15 * 60 * 1000 // 15 minutes

setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of searchCache.entries()) {
    if (now - entry.timestamp > CACHE_TTL * 2) {
      searchCache.delete(key)
    }
  }
}, 10 * 60 * 1000)

// --- Main Search ---

export type BookingSearchParams = {
  destination: string
  checkIn: string
  checkOut: string
  adults?: number
  maxBudgetPerNight?: number
  minStars?: number
  currency?: string
  limit?: number
}

export const searchBookingHotels = async (
  params: BookingSearchParams,
): Promise<BookingHotelResult[]> => {
  const cacheKey = `${params.destination}|${params.checkIn}|${params.checkOut}|${params.adults ?? 1}`
  const cached = searchCache.get(cacheKey)
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    console.log('[BookingCom] Cache hit for:', params.destination)
    return cached.data.slice(0, params.limit ?? 10)
  }

  const apiKey = process.env.RAPIDAPI_KEY
  if (!apiKey) {
    console.warn('[BookingCom] No RAPIDAPI_KEY, skipping Booking.com search')
    return []
  }

  const dest = await resolveDestination(params.destination)
  if (!dest) {
    console.warn('[BookingCom] Could not resolve destination:', params.destination)
    searchCache.set(cacheKey, { data: [], timestamp: Date.now() })
    return []
  }

  try {
    const query = new URLSearchParams({
      dest_id: dest.dest_id,
      dest_type: dest.dest_type,
      checkin_date: params.checkIn,
      checkout_date: params.checkOut,
      adults_number: String(params.adults ?? 1),
      room_number: '1',
      order_by: 'popularity',
      filter_by_currency: params.currency ?? 'EUR',
      locale: 'en-gb',
      units: 'metric',
      page_number: '0',
      include_adjacency: 'true',
    })

    if (params.minStars) {
      query.set('categories_filter_ids', `class::${params.minStars}`)
    }

    const response = await fetchWithRetry(
      `${RAPIDAPI_BASE}/v1/hotels/search?${query}`,
      { headers: rapidApiHeaders() },
    )

    if (!response.ok) {
      const errorText = await response.text()
      console.error('[BookingCom] Search failed:', response.status, errorText)
      searchCache.set(cacheKey, { data: [], timestamp: Date.now() })
      return []
    }

    const data = (await response.json()) as { result?: BookingSearchResult[] }
    const rawResults = data.result || []

    if (rawResults.length === 0) {
      console.warn('[BookingCom] No results for:', params.destination)
      searchCache.set(cacheKey, { data: [], timestamp: Date.now() })
      return []
    }

    console.log(`[BookingCom] Found ${rawResults.length} hotels for ${params.destination}`)

    const nights = Math.max(1, Math.round(
      (new Date(params.checkOut).getTime() - new Date(params.checkIn).getTime()) / (1000 * 60 * 60 * 24),
    ))

    const results: BookingHotelResult[] = []

    for (const hotel of rawResults) {
      const totalPrice = hotel.min_total_price ||
        hotel.composite_price_breakdown?.gross_amount?.value || 0
      const pricePerNight = hotel.composite_price_breakdown?.gross_amount_per_night?.value ||
        Math.round(totalPrice / nights)

      if (totalPrice <= 0) continue

      // Budget filter
      if (params.maxBudgetPerNight && pricePerNight > params.maxBudgetPerNight * 1.5) continue

      const distance = hotel.distance_to_cc
        ? Math.round(hotel.distance_to_cc * 10) / 10
        : 0

      // Infer facilities from star rating
      const facilities: string[] = ['WiFi']
      if (hotel.class >= 3) facilities.push('Air Conditioning', 'Room Service')
      if (hotel.class >= 4) facilities.push('Bar', 'Restaurant')
      if (hotel.class >= 5) facilities.push('Spa', 'Pool', 'Gym')

      results.push({
        hotelId: `bcom-${hotel.hotel_id}`,
        name: hotel.hotel_name,
        cityName: hotel.city || params.destination.split(',')[0].trim(),
        countryName: hotel.country_trans || '',
        latitude: hotel.latitude,
        longitude: hotel.longitude,
        stars: hotel.class || 3,
        rating: hotel.review_score ? hotel.review_score / 2 : 3.5, // Booking uses 1-10, we use 1-5
        reviewCount: hotel.review_nr || 0,
        pricePerNight: Math.round(pricePerNight),
        totalPrice: Math.round(totalPrice),
        currency: hotel.currency_code || params.currency || 'EUR',
        checkIn: params.checkIn,
        checkOut: params.checkOut,
        freeCancellation: hotel.is_free_cancellable === 1,
        photoUrl: hotel.max_1440_photo_url || hotel.max_photo_url || '',
        distanceFromCenter: distance,
        facilities,
        roomType: hotel.unit_configuration_label || undefined,
        source: 'booking-live',
      })
    }

    // Sort by price
    results.sort((a, b) => a.pricePerNight - b.pricePerNight)

    searchCache.set(cacheKey, { data: results, timestamp: Date.now() })
    return results.slice(0, params.limit ?? 10)
  } catch (error) {
    console.error('[BookingCom] Search error:', error)
    searchCache.set(cacheKey, { data: [], timestamp: Date.now() })
    return []
  }
}

// --- Health Check ---

export const testBookingComConnection = async (): Promise<{
  success: boolean
  hotelCount: number
  error?: string
}> => {
  if (!isBookingComAvailable()) {
    return { success: false, hotelCount: 0, error: 'No RAPIDAPI_KEY configured' }
  }

  try {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 7)
    const dayAfter = new Date(tomorrow)
    dayAfter.setDate(dayAfter.getDate() + 3)

    const results = await searchBookingHotels({
      destination: 'Barcelona',
      checkIn: tomorrow.toISOString().split('T')[0],
      checkOut: dayAfter.toISOString().split('T')[0],
      limit: 3,
    })

    return {
      success: results.length > 0,
      hotelCount: results.length,
    }
  } catch (error) {
    return {
      success: false,
      hotelCount: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}
