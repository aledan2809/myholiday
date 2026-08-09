
## 🔍 Introspection Audit 2026-06-20
> Audit complet (gap strategie↔cod · ghid per-pagină · deep research · funcțional + cyber).
> 3 acțiuni deschise · 🔴 1 critice (librărie/local — fără scor extern).
> Rapoarte: `Reports/INTROSPECTION-2026-06-20/` (00-SUMMARY.md, 01-gap-strategy-vs-code.md, 02-pages-guide-RO.md, 03-deep-research-optimization.md, 04b-security-audit.md)
> Checklist Alex centralizat: `Master/reports/Alex_TODO_2026-06-20.md` + tab „Introspection Audit" în UI Master.

## Myholiday (local, nedeployat) — ACTIVE (fix-urile așteaptă review)
Sursă: `Myholiday/Reports/INTROSPECTION-2026-06-20/`

- [ ] 🔴 **`/api/ai` fără auth (cost-abuse)** — protejează înainte de orice deploy (G-MH-AUTH-001).
  - 🗣️ *Pe înțelesul tău:* Ruta inteligentă poate fi apelată de oricine fără cont, ceea ce poate genera costuri pe seama ta. După protejare (înainte de deploy), doar utilizatorii autorizați o folosesc.
- [ ] 🟡 **Drift cheie Booking.com** (`RAPIDAPI_KEY`↔`BOOKING_API_KEY`) — decide numele canonic + `npm audit fix` → Next.js 16.2.6 (3 advisories high incl SSRF).
  - 🗣️ *Pe înțelesul tău:* Cheia spre Booking.com are două nume diferite în cod (confuzie), plus vulnerabilități. După fix, e un singur nume clar și e sigur.
- [ ] 🟡 **Decizie deploy** — promis Vercel vs politica VPS+PG-only; decide VPS2+PG sau rămâne local (nu limbo, L02) + rescrie STATUS/CHANGELOG.
  - 🗣️ *Pe înțelesul tău:* Trebuie decis dacă aplicația merge online pe VPS sau rămâne doar locală — nu lăsată la nesfârșit în nesiguranță. După decizie, documentația spune clar unde stă.
- _Solid: chei server-side, `.env` netracked, rate-limit complet, Zod, Prisma parametrizat. Avantaje: transparența sursei prețului + explicabilitatea recomandării (Deal Score din istoric = pariu top)._

---
