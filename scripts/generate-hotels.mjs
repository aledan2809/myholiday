/**
 * Generate 210+ realistic hotel entries for data/hotels.json
 * Covers 27 cities across 4 continents (Europa, Africa, Asia, America de Sud)
 * Run: node scripts/generate-hotels.mjs
 */

import { writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

const cities = [
  // Europa (15 cities)
  { city: 'Lisabona', country: 'Portugalia', lat: 38.7167, lng: -9.1427, prefix: 'lis', tier: 'major' },
  { city: 'Barcelona', country: 'Spania', lat: 41.3876, lng: 2.1700, prefix: 'bcn', tier: 'major' },
  { city: 'Roma', country: 'Italia', lat: 41.9028, lng: 12.4964, prefix: 'rom', tier: 'major' },
  { city: 'Nisa', country: 'Franta', lat: 43.6953, lng: 7.2598, prefix: 'nic', tier: 'standard' },
  { city: 'Dubrovnik', country: 'Croatia', lat: 42.6507, lng: 18.0944, prefix: 'dbv', tier: 'standard' },
  { city: 'Atena', country: 'Grecia', lat: 37.9838, lng: 23.7275, prefix: 'ath', tier: 'major' },
  { city: 'Praga', country: 'Cehia', lat: 50.0755, lng: 14.4378, prefix: 'prg', tier: 'major' },
  { city: 'Amsterdam', country: 'Olanda', lat: 52.3676, lng: 4.9041, prefix: 'ams', tier: 'standard' },
  { city: 'Porto', country: 'Portugalia', lat: 41.1579, lng: -8.6291, prefix: 'por', tier: 'standard' },
  { city: 'Valencia', country: 'Spania', lat: 39.4699, lng: -0.3763, prefix: 'val', tier: 'standard' },
  { city: 'Viena', country: 'Austria', lat: 48.2082, lng: 16.3738, prefix: 'vie', tier: 'standard' },
  { city: 'Berlin', country: 'Germania', lat: 52.5200, lng: 13.4050, prefix: 'ber', tier: 'standard' },
  { city: 'Paris', country: 'Franta', lat: 48.8566, lng: 2.3522, prefix: 'par', tier: 'standard' },
  { city: 'Milano', country: 'Italia', lat: 45.4642, lng: 9.1900, prefix: 'mil', tier: 'standard' },
  { city: 'Budapesta', country: 'Ungaria', lat: 47.4979, lng: 19.0402, prefix: 'bud', tier: 'standard' },
  // Africa (4 cities)
  { city: 'Cairo', country: 'Egipt', lat: 30.0444, lng: 31.2357, prefix: 'cai', tier: 'standard' },
  { city: 'Cape Town', country: 'Africa de Sud', lat: -33.9249, lng: 18.4241, prefix: 'cpt', tier: 'standard' },
  { city: 'Johannesburg', country: 'Africa de Sud', lat: -26.2041, lng: 28.0473, prefix: 'jnb', tier: 'emerging' },
  { city: 'Tunis', country: 'Tunisia', lat: 36.8065, lng: 10.1815, prefix: 'tun', tier: 'emerging' },
  // Asia (4 cities)
  { city: 'Dubai', country: 'EAU', lat: 25.2048, lng: 55.2708, prefix: 'dxb', tier: 'standard' },
  { city: 'Bangkok', country: 'Thailanda', lat: 13.7563, lng: 100.5018, prefix: 'bkk', tier: 'standard' },
  { city: 'Singapore', country: 'Singapore', lat: 1.3521, lng: 103.8198, prefix: 'sin', tier: 'standard' },
  { city: 'Kuala Lumpur', country: 'Malaezia', lat: 3.1390, lng: 101.6869, prefix: 'kul', tier: 'emerging' },
  // America de Sud (4 cities)
  { city: 'Rio de Janeiro', country: 'Brazilia', lat: -22.9068, lng: -43.1729, prefix: 'rio', tier: 'standard' },
  { city: 'Santiago', country: 'Chile', lat: -33.4489, lng: -70.6693, prefix: 'scl', tier: 'emerging' },
  { city: 'Lima', country: 'Peru', lat: -12.0464, lng: -77.0428, prefix: 'lim', tier: 'emerging' },
  { city: 'Bogota', country: 'Columbia', lat: 4.7110, lng: -74.0721, prefix: 'bog', tier: 'emerging' },
]

const hotelBrands = [
  'Grand Hotel', 'Hotel Palace', 'Hotel Royal', 'Hotel Central',
  'Boutique Hotel', 'Residence Inn', 'Hotel Corso', 'Hotel Park',
  'Hotel Europa', 'Hotel Select', 'Hotel Astoria', 'Hotel Metropolitan',
  'Hotel Vista', 'Hotel Riviera', 'Hotel Continental', 'Hotel Panorama',
]

const descriptions = {
  5: [
    'Experienta de lux in centrul orasului, cu servicii premium si atentie la detalii.',
    'Hotel de 5 stele cu vederi panoramice, spa complet si restaurant gastronomic.',
    'Rafinament si eleganta intr-o locatie privilegiata. Servicii personalizate 24/7.',
    'Destinatia ideala pentru calatorii care apreciaza luxul autentic si confortul suprem.',
  ],
  4: [
    'Hotel modern cu facilitati excelente, ideal pentru vacante si calatorii de afaceri.',
    'Amplasare centrala, camere spatioase si mic dejun bogat inclus in tarif.',
    'Combinatia perfecta intre confort, locatie si raport calitate-pret.',
    'Design contemporan, personal prietenos si acces facil la atractiile principale.',
  ],
  3: [
    'Hotel confortabil cu o locatie buna si facilitati esentiale pentru o sedere placuta.',
    'Raport calitate-pret excelent, camere curate si personal amabil.',
    'Alegerea inteligenta pentru calatorii care vor confort fara costuri excesive.',
    'Locatie accesibila, camere renovate si WiFi gratuit in tot hotelul.',
  ],
  2: [
    'Cazare buget-friendly in centrul orasului, perfecta pentru exploratori activi.',
    'Simplu, curat si accesibil. Ideal pentru calatorii tineri si backpackeri.',
    'Locatie centrala la un pret imbatabil, cu tot ce ai nevoie pentru o sedere reusita.',
    'Cazare economica cu acces la transport public si atractii turistice.',
  ],
}

const checkInTimes = ['14:00', '15:00', '13:00', '16:00']
const checkOutTimes = ['10:00', '11:00', '12:00', '10:30']

const hostels = [
  'Youth Hostel', 'City Hostel', 'Backpackers Hub', 'Generator Hostel',
]

const luxury = [
  'Ritz', 'Intercontinental', 'Four Seasons', 'Waldorf Astoria',
  'Grand Hyatt', 'Mandarin Oriental', 'The Peninsula', 'Sofitel',
]

const allFacilities = [
  'WiFi', 'Breakfast', 'Pool', 'Spa', 'Gym', 'Bar',
  'Room Service', 'Beach Access', 'Garden', 'Kitchen',
  'Air Conditioning', 'Parking', 'Restaurant', 'Laundry',
  'Concierge', 'Business Center',
]

const images = [
  'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=400',
  'https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=400',
  'https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?w=400',
  'https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?w=400',
  'https://images.unsplash.com/photo-1618773928121-c32242e63f39?w=400',
  'https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=400',
  'https://images.unsplash.com/photo-1564501049412-61c2a3083791?w=400',
  'https://images.unsplash.com/photo-1596394516093-501ba68a0ba6?w=400',
  'https://images.unsplash.com/photo-1582719508461-905c673771fd?w=400',
  'https://images.unsplash.com/photo-1590490360182-c33d57733427?w=400',
  'https://images.unsplash.com/photo-1445019980597-93fa8acb246c?w=400',
  'https://images.unsplash.com/photo-1568084680786-a84f91d1153c?w=400',
  'https://images.unsplash.com/photo-1455587734955-081b22074882?w=400',
  'https://images.unsplash.com/photo-1506059612708-99d6c258160e?w=400',
  'https://images.unsplash.com/photo-1584132967334-10e028bd69f7?w=400',
  'https://images.unsplash.com/photo-1512918728675-ed5a9ecdebfd?w=400',
  'https://images.unsplash.com/photo-1578683010236-d716f9a3f461?w=400',
  'https://images.unsplash.com/photo-1563911302283-d2bc129e7570?w=400',
]

function seededRandom(seed) {
  let s = seed
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff
    return s / 0x7fffffff
  }
}

