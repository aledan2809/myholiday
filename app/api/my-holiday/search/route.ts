import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import prisma from '@/lib/db'
import { searchKiwiFlights, searchKiwiMultiDestination, isKiwiAvailable, type KiwiFlightResult } from '@/lib/kiwiService'
// amadeusHotelService used via hotelProviders
import { getTotalHotels } from '@/lib/hotelService'
import {
  prefetchLiveHotels,
  pickHotelForSearchResult,
  type UnifiedHotelResult,
} from '@/lib/hotelProviders'
import { getDiscoveryDestinations } from '@/lib/destinationMetadata'

// Simple in-memory rate limiting for local development
type RateLimitEntry = { count: number; firstRequest: number }
const rateLimitMap = new Map<string, RateLimitEntry>()
const RATE_LIMIT_WINDOW = 60 * 1000 // 1 minute
const MAX_REQUESTS_PER_WINDOW = 10
const MAX_MAP_SIZE = 10000

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
    if (rateLimitMap.size >= MAX_MAP_SIZE) {
      const oldest = rateLimitMap.keys().next().value
      if (oldest) rateLimitMap.delete(oldest)
    }
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
  hotelPreferences?: {
    minStars: number | null
    facilities: string[]
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
    deepLink?: string
  }
  hotel: {
    id: string | null
    name: string
    stars: number
    pricePerNight: number
    rating: number
    distanceFromCenter: number
    facilities: string[]
    image: string
    images: string[]
    breakfastIncluded: boolean
    freeCancellation: boolean
    cancellationPolicy?: string
    description?: string
    checkInTime?: string
    checkOutTime?: string
    source: 'local-database' | 'fallback' | 'amadeus-live' | 'booking-live'
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
  bookingLink?: string
  bookingToken?: string
  flightSource?: string
  matchReasons?: string[]
  weatherIcon?: string
  weatherForecast?: Array<{
    date: string
    tempMin: number
    tempMax: number
    description: string
    icon: string
  }>
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
  hotelPreferences: z
    .object({
      minStars: z.number().nullable(),
      facilities: z.array(z.string()),
    })
    .optional()
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
  'Viena, Austria',
  'Berlin, Germania',
  'Paris, Franta',
  'Milano, Italia',
  'Budapesta, Ungaria',
  'Cairo, Egipt',
  'Cape Town, Africa de Sud',
  'Dubai, EAU',
  'Bangkok, Thailanda',
  'Singapore, Singapore',
  'Rio de Janeiro, Brazilia',
  'Santiago, Chile',
  'Lima, Peru',
  'Bogota, Columbia',
  'Kuala Lumpur, Malaezia',
  'Johannesburg, Africa de Sud',
  'Tunis, Tunisia',
]

const airlines = ['TAP Air Portugal', 'Vueling', 'Wizz Air', 'Ryanair', 'Aegean', 'Lufthansa']
const weatherTags = ['22°C si soare', '19°C partial innorat', '24°C briza calda', '18°C racoare']

// Convert UnifiedHotelResult from hotelProviders to the route's hotel result shape
const unifiedToHotelData = (hotel: UnifiedHotelResult): HolidayResult['hotel'] & { totalCost: number } => ({
  id: hotel.id,
  name: hotel.name,
  stars: hotel.stars,
  pricePerNight: hotel.pricePerNight,
  rating: hotel.rating,
  distanceFromCenter: hotel.distanceFromCenter,
  facilities: hotel.facilities,
  image: hotel.image,
  images: hotel.images,
  breakfastIncluded: hotel.breakfastIncluded,
  freeCancellation: hotel.freeCancellation,
  cancellationPolicy: hotel.cancellationPolicy,
  description: hotel.description,
  checkInTime: hotel.checkInTime,
  checkOutTime: hotel.checkOutTime,
  source: hotel.source,
  totalCost: hotel.totalPrice,
})

// --- Real Weather Integration ---

