import { NextRequest, NextResponse } from 'next/server'
import hotelsData from '@/data/hotels.json'
import { searchAmadeusHotelById, isAmadeusHotelAvailable, enrichAmadeusHotels } from '@/lib/amadeusHotelService'

// Rate limiting: 30 req/min per IP (detail endpoint can call Amadeus)
type RateLimitEntry = { count: number; firstRequest: number }
const detailRateLimitMap = new Map<string, RateLimitEntry>()
const DETAIL_RATE_WINDOW = 60 * 1000
const DETAIL_MAX_REQUESTS = 30
const DETAIL_MAX_MAP_SIZE = 10000

setInterval(() => {
  const now = Date.now()
  for (const [ip, entry] of detailRateLimitMap.entries()) {
    if (now - entry.firstRequest > DETAIL_RATE_WINDOW * 2) {
      detailRateLimitMap.delete(ip)
    }
  }
}, 5 * 60 * 1000)

const checkDetailRateLimit = (clientIP: string): boolean => {
  const now = Date.now()
  const entry = detailRateLimitMap.get(clientIP)
  if (!entry) {
    if (detailRateLimitMap.size >= DETAIL_MAX_MAP_SIZE) {
      const oldest = detailRateLimitMap.keys().next().value
      if (oldest) detailRateLimitMap.delete(oldest)
    }
    detailRateLimitMap.set(clientIP, { count: 1, firstRequest: now })
    return true
  }
  if (now - entry.firstRequest > DETAIL_RATE_WINDOW) {
    entry.count = 1
    entry.firstRequest = now
    return true
  }
  if (entry.count >= DETAIL_MAX_REQUESTS) return false
  entry.count++
  return true
}

type Hotel = {
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
  location: {
    lat: number
    lng: number
    city: string
    country: string
  }
  stars: number
  freeCancellation: boolean
  cancellationPolicy?: string
  checkInTime: string
  checkOutTime: string
  rooms?: Array<{ type: string; capacity: number; priceModifier: number }>
  availability?: {
    startDate: string
    endDate: string
    roomsLeft: number
  }
}

const allHotels: Hotel[] = hotelsData.hotels as Hotel[]

const getSeasonalMultiplier = (checkIn: string | null): number => {
  if (!checkIn) return 1.0
  const month = new Date(checkIn).getMonth()
  if (month >= 5 && month <= 7) return 1.25
  if (month === 3 || month === 4 || month === 8 || month === 9) return 1.1
  return 0.9
}

// Reverse IATA → city name for finding similar local hotels
const iataToCity: Record<string, string> = {
  LIS: 'lisabona', BCN: 'barcelona', ROM: 'roma', NCE: 'nisa',
  DBV: 'dubrovnik', ATH: 'atena', PRG: 'praga', AMS: 'amsterdam',
  OPO: 'porto', VLC: 'valencia', VIE: 'viena', BER: 'berlin',
  PAR: 'paris', MIL: 'milano', BUD: 'budapesta',
  CAI: 'cairo', CPT: 'cape town', JNB: 'johannesburg', TUN: 'tunis',
  DXB: 'dubai', BKK: 'bangkok', SIN: 'singapore', KUL: 'kuala lumpur',
  GIG: 'rio de janeiro', SCL: 'santiago', LIM: 'lima', BOG: 'bogota',
}

