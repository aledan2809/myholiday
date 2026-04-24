import { NextRequest, NextResponse } from 'next/server'
import { scoreDestinations, getSeasonIndex } from '@/lib/destinationMetadata'
import { searchKiwiFlights, isKiwiAvailable } from '@/lib/kiwiService'
import { countHotelsForCity, findHotelsForCity, getSeasonalMultiplier } from '@/lib/hotelService'

// Rate limiting: 20 req/min per IP (explore is heavier due to external API calls)
type RateLimitEntry = { count: number; firstRequest: number }
const exploreRateLimitMap = new Map<string, RateLimitEntry>()
const EXPLORE_RATE_LIMIT_WINDOW = 60 * 1000
const EXPLORE_MAX_REQUESTS = 20

const EXPLORE_MAX_MAP_SIZE = 10000

setInterval(() => {
  const now = Date.now()
  for (const [ip, entry] of exploreRateLimitMap.entries()) {
    if (now - entry.firstRequest > EXPLORE_RATE_LIMIT_WINDOW * 2) {
      exploreRateLimitMap.delete(ip)
    }
  }
}, 5 * 60 * 1000)

const checkExploreRateLimit = (clientIP: string): boolean => {
  const now = Date.now()
  const entry = exploreRateLimitMap.get(clientIP)
  if (!entry) {
    if (exploreRateLimitMap.size >= EXPLORE_MAX_MAP_SIZE) {
      const oldest = exploreRateLimitMap.keys().next().value
      if (oldest) exploreRateLimitMap.delete(oldest)
    }
    exploreRateLimitMap.set(clientIP, { count: 1, firstRequest: now })
    return true
  }
  if (now - entry.firstRequest > EXPLORE_RATE_LIMIT_WINDOW) {
    entry.count = 1
    entry.firstRequest = now
    return true
  }
  if (entry.count >= EXPLORE_MAX_REQUESTS) return false
  entry.count++
  return true
}

// Weather + forecast cache shared across requests (in-memory, local dev)
type ForecastDay = {
  date: string
  tempMin: number
  tempMax: number
  description: string
  icon: string
}

type WeatherData = {
  temp: number
  description: string
  icon: string
  forecast?: ForecastDay[]
}

const weatherCache = new Map<string, { data: WeatherData; timestamp: number }>()
const WEATHER_CACHE_TTL = 30 * 60 * 1000 // 30 minutes
const MAX_WEATHER_CACHE_SIZE = 500

const wmoCodeMap: Record<number, { description: string; icon: string }> = {
  0: { description: 'cer senin', icon: '01d' },
  1: { description: 'predominant senin', icon: '02d' },
  2: { description: 'parțial noros', icon: '03d' },
  3: { description: 'noros', icon: '04d' },
  45: { description: 'ceață', icon: '50d' },
  48: { description: 'ceață cu chiciură', icon: '50d' },
  51: { description: 'burniță ușoară', icon: '09d' },
  53: { description: 'burniță moderată', icon: '09d' },
  55: { description: 'burniță densă', icon: '09d' },
  61: { description: 'ploaie ușoară', icon: '10d' },
  63: { description: 'ploaie moderată', icon: '10d' },
  65: { description: 'ploaie puternică', icon: '10d' },
  71: { description: 'ninsoare ușoară', icon: '13d' },
  73: { description: 'ninsoare moderată', icon: '13d' },
  75: { description: 'ninsoare puternică', icon: '13d' },
  80: { description: 'averse ușoare', icon: '09d' },
  81: { description: 'averse moderate', icon: '09d' },
  82: { description: 'averse puternice', icon: '09d' },
  95: { description: 'furtună', icon: '11d' },
  96: { description: 'furtună cu grindină', icon: '11d' },
  99: { description: 'furtună puternică cu grindină', icon: '11d' },
}

