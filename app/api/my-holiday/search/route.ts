import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import prisma from '@/lib/db'

// Simple in-memory rate limiting for local development
type RateLimitEntry = { count: number; firstRequest: number }
const rateLimitMap = new Map<string, RateLimitEntry>()
const RATE_LIMIT_WINDOW = 60 * 1000 // 1 minute
const MAX_REQUESTS_PER_WINDOW = 10

// Cleanup old entries every 5 minutes
setInterval(() => {
  const now = Date.now()
  for (const [ip, entry] of rateLimitMap.entries()) {
    if (now - entry.firstRequest > RATE_LIMIT_WINDOW * 2) {
      rateLimitMap.delete(ip)
    }
  }
}, 5 * 60 * 1000)

const checkRateLimit = (clientIP: string): boolean => {
  const now = Date.now()
  const entry = rateLimitMap.get(clientIP)

  if (!entry) {
    rateLimitMap.set(clientIP, { count: 1, firstRequest: now })
    return true
  }

  // Reset window if expired
  if (now - entry.firstRequest > RATE_LIMIT_WINDOW) {
    entry.count = 1
    entry.firstRequest = now
    return true
  }

  // Check if limit exceeded
  if (entry.count >= MAX_REQUESTS_PER_WINDOW) {
    return false
  }

  entry.count++
  return true
}

type SearchPayload = {
  origin: string
  destination: string | null
  startDate: string
  endDate: string
  budget: number
  adults: number
  include: {
    flights: boolean
    hotels: boolean
    transfers: boolean
  }
  preferences: {
    maxFlightHours: number | null
    continent: string | null
    temperature: string | null
    activities: string[]
  } | null
}

type HolidayResult = {
  id: string
  destination: string
  total: number
  currency: 'EUR'
  rating: number
  weather: string
  flight: {
    airline: string
    duration: string
    stops: string
    outbound: string
    inbound: string
  }
  hotel: {
    name: string
    stars: number
    breakfastIncluded: boolean
    freeCancellation: boolean
  }
  transfer: {
    type: string
    estimatedCost: string
  }
  breakdown: {
    flights: number
    hotel: number
    transfers: number
  }
  source: 'live' | 'mock'
}

type LocationCandidate = {
  iataCode?: string
  name?: string
  detailedName?: string
  cityName?: string
}

const SearchSchema = z.object({
  origin: z.string().min(2),
  destination: z.string().nullable(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format, expected YYYY-MM-DD'),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format, expected YYYY-MM-DD'),
  budget: z.number().positive(),
  adults: z.number().int().min(1),
  include: z.object({
    flights: z.boolean(),
    hotels: z.boolean(),
    transfers: z.boolean(),
  }),
  preferences: z
    .object({
      maxFlightHours: z.number().nullable(),
      continent: z.string().nullable(),
      temperature: z.string().nullable(),
      activities: z.array(z.string()),
    })
    .nullable(),
})

const destinations = [
  'Lisabona, Portugalia',
  'Barcelona, Spania',
  'Roma, Italia',
  'Nisa, Franta',
  'Dubrovnik, Croatia',
  'Atena, Grecia',
  'Praga, Cehia',
  'Amsterdam, Olanda',
  'Porto, Portugalia',
  'Valencia, Spania',
]

const airlines = ['TAP Air Portugal', 'Vueling', 'Wizz Air', 'Ryanair', 'Aegean', 'Lufthansa']
const hotels = ['Hotel Aurora', 'Marina Suites', 'Casa Del Sol', 'Urban Nest', 'Seaside Bay']
const weatherTags = ['22°C si soare', '19°C partial innorat', '24°C briza calda', '18°C racoare']

const randomPick = <T,>(items: T[], index: number) => items[index % items.length]

const formatDuration = (iso: string) => {
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?/)
  if (!match) return iso
  const hours = match[1] ? Number(match[1]) : 0
  const minutes = match[2] ? Number(match[2]) : 0
  return `${hours}h ${minutes}m`
}

const formatDateTime = (value: string) => {
  const [date, time] = value.split('T')
  if (!date || !time) return value
  return `${date} · ${time.slice(0, 5)}`
}

const isIataCode = (value: string) => /^[A-Z]{3}$/.test(value)

