# Hotel Data Schema

## Changelog
- [2026-03-27] v1.1: Added description, reviewsCount, checkInTime, checkOutTime fields
- [2026-03-27] v1.0: Initial schema documentation

## File: `data/hotels.json`

Root structure:
```json
{
  "hotels": [HotelEntry, ...]
}
```

## HotelEntry

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `id` | string | Unique ID: `h-{cityPrefix}-{###}` | `"h-lis-001"` |
| `name` | string | Hotel display name | `"Sofitel Lisabona"` |
| `description` | string | Short description in Romanian | `"Experienta de lux..."` |
| `pricePerNight` | number | Base price in EUR (pre-seasonal adjustment) | `309` |
| `rating` | number | Guest rating 1.0-5.0 | `4.5` |
| `reviewsCount` | number | Number of guest reviews | `523` |
| `distanceFromCenter` | number | Distance from city center in km | `0.6` |
| `facilities` | string[] | Available amenities | `["WiFi", "Spa", "Breakfast"]` |
| `image` | string | Unsplash image URL (400w) | `"https://images.unsplash.com/..."` |
| `location` | Location | Geographic + city info | See below |
| `stars` | number | Hotel star classification 1-5 | `5` |
| `freeCancellation` | boolean | Supports free cancellation | `true` |
| `checkInTime` | string | Check-in time (HH:MM) | `"14:00"` |
| `checkOutTime` | string | Check-out time (HH:MM) | `"11:00"` |
| `availability` | Availability? | Optional booking window | See below |

## Location

| Field | Type | Description |
|-------|------|-------------|
| `lat` | number | Latitude |
| `lng` | number | Longitude |
| `city` | string | City name (Romanian for European cities) |
| `country` | string | Country name (Romanian) |

## Availability

| Field | Type | Description |
|-------|------|-------------|
| `startDate` | string | Availability window start (YYYY-MM-DD) |
| `endDate` | string | Availability window end (YYYY-MM-DD) |
| `roomsLeft` | number | Rooms remaining (1-10) |

## Facilities Vocabulary

Standard facility names used across all hotels:

- `WiFi` - Wireless internet
- `Breakfast` - Breakfast included
- `Pool` - Swimming pool
- `Spa` - Spa/wellness center
- `Gym` - Fitness center
- `Bar` - On-site bar
- `Room Service` - In-room dining
- `Beach Access` - Direct beach access
- `Garden` - Garden/terrace
- `Kitchen` - In-room kitchen
- `Air Conditioning` - Climate control
- `Parking` - On-site parking
- `Restaurant` - On-site restaurant
- `Laundry` - Laundry service
- `Concierge` - Concierge desk
- `Business Center` - Business facilities

## Dynamic Pricing

The API applies seasonal multipliers to `pricePerNight`:

| Season | Months | Multiplier |
|--------|--------|------------|
| Peak | Jun-Aug | 1.25x |
| Shoulder | Apr-May, Sep-Oct | 1.1x |
| Low | Nov-Mar | 0.9x |

The `basePrice` field in API responses preserves the original price.

## Coverage

27 cities across 4 continents:
- **Europa** (15): Lisabona, Barcelona, Roma, Nisa, Dubrovnik, Atena, Praga, Amsterdam, Porto, Valencia, Viena, Berlin, Paris, Milano, Budapesta
- **Africa** (4): Cairo, Cape Town, Johannesburg, Tunis
- **Asia** (4): Dubai, Bangkok, Singapore, Kuala Lumpur
- **America de Sud** (4): Rio de Janeiro, Santiago, Lima, Bogota

## Generation

Regenerate hotel data:
```bash
node scripts/generate-hotels.mjs
```