const fetchWeatherWithForecast = async (city: string): Promise<WeatherData | null> => {
  const cacheKey = city.toLowerCase()
  const cached = weatherCache.get(cacheKey)
  if (cached && Date.now() - cached.timestamp < WEATHER_CACHE_TTL) {
    return cached.data
  }

  try {
    const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=ro`
    const geoRes = await fetch(geoUrl)
    if (!geoRes.ok) return null

    const geoJson = (await geoRes.json()) as {
      results?: Array<{ latitude: number; longitude: number }>
    }
    const loc = geoJson.results?.[0]
    if (!loc) return null

    const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${loc.latitude}&longitude=${loc.longitude}&current_weather=true&daily=temperature_2m_max,temperature_2m_min,weathercode&timezone=auto&forecast_days=4`
    const weatherRes = await fetch(weatherUrl)
    if (!weatherRes.ok) return null

    const weatherJson = (await weatherRes.json()) as {
      current_weather: { temperature: number; weathercode: number }
      daily?: {
        time: string[]
        temperature_2m_max: number[]
        temperature_2m_min: number[]
        weathercode: number[]
      }
    }
    const cw = weatherJson.current_weather
    const wmo = wmoCodeMap[cw.weathercode] ?? { description: 'variabil', icon: '03d' }

    // Build 3-day forecast (skip today = index 0, take next 3 days)
    const forecast: ForecastDay[] = []
    const daily = weatherJson.daily
    if (daily?.time) {
      for (let i = 1; i <= 3 && i < daily.time.length; i++) {
        const dayWmo = wmoCodeMap[daily.weathercode[i]] ?? { description: 'variabil', icon: '03d' }
        forecast.push({
          date: daily.time[i],
          tempMin: Math.round(daily.temperature_2m_min[i]),
          tempMax: Math.round(daily.temperature_2m_max[i]),
          description: dayWmo.description,
          icon: dayWmo.icon,
        })
      }
    }

    const result: WeatherData = {
      temp: Math.round(cw.temperature),
      description: wmo.description,
      icon: wmo.icon,
      forecast: forecast.length > 0 ? forecast : undefined,
    }

    if (weatherCache.size >= MAX_WEATHER_CACHE_SIZE) {
      const oldest = weatherCache.keys().next().value
      if (oldest) weatherCache.delete(oldest)
    }
    weatherCache.set(cacheKey, { data: result, timestamp: Date.now() })
    return result
  } catch {
    return null
  }
}

// Fallback estimated flight price ranges from Bucharest (OTP) by continent
const flightPriceEstimates: Record<string, [number, number]> = {
  Europa: [50, 250],
  Africa: [200, 500],
  Asia: [300, 700],
  'America de Sud': [400, 900],
}

// Live flight price cache (per IATA, refreshed every 30 min)
type FlightPriceData = {
  min: number
  max: number
  currency: string
  airline: string | null
  deepLink: string | null
  duration: string | null
  stops: number | null
  source: 'kiwi' | 'amadeus'
}

const flightPriceCache = new Map<string, { data: FlightPriceData; timestamp: number }>()
const FLIGHT_CACHE_TTL = 30 * 60 * 1000 // 30 minutes
const MAX_FLIGHT_CACHE_SIZE = 500

// Amadeus token cache for explore route
let amadeusTokenCache: { token: string; expiresAt: number } | null = null

const getAmadeusTokenForExplore = async (): Promise<string | null> => {
  if (amadeusTokenCache && Date.now() < amadeusTokenCache.expiresAt) {
    return amadeusTokenCache.token
  }

  const clientId = process.env.AMADEUS_CLIENT_ID
  const clientSecret = process.env.AMADEUS_CLIENT_SECRET
  if (!clientId || !clientSecret) return null

  const env = (process.env.AMADEUS_ENV || 'test').toLowerCase()
  const baseUrl = env === 'production'
    ? 'https://api.amadeus.com'
    : 'https://test.api.amadeus.com'

  try {
    const res = await fetch(`${baseUrl}/v1/security/oauth2/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'client_credentials', client_id: clientId, client_secret: clientSecret }),
    })
    if (!res.ok) return null
    const data = (await res.json()) as { access_token: string; expires_in: number }
    amadeusTokenCache = { token: data.access_token, expiresAt: Date.now() + (data.expires_in - 60) * 1000 }
    return data.access_token
  } catch {
    return null
  }
}

const fetchAmadeusFlightPrice = async (
  origin: string,
  destIata: string,
  travelDate?: string,
): Promise<FlightPriceData | null> => {
  const token = await getAmadeusTokenForExplore()
  if (!token) return null

  const env = (process.env.AMADEUS_ENV || 'test').toLowerCase()
  const baseUrl = env === 'production'
    ? 'https://api.amadeus.com'
    : 'https://test.api.amadeus.com'

  try {
    const baseDate = travelDate ? new Date(travelDate) : new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
    const returnDate = new Date(baseDate)
    returnDate.setDate(returnDate.getDate() + 7)
    const fmt = (d: Date) => d.toISOString().slice(0, 10)

    const query = new URLSearchParams({
      originLocationCode: origin.toUpperCase(),
      destinationLocationCode: destIata,
      departureDate: fmt(baseDate),
      returnDate: fmt(returnDate),
      adults: '1',
      currencyCode: 'EUR',
      max: '3',
    })

    const res = await fetch(`${baseUrl}/v2/shopping/flight-offers?${query}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(10000),
    })

    if (!res.ok) return null

    const data = (await res.json()) as {
      data: Array<{
        price: { total: string }
        itineraries: Array<{
          duration: string
          segments: Array<{ carrierCode: string }>
        }>
        validatingAirlineCodes?: string[]
      }>
    }

    if (!data.data || data.data.length === 0) return null

    const prices = data.data.map(o => Math.round(Number(o.price.total)))
    const cheapest = data.data[0]
    const outDuration = cheapest.itineraries[0]?.duration
    const segments = cheapest.itineraries[0]?.segments ?? []

    const formatDur = (iso: string): string => {
      const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?/)
      if (!match) return iso
      return `${match[1] || '0'}h ${match[2] || '0'}m`
    }

    return {
      min: Math.min(...prices),
      max: Math.max(...prices),
      currency: 'EUR',
      airline: cheapest.validatingAirlineCodes?.[0] ?? segments[0]?.carrierCode ?? null,
      deepLink: null,
      duration: outDuration ? formatDur(outDuration) : null,
      stops: Math.max(0, segments.length - 1),
      source: 'amadeus',
    }
  } catch {
    return null
  }
}

