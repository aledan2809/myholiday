'use client'

import { useCallback, useEffect, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import styles from './hotels.module.css'

type BrowseHotel = {
  id: string
  name: string
  description?: string
  pricePerNight: number
  basePrice?: number
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
  seasonalPricing?: boolean
  source?: string
}

type BrowseResponse = {
  hotels: BrowseHotel[]
  total: number
  showing: number
  offset: number
  hasMore: boolean
  source: string
  liveHotelsCount?: number
}

const currencyFormatter = new Intl.NumberFormat('ro-RO', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })

const FACILITY_OPTIONS = ['WiFi', 'Breakfast', 'Pool', 'Spa', 'Gym', 'Bar', 'Parking', 'Garden', 'Restaurant', 'Room Service', 'Beach Access', 'Air Conditioning']

export default function HotelsClient() {
  const searchParams = useSearchParams()
  const router = useRouter()

  const [hotels, setHotels] = useState<BrowseHotel[]>([])
  const [total, setTotal] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [offset, setOffset] = useState(0)
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [liveCount, setLiveCount] = useState(0)
  const [dataSource, setDataSource] = useState('')

  const [city, setCity] = useState(searchParams.get('city') || '')
  const [sortBy, setSortBy] = useState(searchParams.get('sortBy') || 'rating_desc')
  const [minStars, setMinStars] = useState(searchParams.get('minStars') || '')
  const [minPrice, setMinPrice] = useState(searchParams.get('minPrice') || '')
  const [maxPrice, setMaxPrice] = useState(searchParams.get('maxPrice') || '')
  const [minRating, setMinRating] = useState(searchParams.get('minRating') || '')
  const [checkIn, setCheckIn] = useState(searchParams.get('checkIn') || '')
  const [checkOut, setCheckOut] = useState(searchParams.get('checkOut') || '')
  const [freeCancellation, setFreeCancellation] = useState(searchParams.get('freeCancellation') === 'true')
  const [facilities, setFacilities] = useState<string[]>(
    searchParams.get('facilities')?.split(',').filter(Boolean) ?? []
  )

  const updateUrl = useCallback((params: URLSearchParams) => {
    const qs = params.toString()
    router.replace(qs ? `/hotels?${qs}` : '/hotels', { scroll: false })
  }, [router])

  const fetchHotels = useCallback(async (newOffset = 0, append = false) => {
    setStatus('loading')
    try {
      const params = new URLSearchParams()
      if (city.trim()) params.set('city', city.trim())
      params.set('sortBy', sortBy)
      params.set('limit', '20')
      params.set('offset', String(newOffset))
      if (minStars) params.set('minStars', minStars)
      if (minPrice) params.set('minPrice', minPrice)
      if (maxPrice) params.set('maxPrice', maxPrice)
      if (minRating) params.set('minRating', minRating)
      if (checkIn) params.set('checkIn', checkIn)
      if (checkOut) params.set('checkOut', checkOut)
      if (freeCancellation) params.set('freeCancellation', 'true')
      if (facilities.length > 0) params.set('facilities', facilities.join(','))
      // Auto-enable live search when city is provided (dates optional but recommended)
      if (city.trim()) params.set('live', 'true')

      const res = await fetch(`/api/hotels?${params}`)
      if (!res.ok) throw new Error('Failed to fetch hotels')
      const data: BrowseResponse = await res.json()

      setHotels(prev => append ? [...prev, ...data.hotels] : data.hotels)
      setTotal(data.total)
      setHasMore(data.hasMore)
      setOffset(newOffset + data.showing)
      setLiveCount(data.liveHotelsCount ?? 0)
      setDataSource(data.source)
      setStatus('success')

      // Sync filters to URL (exclude offset/limit)
      if (!append) {
        const urlParams = new URLSearchParams()
        if (city.trim()) urlParams.set('city', city.trim())
        if (sortBy !== 'rating_desc') urlParams.set('sortBy', sortBy)
        if (minStars) urlParams.set('minStars', minStars)
        if (minPrice) urlParams.set('minPrice', minPrice)
        if (maxPrice) urlParams.set('maxPrice', maxPrice)
        if (minRating) urlParams.set('minRating', minRating)
        if (checkIn) urlParams.set('checkIn', checkIn)
        if (checkOut) urlParams.set('checkOut', checkOut)
        if (freeCancellation) urlParams.set('freeCancellation', 'true')
        if (facilities.length > 0) urlParams.set('facilities', facilities.join(','))
        updateUrl(urlParams)
      }
    } catch {
      setStatus('error')
    }
  }, [city, sortBy, minStars, minPrice, maxPrice, minRating, checkIn, checkOut, freeCancellation, facilities, updateUrl])

  // Auto-load popular hotels on mount
  useEffect(() => {
    fetchHotels(0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleSearch = () => {
    setOffset(0)
    fetchHotels(0)
  }

  const handleLoadMore = () => {
    fetchHotels(offset, true)
  }

  const toggleFacility = (f: string) => {
    setFacilities(prev => prev.includes(f) ? prev.filter(x => x !== f) : [...prev, f])
  }

  return (
    <div className={styles.shell}>
      <div className={styles.container}>
        <div className={styles.header}>
          <Link href="/my-holiday" className={styles.backLink}>
            &larr; Inapoi la cautare
          </Link>
          <h1 className={styles.title}>Exploreaza hoteluri</h1>
          <p className={styles.subtitle}>
            210+ hoteluri din 27 orase pe 4 continente. Preturi sezoniere, filtre avansate, anulare gratuita.
            {dataSource === 'mixed' && ' Date live Amadeus + baza locala.'}
          </p>
        </div>

        <div className={styles.controls}>
          <label className={styles.field}>
            <span className={styles.label}>Oras</span>
            <input
              className={styles.input}
              value={city}
              onChange={e => setCity(e.target.value)}
              placeholder="Roma, Barcelona, Praga..."
            />
          </label>
          <label className={styles.field}>
            <span className={styles.label}>Sorteaza</span>
            <select className={styles.select} value={sortBy} onChange={e => setSortBy(e.target.value)}>
              <option value="rating_desc">Rating (descrescator)</option>
              <option value="price_asc">Pret (crescator)</option>
              <option value="price_desc">Pret (descrescator)</option>
              <option value="distance_asc">Distanta de centru</option>
              <option value="reviews_desc">Nr. recenzii (descrescator)</option>
            </select>
          </label>
          <label className={styles.field}>
            <span className={styles.label}>Minim stele</span>
            <select className={styles.select} value={minStars} onChange={e => setMinStars(e.target.value)}>
              <option value="">Orice</option>
              <option value="2">2+</option>
              <option value="3">3+</option>
              <option value="4">4+</option>
              <option value="5">5</option>
            </select>
          </label>
          <label className={styles.field}>
            <span className={styles.label}>Pret min / noapte</span>
            <input
              className={styles.input}
              type="number"
              min="0"
              value={minPrice}
              onChange={e => setMinPrice(e.target.value)}
              placeholder="0"
            />
          </label>
          <label className={styles.field}>
            <span className={styles.label}>Pret max / noapte</span>
            <input
              className={styles.input}
              type="number"
              min="0"
              value={maxPrice}
              onChange={e => setMaxPrice(e.target.value)}
              placeholder="fara limita"
            />
          </label>
          <label className={styles.field}>
            <span className={styles.label}>Rating minim</span>
            <select className={styles.select} value={minRating} onChange={e => setMinRating(e.target.value)}>
              <option value="">Orice</option>
              <option value="3">3+</option>
              <option value="3.5">3.5+</option>
              <option value="4">4+</option>
              <option value="4.5">4.5+</option>
            </select>
          </label>
          <label className={styles.field}>
            <span className={styles.label}>Check-in</span>
            <input className={styles.input} type="date" value={checkIn} onChange={e => setCheckIn(e.target.value)} />
          </label>
          <label className={styles.field}>
            <span className={styles.label}>Check-out</span>
            <input className={styles.input} type="date" value={checkOut} onChange={e => setCheckOut(e.target.value)} />
          </label>
          <label className={styles.toggle} style={{ alignSelf: 'end', padding: '10px 0' }}>
            <input type="checkbox" checked={freeCancellation} onChange={e => setFreeCancellation(e.target.checked)} />
            Anulare gratuita
          </label>
        </div>

        <div className={styles.facilitiesRow}>
          <span className={styles.label}>Facilitati:</span>
          {FACILITY_OPTIONS.map(f => (
            <label key={f} className={styles.toggle}>
              <input type="checkbox" checked={facilities.includes(f)} onChange={() => toggleFacility(f)} />
              {f}
            </label>
          ))}
        </div>

        <div className={styles.ctaRow}>
          <button className={styles.primaryBtn} type="button" disabled={status === 'loading'} onClick={handleSearch}>
            {status === 'loading' ? 'Se cauta...' : 'Cauta hoteluri'}
          </button>
          {status === 'success' && (
            <span className={styles.stats}>
              {total} hoteluri gasite
              {liveCount > 0 && ` (${liveCount} live Amadeus)`}
            </span>
          )}
        </div>

        {status === 'error' && (
          <div className={styles.banner}>Eroare la incarcarea hotelurilor. Incearca din nou.</div>
        )}

        {hotels.length > 0 && (
          <div className={styles.grid}>
            {hotels.map(h => (
              <Link key={h.id} href={`/hotels/${h.id}?${[checkIn && `checkIn=${checkIn}`, checkOut && `checkOut=${checkOut}`].filter(Boolean).join('&')}`} className={styles.card}>
                {h.image && <img src={h.image} alt={h.name} className={styles.cardImg} loading="lazy" />}
                <div className={styles.cardBody}>
                  <div className={styles.cardHeader}>
                    <span className={styles.cardName}>{h.name}</span>
                    <span className={styles.cardPrice}>{currencyFormatter.format(h.pricePerNight)}/noapte</span>
                  </div>
                  <div className={styles.cardMeta}>
                    <span>{'★'.repeat(h.stars)}{'☆'.repeat(5 - h.stars)}</span>
                    <span>Rating: {h.rating.toFixed(1)} ({h.reviewsCount} recenzii)</span>
                    <span>{h.distanceFromCenter} km de centru</span>
                  </div>
                  {h.description && <div className={styles.cardDescription}>{h.description}</div>}
                  <div className={styles.cardLocation}>{h.location.city}, {h.location.country}</div>
                  <div className={styles.facilities}>
                    {h.facilities.slice(0, 5).map(f => (
                      <span key={f} className={styles.facilityTag}>{f}</span>
                    ))}
                    {h.facilities.length > 5 && (
                      <span className={styles.facilityTag}>+{h.facilities.length - 5}</span>
                    )}
                  </div>
                  <div className={styles.cardFooter}>
                    {h.source === 'amadeus-live' ? (
                      <span className={styles.liveTag}>LIVE Amadeus</span>
                    ) : h.source === 'booking-live' ? (
                      <span className={styles.liveTag}>LIVE Booking</span>
                    ) : (
                      <span className={styles.estimatedTag}>Pret estimat</span>
                    )}
                    {h.freeCancellation && <span className={styles.facilityTag}>Anulare gratuita</span>}
                    {h.availability?.roomsLeft && (
                      <span className={styles.roomsLeft}>
                        {h.availability.roomsLeft} {h.availability.roomsLeft === 1 ? 'camera' : 'camere'} ramase
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}

        {status === 'success' && hotels.length === 0 && (
          <div className={styles.empty}>Nu s-au gasit hoteluri cu filtrele selectate. Modifica criteriile si incearca din nou.</div>
        )}

        {hasMore && (
          <button className={styles.loadMore} type="button" disabled={status === 'loading'} onClick={handleLoadMore}>
            Incarca mai multe hoteluri
          </button>
        )}
      </div>
    </div>
  )
}
