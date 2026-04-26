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


## Governance Reference
See: `Master/knowledge/MASTER_SYSTEM.md` §1-§5. This project follows Master governance; do not duplicate rules.

Project-level rules (Master/CLAUDE.md is the source of truth):
- **Credentials** live in `Master/credentials/` (per Master §5). Never check secrets into this repo.
- **Audit ledger** — for any NO-TOUCH or RESTRICT classified zones, propose-confirm-apply per edit + AUDIT_GAPS.md entry per change (per Master §2d).
- **Pre-commit scope verification** — declare expected staged scope + run `Master/scripts/pre-commit-scope-verify.sh` before commits to avoid prior-uncommitted-work blowups (per Master memory `feedback_pre_commit_scope_verify`).
- **Cross-project impact** — modifications that affect deploy / shared libs / consumer projects require a Master classification check first (per `Master/CLASSIFICATION.md`).
