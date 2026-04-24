import hotelsData from '@/data/hotels.json'

// --- Types ---

export type RoomType = {
  type: string
  capacity: number
  priceModifier: number
}

export type HotelEntry = {
  id: string
  name: string
  description: string
  pricePerNight: number
  rating: number
  reviewsCount: number
  distanceFromCenter: number
  facilities: string[]
  images: string[]
  image: string
  location: { lat: number; lng: number; city: string; country: string }
  stars: number
  freeCancellation: boolean
  cancellationPolicy: string
  checkInTime: string
  checkOutTime: string
  rooms: RoomType[]
  availability?: {
    startDate: string
    endDate: string
    roomsLeft: number
  }
}

export type EnrichedHotel = HotelEntry & {
  dynamicPrice?: number
  dynamicRoomsLeft?: number
  seasonalPricing?: boolean
}

export type HotelFilters = {
  city?: string | null
  minPrice?: number | null
  maxPrice?: number | null
  minRating?: number | null
  minStars?: number | null
  facilities?: string[]
  freeCancellation?: boolean
  checkIn?: string | null
  checkOut?: string | null
  sortBy?: string | null
  limit?: number
  offset?: number
}

export type HotelPreferences = {
  minStars: number | null
  facilities: string[]
}

// --- Data ---

const allHotels: HotelEntry[] = hotelsData.hotels as HotelEntry[]

// --- City Resolution ---

const cityAliasMap: Record<string, string> = {
  lisbon: 'lisabona', rome: 'roma', nice: 'nisa', athens: 'atena',
  prague: 'praga', vienna: 'viena', milan: 'milano', budapest: 'budapesta',
  lis: 'lisabona', bcn: 'barcelona', fco: 'roma', nce: 'nisa',
  dbv: 'dubrovnik', ath: 'atena', prg: 'praga', ams: 'amsterdam',
  opo: 'porto', vlc: 'valencia', vie: 'viena', ber: 'berlin', txl: 'berlin',
  cdg: 'paris', ory: 'paris', mxp: 'milano', lin: 'milano', bud: 'budapesta',
  cai: 'cairo', cpt: 'cape town', jnb: 'johannesburg', tun: 'tunis',
  dxb: 'dubai', bkk: 'bangkok', sin: 'singapore', kul: 'kuala lumpur',
  gig: 'rio de janeiro', gru: 'rio de janeiro', scl: 'santiago', lim: 'lima', bog: 'bogota',
}

export const resolveCity = (input: string): string => {
  const lower = input.toLowerCase().trim()
  if (cityAliasMap[lower]) return cityAliasMap[lower]
  for (const [key, romanianCity] of Object.entries(cityAliasMap)) {
    if (lower.includes(key)) return romanianCity
  }
  return lower
}

export const resolveHotelCity = (destinationText: string): string[] => {
  const destLower = destinationText.toLowerCase()
  const matchedAliases: string[] = []
  const iataMatch = destinationText.match(/\(([A-Z]{3})\)/)
  if (iataMatch) {
    const alias = cityAliasMap[iataMatch[1].toLowerCase()]
    if (alias) matchedAliases.push(alias)
  }
  for (const [key, romanianCity] of Object.entries(cityAliasMap)) {
    if (destLower.includes(key)) matchedAliases.push(romanianCity)
  }
  return [...new Set(matchedAliases)]
}

// --- Seasonal Pricing ---

export const getSeasonalMultiplier = (checkIn?: string | null): number => {
  if (!checkIn) return 1.0
  const month = new Date(checkIn).getMonth()
  if (month >= 5 && month <= 7) return 1.25
  if (month === 3 || month === 4 || month === 8 || month === 9) return 1.1
  return 0.9
}

// --- Dynamic Rooms ---

const dynamicRoomsLeft = (hotelId: string, checkIn: string): number => {
  let hash = 0
  const key = `${hotelId}-${checkIn}`
  for (let i = 0; i < key.length; i++) {
    hash = ((hash << 5) - hash + key.charCodeAt(i)) | 0
  }
  return Math.abs(hash % 8) + 1
}

// --- Core Service Functions ---

export const getTotalHotels = (): number => allHotels.length

export const countHotelsForCity = (city: string): number => {
  const cityLower = city.toLowerCase()
  return allHotels.filter(h => h.location.city.toLowerCase() === cityLower).length
}

export const getHotelById = (id: string): HotelEntry | undefined => {
  return allHotels.find(h => h.id === id)
}