const buildMockResults = (payload: SearchPayload): HolidayResult[] => {
  const baseBudget = payload.budget || 800
  const multiplier = payload.adults > 1 ? 1 + (payload.adults - 1) * 0.65 : 1

  return destinations.map((destination, index) => {
    const flights = Math.round(baseBudget * 0.32 * multiplier + index * 25)
    const hotel = Math.round(baseBudget * 0.5 * multiplier + index * 18)
    const transfers = Math.round(baseBudget * 0.08 * multiplier + index * 6)
    const total = flights + hotel + transfers

    return {
      id: `mock-${index}`,
      destination: payload.destination ? payload.destination : destination,
      total,
      currency: 'EUR',
      rating: 4 + (index % 10) * 0.05,
      weather: randomPick(weatherTags, index),
      flight: {
        airline: randomPick(airlines, index),
        duration: `${2 + (index % 4)}h ${15 + (index % 3) * 10}m`,
        stops: index % 3 === 0 ? 'Direct' : '1 escala',
        outbound: `${payload.startDate} · 08:${10 + index} - 12:${20 + index}`,
        inbound: `${payload.endDate} · 17:${15 + index} - 21:${10 + index}`,
      },
      hotel: {
        name: randomPick(hotels, index),
        stars: 4 + (index % 2),
        breakfastIncluded: index % 2 === 0,
        freeCancellation: index % 3 !== 0,
      },
      transfer: {
        type: index % 2 === 0 ? 'Shuttle bus' : 'Transport public',
        estimatedCost: `${8 + index} EUR`,
      },
      breakdown: {
        flights,
        hotel,
        transfers,
      },
      source: 'mock',
    }
  })
}

const persistSearch = async (payload: SearchPayload, results: HolidayResult[]) => {
  if (!process.env.DATABASE_URL) {
    return
  }

  try {
    await prisma.searchRequest.create({
      data: {
        origin: payload.origin,
        destination: payload.destination ?? null,
        startDate: new Date(payload.startDate),
        endDate: new Date(payload.endDate),
        budget: payload.budget,
        adults: payload.adults,
        includeJson: payload.include,
        preferences: payload.preferences ?? undefined,
        results: {
          create: results.map((result) => ({
            destination: result.destination,
            total: result.total,
            currency: result.currency,
            rating: result.rating,
            weather: result.weather,
            detailsJson: {
              flight: result.flight,
              hotel: result.hotel,
              transfer: result.transfer,
            },
            breakdownJson: result.breakdown,
            source: result.source,
          })),
        },
      },
    })
  } catch (error) {
    console.error('Failed to persist search', error)
  }
}

const AMADEUS_BASE_URL = process.env.AMADEUS_ENV === 'production'
  ? 'https://api.amadeus.com'
  : 'https://test.api.amadeus.com'

// For serverless environments, we don't cache tokens in-memory.
// In production, use Redis/KV store for token caching.
const getAmadeusToken = async () => {
  const clientId = process.env.AMADEUS_CLIENT_ID
  const clientSecret = process.env.AMADEUS_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    return null
  }

  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: clientId,
    client_secret: clientSecret,
  })

  try {
    const response = await fetch(`${AMADEUS_BASE_URL}/v1/security/oauth2/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
    })

    if (!response.ok) {
      console.error('Amadeus token request failed', await response.text())
      return null
    }

    const data = (await response.json()) as { access_token: string; expires_in: number }
    return data.access_token
  } catch (error) {
    console.error('Failed to fetch Amadeus token', error)
    return null
  }
}

const resolveLocationCode = async (token: string, value: string) => {
  const trimmed = value.trim().toUpperCase()
  if (isIataCode(trimmed)) {
    return { code: trimmed, label: trimmed }
  }

  const query = new URLSearchParams({
    subType: 'AIRPORT,CITY',
    keyword: trimmed,
  })

  const response = await fetch(`${AMADEUS_BASE_URL}/v1/reference-data/locations?${query.toString()}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })

  if (!response.ok) {
    console.error('Amadeus location lookup failed', await response.text())
    return null
  }

  const data = (await response.json()) as { data: LocationCandidate[] }
  const candidate = data.data?.[0]

  if (!candidate?.iataCode) {
    return null
  }

  const label = candidate.detailedName ?? candidate.name ?? candidate.cityName ?? candidate.iataCode
  return { code: candidate.iataCode, label }
}

// Popular destinations for discovery mode based on continent
const discoveryDestinations: Record<string, string[]> = {
  Europa: ['LIS', 'BCN', 'FCO', 'NCE', 'DBV', 'ATH', 'PRG', 'AMS'],
  Africa: ['CAI', 'CPT', 'JNB', 'TUN'],
  Asia: ['DXB', 'BKK', 'SIN', 'KUL'],
  'America de Sud': ['RIO', 'SCL', 'LIM', 'BOG']
}

