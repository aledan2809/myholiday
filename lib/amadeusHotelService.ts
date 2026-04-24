// Amadeus Hotel Search API integration
// Uses Hotel List + Hotel Offers APIs with fallback to local database

const AMADEUS_BASE_URL = process.env.AMADEUS_ENV === 'production'
  ? 'https://api.amadeus.com'
  : 'https://test.api.amadeus.com'

// --- Types ---

export type AmadeusHotelOffer = {
  hotelId: string
  name: string
  chainCode?: string
  cityCode: string
  latitude?: number
  longitude?: number
  stars?: number
  rating?: number
  pricePerNight: number
  totalPrice: number
  currency: string
  checkIn: string
  checkOut: string
  roomType?: string
  boardType?: string
  cancellationDeadline?: string
  freeCancellation: boolean
  offerId: string
  source: 'amadeus-live'
}

// Internal API response types
type AmadeusTokenResponse = {
  access_token: string
  expires_in: number
}

type AmadeusHotelListItem = {
  hotelId: string
  name: string
  chainCode?: string
  iataCode: string
  geoCode?: { latitude: number; longitude: number }
  rating?: number
}

type AmadeusHotelOfferResponse = {
  data: Array<{
    type: string
    hotel: {
      hotelId: string
      name: string
      chainCode?: string
      cityCode: string
      latitude?: number
      longitude?: number
      rating?: number
    }
    available: boolean
    offers: Array<{
      id: string
      checkInDate: string
      checkOutDate: string
      room?: {
        type?: string
        typeEstimated?: {
          category?: string
          beds?: number
          bedType?: string
        }
        description?: { text?: string }
      }
      price: {
        currency: string
        total: string
        base?: string
      }
      policies?: {
        cancellations?: Array<{
          deadline?: string
          amount?: string
          type?: string
        }>
        guarantee?: {
          acceptedPayments?: {
            methods?: string[]
          }
        }
      }
      boardType?: string
    }>
  }>
}

// --- Token Management ---

let tokenCache: { token: string; expiresAt: number } | null = null

