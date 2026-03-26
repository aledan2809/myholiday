'use client'

import { useMemo, useState } from 'react'
import styles from './my-holiday.module.css'

type FlightInfo = {
  airline: string
  duration: string
  stops: string
  outbound: string
  inbound: string
}

type HotelInfo = {
  name: string
  stars: number
  breakfastIncluded: boolean
  freeCancellation: boolean
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

type Result = {
  id: string
  destination: string
  total: number
  currency: string
  rating: number
  weather: string
  flight: FlightInfo
  hotel: HotelInfo
  transfer: TransferInfo
  breakdown: Breakdown
  source: 'live' | 'mock'
}

type SearchMeta = {
  mode: 'live' | 'mock'
  missingKeys?: string[]
  note?: string
  dataSourceWarning?: string
}

type SearchResponse = {
  results: Result[]
  meta: SearchMeta
}

const activities = ['plaja', 'city break', 'safari', 'munte', 'wellness', 'gastronomie']
const continents = ['Europa', 'Africa', 'Asia', 'America de Sud']
const temperatures = ['15-20°C', '20-26°C', '26-32°C', '32°C+']

const currencyFormatter = new Intl.NumberFormat('ro-RO', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
})

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
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [message, setMessage] = useState('')
  const [results, setResults] = useState<Result[]>([])
  const [meta, setMeta] = useState<SearchMeta | null>(null)
  const [visibleCount, setVisibleCount] = useState(5)

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
  ])

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setStatus('loading')
    setMessage('Caut cele mai bune combinații de călătorie...')
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
      setStatus('success')
      setMessage(data.results.length ? 'Am gasit oferte care se potrivesc.' : 'Nu am gasit rezultate.')
    } catch (error) {
      console.error(error)
      setStatus('error')
      setMessage('A aparut o problema. Incearca din nou in cateva secunde.')
    }
  }

  const visibleResults = results.slice(0, visibleCount)

  const toggleActivity = (activity: string) => {
    setSelectedActivities((current) =>
      current.includes(activity)
        ? current.filter((item) => item !== activity)
        : [...current, activity]
    )
  }

  return (
    <div className={styles.shell}>
      <div className={styles.container}>
        <section className={`${styles.hero} ${styles.fadeIn}`}>
          <span className={styles.badge}>MVP My Holiday · Europa only</span>
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
          </form>
        </section>

        <section className={styles.results}>
          {visibleResults.map((result) => (
            <article key={result.id} className={`${styles.resultCard} ${styles.fadeIn}`}>
              <div className={styles.resultHeader}>
                <div>
                  <p className={styles.destination}>{result.destination}</p>
                  <span className={styles.tag}>Rating {result.rating.toFixed(1)}</span>
                </div>
                <div className={styles.price}>{currencyFormatter.format(result.total)}</div>
              </div>
              <div className={styles.kpis}>
                <div className={styles.kpi}>Vreme: {result.weather}</div>
                <div className={styles.kpi}>Zbor: {result.flight.duration} · {result.flight.stops}</div>
                <div className={styles.kpi}>Hotel: {result.hotel.name}</div>
                <div className={styles.kpi}>Transfer: {result.transfer.type}</div>
              </div>
              <div className={styles.flightHotel}>
                <div>
                  <div className={styles.sectionTitle}>Detalii zbor</div>
                  <div className={styles.breakdown}>Companie: {result.flight.airline}</div>
                  <div className={styles.breakdown}>Dus: {result.flight.outbound}</div>
                  <div className={styles.breakdown}>Intors: {result.flight.inbound}</div>
                </div>
                <div>
                  <div className={styles.sectionTitle}>Detalii hotel</div>
                  <div className={styles.breakdown}>{result.hotel.stars} stele</div>
                  <div className={styles.breakdown}>Mic dejun: {result.hotel.breakfastIncluded ? 'Inclus' : 'Nu'}</div>
                  <div className={styles.breakdown}>Anulare gratuita: {result.hotel.freeCancellation ? 'Da' : 'Nu'}</div>
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

        {results.length > visibleCount ? (
          <button
            className={styles.secondaryBtn}
            type="button"
            onClick={() => setVisibleCount((count) => count + 5)}
          >
            Afiseaza alte oferte
          </button>
        ) : null}
      </div>
    </div>
  )
}
