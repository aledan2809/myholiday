import { NextRequest, NextResponse } from 'next/server'
import { getHotels, getSeasonalMultiplier } from '@/lib/hotelService'
import { isAmadeusHotelAvailable } from '@/lib/amadeusHotelService'
import { searchHotelsMultiProvider, type UnifiedHotelResult } from '@/lib/hotelProviders'

// Rate limiting: 30 req/min per IP
type RateLimitEntry = { count: number; firstRequest: number }
const hotelsRateLimitMap = new Map<string, RateLimitEntry>()
const HOTELS_RATE_WINDOW = 60 * 1000
const HOTELS_MAX_REQUESTS = 30

const HOTELS_MAX_MAP_SIZE = 10000

setInterval(() => {
  const now = Date.now()
  for (const [ip, entry] of hotelsRateLimitMap.entries()) {
    if (now - entry.firstRequest > HOTELS_RATE_WINDOW * 2) {
      hotelsRateLimitMap.delete(ip)
    }
  }
}, 5 * 60 * 1000)

const checkHotelsRateLimit = (clientIP: string): boolean => {
  const now = Date.now()
  const entry = hotelsRateLimitMap.get(clientIP)
  if (!entry) {
    if (hotelsRateLimitMap.size >= HOTELS_MAX_MAP_SIZE) {
      const oldest = hotelsRateLimitMap.keys().next().value
      if (oldest) hotelsRateLimitMap.delete(oldest)
    }
    hotelsRateLimitMap.set(clientIP, { count: 1, firstRequest: now })
    return true
  }
  if (now - entry.firstRequest > HOTELS_RATE_WINDOW) {
    entry.count = 1
    entry.firstRequest = now
    return true
  }
  if (entry.count >= HOTELS_MAX_REQUESTS) return false
  entry.count++
  return true
}

type HotelOutput = {
  id: string
  name: string
  description: string
  pricePerNight: number
  basePrice: number
  rating: number
  reviewsCount: number
  distanceFromCenter: number
  facilities: string[]
  image: string
  location: { lat: number; lng: number; city: string; country: string }
  stars: number
  freeCancellation: boolean
  checkInTime: string
  checkOutTime: string
  availability?: { startDate: string; endDate: string; roomsLeft: number }
  seasonalPricing: boolean
  source: string
  fetchedAt?: number
}

const unifiedToOutput = (h: UnifiedHotelResult, seasonMultiplier: number): HotelOutput => ({
  id: h.id,
  name: h.name,
  description: h.description,
  pricePerNight: h.pricePerNight,
  basePrice: h.pricePerNight,
  rating: h.rating,
  reviewsCount: h.reviewsCount,
  distanceFromCenter: h.distanceFromCenter,
  facilities: h.facilities,
  image: h.image,
  location: h.location,
  stars: h.stars,
  freeCancellation: h.freeCancellation,
  checkInTime: h.checkInTime,
  checkOutTime: h.checkOutTime,
  seasonalPricing: seasonMultiplier !== 1.0,
  source: h.source,
  fetchedAt: h.fetchedAt,
})

