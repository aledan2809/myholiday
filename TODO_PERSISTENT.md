
## 🔍 Introspection Audit 2026-06-20
> Audit complet (gap strategie↔cod · ghid per-pagină · deep research · funcțional + cyber).
> 3 acțiuni deschise · 🔴 1 critice (librărie/local — fără scor extern).
> Rapoarte: `Reports/INTROSPECTION-2026-06-20/` (00-SUMMARY.md, 01-gap-strategy-vs-code.md, 02-pages-guide-RO.md, 03-deep-research-optimization.md, 04b-security-audit.md)
> Checklist Alex centralizat: `Master/reports/Alex_TODO_2026-06-20.md` + tab „Introspection Audit" în UI Master.

## Myholiday (local, nedeployat) — vezi `STATUS.md` (CLOSE Val 2, 2026-08-10 — STABILIZAT)
Sursă: `Myholiday/Reports/INTROSPECTION-2026-06-20/`

- [x] 🔴 **`/api/ai` auth** — reparat `8f4fff3` (gate x-internal-key, 401). Verificat 2026-08-10. 

- [~] 🟡 **Drift cheie** rezolvat (canonic `RAPIDAPI_KEY`, verificat grep). **npm audit** (13 vuln, Next SSRF) NErezolvat: `npm audit fix` rupe build-ul (`/_global-error` invariant) → revenit; local nedeployat = SSRF neexpus, prioritate mică, se închide la deploy. 

- [ ] 🟡 **Decizie deploy (user)** — VPS2+PG vs local intenționat; la deploy se bumpează Next stabil + audit 0. 

---
