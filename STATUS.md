# STATUS — Myholiday
**Actualizat**: 2026-08-10 (campania CLOSE, Val 2)
**Verdict: STABILIZAT** (local, nedeployat) — 🔴 închis; rămâne o decizie de deploy (a ta)

## Stare generală
- **Clasificare**: ACTIVE · **Nedeployat** (local, port 3000)
- MVP care corelează zboruri + hoteluri + transferuri pentru oferte last-minute (Deal Score din istoric).

## Verificat-întâi (auditul 06-20 era stale)
| Item audit | Stare reală | Dovadă |
|---|---|---|
| 🔴 `/api/ai` fără auth (cost-abuse) | **Reparat** (`8f4fff3`) — gate `x-internal-key === AI_INTERNAL_KEY`, altfel 401 | cod |
| 🟡 Drift cheie Booking.com (`RAPIDAPI_KEY`↔`BOOKING_API_KEY`) | **Rezolvat** — peste tot `RAPIDAPI_KEY`; `BOOKING_API_KEY` nu mai apare nicăieri | grep |

## Nerezolvate — cu motiv
- 🟡 **npm audit (13 vuln., 8 high — Next SSRF).** `npm audit fix` urcă Next într-o versiune cu **bug de build** (`Invariant: Expected an HTML size for prerendered app route /_global-error`) → am revenit la starea care compilează. Cum aplicația e **local, nedeployată**, SSRF-ul din Next **nu e expus** → prioritate mică. Se închide odată cu decizia de deploy (bump Next la o versiune stabilă + build verificat).
- 🟡 **Decizie deploy (a ta)**: politica VPS+PG-only vs. rămâne local. Dacă mergem pe VPS2 → sesiune dedicată (provisionare + bump Next stabil + verificare). Dacă rămâne local → o notăm explicit ca „local intenționat", nu limbo.

## Solid (din audit, confirmat)
Chei server-side, `.env` netracked, rate-limit complet, validare Zod, Prisma parametrizat. Build compilează curat (Next 16.2.4).

## Rămas deschis
- Decizia de deploy (mai sus) — apoi npm audit se închide în aceeași mișcare.