function pickRandom(arr, rand) {
  return arr[Math.floor(rand() * arr.length)]
}

function generateHotels() {
  const hotels = []
  let globalIndex = 0

  for (const loc of cities) {
    const count = loc.tier === 'major' ? 10 : loc.tier === 'standard' ? 8 : 6

    for (let i = 1; i <= count; i++) {
      const rand = seededRandom(globalIndex * 7919 + i * 31)
      globalIndex++

      const stars = i <= 2 ? 5 : i <= 4 ? 4 : i <= 6 ? 3 : i <= 7 ? 2 : Math.ceil(rand() * 3) + 2
      let name
      if (stars >= 5) {
        name = `${pickRandom(luxury, rand)} ${loc.city}`
      } else if (stars <= 2) {
        name = `${pickRandom(hostels, rand)} ${loc.city}`
      } else {
        name = `${pickRandom(hotelBrands, rand)} ${loc.city} ${i <= 4 ? 'Premium' : ''}`
          .trim()
      }

      // Avoid duplicate names
      const existing = hotels.find(h => h.name === name)
      if (existing) {
        name = `${name} ${['II', 'Plus', 'Select', 'Novo'][i % 4]}`
      }

      const basePrices = { 5: [150, 350], 4: [80, 180], 3: [45, 110], 2: [25, 65] }
      const [minP, maxP] = basePrices[stars] || [40, 100]
      const pricePerNight = Math.round(minP + rand() * (maxP - minP))

      const baseRatings = { 5: [4.4, 4.9], 4: [4.0, 4.6], 3: [3.5, 4.3], 2: [3.2, 4.1] }
      const [minR, maxR] = baseRatings[stars] || [3.5, 4.3]
      const rating = Math.round((minR + rand() * (maxR - minR)) * 10) / 10

      const distanceFromCenter = Math.round((0.1 + rand() * (stars >= 4 ? 1.2 : 2.5)) * 10) / 10

      // Facilities based on stars
      const baseFacilities = ['WiFi', 'Air Conditioning']
      if (stars >= 3) baseFacilities.push('Breakfast')
      if (stars >= 4) baseFacilities.push('Bar', 'Room Service')
      if (stars >= 5) baseFacilities.push('Spa', 'Gym')
      // Random extras
      const extras = allFacilities.filter(f => !baseFacilities.includes(f))
      const extraCount = Math.floor(rand() * 3)
      for (let e = 0; e < extraCount; e++) {
        const idx = Math.floor(rand() * extras.length)
        baseFacilities.push(extras.splice(idx, 1)[0])
      }

      // Availability: broad windows covering next 6 months
      const now = new Date()
      const availStart = new Date(now)
      availStart.setDate(availStart.getDate() + Math.floor(rand() * 14))
      const availEnd = new Date(now)
      availEnd.setMonth(availEnd.getMonth() + 6)
      const roomsLeft = Math.floor(rand() * 10) + 1

      const descList = descriptions[stars] || descriptions[3]
      const description = descList[Math.floor(rand() * descList.length)]
      const checkInTime = checkInTimes[Math.floor(rand() * checkInTimes.length)]
      const checkOutTime = checkOutTimes[Math.floor(rand() * checkOutTimes.length)]
      const reviewsCount = Math.floor(rand() * (stars >= 4 ? 800 : 400)) + 20

      const hotel = {
        id: `h-${loc.prefix}-${String(i).padStart(3, '0')}`,
        name,
        description,
        pricePerNight,
        rating,
        reviewsCount,
        distanceFromCenter,
        facilities: baseFacilities,
        image: images[globalIndex % images.length],
        location: {
          lat: Math.round((loc.lat + (rand() - 0.5) * 0.02) * 10000) / 10000,
          lng: Math.round((loc.lng + (rand() - 0.5) * 0.02) * 10000) / 10000,
          city: loc.city,
          country: loc.country,
        },
        stars,
        freeCancellation: rand() > 0.3,
        checkInTime,
        checkOutTime,
        availability: {
          startDate: availStart.toISOString().split('T')[0],
          endDate: availEnd.toISOString().split('T')[0],
          roomsLeft,
        },
      }

      hotels.push(hotel)
    }
  }

  return hotels
}

const hotels = generateHotels()
const output = JSON.stringify({ hotels }, null, 2)
const outPath = join(__dirname, '..', 'data', 'hotels.json')
writeFileSync(outPath, output, 'utf-8')

// Stats
const cityStats = {}
for (const h of hotels) {
  cityStats[h.location.city] = (cityStats[h.location.city] || 0) + 1
}
console.log(`Generated ${hotels.length} hotels across ${Object.keys(cityStats).length} cities → ${outPath}`)
console.log('Cities:', Object.entries(cityStats).map(([c, n]) => `${c}(${n})`).join(', '))
