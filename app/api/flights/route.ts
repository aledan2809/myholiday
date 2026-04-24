import { NextRequest, NextResponse } from 'next/server'
import { searchKiwiFlights, resolveKiwiLocation } from '@/lib/kiwiService'

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams

  const origin = params.get('origin')
  const destination = params.get('destination') || null
  const dateFrom = params.get('dateFrom')
  const dateTo = params.get('dateTo')
  const adults = Number(params.get('adults') || '1')
  const maxPrice = params.get('maxPrice') ? Number(params.get('maxPrice')) : undefined
  const continent = params.get('continent') || null
  const limit = Number(params.get('limit') || '5')

  if (!origin || !dateFrom || !dateTo) {
    return NextResponse.json(
      { error: 'Missing required parameters: origin, dateFrom, dateTo (YYYY-MM-DD)' },
      { status: 400 },
    )
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateFrom) || !/^\d{4}-\d{2}-\d{2}$/.test(dateTo)) {
    return NextResponse.json(
      { error: 'Dates must be in YYYY-MM-DD format' },
      { status: 400 },
    )
  }

  if (!process.env.KIWI_API_KEY) {
    return NextResponse.json(
      { error: 'KIWI_API_KEY is not configured', flights: [] },
      { status: 503 },
    )
  }

  const returnFrom = params.get('returnFrom') || null
  const returnTo = params.get('returnTo') || null

  const flights = await searchKiwiFlights({
    origin,
    destination,
    dateFrom,
    dateTo,
    returnFrom: returnFrom || undefined,
    returnTo: returnTo || undefined,
    adults,
    maxPrice,
    continent,
    limit,
  })

  return NextResponse.json({
    flights,
    total: flights.length,
    source: 'kiwi-tequila',
    params: { origin, destination, dateFrom, dateTo, adults },
  })
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { query } = body as { query?: string }

  if (!query) {
    return NextResponse.json(
      { error: 'Missing query parameter for location lookup' },
      { status: 400 },
    )
  }

  const iataCode = await resolveKiwiLocation(query)

  if (!iataCode) {
    return NextResponse.json({
      location: null,
      message: !process.env.KIWI_API_KEY
        ? 'KIWI_API_KEY not configured'
        : `Could not resolve location for "${query}"`,
    })
  }

  return NextResponse.json({
    location: { code: iataCode, query },
    source: 'kiwi-tequila',
  })
}
