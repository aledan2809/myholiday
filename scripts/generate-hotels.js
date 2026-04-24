#!/usr/bin/env node
/**
 * Generate hotel entries for cities that are missing from data/hotels.json.
 * Focuses on non-European discovery destinations (Africa, Asia, South America)
 * and appends them to the existing hotel database.
 *
 * Usage: node scripts/generate-hotels.js
 */

/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require('fs')
const path = require('path')

const HOTELS_PATH = path.join(__dirname, '..', 'data', 'hotels.json')

// Cities to generate hotels for (not already in hotels.json)
const newCities = [
  // Africa
  { city: 'Cairo', country: 'Egipt', lat: 30.0444, lng: 31.2357, prefix: 'cai', count: 8 },
  { city: 'Cape Town', country: 'Africa de Sud', lat: -33.9249, lng: 18.4241, prefix: 'cpt', count: 8 },
  { city: 'Johannesburg', country: 'Africa de Sud', lat: -26.2041, lng: 28.0473, prefix: 'jnb', count: 6 },
  { city: 'Tunis', country: 'Tunisia', lat: 36.8065, lng: 10.1815, prefix: 'tun', count: 6 },
  // Asia
  { city: 'Dubai', country: 'Emiratele Arabe', lat: 25.2048, lng: 55.2708, prefix: 'dxb', count: 8 },
  { city: 'Bangkok', country: 'Thailanda', lat: 13.7563, lng: 100.5018, prefix: 'bkk', count: 8 },
  { city: 'Singapore', country: 'Singapore', lat: 1.3521, lng: 103.8198, prefix: 'sin', count: 8 },
  { city: 'Kuala Lumpur', country: 'Malaezia', lat: 3.139, lng: 101.6869, prefix: 'kul', count: 6 },
  // South America
  { city: 'Rio de Janeiro', country: 'Brazilia', lat: -22.9068, lng: -43.1729, prefix: 'rio', count: 8 },
  { city: 'Santiago', country: 'Chile', lat: -33.4489, lng: -70.6693, prefix: 'scl', count: 6 },
  { city: 'Lima', country: 'Peru', lat: -12.0464, lng: -77.0428, prefix: 'lim', count: 6 },
  { city: 'Bogota', country: 'Columbia', lat: 4.711, lng: -74.0721, prefix: 'bog', count: 6 },
]

// Hotel name templates per region
const hotelNames = {
  cai: ['Sofitel Cairo Nile', 'Marriott Cairo', 'Four Seasons Cairo', 'Hilton Cairo', 'Kempinski Nile', 'Steigenberger Cecil', 'Fairmont Nile City', 'Pyramids Park Resort'],
  cpt: ['Table Bay Hotel', 'Cape Grace', 'Belmond Mount Nelson', 'One&Only Cape Town', 'Taj Cape Town', 'Westin Cape Town', 'Radisson Blu Waterfront', 'DoubleTree Cape Town'],
  jnb: ['Saxon Hotel Johannesburg', 'Four Seasons The Westcliff', 'Hyatt Regency Johannesburg', 'Radisson Blu Sandton', 'InterContinental Johannesburg', 'Peermont D\'Oreale Grande'],
  tun: ['The Residence Tunis', 'Laico Tunis', 'Sheraton Tunis', 'Golden Tulip El Mechtel', 'Concorde Les Berges du Lac', 'Hotel Africa Tunis'],
  dxb: ['Burj Al Arab', 'Atlantis The Palm', 'Armani Hotel Dubai', 'Jumeirah Beach Hotel', 'Ritz-Carlton Dubai', 'Four Seasons Dubai DIFC', 'W Dubai Mina Seyahi', 'Address Downtown'],
  bkk: ['Mandarin Oriental Bangkok', 'The Peninsula Bangkok', 'Shangri-La Bangkok', 'Anantara Riverside', 'Centara Grand', 'Chatrium Riverside', 'Siam Kempinski', 'SO/ Bangkok'],
  sin: ['Marina Bay Sands', 'Raffles Singapore', 'Fullerton Bay Hotel', 'Capella Singapore', 'Shangri-La Singapore', 'Pan Pacific Singapore', 'Mandarin Oriental Singapore', 'Ritz-Carlton Millenia'],
  kul: ['Mandarin Oriental KL', 'Four Seasons KL', 'The Majestic KL', 'Grand Hyatt KL', 'Shangri-La KL', 'W Kuala Lumpur'],
  rio: ['Copacabana Palace', 'Fasano Rio', 'Santa Teresa Hotel', 'Emiliano Rio', 'Miramar by Windsor', 'JW Marriott Copacabana', 'Hilton Barra', 'Grand Hyatt Rio'],
  scl: ['The Ritz-Carlton Santiago', 'W Santiago', 'Mandarin Oriental Santiago', 'Noi Vitacura', 'Hotel Cumbres Lastarria', 'Doubletree Santiago'],
  lim: ['Belmond Miraflores Park', 'JW Marriott Lima', 'Country Club Lima Hotel', 'Hilton Lima Miraflores', 'Westin Lima', 'Swissotel Lima'],
  bog: ['Four Seasons Bogota', 'JW Marriott Bogota', 'Sofitel Bogota Victoria', 'W Bogota', 'Hotel de la Opera', 'Click Clack Hotel Bogota'],
}