type ForecastDay = {
  date: string       // YYYY-MM-DD
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

// Map Romanian city names to English for OpenWeatherMap compatibility
const cityNameMap: Record<string, string> = {
  Lisabona: 'Lisbon',
  Roma: 'Rome',
  Nisa: 'Nice',
  Atena: 'Athens',
  Praga: 'Prague',
  Olanda: 'Netherlands',
}

// IATA code to city name mapping for discovery mode
const iataToCityMap: Record<string, string> = {
  LIS: 'Lisbon', BCN: 'Barcelona', FCO: 'Rome', NCE: 'Nice',
  DBV: 'Dubrovnik', ATH: 'Athens', PRG: 'Prague', AMS: 'Amsterdam',
  OPO: 'Porto', VLC: 'Valencia', VIE: 'Vienna', BER: 'Berlin',
  CDG: 'Paris', ORY: 'Paris', MXP: 'Milan', LIN: 'Milan', BUD: 'Budapest',
  OTP: 'Bucharest', CAI: 'Cairo', CPT: 'Cape Town', JNB: 'Johannesburg',
  TUN: 'Tunis', DXB: 'Dubai', BKK: 'Bangkok', SIN: 'Singapore',
  KUL: 'Kuala Lumpur', GIG: 'Rio de Janeiro', GRU: 'Rio de Janeiro',
  SCL: 'Santiago', LIM: 'Lima', BOG: 'Bogota',
}

// WMO weather code to Romanian description + OWM-compatible icon
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
  85: { description: 'ninsoare cu averse', icon: '13d' },
  86: { description: 'ninsoare puternică cu averse', icon: '13d' },
  95: { description: 'furtună', icon: '11d' },
  96: { description: 'furtună cu grindină', icon: '11d' },
  99: { description: 'furtună puternică cu grindină', icon: '11d' },
}

// Open-Meteo: free weather API, no key required
const fetchWeatherOpenMeteo = async (city: string): Promise<WeatherData | null> => {
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

    return {
      temp: Math.round(cw.temperature),
      description: wmo.description,
      icon: wmo.icon,
      forecast: forecast.length > 0 ? forecast : undefined,
    }
  } catch (error) {
    console.error(`Open-Meteo weather fetch failed for ${city}`, error)
    return null
  }
}

// OpenWeatherMap: requires API key
const fetchWeatherOpenWeatherMap = async (city: string, apiKey: string): Promise<WeatherData | null> => {
  try {
    const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&appid=${apiKey}&units=metric&lang=ro`
    const response = await fetch(url)
    if (!response.ok) return null

    const json = (await response.json()) as {
      main: { temp: number }
      weather: Array<{ description: string; icon: string }>
    }

    return {
      temp: Math.round(json.main.temp),
      description: json.weather[0]?.description ?? '',
      icon: json.weather[0]?.icon ?? '01d',
    }
  } catch (error) {
    console.error(`OpenWeatherMap fetch failed for ${city}`, error)
    return null
  }
}

const fetchWeatherForCity = async (city: string): Promise<WeatherData | null> => {
  const cacheKey = city.toLowerCase()
  const cached = weatherCache.get(cacheKey)
  if (cached && Date.now() - cached.timestamp < WEATHER_CACHE_TTL) {
    return cached.data
  }

  const apiKey = process.env.OPENWEATHER_API_KEY

  // Try OpenWeatherMap first (if key available), then Open-Meteo (free, no key)
  const result = apiKey
    ? (await fetchWeatherOpenWeatherMap(city, apiKey)) ?? (await fetchWeatherOpenMeteo(city))
    : await fetchWeatherOpenMeteo(city)

  if (result) {
    if (weatherCache.size >= MAX_WEATHER_CACHE_SIZE) {
      const oldest = weatherCache.keys().next().value
      if (oldest) weatherCache.delete(oldest)
    }
    weatherCache.set(cacheKey, { data: result, timestamp: Date.now() })
  }
  return result
}

const extractCityForWeather = (destination: string): string => {
  // Handle "City, Country" format
  const city = destination.split(',')[0].trim()
  // Handle "Label (IATA)" format from live results
  const withoutIata = city.replace(/\s*\([A-Z]{3}\)\s*$/, '').trim()
  // Map Romanian names to English
  return cityNameMap[withoutIata] || withoutIata
}

const resolveWeatherCity = (destination: string): string => {
  // First try IATA lookup
  const iataMatch = destination.match(/\(([A-Z]{3})\)/)
  if (iataMatch && iataToCityMap[iataMatch[1]]) {
    return iataToCityMap[iataMatch[1]]
  }
  return extractCityForWeather(destination)
}

const enrichResultsWithWeather = async (results: HolidayResult[]): Promise<void> => {
  const cityMap = new Map<string, string>() // destination → weather city
  for (const r of results) {
    if (!cityMap.has(r.destination)) {
      cityMap.set(r.destination, resolveWeatherCity(r.destination))
    }
  }

  const uniqueCities = [...new Set(cityMap.values())]
  const weatherResults = new Map<string, WeatherData>()

  await Promise.all(
    uniqueCities.map(async (city) => {
      const data = await fetchWeatherForCity(city)
      if (data) weatherResults.set(city, data)
    })
  )

  for (const result of results) {
    const city = cityMap.get(result.destination)
    const weather = city ? weatherResults.get(city) : undefined
    if (weather) {
      result.weather = `${weather.temp}°C ${weather.description}`
      result.weatherIcon = `https://openweathermap.org/img/wn/${weather.icon}@2x.png`
      if (weather.forecast) {
        result.weatherForecast = weather.forecast.map(d => ({
          date: d.date,
          tempMin: d.tempMin,
          tempMax: d.tempMax,
          description: d.description,
          icon: d.icon,
        }))
      }
    }
  }
}

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

