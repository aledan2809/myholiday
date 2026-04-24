# Decisions — My Holiday
Last Updated: 2026-03-27

## Decision Log
| # | Date | Decision | Rationale | Status |
|---|------|----------|-----------|--------|
| 1 | 2026-02-15 | MASTER governance adopted | Unified orchestration system v3.0 | Active |
| 2 | 2026-03-27 | OpenWeatherMap + Open-Meteo for weather data | Dual-provider: OpenWeatherMap (if key set) with Open-Meteo as free fallback (no key needed). Real weather always available. In-memory cache (30min TTL). | Active |

### Weather API
- **Primary Provider:** OpenWeatherMap (Free Tier) — requires `OPENWEATHER_API_KEY`
- **Fallback Provider:** Open-Meteo (free, no key required) — always available
- **Priority:** OpenWeatherMap → Open-Meteo → mock tags (last resort)
- **Open-Meteo Endpoints:**
  - Geocoding: `geocoding-api.open-meteo.com/v1/search?name={city}&count=1&language=ro`
  - Current + Forecast: `api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lon}&current_weather=true&daily=temperature_2m_max,temperature_2m_min,weathercode&timezone=auto&forecast_days=4`
- **OpenWeatherMap Endpoint:** `api.openweathermap.org/data/2.5/weather?q={city}&appid={key}&units=metric&lang=ro`
- **Cache:** In-memory, 30 min TTL per city
- **WMO Codes:** Mapped to Romanian descriptions + OWM-compatible icons for consistent UI
- **City Resolution:** Romanian name mapping + IATA-to-city mapping for reliable lookups
- **3-Day Forecast:** Daily min/max temperatures + weather codes from Open-Meteo, displayed per result card with Romanian day names
