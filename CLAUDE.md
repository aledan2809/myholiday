# Myholiday — Holiday Package Booking MVP

## Overview
Last-minute vacation packages: correlates flights (Kiwi), hotels (Amadeus/Booking), weather. Discovery mode, search history.

## Stack
- Next.js 16, React 19, TypeScript, Zod
- Prisma 7 + Neon PostgreSQL
- Tailwind CSS
- ai-router (configured, endpoint ready at `/api/ai`)

## Build & Run
```bash
npm run dev      # Dev server
npm run build    # Production build
```

## Features
- Flight search (Kiwi API)
- Hotel search (Amadeus + Booking.com)
- Weather enrichment (dual provider)
- Discovery mode
- Search history (DB persistent)
- AI endpoint ready (POST /api/ai) — not yet used in search flow

## DO NOT MODIFY
- Kiwi/Amadeus API integration logic
- Rate limiting configuration
- Zod validation schemas
- Search history persistence

## Env Vars
```
DATABASE_URL=...
KIWI_API_KEY=...
AMADEUS_API_KEY=...
AMADEUS_API_SECRET=...
```
