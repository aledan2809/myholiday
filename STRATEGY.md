# Strategy — My Holiday
Last Updated: 2026-03-22

## Vision
Platformă web care correlează zbor + hotel + transfer pentru oferte last-minute în Europa și alte continente, facilitând găsirea rapidă a pachetelor de vacanță complete la preturi accesibile.

## Scope

### MVP (Current Phase)
- Căutare combinată zbor + hotel + transfer
- Perioada fixă, buget total, plecare din București (OTP)
- Discovery mode: explorare fără destinație cu filtre (continent, temperatură, activități)
- Integrare live flights (Amadeus API)
- Mock data pentru hoteluri și transferuri
- Persistență căutări în Neon/Postgres

### Phase 2 (Next)
- Integrare reală hoteluri (Amadeus Hotels / Booking.com)
- Integrare Kiwi/Tequila pentru zboruri alternative
- Weather provider real (OpenWeather)
- Discovery recommendations cu Flight Destinations API
- Rate limiting și autentificare utilizatori

## Key Goals
- [x] UI complet funcțional cu discovery mode
- [x] Validare robustă input cu Zod
- [x] Integrare Amadeus pentru zboruri live
- [x] Persistență Neon/Postgres cu Prisma
- [x] Rate limiting pentru protecție API
- [x] Sortare rezultate după preț total
- [ ] Integrare hoteluri reale
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

## Out of Scope
- Plăți online și rezervări reale
- Sistem complex de review-uri
- Notificări push/email
- Mobile app nativă
- Integrare sisteme de reservation hoteliere
- Multi-language support (deocamdată doar română)
