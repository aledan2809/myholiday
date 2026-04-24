import { NextRequest, NextResponse } from 'next/server'
import { isAmadeusHotelAvailable, searchAmadeusHotels, resolveCityCode } from '@/lib/amadeusHotelService'
import { isBookingComAvailable, testBookingComConnection } from '@/lib/bookingComService'
import { getTotalHotels } from '@/lib/hotelService'

// Rate limiting: 5 req/min per IP (status endpoint makes external API test calls)
type RateLimitEntry = { count: number; firstRequest: number }
const statusRateLimitMap = new Map<string, RateLimitEntry>()
const STATUS_RATE_WINDOW = 60 * 1000
const STATUS_MAX_REQUESTS = 5
const STATUS_MAX_MAP_SIZE = 10000

setInterval(() => {
  const now = Date.now()
  for (const [ip, entry] of statusRateLimitMap.entries()) {
    if (now - entry.firstRequest > STATUS_RATE_WINDOW * 2) {
      statusRateLimitMap.delete(ip)
    }
  }
}, 5 * 60 * 1000)

const checkStatusRateLimit = (clientIP: string): boolean => {
  const now = Date.now()
  const entry = statusRateLimitMap.get(clientIP)
  if (!entry) {
    if (statusRateLimitMap.size >= STATUS_MAX_MAP_SIZE) {
      const oldest = statusRateLimitMap.keys().next().value
      if (oldest) statusRateLimitMap.delete(oldest)
    }
    statusRateLimitMap.set(clientIP, { count: 1, firstRequest: now })
    return true
  }
  if (now - entry.firstRequest > STATUS_RATE_WINDOW) {
    entry.count = 1
    entry.firstRequest = now
    return true
  }
  if (entry.count >= STATUS_MAX_REQUESTS) return false
  entry.count++
  return true
}

export async function GET(request: NextRequest) {
  const clientIP = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  if (!checkStatusRateLimit(clientIP)) {
    return NextResponse.json(
      { error: 'Rate limit exceeded. Maximum 5 requests per minute.' },
      { status: 429 },
    )
  }
  const amadeusAvailable = isAmadeusHotelAvailable()
  const bookingAvailable = isBookingComAvailable()
  const localHotelCount = getTotalHotels()

  // Test Amadeus connectivity
  let amadeusTest: { success: boolean; hotelCount: number; cityCode: string | null; error?: string } | null = null

  if (amadeusAvailable) {
    const testCity = 'Barcelona'
    const cityCode = resolveCityCode(testCity)
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 7)
    const dayAfter = new Date(tomorrow)
    dayAfter.setDate(dayAfter.getDate() + 3)

    const checkIn = tomorrow.toISOString().split('T')[0]
    const checkOut = dayAfter.toISOString().split('T')[0]

    try {
      const results = await searchAmadeusHotels({
        destination: testCity,
        checkIn,
        checkOut,
        limit: 3,
      })
      amadeusTest = {
        success: results.length > 0,
        hotelCount: results.length,
        cityCode,
      }
    } catch (error) {
      amadeusTest = {
        success: false,
        hotelCount: 0,
        cityCode,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  // Test Booking.com connectivity
  let bookingTest: { success: boolean; hotelCount: number; error?: string } | null = null

  if (bookingAvailable) {
    try {
      bookingTest = await testBookingComConnection()
    } catch (error) {
      bookingTest = {
        success: false,
        hotelCount: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  const liveProvidersActive = [
    amadeusTest?.success && 'Amadeus',
    bookingTest?.success && 'Booking.com',
  ].filter(Boolean)

  return NextResponse.json({
    providers: {
      amadeus: {
        configured: amadeusAvailable,
        environment: process.env.AMADEUS_ENV === 'production' ? 'production' : 'test',
        test: amadeusTest,
      },
      booking: {
        configured: bookingAvailable,
        test: bookingTest,
      },
      localDatabase: {
        available: true,
        hotelCount: localHotelCount,
      },
    },
    liveEnabled: process.env.MY_HOLIDAY_ENABLE_LIVE === 'true',
    liveProvidersActive: liveProvidersActive.length,
    recommendation: liveProvidersActive.length === 0
      ? 'No live hotel providers active. Set AMADEUS_CLIENT_ID+SECRET or RAPIDAPI_KEY for live data.'
      : liveProvidersActive.length === 1
        ? `${liveProvidersActive[0]} active. Add ${liveProvidersActive[0] === 'Amadeus' ? 'RAPIDAPI_KEY for Booking.com' : 'AMADEUS credentials'} for redundancy.`
        : `Both Amadeus and Booking.com active — full live hotel coverage.`,
  })
}
