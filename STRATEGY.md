# Strategy — My Holiday
Last Updated: 2026-03-27

## Vision
Platformă web care correlează zbor + hotel + transfer pentru oferte last-minute în Europa și alte continente, facilitând găsirea rapidă a pachetelor de vacanță complete la preturi accesibile.

## Scope

### MVP (Current Phase)
- Căutare combinată zbor + hotel + transfer
- Perioada fixă, buget total, plecare din București (OTP)
- Discovery mode: explorare fără destinație cu filtre (continent, temperatură, activități)
- Integrare live flights (Amadeus API)
- Bază de date locală hoteluri (210+ hoteluri, 27 orașe, 4 continente)
- Mock data pentru transferuri
- Persistență căutări în Neon/Postgres

### Phase 2 (Complete) — Hotel Integration ✅
- Bază de date locală cu 214 hoteluri reale din 27 orașe pe 4 continente
- API endpoint `/api/hotels` cu filtrare, sortare, paginare, availability check
- API endpoint `/api/hotels/[id]` cu detalii complete + hoteluri similare
- Prețuri sezoniere dinamice (peak/shoulder/low season multipliers)
- Disponibilitate dinamică per hotel+dată
- Integrare completă în search pipeline (hoteluri din DB cu prețuri sezoniere)
- Sorting & filtering dinamic pe rezultate (preț, rating, distanță, anulare gratuită)
- Browse section cu filtre avansate (min/max price) și paginare
- Hoteluri alternative per rezultat
- Pagină detalii hotel cu booking CTA, link hartă, check-in/out, recenzii
- Descrieri hotel în română, checkInTime/checkOutTime, reviewsCount
- Transparența sursei datelor (badge în UI + meta.dataSourceWarning)
- Schema documentată (`data/hotels-schema.md` v1.1) + script generare (`scripts/generate-hotels.mjs`)

### Phase 3 (Next)
- Integrare Kiwi/Tequila pentru zboruri alternative
- ~~Weather provider real (OpenWeather)~~ ✅ Implementat (Phase 4)
- Discovery recommendations cu Flight Destinations API
- Rate limiting și autentificare utilizatori

## Key Goals
- [x] UI complet funcțional cu discovery mode
- [x] Validare robustă input cu Zod
- [x] Integrare Amadeus pentru zboruri live
- [x] Persistență Neon/Postgres cu Prisma
- [x] Rate limiting pentru protecție API
- [x] Sortare rezultate după preț total
- [x] Integrare weather real (OpenWeatherMap + Open-Meteo fallback, cache 30min, always real data)
- [x] Integrare hoteluri locale (210+ hoteluri, 27 orașe, 4 continente, prețuri sezoniere)
- [x] Sorting & filtering dinamic pe rezultate în UI
- [ ] Deploy Vercel în producție

## Constraints

### Technical constraints
- Next.js App Router cu Server Components
- TypeScript strict pentru type safety
- Serverless-first (Vercel) - nu cache în memorie
- Neon Postgres pentru persistență
- Rate limiting simplu pentru MVP local

### Business constraints
- Proiect local MVP - nu deployment imediat
- Budget limitat pentru API keys externe
- Focus pe Europa pentru MVP
- UI în română

## Weather Integration
- **Status:** ✅ Implemented (Phase 4)
- **Primary Provider:** OpenWeatherMap (Free Tier) — requires `OPENWEATHER_API_KEY`
- **Fallback Provider:** Open-Meteo (free, no API key required) — always available
- **Priority Chain:** OpenWeatherMap → Open-Meteo → mock weather tags
- **Scope:**
  - Real-time current weather for all destination results
  - Dual-provider ensures weather data is always real (no mock needed)
  - In-memory cache (30 min TTL) to minimize API calls
  - City name mapping (Romanian → English) for accurate lookups
  - IATA code → city resolution for live/discovery results
  - Weather icons from OpenWeatherMap CDN displayed in result cards
  - WMO weather codes mapped to Romanian descriptions for Open-Meteo
  - Open-Meteo geocoding resolves city names to coordinates automatically
- **3-Day Forecast:**
  - Open-Meteo daily forecast (temperature min/max + weather code per day)
  - Displayed as compact row under current weather in result cards
  - Day names in Romanian (Lun, Mar, Mie, etc.)
  - Weather icons from OpenWeatherMap CDN for visual consistency
- **Limitations:**
  - No alerts/extreme weather warnings
  - Forecast limited to 3 days (Open-Meteo daily endpoint)

## Hotel Integration
- **Status:** ✅ Implemented (Phase 2) — Live Amadeus + Local DB
- **Architecture:** Multi-provider abstraction layer (`lib/hotelProviders.ts`) with unified `UnifiedHotelResult` type
- **Live Provider:** Amadeus Hotel List + Hotel Offers APIs with OAuth2 token caching, retry logic (exponential backoff on 429/5xx), 15min result cache
- **Local Provider:** JSON database (`data/hotels.json`) — 214+ hotels, 27 cities, 4 continents, schema in `data/hotels-schema.md`
- **API Endpoints:**
  - `GET /api/hotels` — browse with filters, sorting, pagination; uses `searchHotelsMultiProvider` for live+local merge
  - `GET /api/hotels/[id]` — detail page; auto-generates dates for Amadeus IDs, similar hotel suggestions
  - `GET /api/hotels/status` — provider health check
- **Search Integration:** Main search (`/api/my-holiday/search`) uses `prefetchLiveHotels` + `pickHotelForSearchResult` from provider layer for all paths (Amadeus flights, Kiwi flights, mock)
- **Live Enrichment:** Amadeus results enriched with local DB metadata (images, descriptions, reviews) via fuzzy name matching
- **Dynamic Pricing:** Seasonal multipliers (Peak Jun-Aug 1.25x, Shoulder Apr-May/Sep-Oct 1.1x, Low Nov-Mar 0.9x)
- **Deduplication:** Fuzzy name matching to avoid showing same hotel from both live + local sources
- **UI Features:** LIVE badge on Amadeus results, source transparency in meta, dynamic sort/filter, browse section with pagination, hotel detail page with booking CTA
- **Fallback Chain:** Amadeus live → Local DB → Fallback (generated data)
- **Generation:** `node scripts/generate-hotels.mjs` regenerates hotel data for all 27 cities

## Out of Scope
- Plăți online și rezervări reale
- Sistem complex de review-uri
- Notificări push/email
- Mobile app nativă
- Integrare sisteme de reservation hoteliere
- Multi-language support (deocamdată doar română)