const getAmadeusToken = async (): Promise<string | null> => {
  if (tokenCache && Date.now() < tokenCache.expiresAt) {
    return tokenCache.token
  }

  const clientId = process.env.AMADEUS_CLIENT_ID
  const clientSecret = process.env.AMADEUS_CLIENT_SECRET
  if (!clientId || !clientSecret) return null

  try {
    const response = await fetch(`${AMADEUS_BASE_URL}/v1/security/oauth2/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: clientId,
        client_secret: clientSecret,
      }),
    })

    if (!response.ok) {
      console.error('[AmadeusHotel] Token request failed:', response.status)
      return null
    }

    const data = (await response.json()) as AmadeusTokenResponse
    tokenCache = {
      token: data.access_token,
      expiresAt: Date.now() + (data.expires_in - 60) * 1000,
    }
    return data.access_token
  } catch (error) {
    console.error('[AmadeusHotel] Token fetch error:', error)
    return null
  }
}

// --- City Code Resolution ---

// Map Romanian/local city names to IATA codes for Amadeus
const cityToIataMap: Record<string, string> = {
  // Romanian city names (primary keys in hotels.json)
  lisabona: 'LIS', barcelona: 'BCN', roma: 'ROM', nisa: 'NCE',
  dubrovnik: 'DBV', atena: 'ATH', praga: 'PRG', amsterdam: 'AMS',
  porto: 'OPO', valencia: 'VLC', viena: 'VIE', berlin: 'BER',
  paris: 'PAR', milano: 'MIL', budapesta: 'BUD',
  cairo: 'CAI', 'cape town': 'CPT', johannesburg: 'JNB', tunis: 'TUN',
  dubai: 'DXB', bangkok: 'BKK', singapore: 'SIN', 'kuala lumpur': 'KUL',
  'rio de janeiro': 'GIG', santiago: 'SCL', lima: 'LIM', bogota: 'BOG',
  // English city names
  lisbon: 'LIS', rome: 'ROM', nice: 'NCE', athens: 'ATH',
  prague: 'PRG', vienna: 'VIE', milan: 'MIL', budapest: 'BUD',
  // Spanish/Portuguese/French variants
  lisboa: 'LIS', milão: 'MIL',
  'río de janeiro': 'GIG', bogotá: 'BOG',
  // Common abbreviated/alternate names
  capetown: 'CPT', 'kl': 'KUL', 'rio': 'GIG',
  // Country names → capital city codes (for discovery mode)
  portugalia: 'LIS', spania: 'BCN', italia: 'ROM', franta: 'PAR',
  croatia: 'DBV', grecia: 'ATH', cehia: 'PRG', olanda: 'AMS',
  austria: 'VIE', germania: 'BER', ungaria: 'BUD',
  egipt: 'CAI', 'africa de sud': 'CPT', tunisia: 'TUN',
  eau: 'DXB', thailanda: 'BKK', malaezia: 'KUL',
  brazilia: 'GIG', chile: 'SCL', peru: 'LIM', columbia: 'BOG',
  // IATA airport codes mapping to city codes
  fco: 'ROM', cia: 'ROM',         // Rome airports
  cdg: 'PAR', ory: 'PAR',         // Paris airports
  mxp: 'MIL', lin: 'MIL',         // Milan airports
  txl: 'BER', sxf: 'BER', ber: 'BER', // Berlin airports
  gru: 'GIG',                      // São Paulo → Rio area
  ams: 'AMS', ath: 'ATH', bcn: 'BCN', bkk: 'BKK', bog: 'BOG',
  bud: 'BUD', cai: 'CAI', cpt: 'CPT', dbv: 'DBV', dxb: 'DXB',
  gig: 'GIG', jnb: 'JNB', kul: 'KUL', lim: 'LIM', lis: 'LIS',
  nce: 'NCE', opo: 'OPO', prg: 'PRG', scl: 'SCL', sin: 'SIN',
  tun: 'TUN', vie: 'VIE', vlc: 'VLC',
}

// Fallback city codes: if primary code fails, try these alternatives
const cityCodeFallbacks: Record<string, string[]> = {
  ROM: ['FCO', 'CIA'], PAR: ['CDG', 'ORY'], MIL: ['MXP', 'LIN'],
  BER: ['TXL', 'SXF'], GIG: ['GRU', 'SDU'], BUD: ['BPS'],
  LIS: ['OPO'], BCN: ['VLC'], ATH: ['SKG'],
}

export const resolveCityCode = (destination: string): string | null => {
  // Check for IATA code in parentheses like "Rome (FCO)"
  const iataMatch = destination.match(/\(([A-Z]{3})\)/)
  if (iataMatch) return iataMatch[1]

  // Check if input is already an IATA code
  const trimmed = destination.trim().toUpperCase()
  if (/^[A-Z]{3}$/.test(trimmed)) return trimmed

  // Try mapping from city name
  const lower = destination.toLowerCase().trim()
  // Direct match
  if (cityToIataMap[lower]) return cityToIataMap[lower]

  // Try first part (before comma) for "City, Country" format
  const cityPart = lower.split(',')[0].trim()
  if (cityToIataMap[cityPart]) return cityToIataMap[cityPart]

  // Partial match
  for (const [key, code] of Object.entries(cityToIataMap)) {
    if (lower.includes(key) || key.includes(lower)) return code
  }

  return null
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
      // Retry on 429 (rate limit) or 5xx server errors
      if ((response.status === 429 || response.status >= 500) && attempt < maxRetries) {
        const delay = Math.min(1000 * Math.pow(2, attempt), 4000)
        console.warn(`[AmadeusHotel] ${response.status} on attempt ${attempt + 1}, retrying in ${delay}ms`)
        await new Promise(r => setTimeout(r, delay))
        continue
      }
      return response
    } catch (error) {
      lastError = error
      if (attempt < maxRetries) {
        const delay = Math.min(1000 * Math.pow(2, attempt), 4000)
        console.warn(`[AmadeusHotel] Network error on attempt ${attempt + 1}, retrying in ${delay}ms`)
        await new Promise(r => setTimeout(r, delay))
      }
    }
  }
  throw lastError
}

// --- Hotel List API ---

const fetchHotelsByCity = async (
  token: string,
  cityCode: string,
  radius = 20,
  limit = 20,
): Promise<AmadeusHotelListItem[]> => {
  const query = new URLSearchParams({
    cityCode,
    radius: String(radius),
    radiusUnit: 'KM',
    hotelSource: 'ALL',
  })

  try {
    const response = await fetchWithRetry(
      `${AMADEUS_BASE_URL}/v1/reference-data/locations/hotels/by-city?${query}`,
      { headers: { Authorization: `Bearer ${token}` } },
    )

    if (!response.ok) {
      console.error('[AmadeusHotel] Hotel list failed:', response.status, await response.text())
      return []
    }

    const data = (await response.json()) as { data: AmadeusHotelListItem[] }
    return (data.data || []).slice(0, limit)
  } catch (error) {
    console.error('[AmadeusHotel] Hotel list error:', error)
    return []
  }
}

// --- Hotel Offers API ---

const fetchHotelOffers = async (
  token: string,
  hotelIds: string[],
  checkIn: string,
  checkOut: string,
  adults = 1,
  currency = 'EUR',
): Promise<AmadeusHotelOfferResponse['data']> => {
  if (hotelIds.length === 0) return []

  // Amadeus limits to 50 hotel IDs per request
  const batchIds = hotelIds.slice(0, 50)

  const query = new URLSearchParams({
    hotelIds: batchIds.join(','),
    checkInDate: checkIn,
    checkOutDate: checkOut,
    adults: String(adults),
    currency,
    bestRateOnly: 'true',
  })

  try {
    const response = await fetchWithRetry(
      `${AMADEUS_BASE_URL}/v3/shopping/hotel-offers?${query}`,
      { headers: { Authorization: `Bearer ${token}` } },
    )

    if (!response.ok) {
      const errorText = await response.text()
      console.error('[AmadeusHotel] Hotel offers failed:', response.status, errorText)
      return []
    }

    const data = (await response.json()) as AmadeusHotelOfferResponse
    return data.data || []
  } catch (error) {
    console.error('[AmadeusHotel] Hotel offers error:', error)
    return []
  }
}

// --- Hotel Search Cache ---

type HotelCacheEntry = { data: AmadeusHotelResult[]; timestamp: number }
const hotelSearchCache = new Map<string, HotelCacheEntry>()
const HOTEL_CACHE_TTL = 15 * 60 * 1000 // 15 minutes

const buildCacheKey = (params: AmadeusHotelSearchParams): string =>
  `${params.destination}|${params.checkIn}|${params.checkOut}|${params.adults ?? 1}|${params.minStars ?? ''}|${params.maxBudgetPerNight ?? ''}`

// Cleanup stale cache entries every 10 minutes
setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of hotelSearchCache.entries()) {
    if (now - entry.timestamp > HOTEL_CACHE_TTL * 2) {
      hotelSearchCache.delete(key)
    }
  }
}, 10 * 60 * 1000)

// --- Main Search Function ---

export type AmadeusHotelSearchParams = {
  destination: string
  checkIn: string
  checkOut: string
  adults?: number
  maxBudgetPerNight?: number
  minStars?: number
  currency?: string
  limit?: number
}

export type AmadeusHotelResult = {
  hotelId: string
  name: string
  cityCode: string
  stars: number
  pricePerNight: number
  totalPrice: number
  currency: string
  latitude?: number
  longitude?: number
  roomType?: string
  boardType?: string
  freeCancellation: boolean
  cancellationDeadline?: string
  offerId: string
  source: 'amadeus-live'
}

export const searchAmadeusHotels = async (
  params: AmadeusHotelSearchParams,
): Promise<AmadeusHotelResult[]> => {
  // Check cache first
  const cacheKey = buildCacheKey(params)
  const cached = hotelSearchCache.get(cacheKey)
  if (cached && Date.now() - cached.timestamp < HOTEL_CACHE_TTL) {
    console.log('[AmadeusHotel] Cache hit for:', params.destination)
    return cached.data.slice(0, params.limit ?? 10)
  }

  const token = await getAmadeusToken()
  if (!token) {
    console.warn('[AmadeusHotel] No token available, skipping live hotel search')
    return []
  }

  const cityCode = resolveCityCode(params.destination)
  if (!cityCode) {
    console.warn('[AmadeusHotel] Could not resolve city code for:', params.destination)
    return []
  }

  // Step 1: Get hotel list for the city (try fallback codes if primary fails)
  let hotelList = await fetchHotelsByCity(token, cityCode, 30, params.limit ? params.limit + 10 : 30)
  if (hotelList.length === 0 && cityCodeFallbacks[cityCode]) {
    for (const fallback of cityCodeFallbacks[cityCode]) {
      hotelList = await fetchHotelsByCity(token, fallback, 30, params.limit ? params.limit + 10 : 30)
      if (hotelList.length > 0) break
    }
  }
  if (hotelList.length === 0) {
    console.warn('[AmadeusHotel] No hotels found for city:', cityCode)
    // Cache empty result to avoid repeated failed API calls
    hotelSearchCache.set(cacheKey, { data: [], timestamp: Date.now() })
    return []
  }

  console.log(`[AmadeusHotel] Found ${hotelList.length} hotels for ${cityCode}, fetching offers...`)

  const hotelIds = hotelList.map(h => h.hotelId)

  // Step 2: Get offers for those hotels (try in batches if first batch fails)
  let offers = await fetchHotelOffers(
    token,
    hotelIds.slice(0, 50),
    params.checkIn,
    params.checkOut,
    params.adults ?? 1,
    params.currency ?? 'EUR',
  )

  // If first batch returned nothing but we have more hotels, try next batch
  if (offers.length === 0 && hotelIds.length > 50) {
    offers = await fetchHotelOffers(
      token,
      hotelIds.slice(50, 100),
      params.checkIn,
      params.checkOut,
      params.adults ?? 1,
      params.currency ?? 'EUR',
    )
  }

  if (offers.length === 0) {
    console.warn('[AmadeusHotel] No offers returned for', hotelIds.length, 'hotels in', cityCode)
    hotelSearchCache.set(cacheKey, { data: [], timestamp: Date.now() })
    return []
  }

  console.log(`[AmadeusHotel] Got ${offers.length} offers for ${cityCode}`)

  // Step 3: Transform and filter results
  const nights = Math.max(1, Math.round(
    (new Date(params.checkOut).getTime() - new Date(params.checkIn).getTime()) / (1000 * 60 * 60 * 24),
  ))

  const results: AmadeusHotelResult[] = []

  for (const hotelOffer of offers) {
    if (!hotelOffer.available || !hotelOffer.offers?.length) continue

    const offer = hotelOffer.offers[0]
    const totalPrice = Math.round(Number(offer.price.total))
    const pricePerNight = Math.round(totalPrice / nights)

    // Budget filter
    if (params.maxBudgetPerNight && pricePerNight > params.maxBudgetPerNight * 1.5) continue

    // Stars filter
    const stars = hotelOffer.hotel.rating ? Number(hotelOffer.hotel.rating) : 0
    if (params.minStars && stars > 0 && stars < params.minStars) continue

    const cancellation = offer.policies?.cancellations?.[0]
    const freeCancellation = cancellation?.type === 'FULL_REFUND' ||
      (cancellation?.amount === '0' || cancellation?.amount === '0.00')

    results.push({
      hotelId: hotelOffer.hotel.hotelId,
      name: hotelOffer.hotel.name,
      cityCode: hotelOffer.hotel.cityCode,
      stars: stars || 3,
      pricePerNight,
      totalPrice,
      currency: offer.price.currency,
      latitude: hotelOffer.hotel.latitude,
      longitude: hotelOffer.hotel.longitude,
      roomType: offer.room?.typeEstimated?.category || offer.room?.type || undefined,
      boardType: offer.boardType || undefined,
      freeCancellation,
      cancellationDeadline: cancellation?.deadline,
      offerId: offer.id,
      source: 'amadeus-live',
    })
  }

  // Sort by price ascending
  results.sort((a, b) => a.pricePerNight - b.pricePerNight)

  // Cache the full results
  hotelSearchCache.set(cacheKey, { data: results, timestamp: Date.now() })

  return results.slice(0, params.limit ?? 10)
}

// --- Enrich live results with local DB metadata ---

import hotelsData from '@/data/hotels.json'

type LocalHotelEntry = {
  id: string
  name: string
  description: string
  pricePerNight: number
  rating: number
  reviewsCount: number
  distanceFromCenter: number
  facilities: string[]
  image: string
  images?: string[]
  location: { lat: number; lng: number; city: string; country: string }
  stars: number
  freeCancellation: boolean
  cancellationPolicy?: string
  checkInTime: string
  checkOutTime: string
  rooms?: Array<{ type: string; capacity: number; priceModifier: number }>
}

const localHotels = hotelsData.hotels as LocalHotelEntry[]

// Reverse map: IATA code → Romanian city name used in hotels.json
const iataToLocalCity: Record<string, string> = {
  LIS: 'lisabona', BCN: 'barcelona', ROM: 'roma', NCE: 'nisa',
  DBV: 'dubrovnik', ATH: 'atena', PRG: 'praga', AMS: 'amsterdam',
  OPO: 'porto', VLC: 'valencia', VIE: 'viena', BER: 'berlin',
  PAR: 'paris', MIL: 'milano', BUD: 'budapesta',
  CAI: 'cairo', CPT: 'cape town', JNB: 'johannesburg', TUN: 'tunis',
  DXB: 'dubai', BKK: 'bangkok', SIN: 'singapore', KUL: 'kuala lumpur',
  GIG: 'rio de janeiro', SCL: 'santiago', LIM: 'lima', BOG: 'bogota',
}

const findLocalHotelsByCity = (cityCode: string): LocalHotelEntry[] => {
  const localCity = iataToLocalCity[cityCode.toUpperCase()]
  if (!localCity) return []
  return localHotels.filter(h => h.location.city.toLowerCase() === localCity)
}

const nameTokens = (name: string): string[] =>
  name.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(t => t.length > 2)

const nameSimilarity = (a: string, b: string): number => {
  const tokensA = nameTokens(a)
  const tokensB = nameTokens(b)
  if (tokensA.length === 0 || tokensB.length === 0) return 0
  const matches = tokensA.filter(t => tokensB.some(tb => tb.includes(t) || t.includes(tb)))
  return matches.length / Math.max(tokensA.length, tokensB.length)
}

export type EnrichedAmadeusHotel = AmadeusHotelResult & {
  description: string
  rating: number
  reviewsCount: number
  distanceFromCenter: number
  facilities: string[]
  image: string
  images: string[]
  location: { lat: number; lng: number; city: string; country: string }
  cancellationPolicy: string
  checkInTime: string
  checkOutTime: string
  rooms: Array<{ type: string; capacity: number; priceModifier: number }>
  localMatchId: string | null
}

// Default rooms when local match doesn't have them
const DEFAULT_ROOMS = [{ type: 'Double', capacity: 2, priceModifier: 0 }]

/**
 * Enrich live Amadeus hotel results with metadata from local DB.
 * Tries fuzzy name matching first, then falls back to city-level defaults.
 */
export const enrichAmadeusHotels = (
  liveHotels: AmadeusHotelResult[],
): EnrichedAmadeusHotel[] => {
  if (liveHotels.length === 0) return []

  const cityCode = liveHotels[0].cityCode
  const cityHotels = findLocalHotelsByCity(cityCode)

  // Track which local hotels have been used to avoid duplicate matches
  const usedLocalIds = new Set<string>()

  return liveHotels.map((live) => {
    // Try to find a matching local hotel by name similarity
    let bestMatch: LocalHotelEntry | null = null
    let bestScore = 0

    for (const local of cityHotels) {
      if (usedLocalIds.has(local.id)) continue
      const score = nameSimilarity(live.name, local.name)
      if (score > bestScore && score >= 0.3) {
        bestScore = score
        bestMatch = local
      }
    }

    // If no name match, pick an unused local hotel from same city for image/metadata
    if (!bestMatch && cityHotels.length > 0) {
      const unused = cityHotels.find(h => !usedLocalIds.has(h.id))
      if (unused) bestMatch = unused
    }

    if (bestMatch) usedLocalIds.add(bestMatch.id)

    // Resolve city name for display
    const localCityName = iataToLocalCity[cityCode.toUpperCase()]
    const displayCity = localCityName
      ? localCityName.charAt(0).toUpperCase() + localCityName.slice(1)
      : cityCode

    // Build facilities list for non-matched hotels based on star rating
    const inferredFacilities = (() => {
      const base = ['WiFi']
      if (live.boardType === 'BREAKFAST' || live.boardType === 'FULL_BOARD' || live.boardType === 'HALF_BOARD') base.push('Breakfast')
      if (live.stars >= 3) base.push('Air Conditioning', 'Room Service')
      if (live.stars >= 4) base.push('Bar', 'Restaurant', 'Concierge')
      if (live.stars >= 5) base.push('Spa', 'Pool', 'Gym')
      return base
    })()

    // Merge: live pricing + local metadata
    return {
      ...live,
      description: bestMatch
        ? `${bestMatch.description} (Preț live Amadeus)`
        : `${live.name} — hotel ${live.stars}★ în ${displayCity}. Prețuri live Amadeus.${live.roomType ? ` Cameră: ${live.roomType}.` : ''}${live.boardType ? ` Masă: ${live.boardType}.` : ''}`,
      rating: bestMatch?.rating ?? Math.min(4.5, 3.5 + (live.stars - 3) * 0.3),
      reviewsCount: bestMatch?.reviewsCount ?? 0,
      distanceFromCenter: bestMatch?.distanceFromCenter ?? 0,
      facilities: bestMatch
        ? [...new Set([...bestMatch.facilities, ...(live.boardType === 'BREAKFAST' ? ['Breakfast'] : [])])]
        : inferredFacilities,
      image: bestMatch?.image ?? '',
      images: bestMatch?.images ?? [],
      location: bestMatch
        ? bestMatch.location
        : { lat: live.latitude ?? 0, lng: live.longitude ?? 0, city: displayCity, country: '' },
      cancellationPolicy: live.freeCancellation ? 'Anulare gratuită' : (bestMatch?.cancellationPolicy ?? 'Non-refundable'),
      checkInTime: bestMatch?.checkInTime ?? '14:00',
      checkOutTime: bestMatch?.checkOutTime ?? '11:00',
      rooms: bestMatch?.rooms ?? DEFAULT_ROOMS,
      localMatchId: bestMatch?.id ?? null,
    }
  })
}

// --- Search by specific hotel ID ---

/**
 * Fetch offers for a specific Amadeus hotel ID (e.g. "MCLISBON").
 * Unlike searchAmadeusHotels which resolves a city first, this directly
 * queries the Hotel Offers API with the known hotel ID.
 */
export const searchAmadeusHotelById = async (
  hotelId: string,
  checkIn: string,
  checkOut: string,
  adults = 1,
  currency = 'EUR',
): Promise<AmadeusHotelResult | null> => {
  const token = await getAmadeusToken()
  if (!token) return null

  try {
    // fetchHotelOffers already uses fetchWithRetry internally
    const offers = await fetchHotelOffers(token, [hotelId], checkIn, checkOut, adults, currency)
    if (offers.length === 0) return null

    const hotelOffer = offers.find(o => o.hotel.hotelId === hotelId && o.available && o.offers?.length > 0)
    if (!hotelOffer) return null

    const offer = hotelOffer.offers[0]
    const nights = Math.max(1, Math.round(
      (new Date(checkOut).getTime() - new Date(checkIn).getTime()) / (1000 * 60 * 60 * 24),
    ))
    const totalPrice = Math.round(Number(offer.price.total))
    const pricePerNight = Math.round(totalPrice / nights)

    const stars = hotelOffer.hotel.rating ? Number(hotelOffer.hotel.rating) : 0
    const cancellation = offer.policies?.cancellations?.[0]
    const freeCancellation = cancellation?.type === 'FULL_REFUND' ||
      (cancellation?.amount === '0' || cancellation?.amount === '0.00')

    return {
      hotelId: hotelOffer.hotel.hotelId,
      name: hotelOffer.hotel.name,
      cityCode: hotelOffer.hotel.cityCode,
      stars: stars || 3,
      pricePerNight,
      totalPrice,
      currency: offer.price.currency,
      latitude: hotelOffer.hotel.latitude,
      longitude: hotelOffer.hotel.longitude,
      roomType: offer.room?.typeEstimated?.category || offer.room?.type || undefined,
      boardType: offer.boardType || undefined,
      freeCancellation,
      cancellationDeadline: cancellation?.deadline,
      offerId: offer.id,
      source: 'amadeus-live',
    }
  } catch (error) {
    console.error('[AmadeusHotel] Hotel by ID fetch error:', hotelId, error)
    return null
  }
}

// --- Availability Check ---

export const isAmadeusHotelAvailable = (): boolean => {
  return !!(process.env.AMADEUS_CLIENT_ID && process.env.AMADEUS_CLIENT_SECRET)
}