const fetchLiveFlightPrice = async (
  origin: string,
  destIata: string,
  travelDate?: string,
): Promise<FlightPriceData | null> => {
  const cacheKey = `${origin}-${destIata}-${travelDate || 'any'}`
  const cached = flightPriceCache.get(cacheKey)
  if (cached && Date.now() - cached.timestamp < FLIGHT_CACHE_TTL) {
    return cached.data
  }

  // Try Kiwi first, then Amadeus as fallback
  let result: FlightPriceData | null = null

  if (isKiwiAvailable()) {
    try {
      const baseDate = travelDate ? new Date(travelDate) : new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
      const dateFrom = new Date(baseDate)
      const dateTo = new Date(baseDate)
      dateTo.setDate(dateTo.getDate() + 3)
      const returnFrom = new Date(baseDate)
      returnFrom.setDate(returnFrom.getDate() + 5)
      const returnTo = new Date(baseDate)
      returnTo.setDate(returnTo.getDate() + 10)

      const fmt = (d: Date) => d.toISOString().slice(0, 10)

      const flights = await searchKiwiFlights({
        origin,
        destination: destIata,
        dateFrom: fmt(dateFrom),
        dateTo: fmt(dateTo),
        returnFrom: fmt(returnFrom),
        returnTo: fmt(returnTo),
        adults: 1,
        limit: 5,
      })

      if (flights.length > 0) {
        const prices = flights.map(f => f.price)
        const cheapest = flights.reduce((best, f) => f.price < best.price ? f : best, flights[0])

        result = {
          min: Math.min(...prices),
          max: Math.max(...prices),
          currency: 'EUR',
          airline: cheapest.airline,
          deepLink: cheapest.deepLink,
          duration: cheapest.duration,
          stops: cheapest.stops,
          source: 'kiwi',
        }
      }
    } catch (error) {
      console.error(`[Explore] Kiwi flight price fetch failed for ${destIata}`, error)
    }
  }

  // Amadeus fallback
  if (!result) {
    result = await fetchAmadeusFlightPrice(origin, destIata, travelDate)
  }

  if (result) {
    if (flightPriceCache.size >= MAX_FLIGHT_CACHE_SIZE) {
      const oldest = flightPriceCache.keys().next().value
      if (oldest) flightPriceCache.delete(oldest)
    }
    flightPriceCache.set(cacheKey, { data: result, timestamp: Date.now() })
  }

  return result
}

// Hotel pricing for explore suggestions
type HotelPriceData = {
  avgPricePerNight: number
  minPricePerNight: number
  maxPricePerNight: number
  topHotelName: string | null
  topHotelStars: number | null
  topHotelRating: number | null
}

const getHotelPricing = (city: string, travelDate?: string): HotelPriceData | null => {
  const hotels = findHotelsForCity(city, 9999, null, travelDate)
  if (hotels.length === 0) return null

  const multiplier = getSeasonalMultiplier(travelDate)
  const prices = hotels.map(h => Math.round(h.pricePerNight * multiplier))
  const best = hotels.reduce((top, h) => h.rating > top.rating ? h : top, hotels[0])

  return {
    avgPricePerNight: Math.round(prices.reduce((s, p) => s + p, 0) / prices.length),
    minPricePerNight: Math.min(...prices),
    maxPricePerNight: Math.max(...prices),
    topHotelName: best.name,
    topHotelStars: best.stars,
    topHotelRating: best.rating,
  }
}