const facilityPool = ['WiFi', 'Air Conditioning', 'Breakfast', 'Pool', 'Spa', 'Gym', 'Bar', 'Room Service', 'Parking', 'Garden', 'Laundry', 'Restaurant', 'Concierge', 'Business Center']

const unsplashHotelImages = [
  'https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=400',
  'https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?w=400',
  'https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?w=400',
  'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=400',
  'https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=400',
  'https://images.unsplash.com/photo-1582719508461-905c673771fd?w=400',
  'https://images.unsplash.com/photo-1618773928121-c32242e63f39?w=400',
  'https://images.unsplash.com/photo-1564501049412-61c2a3083791?w=400',
]

// Seeded random for reproducibility
let seed = 42
function seededRandom() {
  seed = (seed * 16807) % 2147483647
  return (seed - 1) / 2147483646
}

function randomInRange(min, max) {
  return Math.round((min + seededRandom() * (max - min)) * 100) / 100
}

function generateFacilities(stars) {
  const base = ['WiFi', 'Air Conditioning']
  const extras = facilityPool.filter(f => !base.includes(f))
  const count = stars >= 5 ? 7 : stars >= 4 ? 5 : 3
  const shuffled = extras.sort(() => seededRandom() - 0.5)
  return [...base, ...shuffled.slice(0, count)]
}

function generateHotelsForCity(cityInfo) {
  const names = hotelNames[cityInfo.prefix]
  const hotels = []

  for (let i = 0; i < cityInfo.count; i++) {
    const stars = i < 2 ? 5 : i < 4 ? 4 : 3
    const priceBase = stars === 5 ? 200 : stars === 4 ? 120 : 60
    const pricePerNight = Math.round(priceBase + seededRandom() * priceBase * 0.8)
    const rating = Math.round((stars === 5 ? 4.3 : stars === 4 ? 3.9 : 3.4) + seededRandom() * 0.6) / 1
    const ratingFixed = Math.round((rating + Number.EPSILON) * 10) / 10

    hotels.push({
      id: `h-${cityInfo.prefix}-${String(i + 1).padStart(3, '0')}`,
      name: names[i] || `Hotel ${cityInfo.city} ${i + 1}`,
      pricePerNight,
      rating: Math.min(4.9, Math.max(3.0, ratingFixed)),
      distanceFromCenter: randomInRange(0.2, stars >= 4 ? 3.0 : 8.0),
      facilities: generateFacilities(stars),
      image: unsplashHotelImages[i % unsplashHotelImages.length],
      location: {
        lat: cityInfo.lat + (seededRandom() - 0.5) * 0.02,
        lng: cityInfo.lng + (seededRandom() - 0.5) * 0.02,
        city: cityInfo.city,
        country: cityInfo.country,
      },
      stars,
      freeCancellation: seededRandom() > 0.4,
      availability: {
        startDate: '2026-04-01',
        endDate: '2026-09-30',
        roomsLeft: Math.ceil(seededRandom() * 8),
      },
    })
  }

  return hotels
}

// Main
const existing = JSON.parse(fs.readFileSync(HOTELS_PATH, 'utf-8'))
const existingCities = new Set(existing.hotels.map(h => h.location.city.toLowerCase()))

let added = 0
for (const cityInfo of newCities) {
  if (existingCities.has(cityInfo.city.toLowerCase())) {
    console.log(`Skipping ${cityInfo.city} (already exists)`)
    continue
  }
  const newHotels = generateHotelsForCity(cityInfo)
  existing.hotels.push(...newHotels)
  added += newHotels.length
  console.log(`Added ${newHotels.length} hotels for ${cityInfo.city}`)
}

fs.writeFileSync(HOTELS_PATH, JSON.stringify(existing, null, 2) + '\n')
console.log(`\nDone. Added ${added} hotels. Total: ${existing.hotels.length}`)
