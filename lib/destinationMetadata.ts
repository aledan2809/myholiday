// Destination metadata for intelligent discovery mode matching
// Each destination has typical climate data, available activities, and IATA codes

export type DestinationMeta = {
  city: string
  country: string
  iata: string
  continent: string
  // Average temperatures by season (°C): [winter, spring, summer, autumn]
  avgTemps: [number, number, number, number]
  activities: string[]
  // Romanian display name
  displayName: string
}

// Season index based on month (0=winter, 1=spring, 2=summer, 3=autumn)
export const getSeasonIndex = (dateStr?: string): number => {
  const month = dateStr ? new Date(dateStr).getMonth() : new Date().getMonth()
  if (month >= 2 && month <= 4) return 1  // spring: Mar-May
  if (month >= 5 && month <= 7) return 2  // summer: Jun-Aug
  if (month >= 8 && month <= 10) return 3 // autumn: Sep-Nov
  return 0                                 // winter: Dec-Feb
}

export const allDestinations: DestinationMeta[] = [
  // --- Europa ---
  { city: 'Lisbon', country: 'Portugal', iata: 'LIS', continent: 'Europa', avgTemps: [12, 17, 26, 19], activities: ['city break', 'gastronomie', 'plaja'], displayName: 'Lisabona, Portugalia' },
  { city: 'Barcelona', country: 'Spain', iata: 'BCN', continent: 'Europa', avgTemps: [11, 17, 28, 20], activities: ['plaja', 'city break', 'gastronomie'], displayName: 'Barcelona, Spania' },
  { city: 'Rome', country: 'Italy', iata: 'FCO', continent: 'Europa', avgTemps: [9, 16, 30, 20], activities: ['city break', 'gastronomie'], displayName: 'Roma, Italia' },
  { city: 'Nice', country: 'France', iata: 'NCE', continent: 'Europa', avgTemps: [10, 16, 27, 19], activities: ['plaja', 'city break', 'gastronomie'], displayName: 'Nisa, Franta' },
  { city: 'Dubrovnik', country: 'Croatia', iata: 'DBV', continent: 'Europa', avgTemps: [10, 16, 28, 19], activities: ['plaja', 'city break'], displayName: 'Dubrovnik, Croatia' },
  { city: 'Athens', country: 'Greece', iata: 'ATH', continent: 'Europa', avgTemps: [11, 18, 32, 22], activities: ['plaja', 'city break', 'gastronomie'], displayName: 'Atena, Grecia' },
  { city: 'Prague', country: 'Czech Republic', iata: 'PRG', continent: 'Europa', avgTemps: [1, 11, 22, 12], activities: ['city break', 'gastronomie'], displayName: 'Praga, Cehia' },
  { city: 'Amsterdam', country: 'Netherlands', iata: 'AMS', continent: 'Europa', avgTemps: [4, 11, 20, 13], activities: ['city break', 'gastronomie'], displayName: 'Amsterdam, Olanda' },
  { city: 'Porto', country: 'Portugal', iata: 'OPO', continent: 'Europa', avgTemps: [10, 15, 24, 17], activities: ['city break', 'gastronomie'], displayName: 'Porto, Portugalia' },
  { city: 'Valencia', country: 'Spain', iata: 'VLC', continent: 'Europa', avgTemps: [12, 18, 29, 21], activities: ['plaja', 'city break', 'gastronomie'], displayName: 'Valencia, Spania' },
  { city: 'Vienna', country: 'Austria', iata: 'VIE', continent: 'Europa', avgTemps: [2, 13, 24, 13], activities: ['city break', 'gastronomie', 'wellness'], displayName: 'Viena, Austria' },
  { city: 'Berlin', country: 'Germany', iata: 'BER', continent: 'Europa', avgTemps: [2, 12, 23, 12], activities: ['city break', 'gastronomie'], displayName: 'Berlin, Germania' },
  { city: 'Paris', country: 'France', iata: 'CDG', continent: 'Europa', avgTemps: [5, 13, 24, 14], activities: ['city break', 'gastronomie', 'wellness'], displayName: 'Paris, Franta' },
  { city: 'Milan', country: 'Italy', iata: 'MXP', continent: 'Europa', avgTemps: [4, 15, 28, 15], activities: ['city break', 'gastronomie'], displayName: 'Milano, Italia' },
  { city: 'Budapest', country: 'Hungary', iata: 'BUD', continent: 'Europa', avgTemps: [2, 14, 26, 14], activities: ['city break', 'gastronomie', 'wellness'], displayName: 'Budapesta, Ungaria' },
  // --- Africa ---
  { city: 'Cairo', country: 'Egypt', iata: 'CAI', continent: 'Africa', avgTemps: [15, 24, 34, 26], activities: ['city break', 'safari'], displayName: 'Cairo, Egipt' },
  { city: 'Cape Town', country: 'South Africa', iata: 'CPT', continent: 'Africa', avgTemps: [20, 16, 12, 16], activities: ['plaja', 'safari', 'munte', 'gastronomie'], displayName: 'Cape Town, Africa de Sud' },
  { city: 'Johannesburg', country: 'South Africa', iata: 'JNB', continent: 'Africa', avgTemps: [20, 15, 10, 17], activities: ['safari', 'city break'], displayName: 'Johannesburg, Africa de Sud' },
  { city: 'Tunis', country: 'Tunisia', iata: 'TUN', continent: 'Africa', avgTemps: [12, 18, 30, 22], activities: ['plaja', 'city break', 'gastronomie'], displayName: 'Tunis, Tunisia' },
  // --- Asia ---
  { city: 'Dubai', country: 'UAE', iata: 'DXB', continent: 'Asia', avgTemps: [21, 30, 40, 32], activities: ['plaja', 'city break', 'wellness', 'gastronomie'], displayName: 'Dubai, EAU' },
  { city: 'Bangkok', country: 'Thailand', iata: 'BKK', continent: 'Asia', avgTemps: [28, 32, 30, 28], activities: ['plaja', 'city break', 'gastronomie', 'wellness'], displayName: 'Bangkok, Thailanda' },
  { city: 'Singapore', country: 'Singapore', iata: 'SIN', continent: 'Asia', avgTemps: [27, 28, 28, 27], activities: ['city break', 'gastronomie', 'wellness'], displayName: 'Singapore, Singapore' },
  { city: 'Kuala Lumpur', country: 'Malaysia', iata: 'KUL', continent: 'Asia', avgTemps: [28, 29, 28, 28], activities: ['city break', 'gastronomie', 'wellness'], displayName: 'Kuala Lumpur, Malaezia' },
  // --- America de Sud ---
  { city: 'Rio de Janeiro', country: 'Brazil', iata: 'GIG', continent: 'America de Sud', avgTemps: [28, 24, 22, 24], activities: ['plaja', 'city break', 'gastronomie'], displayName: 'Rio de Janeiro, Brazilia' },
  { city: 'Santiago', country: 'Chile', iata: 'SCL', continent: 'America de Sud', avgTemps: [22, 15, 10, 16], activities: ['city break', 'munte', 'gastronomie'], displayName: 'Santiago, Chile' },
  { city: 'Lima', country: 'Peru', iata: 'LIM', continent: 'America de Sud', avgTemps: [24, 20, 16, 18], activities: ['city break', 'gastronomie'], displayName: 'Lima, Peru' },
  { city: 'Bogota', country: 'Colombia', iata: 'BOG', continent: 'America de Sud', avgTemps: [14, 14, 14, 14], activities: ['city break', 'gastronomie', 'munte'], displayName: 'Bogota, Columbia' },
]