const calculateNights = (startDate: string, endDate: string): number => {
  const start = new Date(startDate)
  const end = new Date(endDate)
  const diff = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
  return Math.max(1, diff)
}

// Continent mapping for discovery mode filtering
const destinationContinent: Record<string, string> = {
  'Lisabona, Portugalia': 'Europa', 'Barcelona, Spania': 'Europa', 'Roma, Italia': 'Europa',
  'Nisa, Franta': 'Europa', 'Dubrovnik, Croatia': 'Europa', 'Atena, Grecia': 'Europa',
  'Praga, Cehia': 'Europa', 'Amsterdam, Olanda': 'Europa', 'Porto, Portugalia': 'Europa',
  'Valencia, Spania': 'Europa', 'Viena, Austria': 'Europa', 'Berlin, Germania': 'Europa',
  'Paris, Franta': 'Europa', 'Milano, Italia': 'Europa', 'Budapesta, Ungaria': 'Europa',
  'Cairo, Egipt': 'Africa', 'Cape Town, Africa de Sud': 'Africa',
  'Johannesburg, Africa de Sud': 'Africa', 'Tunis, Tunisia': 'Africa',
  'Dubai, EAU': 'Asia', 'Bangkok, Thailanda': 'Asia', 'Singapore, Singapore': 'Asia',
  'Kuala Lumpur, Malaezia': 'Asia',
  'Rio de Janeiro, Brazilia': 'America de Sud', 'Santiago, Chile': 'America de Sud',
  'Lima, Peru': 'America de Sud', 'Bogota, Columbia': 'America de Sud',
}

