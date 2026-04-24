'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import styles from './my-holiday.module.css'

type FlightInfo = {
  airline: string
  duration: string
  stops: string
  outbound: string
  inbound: string
  deepLink?: string
}

type HotelInfo = {
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

type TransferInfo = {
  type: string
  estimatedCost: string
}

type Breakdown = {
  flights: number
  hotel: number
  transfers: number
}

type ForecastDay = {
  date: string
  tempMin: number
  tempMax: number
  description: string
  icon: string
}

type Result = {
  id: string
  destination: string
  total: number
  currency: string
  rating: number
  weather: string
  weatherIcon?: string
  weatherForecast?: ForecastDay[]
  flight: FlightInfo
  hotel: HotelInfo
  transfer: TransferInfo
  breakdown: Breakdown
  source: 'live' | 'mock'
  bookingLink?: string
  bookingToken?: string
  flightSource?: string
  matchReasons?: string[]
}

type SearchMeta = {
  mode: 'live' | 'mock'
  flightSource?: string
  missingKeys?: string[]
  note?: string
  dataSourceWarning?: string
  hotelSource?: string
  liveHotelCount?: number
  localHotelCount?: number
  totalHotels?: number
}

type SearchResponse = {
  results: Result[]
  meta: SearchMeta
}

type ExploreForecastDay = {
  date: string
  tempMin: number
  tempMax: number
  description: string
  icon: string
}

type ExploreSuggestion = {
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
    forecast?: ExploreForecastDay[]
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
    source?: 'kiwi' | 'amadeus'
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

type ExploreResponse = {
  suggestions: ExploreSuggestion[]
  meta: {
    continent: string
    count: number
    weatherSource: string
    flightSource: string
    liveFlightCount: number
    liveWeatherCount: number
    travelSeason: string
  }
}

type BrowseHotel = {
  id: string
  name: string
  description: string
  pricePerNight: number
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
}

type HotelBrowseResponse = {
  hotels: BrowseHotel[]
  total: number
  showing: number
  offset: number
  hasMore: boolean
  source: string
}

type SimilarHotel = {
  id: string
  name: string
  pricePerNight: number
  rating: number
  stars: number
  image: string
  distanceFromCenter: number
}

type HotelDetail = BrowseHotel & {
  basePrice: number
  seasonalPricing: boolean
  seasonMultiplier?: number
}

type HotelDetailResponse = {
  hotel: HotelDetail
  similarHotels: SimilarHotel[]
}

const activities = ['plaja', 'city break', 'safari', 'munte', 'wellness', 'gastronomie']
const continents = ['Europa', 'Africa', 'Asia', 'America de Sud']
const temperatures = ['15-20°C', '20-26°C', '26-32°C', '32°C+']

const currencyFormatter = new Intl.NumberFormat('ro-RO', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
})

const shortDayName = (dateStr: string): string => {
  const days = ['Dum', 'Lun', 'Mar', 'Mie', 'Joi', 'Vin', 'Sam']
  const d = new Date(dateStr + 'T00:00:00')
  return days[d.getDay()]
}

export default function MyHolidayPage() {
  const [origin, setOrigin] = useState('OTP')
  const [destination, setDestination] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [budget, setBudget] = useState('')
  const [adults, setAdults] = useState(2)
  const [withFlights, setWithFlights] = useState(true)
  const [withHotels, setWithHotels] = useState(true)
  const [withTransfers, setWithTransfers] = useState(true)
  const [maxFlightHours, setMaxFlightHours] = useState('')
  const [continent, setContinent] = useState('Europa')
  const [temperature, setTemperature] = useState('')
  const [selectedActivities, setSelectedActivities] = useState<string[]>([])
  const [minStars, setMinStars] = useState('')
  const [hotelFacilities, setHotelFacilities] = useState<string[]>([])
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [message, setMessage] = useState('')
  const [results, setResults] = useState<Result[]>([])
  const [meta, setMeta] = useState<SearchMeta | null>(null)
  const [visibleCount, setVisibleCount] = useState(5)
  const [sortBy, setSortBy] = useState<string>('total_asc')
  const [filterMaxPrice, setFilterMaxPrice] = useState('')
  const [filterMinRating, setFilterMinRating] = useState('')
  const [filterFreeCancellation, setFilterFreeCancellation] = useState(false)

  // Hotel browse state
  const [browseHotels, setBrowseHotels] = useState<BrowseHotel[]>([])
  const [browseTotal, setBrowseTotal] = useState(0)
  const [browseHasMore, setBrowseHasMore] = useState(false)
  const [browseOffset, setBrowseOffset] = useState(0)
  const [browseStatus, setBrowseStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [browseCity, setBrowseCity] = useState('')
  const [browseSortBy, setBrowseSortBy] = useState('rating_desc')
  const [browseMinStars, setBrowseMinStars] = useState('')
  const [browseMaxPrice, setBrowseMaxPrice] = useState('')
  const [browseFacilities, setBrowseFacilities] = useState<string[]>([])
  const [browseFreeCancellation, setBrowseFreeCancellation] = useState(false)

  // Alternative hotels for a specific result
  const [altHotelsFor, setAltHotelsFor] = useState<string | null>(null)
  const [altHotels, setAltHotels] = useState<BrowseHotel[]>([])
  const [altLoading, setAltLoading] = useState(false)

  // Hotel detail modal state
  const [detailHotel, setDetailHotel] = useState<HotelDetail | null>(null)
  const [detailSimilar, setDetailSimilar] = useState<SimilarHotel[]>([])
  const [detailLoading, setDetailLoading] = useState(false)

  // Flight availability check state
  const [checkingFlight, setCheckingFlight] = useState<string | null>(null)
  const [flightAvailability, setFlightAvailability] = useState<Record<string, { available: boolean; price: number | null; message?: string }>>({})

  // Explore suggestions state
  const [exploreSuggestions, setExploreSuggestions] = useState<ExploreSuggestion[]>([])
  const [exploreLoading, setExploreLoading] = useState(false)
  const [exploreContinent, setExploreContinent] = useState<string>('')
  const [exploreSeason, setExploreSeason] = useState('')
  const [exploreLoaded, setExploreLoaded] = useState(false)

  const showDiscoveryFields = destination.trim().length === 0

  const payload = useMemo(() => {
    const budgetNumber = Number(budget)
    return {
      origin,
      destination: destination.trim() || null,
      startDate,
      endDate,
      budget: Number.isNaN(budgetNumber) ? 0 : budgetNumber,
      adults,
      include: {
        flights: withFlights,
        hotels: withHotels,
        transfers: withTransfers,
      },
      preferences: showDiscoveryFields
        ? {
            maxFlightHours: maxFlightHours ? Number(maxFlightHours) : null,
            continent: continent || null,
            temperature: temperature || null,
            activities: selectedActivities,
          }
        : null,
      hotelPreferences: {
        minStars: minStars ? Number(minStars) : null,
        facilities: hotelFacilities,
      },
    }
  }, [
    origin,
    destination,
    startDate,
    endDate,
    budget,
    adults,
    withFlights,
    withHotels,
    withTransfers,
    showDiscoveryFields,
    maxFlightHours,
    continent,
    temperature,
    selectedActivities,
    minStars,
    hotelFacilities,
  ])

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setStatus('loading')
    setMessage('Caut cele mai bune combinatii de calatorie...')
    setVisibleCount(5)

    try {
      const response = await fetch('/api/my-holiday/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        throw new Error('Request failed')
      }

      const data = (await response.json()) as SearchResponse
      setResults(data.results)
      setMeta(data.meta)
      // In discovery mode, default to relevance sorting (server already ranked by preference score)
      if (showDiscoveryFields) {
        setSortBy('relevance')
      }
      setStatus('success')
      setMessage(data.results.length ? 'Am gasit oferte care se potrivesc.' : 'Nu am gasit rezultate.')
    } catch (error) {
      console.error(error)
      setStatus('error')
      setMessage('A aparut o problema. Incearca din nou in cateva secunde.')
    }
  }

  const sortedAndFiltered = useMemo(() => {
    let filtered = [...results]

    // Apply result filters
    if (filterMaxPrice) {
      const max = Number(filterMaxPrice)
      if (!Number.isNaN(max)) filtered = filtered.filter(r => r.total <= max)
    }
    if (filterMinRating) {
      const min = Number(filterMinRating)
      if (!Number.isNaN(min)) filtered = filtered.filter(r => r.hotel.rating >= min)
    }
    if (filterFreeCancellation) {
      filtered = filtered.filter(r => r.hotel.freeCancellation)
    }

    // Apply sorting
    switch (sortBy) {
      case 'total_asc':
        filtered.sort((a, b) => a.total - b.total)
        break
      case 'total_desc':
        filtered.sort((a, b) => b.total - a.total)
        break
      case 'hotel_price_asc':
        filtered.sort((a, b) => a.hotel.pricePerNight - b.hotel.pricePerNight)
        break
      case 'rating_desc':
        filtered.sort((a, b) => b.hotel.rating - a.hotel.rating)
        break
      case 'distance_asc':
        filtered.sort((a, b) => a.hotel.distanceFromCenter - b.hotel.distanceFromCenter)
        break
    }

    return filtered
  }, [results, sortBy, filterMaxPrice, filterMinRating, filterFreeCancellation])

  const visibleResults = sortedAndFiltered.slice(0, visibleCount)

  const toggleActivity = (activity: string) => {
    setSelectedActivities((current) =>
      current.includes(activity)
        ? current.filter((item) => item !== activity)
        : [...current, activity]
    )
  }

  const fetchBrowseHotels = useCallback(async (offset = 0, append = false) => {
    setBrowseStatus('loading')
    const params = new URLSearchParams()
    if (browseCity.trim()) params.set('city', browseCity.trim())
    if (browseMinStars) params.set('minStars', browseMinStars)
    if (browseMaxPrice) params.set('maxPrice', browseMaxPrice)
    if (browseFacilities.length > 0) params.set('facilities', browseFacilities.join(','))
    if (browseFreeCancellation) params.set('freeCancellation', 'true')
    if (startDate) params.set('checkIn', startDate)
    if (endDate) params.set('checkOut', endDate)
    params.set('sortBy', browseSortBy)
    params.set('limit', '12')
    params.set('offset', String(offset))

    try {
      const res = await fetch(`/api/hotels?${params.toString()}`)
      if (!res.ok) throw new Error('Failed to fetch hotels')
      const data = (await res.json()) as HotelBrowseResponse
      setBrowseHotels(append ? prev => [...prev, ...data.hotels] : data.hotels)
      setBrowseTotal(data.total)
      setBrowseHasMore(data.hasMore)
      setBrowseOffset(offset + data.showing)
      setBrowseStatus('success')
    } catch {
      setBrowseStatus('error')
    }
  }, [browseCity, browseMinStars, browseMaxPrice, browseFacilities, browseFreeCancellation, browseSortBy, startDate, endDate])

  const fetchAltHotels = useCallback(async (city: string, resultId: string) => {
    if (altHotelsFor === resultId) {
      setAltHotelsFor(null)
      setAltHotels([])
      return
    }
    setAltHotelsFor(resultId)
    setAltLoading(true)
    const params = new URLSearchParams({ city, sortBy: 'rating_desc', limit: '6' })
    if (startDate) params.set('checkIn', startDate)
    if (endDate) params.set('checkOut', endDate)
    try {
      const res = await fetch(`/api/hotels?${params.toString()}`)
      if (!res.ok) throw new Error('Failed')
      const data = (await res.json()) as HotelBrowseResponse
      setAltHotels(data.hotels)
    } catch {
      setAltHotels([])
    }
    setAltLoading(false)
  }, [altHotelsFor, startDate, endDate])

  const openHotelDetail = useCallback(async (hotelId: string) => {
    setDetailLoading(true)
    setDetailHotel(null)
    setDetailSimilar([])
    const params = new URLSearchParams()
    if (startDate) params.set('checkIn', startDate)
    try {
      const res = await fetch(`/api/hotels/${hotelId}?${params.toString()}`)
      if (!res.ok) throw new Error('Failed')
      const data = (await res.json()) as HotelDetailResponse
      setDetailHotel(data.hotel)
      setDetailSimilar(data.similarHotels)
    } catch {
      setDetailHotel(null)
    }
    setDetailLoading(false)
  }, [startDate])

  const checkFlightAvailability = useCallback(async (resultId: string, bookingToken: string) => {
    setCheckingFlight(resultId)
    try {
      const res = await fetch('/api/flights/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingToken, adults }),
      })
      if (!res.ok) throw new Error('Check failed')
      const data = (await res.json()) as { available: boolean; price: number | null; invalidReason?: string }
      setFlightAvailability(prev => ({
        ...prev,
        [resultId]: {
          available: data.available,
          price: data.price,
          message: data.available
            ? (data.price ? `Disponibil — ${data.price} EUR` : 'Disponibil')
            : (data.invalidReason || 'Zborul nu mai este disponibil'),
        },
      }))
    } catch {
      setFlightAvailability(prev => ({
        ...prev,
        [resultId]: { available: false, price: null, message: 'Eroare la verificare' },
      }))
    } finally {
      setCheckingFlight(null)
    }
  }, [adults])

  const closeHotelDetail = useCallback(() => {
    setDetailHotel(null)
    setDetailSimilar([])
  }, [])

  const [exploreMeta, setExploreMeta] = useState<ExploreResponse['meta'] | null>(null)

  const fetchExploreSuggestions = useCallback(async (continentFilter?: string) => {
    setExploreLoading(true)
    const params = new URLSearchParams({ limit: '12' })
    if (continentFilter) params.set('continent', continentFilter)
    if (startDate) params.set('travelDate', startDate)
    if (origin) params.set('origin', origin)
    if (temperature) params.set('temperature', temperature)
    if (selectedActivities.length > 0) params.set('activities', selectedActivities.join(','))

    try {
      const res = await fetch(`/api/explore?${params.toString()}`)
      if (!res.ok) throw new Error('Failed')
      const data = (await res.json()) as ExploreResponse
      setExploreSuggestions(data.suggestions)
      setExploreSeason(data.meta.travelSeason)
      setExploreMeta(data.meta)
      setExploreLoaded(true)
    } catch {
      setExploreSuggestions([])
    }
    setExploreLoading(false)
  }, [startDate, origin, temperature, selectedActivities])

  // Auto-load explore suggestions on mount
  const [exploreAutoLoaded, setExploreAutoLoaded] = useState(false)
  useEffect(() => {
    if (!exploreAutoLoaded) {
      setExploreAutoLoaded(true)
      fetchExploreSuggestions('')
    }
  }, [exploreAutoLoaded, fetchExploreSuggestions])

  // Refresh explore suggestions when discovery preferences change
  const [exploreRefreshKey, setExploreRefreshKey] = useState('')
  useEffect(() => {
    const key = `${temperature}|${selectedActivities.join(',')}`
    if (exploreAutoLoaded && key !== exploreRefreshKey) {
      setExploreRefreshKey(key)
      fetchExploreSuggestions(exploreContinent || '')
    }
  }, [temperature, selectedActivities, exploreAutoLoaded, exploreRefreshKey, exploreContinent, fetchExploreSuggestions])

  const handleExploreCardClick = useCallback((suggestion: ExploreSuggestion) => {
    // Set the destination and pre-fill form with suggestion context
    setDestination(suggestion.displayName)
    setContinent(suggestion.continent)
    // Pre-select matching activities
    if (suggestion.activities.length > 0) {
      setSelectedActivities(prev => {
        const merged = new Set([...prev, ...suggestion.activities])
        return [...merged]
      })
    }
    // Scroll to the search form
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  const handleQuickExplore = useCallback((suggestion: ExploreSuggestion) => {
    // Set destination and auto-submit search
    setDestination(suggestion.displayName)
    if (!startDate || !endDate || !budget) {
      // If dates/budget not set, just fill destination and scroll
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }
    // Auto-submit by calling the search directly
    setStatus('loading')
    setMessage('Caut oferte pentru ' + suggestion.displayName + '...')
    setVisibleCount(5)

    const searchPayload = {
      origin,
      destination: suggestion.displayName,
      startDate,
      endDate,
      budget: Number(budget) || 800,
      adults,
      include: { flights: withFlights, hotels: withHotels, transfers: withTransfers },
      preferences: {
        maxFlightHours: maxFlightHours ? Number(maxFlightHours) : null,
        continent: suggestion.continent || null,
        temperature: temperature || null,
        activities: suggestion.activities,
      },
      hotelPreferences: {
        minStars: minStars ? Number(minStars) : null,
        facilities: hotelFacilities,
      },
    }

    fetch('/api/my-holiday/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(searchPayload),
    })
      .then(res => {
        if (!res.ok) throw new Error('Request failed')
        return res.json() as Promise<SearchResponse>
      })
      .then(data => {
        setResults(data.results)
        setMeta(data.meta)
        setStatus('success')
        setMessage(data.results.length ? `Am gasit ${data.results.length} oferte pentru ${suggestion.displayName}.` : 'Nu am gasit rezultate.')
        window.scrollTo({ top: 0, behavior: 'smooth' })
      })
      .catch(() => {
        setStatus('error')
        setMessage('A aparut o problema. Incearca din nou.')
      })
  }, [origin, startDate, endDate, budget, adults, withFlights, withHotels, withTransfers, minStars, hotelFacilities, maxFlightHours, temperature])

  return (
    <div className={styles.shell}>
      <div className={styles.container}>
        <section className={`${styles.hero} ${styles.fadeIn}`}>
          <span className={styles.badge}>MVP My Holiday · Europa, Africa, Asia, America de Sud</span>
          <h1 className={styles.title}>My Holiday – combinam zboruri, hoteluri si transferuri, optimizand costul total.</h1>
          <p className={styles.subtitle}>
            Introdu perioada si bugetul, iar noi corelam last-minute flights, hoteluri si transferuri
            (shuttle/public). Daca nu ai destinatie, te ajutam sa explorezi locuri noi.
          </p>
          <div className={styles.heroHighlights}>
            <div>Costuri defalcate automat</div>
            <div>5 oferte per ecran + load more</div>
            <div>Sortare initiala dupa pret total</div>
          </div>
        </section>

        <section className={`${styles.formCard} ${styles.fadeIn}`}>
          <form onSubmit={handleSubmit} className={styles.formCard}>
            <div className={styles.formGrid}>
              <label className={styles.field}>
                <span className={styles.label}>Plecare (aeroport / oras)</span>
                <input
                  className={styles.input}
                  value={origin}
                  onChange={(event) => setOrigin(event.target.value)}
                  placeholder="OTP"
                  required
                />
              </label>
              <label className={styles.field}>
                <span className={styles.label}>Destinatie (optional)</span>
                <input
                  className={styles.input}
                  value={destination}
                  onChange={(event) => setDestination(event.target.value)}
                  placeholder="Roma, Lisboa, Barcelona"
                />
              </label>
              <label className={styles.field}>
                <span className={styles.label}>Data plecare</span>
                <input
                  className={styles.input}
                  type="date"
                  value={startDate}
                  onChange={(event) => setStartDate(event.target.value)}
                  required
                />
              </label>
              <label className={styles.field}>
                <span className={styles.label}>Data intoarcere</span>
                <input
                  className={styles.input}
                  type="date"
                  value={endDate}
                  onChange={(event) => setEndDate(event.target.value)}
                  required
                />
              </label>
              <label className={styles.field}>
                <span className={styles.label}>Buget total (EUR)</span>
                <input
                  className={styles.input}
                  type="number"
                  min="100"
                  value={budget}
                  onChange={(event) => setBudget(event.target.value)}
                  placeholder="1000"
                  required
                />
              </label>
              <label className={styles.field}>
                <span className={styles.label}>Numar adulti</span>
                <input
                  className={styles.input}
                  type="number"
                  min="1"
                  value={adults}
                  onChange={(event) => setAdults(Number(event.target.value))}
                />
              </label>
            </div>

            <div className={styles.toggles}>
              <label className={styles.toggle}>
                <input
                  type="checkbox"
                  checked={withFlights}
                  onChange={(event) => setWithFlights(event.target.checked)}
                />
                Zboruri
              </label>
              <label className={styles.toggle}>
                <input
                  type="checkbox"
                  checked={withHotels}
                  onChange={(event) => setWithHotels(event.target.checked)}
                />
                Hoteluri
              </label>
              <label className={styles.toggle}>
                <input
                  type="checkbox"
                  checked={withTransfers}
                  onChange={(event) => setWithTransfers(event.target.checked)}
                />
                Transfer aeroport
              </label>
            </div>

            {withHotels ? (
              <div className={styles.formGrid}>
                <label className={styles.field}>
                  <span className={styles.label}>Minim stele hotel</span>
                  <select
                    className={styles.select}
                    value={minStars}
                    onChange={(event) => setMinStars(event.target.value)}
                  >
                    <option value="">Orice</option>
                    <option value="2">2+ stele</option>
                    <option value="3">3+ stele</option>
                    <option value="4">4+ stele</option>
                    <option value="5">5 stele</option>
                  </select>
                </label>
                <div className={styles.field}>
                  <span className={styles.label}>Facilitati hotel</span>
                  <div className={styles.toggles}>
                    {['WiFi', 'Breakfast', 'Pool', 'Spa', 'Gym', 'Bar'].map((facility) => (
                      <label key={facility} className={styles.toggle}>
                        <input
                          type="checkbox"
                          checked={hotelFacilities.includes(facility)}
                          onChange={() =>
                            setHotelFacilities((current) =>
                              current.includes(facility)
                                ? current.filter((f) => f !== facility)
                                : [...current, facility]
                            )
                          }
                        />
                        {facility}
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            ) : null}

            {showDiscoveryFields ? (
              <div className={styles.formGrid}>
                <label className={styles.field}>
                  <span className={styles.label}>Max ore de zbor</span>
                  <input
                    className={styles.input}
                    type="number"
                    min="1"
                    value={maxFlightHours}
                    onChange={(event) => setMaxFlightHours(event.target.value)}
                    placeholder="4"
                  />
                </label>
                <label className={styles.field}>
                  <span className={styles.label}>Continent</span>
                  <select
                    className={styles.select}
                    value={continent}
                    onChange={(event) => setContinent(event.target.value)}
                  >
                    {continents.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </label>
                <label className={styles.field}>
                  <span className={styles.label}>Temperatura ideala</span>
                  <select
                    className={styles.select}
                    value={temperature}
                    onChange={(event) => setTemperature(event.target.value)}
                  >
                    <option value="">Nu conteaza</option>
                    {temperatures.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </label>
                <div className={styles.field}>
                  <span className={styles.label}>Activitati</span>
                  <div className={styles.toggles}>
                    {activities.map((activity) => (
                      <label key={activity} className={styles.toggle}>
                        <input
                          type="checkbox"
                          checked={selectedActivities.includes(activity)}
                          onChange={() => toggleActivity(activity)}
                        />
                        {activity}
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            ) : null}

            <div className={styles.ctaRow}>
              <button className={styles.primaryBtn} type="submit" disabled={status === 'loading'}>
                {status === 'loading' ? 'Caut oferte...' : 'Cauta oferte'}
              </button>
              <button
                className={styles.secondaryBtn}
                type="button"
                onClick={() => {
                  setDestination('')
                  setSelectedActivities([])
                }}
              >
                Exploreaza fara destinatie
              </button>
            </div>

            {status !== 'idle' ? <div className={styles.banner}>{message}</div> : null}
            {meta?.mode === 'mock' && meta.missingKeys?.length ? (
              <div className={styles.banner}>
                Lipsesc cheile API: {meta.missingKeys.join(', ')}. Conecteaza providerii pentru date live.
              </div>
            ) : null}
            {meta?.dataSourceWarning ? (
              <div className={styles.banner}>
                {meta.dataSourceWarning}
              </div>
            ) : null}
            {meta?.note ? (
              <div className={styles.banner} style={{ background: 'rgba(59,130,246,0.08)', borderColor: 'rgba(59,130,246,0.2)', color: '#1d4ed8' }}>
                {meta.note}
              </div>
            ) : null}
          </form>
        </section>

        {/* Explore section — dynamic destination suggestions with live data */}
        <section className={`${styles.exploreSection} ${styles.fadeIn}`}>
          <div className={styles.exploreHeader}>
            <div>
              <h2 className={styles.exploreTitle}>Exploreaza destinatii</h2>
              <p className={styles.exploreSubtitle}>
                Destinatii sugerate cu date meteo si preturi live. Selecteaza un continent sau apasa pe o destinatie.
              </p>
            </div>
            <div className={styles.exploreHeaderRight}>
              {exploreMeta && exploreMeta.liveFlightCount > 0 ? (
                <span className={styles.exploreLiveBadge}>
                  LIVE {exploreMeta.liveFlightCount}/{exploreMeta.count} zboruri
                </span>
              ) : null}
              {exploreSeason ? (
                <span className={styles.exploreSeason}>
                  Sezon: {exploreSeason}
                </span>
              ) : null}
            </div>
          </div>
          <div className={styles.exploreFilters}>
            <button
              type="button"
              className={`${styles.exploreFilterBtn} ${exploreContinent === '' ? styles.exploreFilterBtnActive : ''}`}
              onClick={() => { setExploreContinent(''); fetchExploreSuggestions('') }}
            >
              Toate
            </button>
            {continents.map(c => (
              <button
                key={c}
                type="button"
                className={`${styles.exploreFilterBtn} ${exploreContinent === c ? styles.exploreFilterBtnActive : ''}`}
                onClick={() => { setExploreContinent(c); fetchExploreSuggestions(c) }}
              >
                {c}
              </button>
            ))}
          </div>
          {exploreLoading ? (
            <div className={styles.exploreLoading}>Se incarca sugestii de destinatii cu date live...</div>
          ) : exploreSuggestions.length > 0 ? (
            <div className={styles.exploreGrid}>
              {exploreSuggestions.map(suggestion => (
                <div
                  key={suggestion.iata}
                  className={styles.exploreCard}
                  onClick={() => handleExploreCardClick(suggestion)}
                >
                  <div className={styles.exploreCardTop}>
                    <div className={styles.exploreCardTopHeader}>
                      <p className={styles.exploreCardCity}>{suggestion.city}</p>
                      {suggestion.liveFlightPrice ? (
                        <span className={styles.exploreCardLiveTag}>
                          LIVE{suggestion.liveFlightPrice.source ? ` · ${suggestion.liveFlightPrice.source === 'kiwi' ? 'Kiwi' : 'Amadeus'}` : ''}
                        </span>
                      ) : null}
                    </div>
                    <p className={styles.exploreCardCountry}>{suggestion.country} · {suggestion.continent}</p>
                    {suggestion.weather ? (
                      <div className={styles.exploreCardWeather}>
                        <img
                          src={suggestion.weather.iconUrl}
                          alt=""
                          width={40}
                          height={40}
                          className={styles.exploreCardWeatherIcon}
                        />
                        <span className={styles.exploreCardTemp}>{suggestion.weather.temp}°C</span>
                        <span className={styles.exploreCardWeatherDesc}>{suggestion.weather.description}</span>
                      </div>
                    ) : (
                      <div className={styles.exploreCardWeather}>
                        <span className={styles.exploreCardTemp}>~{suggestion.seasonalTemp}°C</span>
                        <span className={styles.exploreCardWeatherDesc}>medie sezoniera</span>
                      </div>
                    )}
                    {suggestion.weather?.forecast && suggestion.weather.forecast.length > 0 ? (
                      <div className={styles.exploreCardForecast}>
                        {suggestion.weather.forecast.map(day => (
                          <div key={day.date} className={styles.exploreCardForecastDay}>
                            <span className={styles.forecastDayName}>{shortDayName(day.date)}</span>
                            <img
                              src={`https://openweathermap.org/img/wn/${day.icon}.png`}
                              alt=""
                              width={24}
                              height={24}
                            />
                            <span className={styles.forecastTemps}>{day.tempMin}°/{day.tempMax}°</span>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                  <div className={styles.exploreCardBody}>
                    <div className={styles.exploreCardActivities}>
                      {suggestion.activities.map(a => (
                        <span key={a} className={styles.exploreActivityTag}>{a}</span>
                      ))}
                    </div>
                    <div className={styles.exploreCardPrice}>
                      {suggestion.liveFlightPrice ? (
                        <>
                          Zbor de la: <span className={styles.exploreCardPriceValue}>{suggestion.liveFlightPrice.min} EUR</span>
                          {suggestion.liveFlightPrice.airline ? (
                            <span className={styles.exploreCardAirline}> · {suggestion.liveFlightPrice.airline}</span>
                          ) : null}
                          {suggestion.liveFlightPrice.duration ? (
                            <span className={styles.exploreCardDuration}> · {suggestion.liveFlightPrice.duration}</span>
                          ) : null}
                          {suggestion.liveFlightPrice.stops != null ? (
                            <span className={styles.exploreCardStops}>
                              {' '}· {suggestion.liveFlightPrice.stops === 0 ? 'Direct' : `${suggestion.liveFlightPrice.stops} escala`}
                            </span>
                          ) : null}
                        </>
                      ) : (
                        <>
                          Zbor estimat: <span className={styles.exploreCardPriceValue}>{suggestion.estimatedFlightPrice.min}–{suggestion.estimatedFlightPrice.max} EUR</span>
                        </>
                      )}
                    </div>
                    {suggestion.hotelPricing ? (
                      <div className={styles.exploreCardHotelCount}>
                        {suggestion.hotelCount} hoteluri · de la {suggestion.hotelPricing.minPricePerNight} EUR/noapte
                        {suggestion.hotelPricing.topHotelName ? (
                          <span className={styles.exploreCardTopHotel}>
                            {' '}· Top: {suggestion.hotelPricing.topHotelName}
                            {suggestion.hotelPricing.topHotelStars ? ` ${'★'.repeat(suggestion.hotelPricing.topHotelStars)}` : ''}
                          </span>
                        ) : null}
                      </div>
                    ) : suggestion.hotelCount > 0 ? (
                      <div className={styles.exploreCardHotelCount}>
                        {suggestion.hotelCount} hoteluri disponibile
                      </div>
                    ) : null}
                    {suggestion.matchReasons.length > 0 ? (
                      <div className={styles.exploreCardMatchReasons}>
                        {suggestion.matchReasons.map((reason, i) => (
                          <span key={i} className={styles.matchTag}>{reason}</span>
                        ))}
                      </div>
                    ) : null}
                    <button
                      type="button"
                      className={styles.exploreCardCta}
                      onClick={(e) => {
                        e.stopPropagation()
                        handleQuickExplore(suggestion)
                      }}
                    >
                      Cauta oferte
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : exploreLoaded ? (
            <div className={styles.exploreLoading}>Nu s-au gasit destinatii pentru filtrul selectat.</div>
          ) : (
            <div className={styles.exploreLoading}>
              <button
                type="button"
                className={styles.primaryBtn}
                onClick={() => fetchExploreSuggestions(exploreContinent || '')}
              >
                Incarca destinatii sugerate
              </button>
            </div>
          )}
        </section>

        {results.length > 0 ? (
          <section className={`${styles.filtersBar} ${styles.fadeIn}`}>
            <div className={styles.filtersRow}>
              <label className={styles.filterField}>
                <span className={styles.filterLabel}>Sorteaza dupa</span>
                <select
                  className={styles.select}
                  value={sortBy}
                  onChange={(e) => { setSortBy(e.target.value); setVisibleCount(5) }}
                >
                  {showDiscoveryFields && <option value="relevance">Relevanta (preferinte)</option>}
                  <option value="total_asc">Pret total (crescator)</option>
                  <option value="total_desc">Pret total (descrescator)</option>
                  <option value="hotel_price_asc">Pret hotel/noapte (crescator)</option>
                  <option value="rating_desc">Rating hotel (descrescator)</option>
                  <option value="distance_asc">Distanta de centru (aproape)</option>
                </select>
              </label>
              <label className={styles.filterField}>
                <span className={styles.filterLabel}>Pret max total (EUR)</span>
                <input
                  className={styles.input}
                  type="number"
                  min="0"
                  value={filterMaxPrice}
                  onChange={(e) => { setFilterMaxPrice(e.target.value); setVisibleCount(5) }}
                  placeholder="fara limita"
                />
              </label>
              <label className={styles.filterField}>
                <span className={styles.filterLabel}>Rating minim hotel</span>
                <select
                  className={styles.select}
                  value={filterMinRating}
                  onChange={(e) => { setFilterMinRating(e.target.value); setVisibleCount(5) }}
                >
                  <option value="">Orice</option>
                  <option value="3.5">3.5+</option>
                  <option value="4.0">4.0+</option>
                  <option value="4.5">4.5+</option>
                </select>
              </label>
              <label className={styles.filterToggle}>
                <input
                  type="checkbox"
                  checked={filterFreeCancellation}
                  onChange={(e) => { setFilterFreeCancellation(e.target.checked); setVisibleCount(5) }}
                />
                Anulare gratuita
              </label>
            </div>
            <div className={styles.filterStats}>
              {sortedAndFiltered.length} din {results.length} rezultate
              {meta?.flightSource ? (
                <span className={styles.sourceTag}>Zboruri: {meta.flightSource}</span>
              ) : null}
              {meta?.hotelSource === 'amadeus-live' || meta?.hotelSource === 'booking-live' || (meta?.liveHotelCount && meta.liveHotelCount > 0) ? (
                <span className={styles.sourceTag}>Hoteluri: {meta?.liveHotelCount ?? 0} LIVE + {meta?.localHotelCount ?? 0} locale</span>
              ) : meta?.hotelSource === 'local-database' ? (
                <span className={styles.sourceTag} style={{ background: 'rgba(234,179,8,0.15)', color: '#a16207' }}>Hoteluri: preturi estimate ({meta.totalHotels} hoteluri)</span>
              ) : null}
            </div>
          </section>
        ) : null}

        <section className={styles.results}>
          {visibleResults.map((result) => (
            <article key={result.id} className={`${styles.resultCard} ${styles.fadeIn}`}>
              <div className={styles.resultHeader}>
                <div>
                  <p className={styles.destination}>{result.destination}</p>
                  <span className={styles.tag}>Rating {result.rating.toFixed(1)}</span>
                  {result.matchReasons && result.matchReasons.length > 0 && (
                    <span className={styles.matchReasons}>
                      {result.matchReasons.map((reason, i) => (
                        <span key={i} className={styles.matchTag}>{reason}</span>
                      ))}
                    </span>
                  )}
                </div>
                <div className={styles.price}>{currencyFormatter.format(result.total)}</div>
              </div>
              <div className={styles.kpis}>
                <div className={styles.kpi}>
                  {result.weatherIcon ? (
                    <span className={styles.weatherKpi}>
                      <img src={result.weatherIcon} alt="" width={32} height={32} className={styles.weatherIcon} />
                      {result.weather}
                    </span>
                  ) : (
                    <>Vreme: {result.weather}</>
                  )}
                </div>
                <div className={styles.kpi}>Zbor: {result.flight.duration} · {result.flight.stops}</div>
                <div className={styles.kpi}>Hotel: {result.hotel.id ? (
                  <Link href={`/hotels/${result.hotel.id}?${[startDate && `checkIn=${startDate}`, endDate && `checkOut=${endDate}`].filter(Boolean).join('&')}`} className={styles.hotelLink}>{result.hotel.name}</Link>
                ) : result.hotel.name} · {'★'.repeat(result.hotel.stars)}
                {result.hotel.source === 'amadeus-live' ? (
                  <span className={styles.sourceTag} style={{ marginLeft: 6, fontSize: '0.65rem', background: '#16a34a', color: '#fff' }}>LIVE Amadeus</span>
                ) : result.hotel.source === 'booking-live' ? (
                  <span className={styles.sourceTag} style={{ marginLeft: 6, fontSize: '0.65rem', background: '#003580', color: '#fff' }}>LIVE Booking</span>
                ) : (
                  <span className={styles.sourceTag} style={{ marginLeft: 6, fontSize: '0.65rem', background: 'rgba(234,179,8,0.15)', color: '#a16207' }}>Estimat</span>
                )}
                </div>
                <div className={styles.kpi}>Transfer: {result.transfer.type}</div>
              </div>
              {result.weatherForecast && result.weatherForecast.length > 0 ? (
                <div className={styles.forecastRow}>
                  <span className={styles.forecastLabel}>Prognoza 3 zile:</span>
                  {result.weatherForecast.map((day) => (
                    <div key={day.date} className={styles.forecastDay}>
                      <span className={styles.forecastDayName}>{shortDayName(day.date)}</span>
                      <img
                        src={`https://openweathermap.org/img/wn/${day.icon}@2x.png`}
                        alt=""
                        width={28}
                        height={28}
                        className={styles.forecastIcon}
                      />
                      <span className={styles.forecastTemps}>
                        {day.tempMax}° / {day.tempMin}°
                      </span>
                    </div>
                  ))}
                </div>
              ) : null}
              <div className={styles.flightHotel}>
                <div>
                  <div className={styles.sectionTitle}>Detalii zbor</div>
                  <div className={styles.breakdown}>Companie: {result.flight.airline}</div>
                  <div className={styles.breakdown}>Dus: {result.flight.outbound}</div>
                  <div className={styles.breakdown}>Intors: {result.flight.inbound}</div>
                  {result.source === 'live' ? (
                    <div className={styles.breakdown}>
                      <span className={styles.sourceTag}>Date reale</span>
                      {result.flightSource ? (
                        <span className={styles.sourceTag} style={{ marginLeft: '0.3rem' }}>
                          via {result.flightSource}
                        </span>
                      ) : null}
                    </div>
                  ) : null}
                  {result.flight.deepLink ? (
                    <a
                      href={result.flight.deepLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={styles.primaryBtn}
                      style={{ display: 'inline-block', marginTop: '0.5rem', fontSize: '0.85rem', padding: '0.4rem 1rem' }}
                    >
                      Rezerva zborul
                    </a>
                  ) : result.bookingLink ? (
                    <a
                      href={result.bookingLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={styles.primaryBtn}
                      style={{ display: 'inline-block', marginTop: '0.5rem', fontSize: '0.85rem', padding: '0.4rem 1rem' }}
                    >
                      Rezerva zborul
                    </a>
                  ) : null}
                  {result.bookingToken ? (
                    <div style={{ marginTop: '0.4rem' }}>
                      {flightAvailability[result.id] ? (
                        <span style={{
                          fontSize: '0.8rem',
                          color: flightAvailability[result.id].available ? '#22c55e' : '#ef4444',
                        }}>
                          {flightAvailability[result.id].message}
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => checkFlightAvailability(result.id, result.bookingToken!)}
                          disabled={checkingFlight === result.id}
                          className={styles.secondaryBtn}
                          style={{ fontSize: '0.8rem', padding: '0.3rem 0.8rem' }}
                        >
                          {checkingFlight === result.id ? 'Se verifica...' : 'Verifica disponibilitate'}
                        </button>
                      )}
                    </div>
                  ) : null}
                </div>
                <div>
                  <div className={styles.sectionTitle}>Detalii hotel</div>
                  {result.hotel.image ? (
                    <img
                      src={result.hotel.image}
                      alt={result.hotel.name}
                      className={styles.hotelImage}
                      loading="lazy"
                    />
                  ) : null}
                  {result.hotel.id ? (
                    <Link href={`/hotels/${result.hotel.id}?${[startDate && `checkIn=${startDate}`, endDate && `checkOut=${endDate}`].filter(Boolean).join('&')}`} className={styles.hotelLink}>
                      <strong>{result.hotel.name}</strong> — vezi detalii complete
                    </Link>
                  ) : null}
                  {result.hotel.description && (
                    <div className={styles.breakdown} style={{ fontSize: '0.8rem', opacity: 0.85, lineHeight: 1.4, marginBottom: 4 }}>
                      {result.hotel.description.length > 120 ? result.hotel.description.slice(0, 120) + '...' : result.hotel.description}
                    </div>
                  )}
                  <div className={styles.breakdown}>
                    {'★'.repeat(result.hotel.stars)}{'☆'.repeat(5 - result.hotel.stars)} · {result.hotel.rating.toFixed(1)}/5
                  </div>
                  <div className={styles.breakdown}>{currencyFormatter.format(result.hotel.pricePerNight)} / noapte</div>
                  <div className={styles.breakdown}>{result.hotel.distanceFromCenter} km de centru</div>
                  {result.hotel.checkInTime && (
                    <div className={styles.breakdown}>Check-in: {result.hotel.checkInTime} · Check-out: {result.hotel.checkOutTime}</div>
                  )}
                  <div className={styles.breakdown}>Mic dejun: {result.hotel.breakfastIncluded ? 'Inclus' : 'Nu'}</div>
                  <div className={styles.breakdown}>Anulare gratuita: {result.hotel.freeCancellation ? 'Da' : 'Nu'}
                    {result.hotel.cancellationPolicy && result.hotel.cancellationPolicy !== 'Non-refundable' && (
                      <span style={{ fontSize: '0.75rem', opacity: 0.8 }}> ({result.hotel.cancellationPolicy})</span>
                    )}
                  </div>
                  <div className={styles.breakdown}>
                    Sursa: <span className={styles.sourceTag}>{result.hotel.source === 'amadeus-live' ? 'Amadeus LIVE' : result.hotel.source === 'booking-live' ? 'Booking.com LIVE' : result.hotel.source === 'local-database' ? 'Baza de date locala' : 'Estimare'}</span>
                  </div>
                  {result.hotel.facilities.length > 0 ? (
                    <div className={styles.facilities}>
                      {result.hotel.facilities.map((f) => (
                        <span key={f} className={styles.facilityTag}>{f}</span>
                      ))}
                    </div>
                  ) : null}
                  <button
                    className={styles.altHotelsBtn}
                    type="button"
                    onClick={() => {
                      const city = result.destination.split(',')[0].replace(/\s*\([A-Z]{3}\)\s*$/, '').trim()
                      fetchAltHotels(city, result.id)
                    }}
                  >
                    {altHotelsFor === result.id ? 'Ascunde alternative' : 'Vezi hoteluri alternative'}
                  </button>
                  {altHotelsFor === result.id ? (
                    <div className={styles.altHotelsGrid}>
                      {altLoading ? (
                        <div className={styles.altLoading}>Se incarca hoteluri...</div>
                      ) : altHotels.length > 0 ? (
                        altHotels.map((h) => (
                          <div key={h.id} className={styles.altHotelCard}>
                            {h.image ? (
                              <img src={h.image} alt={h.name} className={styles.altHotelImg} loading="lazy" />
                            ) : null}
                            <div className={styles.altHotelInfo}>
                              <strong>{h.name}</strong>
                              <span>{'★'.repeat(h.stars)}{'☆'.repeat(5 - h.stars)} · {h.rating.toFixed(1)}</span>
                              <span>{currencyFormatter.format(h.pricePerNight)} / noapte</span>
                              <span>{h.distanceFromCenter} km de centru</span>
                              {h.freeCancellation ? <span className={styles.facilityTag}>Anulare gratuita</span> : null}
                              {h.availability?.roomsLeft ? (
                                <span className={styles.roomsLeft}>
                                  {h.availability.roomsLeft} {h.availability.roomsLeft === 1 ? 'camera ramasa' : 'camere ramase'}
                                </span>
                              ) : null}
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className={styles.altLoading}>Nu s-au gasit hoteluri alternative.</div>
                      )}
                    </div>
                  ) : null}
                </div>
                <div>
                  <div className={styles.sectionTitle}>Costuri</div>
                  <div className={styles.breakdown}>Zboruri: {currencyFormatter.format(result.breakdown.flights)}</div>
                  <div className={styles.breakdown}>Hotel: {currencyFormatter.format(result.breakdown.hotel)}</div>
                  <div className={styles.breakdown}>Transfer: {currencyFormatter.format(result.breakdown.transfers)}</div>
                </div>
              </div>
            </article>
          ))}
        </section>

        {sortedAndFiltered.length > visibleCount ? (
          <button
            className={styles.secondaryBtn}
            type="button"
            onClick={() => setVisibleCount((count) => count + 5)}
          >
            Afiseaza alte oferte
          </button>
        ) : null}

        <section className={`${styles.hotelBrowseSection} ${styles.fadeIn}`}>
          <h2 className={styles.browseSectionTitle}>Exploreaza hoteluri</h2>
          <p className={styles.browseSectionSubtitle}>
            Cauta direct in baza de date cu 210+ hoteluri din 27 orase pe 4 continente.
            {' '}<Link href="/hotels" style={{ color: 'var(--holiday-lagoon, #2b7a78)', fontWeight: 600 }}>Vezi toate hotelurile &rarr;</Link>
          </p>
          <div className={styles.browseControls}>
            <label className={styles.filterField}>
              <span className={styles.filterLabel}>Oras</span>
              <input
                className={styles.input}
                value={browseCity}
                onChange={(e) => setBrowseCity(e.target.value)}
                placeholder="Roma, Barcelona, Praga..."
              />
            </label>
            <label className={styles.filterField}>
              <span className={styles.filterLabel}>Sorteaza</span>
              <select
                className={styles.select}
                value={browseSortBy}
                onChange={(e) => setBrowseSortBy(e.target.value)}
              >
                <option value="rating_desc">Rating (descrescator)</option>
                <option value="price_asc">Pret (crescator)</option>
                <option value="price_desc">Pret (descrescator)</option>
                <option value="distance_asc">Distanta de centru</option>
              </select>
            </label>
            <label className={styles.filterField}>
              <span className={styles.filterLabel}>Minim stele</span>
              <select
                className={styles.select}
                value={browseMinStars}
                onChange={(e) => setBrowseMinStars(e.target.value)}
              >
                <option value="">Orice</option>
                <option value="3">3+</option>
                <option value="4">4+</option>
                <option value="5">5</option>
              </select>
            </label>
            <label className={styles.filterField}>
              <span className={styles.filterLabel}>Pret max/noapte</span>
              <input
                className={styles.input}
                type="number"
                min="0"
                value={browseMaxPrice}
                onChange={(e) => setBrowseMaxPrice(e.target.value)}
                placeholder="fara limita"
              />
            </label>
            <label className={styles.filterToggle}>
              <input
                type="checkbox"
                checked={browseFreeCancellation}
                onChange={(e) => setBrowseFreeCancellation(e.target.checked)}
              />
              Anulare gratuita
            </label>
          </div>
          <div className={styles.browseFacilitiesRow}>
            <span className={styles.filterLabel}>Facilitati:</span>
            {['WiFi', 'Breakfast', 'Pool', 'Spa', 'Gym', 'Bar', 'Parking', 'Garden'].map((f) => (
              <label key={f} className={styles.toggle}>
                <input
                  type="checkbox"
                  checked={browseFacilities.includes(f)}
                  onChange={() =>
                    setBrowseFacilities((prev) =>
                      prev.includes(f) ? prev.filter((x) => x !== f) : [...prev, f]
                    )
                  }
                />
                {f}
              </label>
            ))}
          </div>
          <div className={styles.ctaRow}>
            <button
              className={styles.primaryBtn}
              type="button"
              disabled={browseStatus === 'loading'}
              onClick={() => { setBrowseOffset(0); fetchBrowseHotels(0) }}
            >
              {browseStatus === 'loading' ? 'Se cauta...' : 'Cauta hoteluri'}
            </button>
            {browseStatus === 'success' ? (
              <span className={styles.filterStats}>{browseTotal} hoteluri gasite</span>
            ) : null}
          </div>

          {browseStatus === 'error' ? (
            <div className={styles.banner}>Eroare la incarcarea hotelurilor. Incearca din nou.</div>
          ) : null}

          {browseHotels.length > 0 ? (
            <div className={styles.browseHotelGrid}>
              {browseHotels.map((h) => (
                <article
                  key={h.id}
                  className={`${styles.browseHotelCard} ${styles.browseHotelClickable}`}
                  onClick={() => openHotelDetail(h.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => { if (e.key === 'Enter') openHotelDetail(h.id) }}
                >
                  {h.image ? (
                    <img src={h.image} alt={h.name} className={styles.browseHotelImg} loading="lazy" />
                  ) : null}
                  <div className={styles.browseHotelBody}>
                    <div className={styles.browseHotelHeader}>
                      <strong className={styles.browseHotelName}>{h.name}</strong>
                      <span className={styles.browseHotelPrice}>{currencyFormatter.format(h.pricePerNight)}/noapte</span>
                    </div>
                    <div className={styles.browseHotelMeta}>
                      <span>{'★'.repeat(h.stars)}{'☆'.repeat(5 - h.stars)}</span>
                      <span>Rating: {h.rating.toFixed(1)} ({h.reviewsCount} recenzii)</span>
                      <span>{h.distanceFromCenter} km de centru</span>
                    </div>
                    {h.description && <div className={styles.browseHotelDescription}>{h.description}</div>}
                    <div className={styles.browseHotelLocation}>
                      {h.location.city}, {h.location.country}
                    </div>
                    <div className={styles.facilities}>
                      {h.facilities.map((f) => (
                        <span key={f} className={styles.facilityTag}>{f}</span>
                      ))}
                    </div>
                    <div className={styles.browseHotelFooter}>
                      {h.freeCancellation ? <span className={styles.facilityTag}>Anulare gratuita</span> : null}
                      {h.availability?.roomsLeft ? (
                        <span className={styles.roomsLeft}>
                          {h.availability.roomsLeft} {h.availability.roomsLeft === 1 ? 'camera' : 'camere'} ramase
                        </span>
                      ) : null}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          ) : null}

          {browseHasMore ? (
            <button
              className={styles.secondaryBtn}
              type="button"
              disabled={browseStatus === 'loading'}
              onClick={() => fetchBrowseHotels(browseOffset, true)}
            >
              Incarca mai multe hoteluri
            </button>
          ) : null}
        </section>

        {/* Hotel Detail Modal */}
        {(detailHotel || detailLoading) ? (
          <div className={styles.modalOverlay} onClick={closeHotelDetail}>
            <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
              <button className={styles.modalClose} type="button" onClick={closeHotelDetail}>✕</button>
              {detailLoading ? (
                <div className={styles.modalLoading}>Se incarca detaliile hotelului...</div>
              ) : detailHotel ? (
                <>
                  <div className={styles.modalHero}>
                    {detailHotel.image ? (
                      <img src={detailHotel.image} alt={detailHotel.name} className={styles.modalHotelImg} />
                    ) : null}
                    <div className={styles.modalHotelOverlay}>
                      <h2 className={styles.modalHotelName}>{detailHotel.name}</h2>
                      <div className={styles.modalHotelStars}>
                        {'★'.repeat(detailHotel.stars)}{'☆'.repeat(5 - detailHotel.stars)}
                      </div>
                    </div>
                  </div>
                  <div className={styles.modalBody}>
                    <div className={styles.modalGrid}>
                      <div className={styles.modalSection}>
                        <h3 className={styles.modalSectionTitle}>Informatii</h3>
                        <div className={styles.modalInfo}>
                          <div>Rating: <strong>{detailHotel.rating.toFixed(1)}/5</strong></div>
                          <div>Pret: <strong>{currencyFormatter.format(detailHotel.pricePerNight)}/noapte</strong>
                            {detailHotel.seasonalPricing ? (
                              <span className={styles.seasonTag}> (pret sezonier, baza: {currencyFormatter.format(detailHotel.basePrice)})</span>
                            ) : null}
                          </div>
                          <div>Locatie: <strong>{detailHotel.location.city}, {detailHotel.location.country}</strong></div>
                          <div>Distanta de centru: <strong>{detailHotel.distanceFromCenter} km</strong></div>
                          <div>Anulare gratuita: <strong>{detailHotel.freeCancellation ? 'Da' : 'Nu'}</strong></div>
                          {detailHotel.availability?.roomsLeft ? (
                            <div className={styles.roomsLeft}>
                              {detailHotel.availability.roomsLeft} {detailHotel.availability.roomsLeft === 1 ? 'camera ramasa' : 'camere ramase'}
                            </div>
                          ) : null}
                        </div>
                      </div>
                      <div className={styles.modalSection}>
                        <h3 className={styles.modalSectionTitle}>Facilitati</h3>
                        <div className={styles.facilities}>
                          {detailHotel.facilities.map((f) => (
                            <span key={f} className={styles.facilityTag}>{f}</span>
                          ))}
                        </div>
                      </div>
                    </div>
                    {detailSimilar.length > 0 ? (
                      <div className={styles.modalSimilar}>
                        <h3 className={styles.modalSectionTitle}>Hoteluri similare in {detailHotel.location.city}</h3>
                        <div className={styles.similarGrid}>
                          {detailSimilar.map((s) => (
                            <div
                              key={s.id}
                              className={styles.similarCard}
                              onClick={() => openHotelDetail(s.id)}
                              role="button"
                              tabIndex={0}
                              onKeyDown={(e) => { if (e.key === 'Enter') openHotelDetail(s.id) }}
                            >
                              {s.image ? (
                                <img src={s.image} alt={s.name} className={styles.similarImg} loading="lazy" />
                              ) : null}
                              <div className={styles.similarInfo}>
                                <strong>{s.name}</strong>
                                <span>{'★'.repeat(s.stars)} · {s.rating.toFixed(1)}</span>
                                <span>{currencyFormatter.format(s.pricePerNight)}/noapte</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                </>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}
