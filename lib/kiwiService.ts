const TEQUILA_BASE = 'https://api.tequila.kiwi.com'

type TequilaFlight = {
  id: string
  price: number
  airlines: string[]
  route: Array<{
    flyFrom: string
    flyTo: string
    local_departure: string
    local_arrival: string
    airline: string
  }>
  duration: { departure: number; return: number; total: number }
  fly_duration: string
  return_duration: string
  cityTo: string
  cityFrom: string
  countryTo: { name: string }
  deep_link: string
  booking_token: string
}

type TequilaSearchResponse = {
  data: TequilaFlight[]
  currency: string
}

type TequilaLocationResponse = {
  locations: Array<{
    id: string
    code: string
    name: string
    city: { name: string }
    country: { name: string }
  }>
}

export type KiwiFlightResult = {
  id: string
  price: number
  currency: string
  airline: string
  airlines: string[]
  duration: string
  returnDuration: string
  stops: number
  returnStops: number
  outbound: string
  inbound: string
  destination: string
  destinationCity: string
  destinationCountry: string
  deepLink: string
  bookingToken: string
}

const getApiKey = (): string | null => {
  const key = process.env.KIWI_API_KEY?.trim()
  return key && key.length > 0 ? key : null
}

export const isKiwiAvailable = (): boolean => getApiKey() !== null

const formatDurationMs = (ms: number): string => {
  const totalMinutes = Math.round(ms / 60)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  return `${hours}h ${minutes}m`
}

const formatLocalTime = (datetime: string): string => {
  // Tequila returns "2026-04-10T08:15:00.000Z" or similar
  const [date, time] = datetime.split('T')
  if (!date || !time) return datetime
  return `${date} · ${time.slice(0, 5)}`
}

export const resolveKiwiLocation = async (query: string): Promise<string | null> => {
  const apiKey = getApiKey()
  if (!apiKey) return null

  const trimmed = query.trim()
  // If already an IATA code, return as-is
  if (/^[A-Z]{3}$/.test(trimmed.toUpperCase())) {
    return trimmed.toUpperCase()
  }

  try {
    const params = new URLSearchParams({
      term: trimmed,
      location_types: 'airport,city',
      limit: '1',
    })

    const res = await fetch(`${TEQUILA_BASE}/locations/query?${params}`, {
      headers: { apikey: apiKey },
    })

    if (!res.ok) return null

    const data = (await res.json()) as TequilaLocationResponse
    return data.locations?.[0]?.code || null
  } catch (error) {
    console.error('Kiwi location lookup failed', error)
    return null
  }
}

export type KiwiSearchParams = {
  origin: string
  destination?: string | null
  dateFrom: string // DD/MM/YYYY
  dateTo: string   // DD/MM/YYYY
  returnFrom?: string // DD/MM/YYYY
  returnTo?: string   // DD/MM/YYYY
  adults: number
  maxPrice?: number
  maxStopovers?: number
  limit?: number
  continent?: string | null
}

// Convert YYYY-MM-DD to DD/MM/YYYY for Tequila API
const toTequilaDate = (isoDate: string): string => {
  const [y, m, d] = isoDate.split('-')
  return `${d}/${m}/${y}`
}

// Continent to Kiwi fly_to region codes
const continentToRegion: Record<string, string> = {
  Europa: 'europe',
  Europe: 'europe',
  Africa: 'africa',
  Asia: 'asia',
  'America de Nord': 'north-america',
  'North America': 'north-america',
  'America de Sud': 'south-america',
  'South America': 'south-america',
  Oceania: 'oceania',
  'Orientul Mijlociu': 'middle-east',
  'Middle East': 'middle-east',
}