export const getSimilarHotels = (hotel: HotelEntry, checkIn?: string | null, limit = 4) => {
  const seasonMultiplier = getSeasonalMultiplier(checkIn)
  return allHotels
    .filter(h => h.id !== hotel.id && h.location.city === hotel.location.city)
    .sort((a, b) => b.rating - a.rating)
    .slice(0, limit)
    .map(h => ({
      id: h.id,
      name: h.name,
      pricePerNight: Math.round(h.pricePerNight * seasonMultiplier),
      rating: h.rating,
      stars: h.stars,
      image: h.image,
      images: h.images,
      distanceFromCenter: h.distanceFromCenter,
    }))
}

export const getHotels = (filters: HotelFilters = {}) => {
  const {
    city, minPrice, maxPrice, minRating, minStars,
    facilities = [], freeCancellation, checkIn, checkOut,
    sortBy, limit = 20, offset = 0,
  } = filters

  const seasonMultiplier = getSeasonalMultiplier(checkIn)

  let filtered: EnrichedHotel[] = allHotels.map(h => ({
    ...h,
    dynamicPrice: Math.round(h.pricePerNight * seasonMultiplier),
    dynamicRoomsLeft: checkIn ? dynamicRoomsLeft(h.id, checkIn) : h.availability?.roomsLeft,
    seasonalPricing: seasonMultiplier !== 1.0,
  }))

  if (city) {
    const resolvedCity = resolveCity(city)
    filtered = filtered.filter(h => h.location.city.toLowerCase().includes(resolvedCity))
  }

  if (minPrice != null) {
    filtered = filtered.filter(h => (h.dynamicPrice ?? h.pricePerNight) >= minPrice)
  }
  if (maxPrice != null) {
    filtered = filtered.filter(h => (h.dynamicPrice ?? h.pricePerNight) <= maxPrice)
  }
  if (minRating != null) {
    filtered = filtered.filter(h => h.rating >= minRating)
  }
  if (minStars != null) {
    filtered = filtered.filter(h => h.stars >= minStars)
  }
  if (freeCancellation) {
    filtered = filtered.filter(h => h.freeCancellation)
  }
  if (facilities.length > 0) {
    const required = facilities.map(f => f.toLowerCase())
    filtered = filtered.filter(h =>
      required.every(rf => h.facilities.some(hf => hf.toLowerCase() === rf))
    )
  }
  if (checkIn && checkOut) {
    const checkInDate = new Date(checkIn)
    const checkOutDate = new Date(checkOut)
    filtered = filtered.filter(h => {
      if (!h.availability) return true
      const availStart = new Date(h.availability.startDate)
      const availEnd = new Date(h.availability.endDate)
      return checkInDate >= availStart && checkOutDate <= availEnd && h.availability.roomsLeft > 0
    })
  }

  switch (sortBy) {
    case 'price_asc':
      filtered.sort((a, b) => (a.dynamicPrice ?? a.pricePerNight) - (b.dynamicPrice ?? b.pricePerNight))
      break
    case 'price_desc':
      filtered.sort((a, b) => (b.dynamicPrice ?? b.pricePerNight) - (a.dynamicPrice ?? a.pricePerNight))
      break
    case 'rating_desc':
      filtered.sort((a, b) => b.rating - a.rating)
      break
    case 'distance_asc':
      filtered.sort((a, b) => a.distanceFromCenter - b.distanceFromCenter)
      break
    case 'reviews_desc':
      filtered.sort((a, b) => b.reviewsCount - a.reviewsCount)
      break
    default:
      filtered.sort((a, b) => b.rating - a.rating)
  }

  const start = Math.max(0, offset)
  const page = filtered.slice(start, start + Math.max(1, limit))

  return {
    hotels: page,
    total: filtered.length,
    showing: page.length,
    offset: start,
    hasMore: start + page.length < filtered.length,
    seasonMultiplier: seasonMultiplier !== 1.0 ? seasonMultiplier : undefined,
  }
}