const buildLiveResults = async (payload: SearchPayload): Promise<{ results: HolidayResult[]; usedDestination: string } | null> => {
  const token = await getAmadeusToken()
  if (!token) {
    return null
  }

  let destination: { code: string; label: string } | null = null

  if (payload.destination) {
    // Normal mode with specific destination
    destination = await resolveLocationCode(token, payload.destination)
    if (!destination) {
      return null
    }
  } else {
    // Discovery mode - pick a destination based on preferences
    const continent = payload.preferences?.continent || 'Europa'
    const destinations = discoveryDestinations[continent] || discoveryDestinations['Europa']
    const randomDestination = destinations[Math.floor(Math.random() * destinations.length)]
    destination = { code: randomDestination, label: randomDestination }
  }

  const query = new URLSearchParams({
    originLocationCode: payload.origin.toUpperCase(),
    destinationLocationCode: destination.code,
    departureDate: payload.startDate,
    returnDate: payload.endDate,
    adults: String(payload.adults),
    currencyCode: 'EUR',
    max: '5',
  })

  if (payload.budget > 0) {
    query.set('maxPrice', String(payload.budget))
  }

  const response = await fetch(`${AMADEUS_BASE_URL}/v2/shopping/flight-offers?${query.toString()}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })

  if (!response.ok) {
    console.error('Amadeus flight offers failed', await response.text())
    return null
  }

  const data = (await response.json()) as {
    data: Array<{
      id: string
      price: { total: string; currency: string }
      itineraries: Array<{
        duration: string
        segments: Array<{ departure: { at: string }; arrival: { at: string }; carrierCode: string }>
      }>
      validatingAirlineCodes?: string[]
    }>
  }

  const results: HolidayResult[] = data.data.map((offer, index) => {
    const outbound = offer.itineraries[0]
    const inbound = offer.itineraries[1]
    const outboundSegments = outbound?.segments ?? []
    const inboundSegments = inbound?.segments ?? []
    const stopsOut = outboundSegments.length > 0 ? outboundSegments.length - 1 : 0

    const flightPrice = Math.round(Number(offer.price.total))
    const hotelBudget = Math.max(0, Math.round((payload.budget - flightPrice) * 0.75))
    const transferBudget = Math.max(0, Math.round((payload.budget - flightPrice) * 0.1))
    const total = flightPrice + hotelBudget + transferBudget

    return {
      id: offer.id,
      destination: `${destination.label} (${destination.code})`,
      total,
      currency: 'EUR',
      rating: 3.9 + (index % 6) * 0.1,
      weather: randomPick(weatherTags, index),
      flight: {
        airline: offer.validatingAirlineCodes?.[0] ?? outboundSegments[0]?.carrierCode ?? 'Airline',
        duration: outbound?.duration ? formatDuration(outbound.duration) : 'N/A',
        stops: stopsOut === 0 ? 'Direct' : `${stopsOut} escala`,
        outbound: outboundSegments[0]?.departure?.at
          ? `${formatDateTime(outboundSegments[0].departure.at)} - ${formatDateTime(outboundSegments[outboundSegments.length - 1].arrival.at)}`
          : 'N/A',
        inbound: inboundSegments[0]?.departure?.at
          ? `${formatDateTime(inboundSegments[0].departure.at)} - ${formatDateTime(inboundSegments[inboundSegments.length - 1].arrival.at)}`
          : 'N/A',
      },
      hotel: {
        name: randomPick(hotels, index),
        stars: 4 + (index % 2),
        breakfastIncluded: index % 2 === 0,
        freeCancellation: index % 3 !== 0,
      },
      transfer: {
        type: index % 2 === 0 ? 'Shuttle bus' : 'Transport public',
        estimatedCost: `${8 + index} EUR`,
      },
      breakdown: {
        flights: flightPrice,
        hotel: hotelBudget,
        transfers: transferBudget,
      },
      source: 'live',
    }
  })

  return { results, usedDestination: destination.code }
}

export async function POST(request: NextRequest) {
  // Rate limiting check - get client IP from headers
  const forwarded = request.headers.get('x-forwarded-for')
  const clientIP = forwarded ? forwarded.split(',')[0] :
    request.headers.get('x-real-ip') ?? 'unknown'
  if (!checkRateLimit(clientIP)) {
    return NextResponse.json(
      { error: 'Rate limit exceeded. Maximum 10 requests per minute allowed.' },
      { status: 429 }
    )
  }

  const body = await request.json()
  const parsed = SearchSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json({
      error: 'Invalid payload',
      details: parsed.error.issues.map(e => `${e.path.join('.')}: ${e.message}`)
    }, { status: 400 })
  }

  const payload = parsed.data

  const missingKeys = [
    !process.env.AMADEUS_CLIENT_ID ? 'AMADEUS_CLIENT_ID' : null,
    !process.env.AMADEUS_CLIENT_SECRET ? 'AMADEUS_CLIENT_SECRET' : null,
  ].filter(Boolean) as string[]

  const liveEnabled = process.env.MY_HOLIDAY_ENABLE_LIVE === 'true'
  const livePayload = liveEnabled && missingKeys.length === 0
    ? await buildLiveResults(payload)
    : null

  const results = livePayload?.results ?? buildMockResults(payload)

  // Sort results by total price (ascending) as mentioned in README
  results.sort((a, b) => a.total - b.total)

  await persistSearch(payload, results)

  return NextResponse.json({
    results,
    meta: {
      mode: livePayload ? 'live' : 'mock',
      missingKeys,
      note: !payload.destination && livePayload
        ? `Discovery mode activ: destinație aleatorie ${livePayload.usedDestination} din continentul selectat.`
        : (!payload.destination && liveEnabled
          ? 'Discovery mode: folosind destinații sugerate pentru explorare.'
          : undefined),
      dataSourceWarning: livePayload
        ? 'ATENȚIE: Zborurile sunt date REALE din Amadeus. Hotelurile și transferurile sunt ESTIMATE.'
        : 'Toate datele sunt fictive (mock data) pentru demonstrație.',
    },
  })
}