export async function GET(request: NextRequest) {
  const clientIP = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  if (!checkHotelsRateLimit(clientIP)) {
    return NextResponse.json(
      { error: 'Rate limit exceeded. Maximum 30 requests per minute.' },
      { status: 429 },
    )
  }

  const params = request.nextUrl.searchParams

  const city = params.get('city') || params.get('destination')
  const parseFiniteNumber = (val: string | null): number | null => {
    if (val == null) return null
    const n = Number(val)
    return Number.isFinite(n) ? n : null
  }
  const minPrice = parseFiniteNumber(params.get('minPrice'))
  const maxPrice = parseFiniteNumber(params.get('maxPrice'))
  const minRating = parseFiniteNumber(params.get('minRating'))
  const minStars = parseFiniteNumber(params.get('minStars'))
  const facilities = params.get('facilities')?.split(',').filter(Boolean) ?? []
  const sortByRaw = params.get('sortBy')
  const VALID_SORT_KEYS = ['price_asc', 'price_desc', 'rating_desc', 'distance_asc', 'reviews_desc']
  const sortBy = sortByRaw && VALID_SORT_KEYS.includes(sortByRaw) ? sortByRaw : null
  if (sortByRaw && !sortBy) {
    return NextResponse.json({ error: `Invalid sortBy value. Must be one of: ${VALID_SORT_KEYS.join(', ')}` }, { status: 400 })
  }
  if (minPrice != null && maxPrice != null && minPrice > maxPrice) {
    return NextResponse.json({ error: 'minPrice must be <= maxPrice' }, { status: 400 })
  }
  if (minPrice != null && minPrice < 0) {
    return NextResponse.json({ error: 'minPrice must be non-negative' }, { status: 400 })
  }
  const limit = Math.max(1, Math.min(params.get('limit') ? Number(params.get('limit')) : 20, 100))
  const offset = Math.max(0, params.get('offset') ? Number(params.get('offset')) : 0)
  const checkIn = params.get('checkIn')
  const checkOut = params.get('checkOut')
  const freeCancellation = params.get('freeCancellation')
  const liveExplicit = params.get('live')
  const liveMode = liveExplicit === 'true' || (liveExplicit !== 'false' && isAmadeusHotelAvailable())

  const seasonMultiplier = getSeasonalMultiplier(checkIn)

  // Use multi-provider search when live mode is enabled and city is provided
  let liveOutputs: HotelOutput[] = []
  let usedLiveSource = false

  if (liveMode && city) {
    const effectiveCheckIn = checkIn || (() => {
      const d = new Date(); d.setDate(d.getDate() + 7)
      return d.toISOString().split('T')[0]
    })()
    const effectiveCheckOut = checkOut || (() => {
      const d = new Date(effectiveCheckIn); d.setDate(d.getDate() + 3)
      return d.toISOString().split('T')[0]
    })()

    try {
      const { results, liveCount } = await searchHotelsMultiProvider({
        destination: city,
        checkIn: effectiveCheckIn,
        checkOut: effectiveCheckOut,
        adults: 1,
        maxBudgetPerNight: maxPrice ?? undefined,
        minStars: minStars ?? undefined,
        limit: limit + 10,
      })

      if (liveCount > 0) {
        // Take all live results from any provider (Amadeus + Booking.com)
        liveOutputs = results
          .filter(r => r.source === 'amadeus-live' || r.source === 'booking-live')
          .map(r => unifiedToOutput(r, seasonMultiplier))
        usedLiveSource = true
      }
    } catch (error) {
      console.error('[HotelsAPI] Multi-provider search failed, using local DB:', error)
    }
  }

  // Get local DB hotels with full filtering support
  const localData = getHotels({
    city,
    minPrice,
    maxPrice,
    minRating,
    minStars,
    facilities,
    freeCancellation: freeCancellation === 'true',
    checkIn,
    checkOut,
    sortBy,
    limit: limit + liveOutputs.length,
    offset: liveOutputs.length > 0 ? 0 : offset,
  })

  const localOutputs: HotelOutput[] = localData.hotels.map(h => ({
    id: h.id,
    name: h.name,
    description: h.description,
    pricePerNight: h.dynamicPrice ?? h.pricePerNight,
    basePrice: h.pricePerNight,
    rating: h.rating,
    reviewsCount: h.reviewsCount,
    distanceFromCenter: h.distanceFromCenter,
    facilities: h.facilities,
    image: h.image,
    location: h.location,
    stars: h.stars,
    freeCancellation: h.freeCancellation,
    checkInTime: h.checkInTime,
    checkOutTime: h.checkOutTime,
    availability: h.availability ? {
      ...h.availability,
      roomsLeft: h.dynamicRoomsLeft ?? h.availability.roomsLeft,
    } : undefined,
    seasonalPricing: h.seasonalPricing ?? false,
    source: 'local-database',
  }))

  // Deduplicate: remove local hotels that match live results by name similarity
  const liveNames = liveOutputs.map(h => h.name.toLowerCase())
  const dedupedLocal = localOutputs.filter(local => {
    const localName = local.name.toLowerCase()
    return !liveNames.some(liveName =>
      liveName === localName ||
      liveName.includes(localName) ||
      localName.includes(liveName)
    )
  })

  const combined = [...liveOutputs, ...dedupedLocal]

  // Apply filters to live results that weren't filtered by the local query
  const filtered = combined.filter(h => {
    if (minPrice != null && h.pricePerNight < minPrice) return false
    if (maxPrice != null && h.pricePerNight > maxPrice) return false
    if (minRating != null && h.rating < minRating) return false
    if (freeCancellation === 'true' && !h.freeCancellation) return false
    if (facilities.length > 0) {
      const required = facilities.map(f => f.toLowerCase())
      if (!required.every(rf => h.facilities.some(hf => hf.toLowerCase() === rf))) return false
    }
    return true
  })

  // Sort combined results
  switch (sortBy) {
    case 'price_asc':
      filtered.sort((a, b) => a.pricePerNight - b.pricePerNight)
      break
    case 'price_desc':
      filtered.sort((a, b) => b.pricePerNight - a.pricePerNight)
      break
    case 'rating_desc':
      filtered.sort((a, b) => b.rating - a.rating)
      break
    case 'distance_asc':
      filtered.sort((a, b) => a.distanceFromCenter - b.distanceFromCenter)
      break
    case 'reviews_desc':
      filtered.sort((a, b) => b.reviewsCount - a.reviewsCount)
      break
    default:
      if (usedLiveSource) break
      filtered.sort((a, b) => b.rating - a.rating)
  }

  const start = Math.max(0, liveOutputs.length > 0 ? 0 : offset)
  const page = filtered.slice(start, start + Math.max(1, limit))

  return NextResponse.json({
    hotels: page,
    total: filtered.length,
    showing: page.length,
    offset: start,
    hasMore: start + page.length < filtered.length,
    source: usedLiveSource ? 'mixed' : 'local-database',
    liveHotelsCount: liveOutputs.length,
    seasonMultiplier: seasonMultiplier !== 1.0 ? seasonMultiplier : undefined,
  })
}
