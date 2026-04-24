'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import styles from '../hotels.module.css'

type RoomInfo = {
  type: string
  capacity: number
  priceModifier: number
}

type HotelDetail = {
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
  images?: string[]
  location: { lat: number; lng: number; city: string; country: string }
  stars: number
  freeCancellation: boolean
  cancellationPolicy?: string
  checkInTime: string
  checkOutTime: string
  seasonalPricing: boolean
  seasonMultiplier?: number
  availability?: { startDate: string; endDate: string; roomsLeft: number }
  rooms?: RoomInfo[]
  roomType?: string
  boardType?: string
  offerId?: string
  totalPrice?: number
  currency?: string
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

const currencyFormatter = new Intl.NumberFormat('ro-RO', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })

export default function HotelDetailClient() {
  const params = useParams()
  const searchParams = useSearchParams()
  const hotelId = params.id as string
  const checkIn = searchParams.get('checkIn')
  const checkOut = searchParams.get('checkOut')

  const [hotel, setHotel] = useState<HotelDetail | null>(null)
  const [similar, setSimilar] = useState<SimilarHotel[]>([])
  const [source, setSource] = useState<string>('local-database')
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [activeImage, setActiveImage] = useState(0)

  const fetchDetail = useCallback(async () => {
    setStatus('loading')
    try {
      const urlParams = new URLSearchParams()
      if (checkIn) urlParams.set('checkIn', checkIn)
      if (checkOut) urlParams.set('checkOut', checkOut)
      const qs = urlParams.toString()
      const url = qs ? `/api/hotels/${hotelId}?${qs}` : `/api/hotels/${hotelId}`
      const res = await fetch(url)
      if (!res.ok) throw new Error('Hotel not found')
      const data = await res.json()
      setHotel(data.hotel)
      setSimilar(data.similarHotels ?? [])
      setSource(data.source ?? 'local-database')
      setStatus('success')
    } catch {
      setStatus('error')
    }
  }, [hotelId, checkIn, checkOut])

  useEffect(() => {
    fetchDetail()
  }, [fetchDetail])

  if (status === 'loading') {
    return (
      <div className={styles.shell}>
        <div className={styles.container}>
          <div className={styles.loading}>Se incarca detaliile hotelului...</div>
        </div>
      </div>
    )
  }

  if (status === 'error' || !hotel) {
    return (
      <div className={styles.shell}>
        <div className={styles.container}>
          <div className={styles.header}>
            <Link href="/hotels" className={styles.backLink}>&larr; Inapoi la hoteluri</Link>
            <h1 className={styles.title}>Hotel negasit</h1>
            <p className={styles.subtitle}>Hotelul solicitat nu exista in baza de date. Incearca sa adaugi date de check-in si check-out pentru date live.</p>
          </div>
        </div>
      </div>
    )
  }

  const allImages = [hotel.image, ...(hotel.images ?? [])].filter(Boolean)
  const currentImage = allImages[activeImage] || hotel.image

  return (
    <div className={styles.shell}>
      <div className={styles.container}>
        <Link href="/hotels" className={styles.backLink}>&larr; Inapoi la hoteluri</Link>

        <div className={styles.detailHero}>
          {currentImage && <img src={currentImage} alt={hotel.name} className={styles.detailImg} />}
          <div className={styles.detailOverlay}>
            <h1 className={styles.detailName}>{hotel.name}</h1>
            <div className={styles.detailStars}>
              {'★'.repeat(hotel.stars)}{'☆'.repeat(5 - hotel.stars)}
              {source === 'amadeus-live' ? (
                <span style={{ marginLeft: 12, background: '#16a34a', color: '#fff', padding: '2px 10px', borderRadius: 6, fontSize: '0.75rem', fontWeight: 600 }}>LIVE Amadeus</span>
              ) : source === 'booking-live' ? (
                <span style={{ marginLeft: 12, background: '#003580', color: '#fff', padding: '2px 10px', borderRadius: 6, fontSize: '0.75rem', fontWeight: 600 }}>LIVE Booking</span>
              ) : (
                <span style={{ marginLeft: 12, background: 'rgba(234,179,8,0.15)', color: '#a16207', padding: '2px 10px', borderRadius: 6, fontSize: '0.75rem', fontWeight: 600 }}>Pret estimat</span>
              )}
            </div>
          </div>
        </div>

        {allImages.length > 1 && (
          <div className={styles.imageGallery}>
            {allImages.map((img, idx) => (
              <button
                key={idx}
                type="button"
                className={`${styles.galleryThumb} ${idx === activeImage ? styles.galleryThumbActive : ''}`}
                onClick={() => setActiveImage(idx)}
              >
                <img src={img} alt={`${hotel.name} ${idx + 1}`} loading="lazy" />
              </button>
            ))}
          </div>
        )}

        {hotel.description && (
          <div className={styles.detailDescription}>{hotel.description}</div>
        )}

        <div className={styles.detailBody}>
          <div className={styles.detailSection}>
            <h2 className={styles.detailSectionTitle}>Informatii</h2>
            <div className={styles.detailInfo}>
              <div>Rating: <strong>{hotel.rating.toFixed(1)} / 5</strong> ({hotel.reviewsCount} recenzii)</div>
              <div>
                Pret: <strong>{currencyFormatter.format(hotel.pricePerNight)} / noapte</strong>
                {hotel.seasonalPricing && (
                  <span className={styles.seasonTag}> (pret sezonier, baza: {currencyFormatter.format(hotel.basePrice)})</span>
                )}
              </div>
              {hotel.totalPrice && (
                <div>Total sejur: <strong>{currencyFormatter.format(hotel.totalPrice)}</strong></div>
              )}
              <div>Locatie: <strong>{hotel.location.city}, {hotel.location.country}</strong></div>
              <div>Distanta de centru: <strong>{hotel.distanceFromCenter} km</strong></div>
              <div>Check-in: <strong>{hotel.checkInTime}</strong> · Check-out: <strong>{hotel.checkOutTime}</strong></div>
              <div>Anulare gratuita: <strong>{hotel.freeCancellation ? 'Da' : 'Nu'}</strong></div>
              {hotel.cancellationPolicy && (
                <div>Politica anulare: <strong>{hotel.cancellationPolicy}</strong></div>
              )}
              {hotel.roomType && (
                <div>Tip camera: <strong>{hotel.roomType}</strong></div>
              )}
              {hotel.boardType && (
                <div>Masa: <strong>{hotel.boardType}</strong></div>
              )}
              {hotel.availability?.roomsLeft && (
                <div className={styles.roomsLeft}>
                  {hotel.availability.roomsLeft} {hotel.availability.roomsLeft === 1 ? 'camera ramasa' : 'camere ramase'}
                </div>
              )}
            </div>
          </div>

          <div className={styles.detailSection}>
            <h2 className={styles.detailSectionTitle}>Facilitati</h2>
            <div className={styles.facilities}>
              {hotel.facilities.map(f => (
                <span key={f} className={styles.facilityTag}>{f}</span>
              ))}
            </div>

            {hotel.rooms && hotel.rooms.length > 0 && (
              <>
                <h2 className={styles.detailSectionTitle} style={{ marginTop: 20 }}>Tipuri camere</h2>
                <div className={styles.facilities}>
                  {hotel.rooms.map(r => (
                    <span key={r.type} className={styles.facilityTag}>
                      {r.type} (max {r.capacity} pers.)
                      {r.priceModifier !== 0 && ` ${r.priceModifier > 0 ? '+' : ''}${r.priceModifier}%`}
                    </span>
                  ))}
                </div>
              </>
            )}

            <h2 className={styles.detailSectionTitle} style={{ marginTop: 20 }}>Locatie pe harta</h2>
            <div className={styles.mapPlaceholder}>
              <a
                href={`https://www.openstreetmap.org/?mlat=${hotel.location.lat}&mlon=${hotel.location.lng}#map=15/${hotel.location.lat}/${hotel.location.lng}`}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.mapLink}
              >
                Vezi pe harta ({hotel.location.lat.toFixed(4)}, {hotel.location.lng.toFixed(4)})
              </a>
            </div>
          </div>

          <div className={styles.bookingSection}>
            <div className={styles.bookingCard}>
              <div className={styles.bookingPrice}>{currencyFormatter.format(hotel.pricePerNight)} <span>/ noapte</span></div>
              {hotel.totalPrice && (
                <div style={{ fontSize: '0.9rem', opacity: 0.8, marginBottom: 8 }}>
                  Total: {currencyFormatter.format(hotel.totalPrice)}
                </div>
              )}
              {hotel.freeCancellation && <div className={styles.bookingFree}>Anulare gratuita</div>}
              <button className={styles.bookingBtn} type="button" onClick={() => alert('Rezervarea va fi disponibila in curand!')}>
                Rezerva acum
              </button>
              <div className={styles.bookingNote}>
                Sursa: {source === 'amadeus-live' ? 'Amadeus (date live)' : source === 'booking-live' ? 'Booking.com (date live)' : 'baza de date locala (pret estimat)'}
              </div>
            </div>
          </div>

          {similar.length > 0 && (
            <div className={styles.similarSection}>
              <h2 className={styles.detailSectionTitle}>Hoteluri similare in {hotel.location.city}</h2>
              <div className={styles.similarGrid}>
                {similar.map(s => (
                  <Link
                    key={s.id}
                    href={`/hotels/${s.id}${checkIn ? `?checkIn=${checkIn}` : ''}${checkOut ? `${checkIn ? '&' : '?'}checkOut=${checkOut}` : ''}`}
                    className={styles.similarCard}
                  >
                    {s.image && <img src={s.image} alt={s.name} className={styles.similarImg} loading="lazy" />}
                    <div className={styles.similarInfo}>
                      <strong>{s.name}</strong>
                      <span>{'★'.repeat(s.stars)} · {s.rating.toFixed(1)}</span>
                      <span>{currencyFormatter.format(s.pricePerNight)} / noapte</span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