const findSimilarLocalHotels = (cityCode: string, excludeId: string, checkIn: string | null, limit = 4) => {
  const localCity = iataToCity[cityCode.toUpperCase()]
  const seasonMultiplier = getSeasonalMultiplier(checkIn)

  const candidates = localCity
    ? allHotels.filter(h => h.id !== excludeId && h.location.city.toLowerCase() === localCity)
    : []

  return candidates
    .sort((a, b) => b.rating - a.rating)
    .slice(0, limit)
    .map(h => ({
      id: h.id,
      name: h.name,
      pricePerNight: Math.round(h.pricePerNight * seasonMultiplier),
      rating: h.rating,
      stars: h.stars,
      image: h.image,
      distanceFromCenter: h.distanceFromCenter,
    }))
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const clientIP = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  if (!checkDetailRateLimit(clientIP)) {
    return NextResponse.json(
      { error: 'Rate limit exceeded. Maximum 30 requests per minute.' },
      { status: 429 },
    )
  }

  const { id } = await params
  const checkIn = request.nextUrl.searchParams.get('checkIn')
  const checkOut = request.nextUrl.searchParams.get('checkOut')
  const seasonMultiplier = getSeasonalMultiplier(checkIn)

  // Try local database first
  const localHotel = allHotels.find(h => h.id === id)

  if (localHotel) {
    const dynamicPrice = Math.round(localHotel.pricePerNight * seasonMultiplier)

    const similar = allHotels
      .filter(h => h.id !== localHotel.id && h.location.city === localHotel.location.city)
      .sort((a, b) => b.rating - a.rating)
      .slice(0, 4)
      .map(h => ({
        id: h.id,
        name: h.name,
        pricePerNight: Math.round(h.pricePerNight * seasonMultiplier),
        rating: h.rating,
        stars: h.stars,
        image: h.image,
        distanceFromCenter: h.distanceFromCenter,
      }))

    return NextResponse.json({
      hotel: {
        ...localHotel,
        images: localHotel.images ?? [],
        rooms: localHotel.rooms ?? [{ type: 'Double', capacity: 2, priceModifier: 0 }],
        cancellationPolicy: localHotel.cancellationPolicy ?? (localHotel.freeCancellation ? 'Anulare gratuita' : 'Non-refundable'),
        pricePerNight: dynamicPrice,
        basePrice: localHotel.pricePerNight,
        seasonalPricing: seasonMultiplier !== 1.0,
        seasonMultiplier: seasonMultiplier !== 1.0 ? seasonMultiplier : undefined,
      },
      similarHotels: similar,
      source: 'local-database',
    })
  }

  // Not in local DB — this might be an Amadeus hotel ID
  // Try to look it up via Amadeus if credentials are available
  // Generate default dates if not provided (next week, 3 nights)
  const effectiveCheckIn = checkIn || (() => {
    const d = new Date(); d.setDate(d.getDate() + 7)
    return d.toISOString().split('T')[0]
  })()
  const effectiveCheckOut = checkOut || (() => {
    const d = new Date(effectiveCheckIn); d.setDate(d.getDate() + 3)
    return d.toISOString().split('T')[0]
  })()

  if (isAmadeusHotelAvailable()) {
    try {
      // Directly fetch offers for this specific hotel ID from Amadeus
      const match = await searchAmadeusHotelById(id, effectiveCheckIn, effectiveCheckOut)

      if (match) {
        const enriched = enrichAmadeusHotels([match])
        const hotel = enriched[0]
        const similar = findSimilarLocalHotels(hotel.cityCode, id, effectiveCheckIn)

        return NextResponse.json({
          hotel: {
            id: hotel.hotelId,
            name: hotel.name,
            description: hotel.description,
            pricePerNight: hotel.pricePerNight,
            basePrice: hotel.pricePerNight,
            rating: hotel.rating,
            reviewsCount: hotel.reviewsCount,
            distanceFromCenter: hotel.distanceFromCenter,
            facilities: hotel.facilities,
            image: hotel.image,
            images: hotel.images,
            location: hotel.location,
            stars: hotel.stars,
            freeCancellation: hotel.freeCancellation,
            cancellationPolicy: hotel.cancellationPolicy,
            checkInTime: hotel.checkInTime,
            checkOutTime: hotel.checkOutTime,
            rooms: hotel.rooms,
            roomType: hotel.roomType,
            boardType: hotel.boardType,
            offerId: hotel.offerId,
            totalPrice: hotel.totalPrice,
            currency: hotel.currency,
            seasonalPricing: false,
          },
          similarHotels: similar,
          source: 'amadeus-live',
        })
      }
    } catch (error) {
      console.error('[HotelDetail] Amadeus lookup failed for', id, error)
    }
  }

  // If Amadeus lookup also failed, return helpful message
  if (/^[A-Z0-9]{6,12}$/.test(id)) {
    return NextResponse.json({
      error: 'Hotel not found. This appears to be a live hotel ID but no availability was returned from Amadeus.',
      hotelId: id,
      hint: 'The hotel may not have availability for the requested dates. Try different dates.',
    }, { status: 404 })
  }

  return NextResponse.json({ error: 'Hotel not found' }, { status: 404 })
}