const buildMockResults = async (payload: SearchPayload): Promise<HolidayResult[]> => {
  const baseBudget = payload.budget || 800
  const multiplier = payload.adults > 1 ? 1 + (payload.adults - 1) * 0.65 : 1
  const nights = calculateNights(payload.startDate, payload.endDate)

  // Filter and score destinations by preferences in discovery mode
  let targetDestinations = destinations
  const mockMatchReasons: Record<string, string[]> = {}

  if (!payload.destination && payload.preferences) {
    const prefs = payload.preferences
    const scoredDests = getDiscoveryDestinations(
      { continent: prefs.continent, temperature: prefs.temperature, activities: prefs.activities, maxFlightHours: prefs.maxFlightHours },
      10,
      payload.startDate,
    )
    // Map scored destinations back to Romanian display names
    const scoredDisplayNames = scoredDests.map(d => d.displayName)
    const validNames = scoredDisplayNames.filter(name => destinations.includes(name))
    if (validNames.length > 0) targetDestinations = validNames
    for (const d of scoredDests) {
      mockMatchReasons[d.displayName] = d.matchReasons
    }
  } else if (!payload.destination && payload.preferences?.continent) {
    const continentFiltered = destinations.filter(
      d => destinationContinent[d] === payload.preferences!.continent
    )
    if (continentFiltered.length > 0) targetDestinations = continentFiltered
  }

  // Limit to 10 results for performance
  const selectedDestinations = targetDestinations.slice(0, 10)

  // Prefetch live hotel data per unique destination via provider layer
  const maxPerNight = baseBudget > 0 ? Math.round(baseBudget * 0.6 / Math.max(1, nights)) : undefined
  const uniqueDests = payload.destination
    ? [payload.destination]
    : selectedDestinations.map(d => d.split(',')[0].trim())

  const liveHotelCache = await prefetchLiveHotels(
    uniqueDests,
    payload.startDate,
    payload.endDate,
    payload.adults,
    maxPerNight,
    payload.hotelPreferences?.minStars ?? undefined,
    10,
  )

  return Promise.all(selectedDestinations.map(async (destination, index) => {
    const destText = payload.destination ? payload.destination : destination
    const flightsCost = Math.round(baseBudget * 0.32 * multiplier + index * 25)
    const hotelBudget = Math.round(baseBudget * 0.5 * multiplier + index * 18)
    const transfersCost = Math.round(baseBudget * 0.08 * multiplier + index * 6)

    // Pick hotel via provider layer (live cache first, then local DB)
    const hotel = await pickHotelForSearchResult(
      destText, nights, hotelBudget, index,
      payload.startDate, payload.endDate, payload.adults,
      payload.hotelPreferences, liveHotelCache,
    )
    const hotelData = unifiedToHotelData(hotel)

    const hotelCost = Math.min(hotelData.totalCost, hotelBudget)
    const total = flightsCost + hotelCost + transfersCost

    return {
      id: `mock-${index}`,
      destination: destText,
      total,
      currency: 'EUR',
      rating: hotelData.rating,
      weather: randomPick(weatherTags, index),
      flight: {
        airline: randomPick(airlines, index),
        duration: `${2 + (index % 4)}h ${15 + (index % 3) * 10}m`,
        stops: index % 3 === 0 ? 'Direct' : '1 escala',
        outbound: `${payload.startDate} · 08:${10 + index} - 12:${20 + index}`,
        inbound: `${payload.endDate} · 17:${15 + index} - 21:${10 + index}`,
      },
      hotel: {
        id: hotelData.id,
        name: hotelData.name,
        stars: hotelData.stars,
        pricePerNight: hotelData.pricePerNight,
        rating: hotelData.rating,
        distanceFromCenter: hotelData.distanceFromCenter,
        facilities: hotelData.facilities,
        image: hotelData.image,
        images: hotelData.images,
        breakfastIncluded: hotelData.breakfastIncluded,
        freeCancellation: hotelData.freeCancellation,
        cancellationPolicy: hotelData.cancellationPolicy,
        description: hotelData.description,
        checkInTime: hotelData.checkInTime,
        checkOutTime: hotelData.checkOutTime,
        source: hotelData.source,
      },
      transfer: {
        type: index % 2 === 0 ? 'Shuttle bus' : 'Transport public',
        estimatedCost: `${8 + index} EUR`,
      },
      breakdown: {
        flights: flightsCost,
        hotel: hotelCost,
        transfers: transfersCost,
      },
      source: 'mock',
      matchReasons: mockMatchReasons[destText] || undefined,
    }
  }))
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

const buildKiwiResults = async (payload: SearchPayload): Promise<{ results: HolidayResult[]; usedDestination: string; discoveryMeta?: { destinations: string[]; matchReasons: Record<string, string[]> } } | null> => {
  let kiwiFlights: KiwiFlightResult[]
  let discoveryMeta: { destinations: string[]; matchReasons: Record<string, string[]> } | undefined

  if (!payload.destination) {
    // Discovery mode: use preference-scored destinations
    const prefs = payload.preferences || { continent: 'Europa', temperature: null, activities: [], maxFlightHours: null }
    const scoredDests = getDiscoveryDestinations(
      { continent: prefs.continent, temperature: prefs.temperature, activities: prefs.activities, maxFlightHours: prefs.maxFlightHours },
      6,
      payload.startDate,
    )
    const selectedDests = scoredDests.map(d => d.iata)

    // Discovery: searching scored destinations via Kiwi

    kiwiFlights = await searchKiwiMultiDestination({
      origin: payload.origin,
      destinations: selectedDests,
      dateFrom: payload.startDate,
      dateTo: payload.endDate,
      adults: payload.adults,
      maxPrice: payload.budget > 0 ? payload.budget : undefined,
      continent: prefs.continent,
      limit: 3,
    })

    // Filter by max flight hours
    if (prefs.maxFlightHours && prefs.maxFlightHours > 0) {
      const filtered = kiwiFlights.filter(f => {
        const match = f.duration.match(/(\d+)h\s*(\d+)?m?/)
        if (!match) return true
        const hours = Number(match[1]) + (Number(match[2] || 0) / 60)
        return hours <= prefs.maxFlightHours!
      })
      if (filtered.length > 0) kiwiFlights = filtered
    }

    const matchReasonsMap: Record<string, string[]> = {}
    for (const dest of scoredDests) {
      matchReasonsMap[dest.iata] = dest.matchReasons
    }
    discoveryMeta = { destinations: selectedDests, matchReasons: matchReasonsMap }
  } else {
    kiwiFlights = await searchKiwiFlights({
      origin: payload.origin,
      destination: payload.destination,
      dateFrom: payload.startDate,
      dateTo: payload.endDate,
      adults: payload.adults,
      maxPrice: payload.budget > 0 ? payload.budget : undefined,
      continent: payload.preferences?.continent,
      limit: 10,
    })
  }

  if (kiwiFlights.length === 0) return null

  const nights = calculateNights(payload.startDate, payload.endDate)

  // Prefetch live hotel data per unique destination via provider layer
  const uniqueFlightDests = [...new Set(kiwiFlights.map(f => f.destination))]
  const avgFlightPrice = kiwiFlights.reduce((s, f) => s + f.price, 0) / kiwiFlights.length
  const kiwiMaxPerNight = payload.budget > 0 ? Math.round((payload.budget - avgFlightPrice) * 0.75 / nights) : undefined

  const kiwiHotelCache = await prefetchLiveHotels(
    uniqueFlightDests,
    payload.startDate,
    payload.endDate,
    payload.adults,
    kiwiMaxPerNight,
    payload.hotelPreferences?.minStars ?? undefined,
    10,
  )

  const results: HolidayResult[] = await Promise.all(kiwiFlights.map(async (flight: KiwiFlightResult, index: number) => {
    const flightPrice = flight.price
    const hotelBudget = Math.max(0, Math.round((payload.budget - flightPrice) * 0.75))
    const transferBudget = Math.max(0, Math.round((payload.budget - flightPrice) * 0.1))

    // Pick hotel via provider layer (live cache first, then local DB)
    const hotel = await pickHotelForSearchResult(
      flight.destination, nights, hotelBudget, index,
      payload.startDate, payload.endDate, payload.adults,
      payload.hotelPreferences, kiwiHotelCache,
    )
    const hotelData = unifiedToHotelData(hotel)

    const hotelCost = hotelData.totalCost
    const total = flightPrice + hotelCost + transferBudget

    const airlinesStr = flight.airlines && flight.airlines.length > 1
      ? flight.airlines.join(', ')
      : (flight.airline || 'Airline')

    return {
      id: flight.id,
      destination: flight.destination,
      total,
      currency: 'EUR' as const,
      rating: hotelData.rating,
      weather: randomPick(weatherTags, index),
      flight: {
        airline: airlinesStr,
        duration: flight.duration,
        stops: flight.stops === 0 ? 'Direct' : `${flight.stops} escala`,
        outbound: flight.outbound,
        inbound: flight.inbound,
        deepLink: flight.deepLink || undefined,
      },
      hotel: {
        id: hotelData.id,
        name: hotelData.name,
        stars: hotelData.stars,
        pricePerNight: hotelData.pricePerNight,
        rating: hotelData.rating,
        distanceFromCenter: hotelData.distanceFromCenter,
        facilities: hotelData.facilities,
        image: hotelData.image,
        images: hotelData.images,
        breakfastIncluded: hotelData.breakfastIncluded,
        freeCancellation: hotelData.freeCancellation,
        cancellationPolicy: hotelData.cancellationPolicy,
        description: hotelData.description,
        checkInTime: hotelData.checkInTime,
        checkOutTime: hotelData.checkOutTime,
        source: hotelData.source,
      },
      transfer: {
        type: index % 2 === 0 ? 'Shuttle bus' : 'Transport public',
        estimatedCost: `${8 + index} EUR`,
      },
      breakdown: {
        flights: flightPrice,
        hotel: hotelCost,
        transfers: transferBudget,
      },
      source: 'live' as const,
      bookingLink: flight.deepLink || undefined,
      bookingToken: flight.bookingToken || undefined,
      flightSource: 'Kiwi/Tequila',
      matchReasons: discoveryMeta?.matchReasons[flight.destination.split(',')[0].trim()] || undefined,
    }
  }))

  const usedDestination = kiwiFlights[0]?.destinationCity || 'unknown'
  return { results, usedDestination, discoveryMeta }
}

// Parse flight duration ISO format to hours for maxFlightHours filtering
const parseDurationToHours = (iso: string): number => {
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?/)
  if (!match) return 999
  const hours = match[1] ? Number(match[1]) : 0
  const minutes = match[2] ? Number(match[2]) : 0
  return hours + minutes / 60
}