export type ExploreSuggestion = {
  city: string
  country: string
  displayName: string
  iata: string
  continent: string
  activities: string[]
  weather: {
    temp: number
    description: string
    icon: string
    iconUrl: string
    forecast?: ForecastDay[]
  } | null
  estimatedFlightPrice: { min: number; max: number }
  liveFlightPrice: {
    min: number
    max: number
    currency: string
    airline: string | null
    deepLink: string | null
    duration: string | null
    stops: number | null
    source: 'kiwi' | 'amadeus'
  } | null
  hotelCount: number
  hotelPricing: {
    avgPricePerNight: number
    minPricePerNight: number
    maxPricePerNight: number
    topHotelName: string | null
    topHotelStars: number | null
    topHotelRating: number | null
  } | null
  seasonalTemp: number
  score: number
  matchReasons: string[]
}

export async function GET(request: NextRequest) {
  const clientIP = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  if (!checkExploreRateLimit(clientIP)) {
    return NextResponse.json(
      { error: 'Rate limit exceeded. Maximum 20 requests per minute.' },
      { status: 429 },
    )
  }

  const searchParams = request.nextUrl.searchParams
  const continent = searchParams.get('continent') || null
  const temperature = searchParams.get('temperature') || null
  const activitiesParam = searchParams.get('activities') || ''
  const activitiesList = activitiesParam ? activitiesParam.split(',').map(a => a.trim()).filter(Boolean) : []
  const limit = Math.min(Number(searchParams.get('limit') || '8'), 20)
  const travelDate = searchParams.get('travelDate') || undefined
  const origin = searchParams.get('origin') || 'OTP'

  // Score destinations based on preferences
  const scored = scoreDestinations(
    { continent, temperature, activities: activitiesList, maxFlightHours: null },
    travelDate,
  )

  const topDests = scored.slice(0, limit)
  const seasonIdx = getSeasonIndex(travelDate)

  // Fetch live weather + live flight prices in parallel
  const weatherPromises = topDests.map(dest => fetchWeatherWithForecast(dest.city))
  const flightPromises = topDests.map(dest => fetchLiveFlightPrice(origin, dest.iata, travelDate))

  const [weatherResults, flightResults] = await Promise.all([
    Promise.all(weatherPromises),
    Promise.all(flightPromises),
  ])

  const suggestions: ExploreSuggestion[] = topDests.map((dest, i) => {
    const weather = weatherResults[i]
    const liveFlight = flightResults[i]
    const fallbackRange = flightPriceEstimates[dest.continent] || [100, 400]
    const hotelPricing = getHotelPricing(dest.city, travelDate)

    return {
      city: dest.city,
      country: dest.country,
      displayName: dest.displayName,
      iata: dest.iata,
      continent: dest.continent,
      activities: dest.activities,
      weather: weather ? {
        temp: weather.temp,
        description: weather.description,
        icon: weather.icon,
        iconUrl: `https://openweathermap.org/img/wn/${weather.icon}@2x.png`,
        forecast: weather.forecast,
      } : null,
      estimatedFlightPrice: liveFlight
        ? { min: liveFlight.min, max: liveFlight.max }
        : { min: fallbackRange[0], max: fallbackRange[1] },
      liveFlightPrice: liveFlight,
      hotelCount: countHotelsForCity(dest.city),
      hotelPricing,
      seasonalTemp: dest.avgTemps[seasonIdx],
      score: dest.score,
      matchReasons: dest.matchReasons,
    }
  })

  const liveFlightCount = flightResults.filter(Boolean).length
  const liveWeatherCount = weatherResults.filter(Boolean).length
  const flightSources = flightResults.filter(Boolean).map(f => f!.source)
  const hasKiwi = flightSources.includes('kiwi')
  const hasAmadeus = flightSources.includes('amadeus')
  const flightSourceLabel = hasKiwi && hasAmadeus
    ? 'Kiwi + Amadeus (live)'
    : hasKiwi
      ? 'Kiwi/Tequila (live)'
      : hasAmadeus
        ? 'Amadeus (live)'
        : 'estimate'

  return NextResponse.json({
    suggestions,
    meta: {
      continent: continent || 'all',
      count: suggestions.length,
      weatherSource: 'Open-Meteo (live)',
      flightSource: flightSourceLabel,
      liveFlightCount,
      liveWeatherCount,
      travelSeason: ['iarna', 'primavara', 'vara', 'toamna'][seasonIdx],
    },
  })
}