export const findHotelsForCity = (
  destinationText: string,
  maxBudgetPerNight: number,
  hotelPrefs?: HotelPreferences | null,
  checkIn?: string,
  checkOut?: string,
): HotelEntry[] => {
  const destLower = destinationText.toLowerCase()
  const seasonMultiplier = getSeasonalMultiplier(checkIn)

  let candidates = allHotels.filter(h => destLower.includes(h.location.city.toLowerCase()))

  if (candidates.length === 0) {
    const resolvedCities = resolveHotelCity(destinationText)
    if (resolvedCities.length > 0) {
      candidates = allHotels.filter(h =>
        resolvedCities.includes(h.location.city.toLowerCase())
      )
    }
  }

  if (candidates.length === 0) {
    candidates = [...allHotels].sort((a, b) => b.rating - a.rating).slice(0, 15)
  }

  if (checkIn && checkOut) {
    const checkInDate = new Date(checkIn)
    const checkOutDate = new Date(checkOut)
    const availFiltered = candidates.filter(h => {
      if (!h.availability) return true
      const availStart = new Date(h.availability.startDate)
      const availEnd = new Date(h.availability.endDate)
      return checkInDate >= availStart && checkOutDate <= availEnd && h.availability.roomsLeft > 0
    })
    if (availFiltered.length > 0) candidates = availFiltered
  }

  if (maxBudgetPerNight > 0) {
    const budgetFiltered = candidates.filter(h =>
      Math.round(h.pricePerNight * seasonMultiplier) <= maxBudgetPerNight * 1.5
    )
    if (budgetFiltered.length > 0) candidates = budgetFiltered
  }

  if (hotelPrefs) {
    if (hotelPrefs.minStars) {
      const starsFiltered = candidates.filter(h => h.stars >= hotelPrefs.minStars!)
      if (starsFiltered.length > 0) candidates = starsFiltered
    }
    if (hotelPrefs.facilities.length > 0) {
      const requiredFacilities = hotelPrefs.facilities.map(f => f.toLowerCase())
      const facilityFiltered = candidates.filter(h =>
        requiredFacilities.every(rf => h.facilities.some(hf => hf.toLowerCase() === rf))
      )
      if (facilityFiltered.length > 0) candidates = facilityFiltered
    }
  }

  return candidates.sort((a, b) => b.rating - a.rating)
}

export type PickedHotel = {
  id: string | null
  name: string
  stars: number
  pricePerNight: number
  rating: number
  distanceFromCenter: number
  facilities: string[]
  image: string
  images: string[]
  rooms: RoomType[]
  breakfastIncluded: boolean
  freeCancellation: boolean
  cancellationPolicy: string
  description: string
  checkInTime: string
  checkOutTime: string
  source: 'local-database' | 'fallback' | 'amadeus-live' | 'booking-live'
  totalCost: number
}

export const pickHotelForResult = (
  destinationText: string,
  nights: number,
  hotelBudget: number,
  index: number,
  hotelPrefs?: HotelPreferences | null,
  checkIn?: string,
  checkOut?: string,
): PickedHotel => {
  const maxPerNight = nights > 0 ? hotelBudget / nights : hotelBudget
  const candidates = findHotelsForCity(destinationText, maxPerNight, hotelPrefs, checkIn, checkOut)
  const seasonMultiplier = getSeasonalMultiplier(checkIn)

  if (candidates.length === 0) {
    const fallbackPrice = Math.round(maxPerNight * 0.7)
    return {
      id: null,
      name: 'Hotel Standard',
      stars: 3,
      pricePerNight: fallbackPrice,
      rating: 3.8,
      distanceFromCenter: 1.0,
      facilities: ['WiFi'],
      image: '',
      images: [],
      rooms: [{ type: 'Double', capacity: 2, priceModifier: 0 }],
      breakfastIncluded: false,
      freeCancellation: false,
      cancellationPolicy: 'Non-refundable',
      description: 'Hotel standard cu facilitati de baza.',
      checkInTime: '14:00',
      checkOutTime: '11:00',
      source: 'fallback',
      totalCost: fallbackPrice * Math.max(1, nights),
    }
  }

  const hotel = candidates[index % candidates.length]
  const dynamicPrice = Math.round(hotel.pricePerNight * seasonMultiplier)

  return {
    id: hotel.id,
    name: hotel.name,
    stars: hotel.stars,
    pricePerNight: dynamicPrice,
    rating: hotel.rating,
    distanceFromCenter: hotel.distanceFromCenter,
    facilities: hotel.facilities,
    image: hotel.image,
    images: hotel.images,
    rooms: hotel.rooms,
    breakfastIncluded: hotel.facilities.some(f => f.toLowerCase() === 'breakfast'),
    freeCancellation: hotel.freeCancellation,
    cancellationPolicy: hotel.cancellationPolicy,
    description: hotel.description,
    checkInTime: hotel.checkInTime,
    checkOutTime: hotel.checkOutTime,
    source: 'local-database',
    totalCost: dynamicPrice * Math.max(1, nights),
  }
}