// Search Amadeus flights for a single destination, returning raw offer data
const searchAmadeusFlightsForDest = async (
  token: string,
  origin: string,
  destCode: string,
  startDate: string,
  endDate: string,
  adults: number,
  budget: number,
  maxResults: number = 5,
): Promise<Array<{
  id: string
  destCode: string
  destLabel: string
  price: { total: string; currency: string }
  itineraries: Array<{
    duration: string
    segments: Array<{ departure: { at: string }; arrival: { at: string }; carrierCode: string }>
  }>
  validatingAirlineCodes?: string[]
}>> => {
  try {
    const query = new URLSearchParams({
      originLocationCode: origin.toUpperCase(),
      destinationLocationCode: destCode,
      departureDate: startDate,
      returnDate: endDate,
      adults: String(adults),
      currencyCode: 'EUR',
      max: String(maxResults),
    })

    if (budget > 0) {
      query.set('maxPrice', String(budget))
    }

    const response = await fetch(`${AMADEUS_BASE_URL}/v2/shopping/flight-offers?${query.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(12000),
    })

    if (!response.ok) {
      console.error(`[Amadeus] Flight search failed for ${destCode}: ${response.status}`)
      return []
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

    return (data.data || []).map(offer => ({
      ...offer,
      destCode,
      destLabel: `${iataToCityMap[destCode] || destCode} (${destCode})`,
    }))
  } catch (error) {
    console.error(`[Amadeus] Flight search error for ${destCode}`, error)
    return []
  }
}

const buildLiveResults = async (payload: SearchPayload): Promise<{ results: HolidayResult[]; usedDestination: string; discoveryMeta?: { destinations: string[]; matchReasons: Record<string, string[]> } } | null> => {
  const token = await getAmadeusToken()
  if (!token) {
    return null
  }

  if (payload.destination) {
    // --- Normal mode: single destination ---
    const destination = await resolveLocationCode(token, payload.destination)
    if (!destination) return null

    const offers = await searchAmadeusFlightsForDest(
      token, payload.origin, destination.code,
      payload.startDate, payload.endDate, payload.adults, payload.budget, 10,
    )

    if (offers.length === 0) return null

    const nights = calculateNights(payload.startDate, payload.endDate)
    const destText = `${destination.label} (${destination.code})`

    const liveMaxPerNight = payload.budget > 0 ? Math.round(payload.budget * 0.5 / nights) : undefined
    const liveHotelCache = await prefetchLiveHotels(
      [destText], payload.startDate, payload.endDate, payload.adults,
      liveMaxPerNight, payload.hotelPreferences?.minStars ?? undefined, 15,
    )

    const results: HolidayResult[] = await Promise.all(offers.map(async (offer, index) => {
      const outbound = offer.itineraries[0]
      const inbound = offer.itineraries[1]
      const outboundSegments = outbound?.segments ?? []
      const inboundSegments = inbound?.segments ?? []
      const stopsOut = outboundSegments.length > 0 ? outboundSegments.length - 1 : 0

      const flightPrice = Math.round(Number(offer.price.total))
      const hotelBudget = Math.max(0, Math.round((payload.budget - flightPrice) * 0.75))
      const transferBudget = Math.max(0, Math.round((payload.budget - flightPrice) * 0.1))

      const hotel = await pickHotelForSearchResult(
        destText, nights, hotelBudget, index,
        payload.startDate, payload.endDate, payload.adults,
        payload.hotelPreferences, liveHotelCache,
      )
      const hotelData = unifiedToHotelData(hotel)
      const hotelCost = hotelData.totalCost
      const total = flightPrice + hotelCost + transferBudget

      return {
        id: offer.id,
        destination: destText,
        total,
        currency: 'EUR' as const,
        rating: hotelData.rating,
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
          id: hotelData.id, name: hotelData.name, stars: hotelData.stars,
          pricePerNight: hotelData.pricePerNight, rating: hotelData.rating,
          distanceFromCenter: hotelData.distanceFromCenter, facilities: hotelData.facilities,
          image: hotelData.image, images: hotelData.images,
          breakfastIncluded: hotelData.breakfastIncluded, freeCancellation: hotelData.freeCancellation,
          cancellationPolicy: hotelData.cancellationPolicy, description: hotelData.description,
          checkInTime: hotelData.checkInTime, checkOutTime: hotelData.checkOutTime,
          source: hotelData.source,
        },
        transfer: { type: index % 2 === 0 ? 'Shuttle bus' : 'Transport public', estimatedCost: `${8 + index} EUR` },
        breakdown: { flights: flightPrice, hotel: hotelCost, transfers: transferBudget },
        source: 'live' as const,
        flightSource: 'Amadeus',
      }
    }))

    return { results, usedDestination: destination.code }
  }

  // --- Discovery mode: search MULTIPLE destinations scored by preferences ---
  const prefs = payload.preferences || { continent: 'Europa', temperature: null, activities: [], maxFlightHours: null }
  const scoredDests = getDiscoveryDestinations(
    { continent: prefs.continent, temperature: prefs.temperature, activities: prefs.activities, maxFlightHours: prefs.maxFlightHours },
    8,
    payload.startDate,
  )

  // Discovery: searching scored destinations via Amadeus

  // Search flights for top scored destinations in parallel (max 5 concurrent)
  const destBatches = scoredDests.slice(0, 5)
  const allOffers = await Promise.all(
    destBatches.map(dest =>
      searchAmadeusFlightsForDest(
        token, payload.origin, dest.iata,
        payload.startDate, payload.endDate, payload.adults,
        payload.budget, 3,
      )
    )
  )

  const flatOffers = allOffers.flat()

  if (flatOffers.length === 0) {
    // Fallback: try remaining scored destinations
    const fallbackDests = scoredDests.slice(5)
    if (fallbackDests.length > 0) {
      const fallbackOffers = await Promise.all(
        fallbackDests.map(dest =>
          searchAmadeusFlightsForDest(
            token, payload.origin, dest.iata,
            payload.startDate, payload.endDate, payload.adults,
            payload.budget, 3,
          )
        )
      )
      flatOffers.push(...fallbackOffers.flat())
    }
    if (flatOffers.length === 0) return null
  }

  // Filter by max flight hours preference
  let filteredOffers = flatOffers
  if (prefs.maxFlightHours && prefs.maxFlightHours > 0) {
    const maxHours = prefs.maxFlightHours
    filteredOffers = flatOffers.filter(offer => {
      const outDuration = offer.itineraries[0]?.duration
      if (!outDuration) return true
      return parseDurationToHours(outDuration) <= maxHours
    })
    // Keep at least some results even if all exceed the limit
    if (filteredOffers.length === 0) filteredOffers = flatOffers.slice(0, 5)
  }

  // Build match reasons map from scored destinations
  const matchReasonsMap: Record<string, string[]> = {}
  for (const dest of scoredDests) {
    matchReasonsMap[dest.iata] = dest.matchReasons
  }

  // Sort by preference score (dest score) then by price
  const destScoreMap = new Map(scoredDests.map(d => [d.iata, d.score]))
  filteredOffers.sort((a, b) => {
    const scoreA = destScoreMap.get(a.destCode) || 0
    const scoreB = destScoreMap.get(b.destCode) || 0
    if (scoreB !== scoreA) return scoreB - scoreA
    return Number(a.price.total) - Number(b.price.total)
  })

  // Take top 10 results
  const topOffers = filteredOffers.slice(0, 10)

  const nights = calculateNights(payload.startDate, payload.endDate)
  const uniqueDestTexts = [...new Set(topOffers.map(o => o.destLabel))]

  const liveMaxPerNight = payload.budget > 0 ? Math.round(payload.budget * 0.5 / nights) : undefined
  const liveHotelCache = await prefetchLiveHotels(
    uniqueDestTexts, payload.startDate, payload.endDate, payload.adults,
    liveMaxPerNight, payload.hotelPreferences?.minStars ?? undefined, 10,
  )

  const results: HolidayResult[] = await Promise.all(topOffers.map(async (offer, index) => {
    const destText = offer.destLabel
    const outbound = offer.itineraries[0]
    const inbound = offer.itineraries[1]
    const outboundSegments = outbound?.segments ?? []
    const inboundSegments = inbound?.segments ?? []
    const stopsOut = outboundSegments.length > 0 ? outboundSegments.length - 1 : 0

    const flightPrice = Math.round(Number(offer.price.total))
    const hotelBudget = Math.max(0, Math.round((payload.budget - flightPrice) * 0.75))
    const transferBudget = Math.max(0, Math.round((payload.budget - flightPrice) * 0.1))

    const hotel = await pickHotelForSearchResult(
      destText, nights, hotelBudget, index,
      payload.startDate, payload.endDate, payload.adults,
      payload.hotelPreferences, liveHotelCache,
    )
    const hotelData = unifiedToHotelData(hotel)
    const hotelCost = hotelData.totalCost
    const total = flightPrice + hotelCost + transferBudget

    return {
      id: `amadeus-disc-${offer.destCode}-${offer.id}`,
      destination: destText,
      total,
      currency: 'EUR' as const,
      rating: hotelData.rating,
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
        id: hotelData.id, name: hotelData.name, stars: hotelData.stars,
        pricePerNight: hotelData.pricePerNight, rating: hotelData.rating,
        distanceFromCenter: hotelData.distanceFromCenter, facilities: hotelData.facilities,
        image: hotelData.image, images: hotelData.images,
        breakfastIncluded: hotelData.breakfastIncluded, freeCancellation: hotelData.freeCancellation,
        cancellationPolicy: hotelData.cancellationPolicy, description: hotelData.description,
        checkInTime: hotelData.checkInTime, checkOutTime: hotelData.checkOutTime,
        source: hotelData.source,
      },
      transfer: { type: index % 2 === 0 ? 'Shuttle bus' : 'Transport public', estimatedCost: `${8 + index} EUR` },
      breakdown: { flights: flightPrice, hotel: hotelCost, transfers: transferBudget },
      source: 'live' as const,
      flightSource: 'Amadeus',
      matchReasons: matchReasonsMap[offer.destCode],
    }
  }))

  const usedDestinations = [...new Set(topOffers.map(o => o.destCode))]
  return {
    results,
    usedDestination: usedDestinations.join(', '),
    discoveryMeta: { destinations: usedDestinations, matchReasons: matchReasonsMap },
  }
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

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON body' },
      { status: 400 },
    )
  }
  const parsed = SearchSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json({
      error: 'Invalid payload',
      details: parsed.error.issues.map(e => `${e.path.join('.')}: ${e.message}`)
    }, { status: 400 })
  }

  const payload = parsed.data

  const hasAmadeus = !!(process.env.AMADEUS_CLIENT_ID && process.env.AMADEUS_CLIENT_SECRET)
  const hasKiwi = isKiwiAvailable()
  const liveEnabled = process.env.MY_HOLIDAY_ENABLE_LIVE === 'true'
  const preferredProvider = (process.env.FLIGHT_PROVIDER || 'amadeus').toLowerCase()

  const missingKeys = [
    !hasAmadeus && !hasKiwi ? 'AMADEUS_CLIENT_ID or KIWI_API_KEY' : null,
  ].filter(Boolean) as string[]

  let livePayload: { results: HolidayResult[]; usedDestination: string; discoveryMeta?: { destinations: string[]; matchReasons: Record<string, string[]> } } | null = null
  let flightSource: string | null = null

  if (liveEnabled && (hasAmadeus || hasKiwi)) {
    // Provider priority based on FLIGHT_PROVIDER env var
    const tryKiwiFirst = preferredProvider === 'kiwi' && hasKiwi
    const tryAmadeusFirst = !tryKiwiFirst && hasAmadeus

    if (tryKiwiFirst) {
      livePayload = await buildKiwiResults(payload)
      if (livePayload) flightSource = 'Kiwi/Tequila'
    }

    if (!livePayload && tryAmadeusFirst) {
      livePayload = await buildLiveResults(payload)
      if (livePayload) flightSource = 'Amadeus'
    }

    // Fallback: try the other provider
    if (!livePayload && hasKiwi && !tryKiwiFirst) {
      livePayload = await buildKiwiResults(payload)
      if (livePayload) flightSource = 'Kiwi/Tequila'
    }
    if (!livePayload && hasAmadeus && tryKiwiFirst) {
      livePayload = await buildLiveResults(payload)
      if (livePayload) flightSource = 'Amadeus'
    }
  }

  const results = livePayload?.results ?? await buildMockResults(payload)

  // Sort results by total price (ascending) as mentioned in README
  results.sort((a, b) => a.total - b.total)

  // Enrich results with real weather data (falls back to mock tags if no API key)
  await enrichResultsWithWeather(results)

  await persistSearch(payload, results)

  const amadeusHotelCount = results.filter(r => r.hotel.source === 'amadeus-live').length
  const bookingHotelCount = results.filter(r => r.hotel.source === 'booking-live').length
  const liveHotelCount = amadeusHotelCount + bookingHotelCount
  const localHotelCount = results.filter(r => r.hotel.source === 'local-database').length
  const hasLiveHotels = liveHotelCount > 0

  return NextResponse.json({
    results,
    meta: {
      mode: livePayload ? 'live' : 'mock',
      flightSource: flightSource ?? undefined,
      missingKeys: missingKeys.length > 0 ? missingKeys : undefined,
      note: !payload.destination && livePayload
        ? `Discovery mode activ: ${livePayload.discoveryMeta ? `${livePayload.discoveryMeta.destinations.length} destinații analizate` : `destinație ${livePayload.usedDestination}`} bazat pe preferințele tale.`
        : (!payload.destination && liveEnabled
          ? 'Discovery mode: destinații sugerate bazate pe preferințe.'
          : (!payload.destination
            ? 'Discovery mode: destinații sugerate bazate pe preferințe.'
            : undefined)),
      dataSourceWarning: (() => {
        const hotelSourceDesc = hasLiveHotels
          ? `Hoteluri: ${amadeusHotelCount > 0 ? `${amadeusHotelCount} Amadeus` : ''}${amadeusHotelCount > 0 && bookingHotelCount > 0 ? ' + ' : ''}${bookingHotelCount > 0 ? `${bookingHotelCount} Booking.com` : ''} LIVE${localHotelCount > 0 ? ` + ${localHotelCount} bază locală` : ''}.`
          : `Hoteluri: bază de date locală (${getTotalHotels()} hoteluri, prețuri sezoniere).`
        if (livePayload) {
          return `Zboruri: date REALE (${flightSource}). ${hotelSourceDesc} Transferuri: estimate.`
        }
        return `${hotelSourceDesc} Zboruri și transferuri: date simulate.`
      })(),
      hotelSource: hasLiveHotels ? 'amadeus-live' : 'local-database',
      liveHotelCount,
      localHotelCount,
      totalHotels: getTotalHotels(),
    },
  })
}