// Parse temperature preference string like "20-26°C" into [min, max]
const parseTemperatureRange = (pref: string): [number, number] | null => {
  if (pref.startsWith('32')) return [32, 45]
  const match = pref.match(/(\d+)-(\d+)/)
  if (!match) return null
  return [Number(match[1]), Number(match[2])]
}

export type ScoredDestination = DestinationMeta & { score: number; matchReasons: string[] }

// Score destinations based on user preferences
export const scoreDestinations = (
  prefs: {
    continent: string | null
    temperature: string | null
    activities: string[]
    maxFlightHours: number | null
  },
  travelDate?: string,
): ScoredDestination[] => {
  const seasonIdx = getSeasonIndex(travelDate)

  let filtered = allDestinations

  // Filter by continent if specified
  if (prefs.continent) {
    const continentFiltered = filtered.filter(d => d.continent === prefs.continent)
    if (continentFiltered.length > 0) filtered = continentFiltered
  }

  const tempRange = prefs.temperature ? parseTemperatureRange(prefs.temperature) : null

  return filtered.map(dest => {
    let score = 50 // base score
    const matchReasons: string[] = []

    // Temperature matching (0-30 points)
    if (tempRange) {
      const destTemp = dest.avgTemps[seasonIdx]
      if (destTemp >= tempRange[0] && destTemp <= tempRange[1]) {
        score += 30
        matchReasons.push(`~${destTemp}°C`)
      } else {
        // Partial credit for close matches
        const distance = Math.min(
          Math.abs(destTemp - tempRange[0]),
          Math.abs(destTemp - tempRange[1]),
        )
        if (distance <= 5) {
          score += 15
          matchReasons.push(`~${destTemp}°C`)
        } else {
          score -= 10
        }
      }
    }

    // Activity matching (0-30 points)
    if (prefs.activities.length > 0) {
      const matched = prefs.activities.filter(a => dest.activities.includes(a))
      const matchRatio = matched.length / prefs.activities.length
      score += Math.round(matchRatio * 30)
      if (matched.length > 0) {
        matchReasons.push(matched.join(', '))
      }
      if (matchRatio === 0) {
        score -= 15
      }
    }

    return { ...dest, score: Math.max(0, score), matchReasons }
  })
    .sort((a, b) => b.score - a.score)
}

// Get top N destination IATA codes for discovery, scored by preferences
export const getDiscoveryDestinations = (
  prefs: {
    continent: string | null
    temperature: string | null
    activities: string[]
    maxFlightHours: number | null
  },
  count: number = 8,
  travelDate?: string,
): ScoredDestination[] => {
  return scoreDestinations(prefs, travelDate).slice(0, count)
}