export const searchKiwiFlights = async (params: KiwiSearchParams): Promise<KiwiFlightResult[]> => {
  const apiKey = getApiKey()
  if (!apiKey) return []

  try {
    // Resolve origin to IATA code (handles city names like "Bucharest" → "OTP")
    let flyFrom: string
    const originUpper = params.origin.trim().toUpperCase()
    if (/^[A-Z]{3}$/.test(originUpper)) {
      flyFrom = originUpper
    } else {
      const resolvedOrigin = await resolveKiwiLocation(params.origin)
      if (!resolvedOrigin) {
        console.error(`[Kiwi] Could not resolve origin: ${params.origin}`)
        return []
      }
      flyFrom = resolvedOrigin
    }

    let flyTo: string

    if (params.destination) {
      // Resolve destination to IATA code
      const resolved = await resolveKiwiLocation(params.destination)
      if (!resolved) return []
      flyTo = resolved
    } else {
      // Discovery mode: use continent region or default to Europe
      flyTo = continentToRegion[params.continent || 'Europa'] || 'europe'
    }

    // Departure on startDate, return on endDate
    const departureDateFrom = params.dateFrom
    const departureDateTo = params.dateFrom
    const returnDateFrom = params.returnFrom || params.dateTo || params.dateFrom
    const returnDateTo = params.returnTo || params.dateTo || params.dateFrom

    const searchParams = new URLSearchParams({
      fly_from: flyFrom,
      fly_to: flyTo,
      date_from: toTequilaDate(departureDateFrom),
      date_to: toTequilaDate(departureDateTo),
      return_from: toTequilaDate(returnDateFrom),
      return_to: toTequilaDate(returnDateTo),
      adults: String(params.adults),
      curr: 'EUR',
      limit: String(params.limit || 10),
      sort: 'price',
      flight_type: 'round',
      locale: 'en',
    })

    if (params.maxPrice && params.maxPrice > 0) {
      searchParams.set('price_to', String(params.maxPrice))
    }

    if (params.maxStopovers != null) {
      searchParams.set('max_stopovers', String(params.maxStopovers))
    }

    const res = await fetch(`${TEQUILA_BASE}/v2/search?${searchParams}`, {
      headers: { apikey: apiKey },
      signal: AbortSignal.timeout(15000),
    })

    if (!res.ok) {
      const errorText = await res.text().catch(() => 'unknown')
      console.error(`[Kiwi] Flight search failed: ${res.status} - ${errorText}`)
      return []
    }

    const data = (await res.json()) as TequilaSearchResponse

    if (!data.data || data.data.length === 0) {
      console.log('[Kiwi] No flights found for query:', flyTo)
      return []
    }

    return data.data.map((flight): KiwiFlightResult => {
      // Split routes into outbound and return using the turnaround city
      const midIndex = flight.route.findIndex((seg, i) =>
        i > 0 && seg.flyFrom === flight.cityTo
      )
      const splitAt = midIndex > 0 ? midIndex : Math.ceil(flight.route.length / 2)
      const outboundRoutes = flight.route.slice(0, splitAt)
      const returnRoutes = flight.route.slice(splitAt)

      const outboundStops = Math.max(0, outboundRoutes.length - 1)
      const returnStops = Math.max(0, returnRoutes.length - 1)
      const firstOut = outboundRoutes[0]
      const lastOut = outboundRoutes[outboundRoutes.length - 1]
      const firstRet = returnRoutes[0]
      const lastRet = returnRoutes[returnRoutes.length - 1]

      return {
        id: `kiwi-${flight.id}`,
        price: Math.round(flight.price),
        currency: 'EUR',
        airline: flight.airlines[0] || firstOut?.airline || 'Unknown',
        airlines: [...new Set(flight.airlines)],
        duration: formatDurationMs(flight.duration.departure),
        returnDuration: formatDurationMs(flight.duration.return),
        stops: outboundStops,
        returnStops,
        outbound: firstOut && lastOut
          ? `${formatLocalTime(firstOut.local_departure)} - ${formatLocalTime(lastOut.local_arrival)}`
          : 'N/A',
        inbound: firstRet && lastRet
          ? `${formatLocalTime(firstRet.local_departure)} - ${formatLocalTime(lastRet.local_arrival)}`
          : 'N/A',
        destination: `${flight.cityTo}, ${flight.countryTo.name}`,
        destinationCity: flight.cityTo,
        destinationCountry: flight.countryTo.name,
        deepLink: flight.deep_link,
        bookingToken: flight.booking_token,
      }
    })
  } catch (error) {
    console.error('Kiwi flight search error', error)
    return []
  }
}

// Discovery mode: search multiple destinations in parallel for richer results
export const searchKiwiMultiDestination = async (
  params: Omit<KiwiSearchParams, 'destination'> & { destinations: string[] },
): Promise<KiwiFlightResult[]> => {
  const searches = params.destinations.map(dest =>
    searchKiwiFlights({ ...params, destination: dest, limit: params.limit || 3 })
  )
  const results = await Promise.all(searches)
  const merged = results.flat()
  // Deduplicate by flight id and sort by price
  const seen = new Set<string>()
  return merged
    .filter(f => { if (seen.has(f.id)) return false; seen.add(f.id); return true })
    .sort((a, b) => a.price - b.price)
}

// Check flight booking availability via Tequila check_flights endpoint
export type BookingCheckResult = {
  available: boolean
  price: number | null
  currency: string
  invalidReason?: string
}

export const checkKiwiBooking = async (bookingToken: string, adults: number = 1): Promise<BookingCheckResult> => {
  const apiKey = getApiKey()
  if (!apiKey) return { available: false, price: null, currency: 'EUR', invalidReason: 'API key not configured' }

  try {
    const params = new URLSearchParams({
      booking_token: bookingToken,
      bnum: String(adults),
      pnum: String(adults),
      adults: String(adults),
      currency: 'EUR',
    })

    const res = await fetch(`${TEQUILA_BASE}/v2/booking/check_flights?${params}`, {
      headers: { apikey: apiKey },
      signal: AbortSignal.timeout(10000),
    })

    if (!res.ok) {
      return { available: false, price: null, currency: 'EUR', invalidReason: `API error: ${res.status}` }
    }

    const data = (await res.json()) as {
      flights_checked: boolean
      flights_invalid: boolean
      price_change: boolean
      total: number
      currency: string
    }

    return {
      available: data.flights_checked && !data.flights_invalid,
      price: data.total ?? null,
      currency: data.currency || 'EUR',
      invalidReason: data.flights_invalid ? 'Flight no longer available' : undefined,
    }
  } catch (error) {
    console.error('Kiwi booking check error', error)
    return { available: false, price: null, currency: 'EUR', invalidReason: 'Check request failed' }
  }
}
