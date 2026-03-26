# My Holiday (MVP)

MVP web care coreleaza zboruri, hoteluri si transferuri pentru oferte last-minute in Europa.

## Rulare locala

```bash
npm install
npm run dev
```

Aplicatia este disponibila la `http://localhost:3000/my-holiday`.

## Configurare API-uri

Copiaza `.env.example` in `.env.local` si completeaza cheile. Pentru live data:

```
MY_HOLIDAY_ENABLE_LIVE=true
```

Fara chei, backend-ul foloseste rezultate mock.

## Neon (Postgres) + Prisma

- Creeaza un proiect in Neon si copiaza `DATABASE_URL` in `.env.local`.
- Schema se afla in `prisma/schema.prisma`.
- Cand vrei sa creezi tabelele, ruleaza migrarile Prisma.

## Functionalitati MVP

- Perioada fixa, buget total, plecare din OTP
- Destinatie optionala (mod de explorare)
- Zboruri + hotel + transfer (shuttle/public)
- Costuri defalcate si total
- Lista rezultate cu load more

## Live integration (urmatorul pas)

- Amadeus / Kiwi (zboruri)
- Booking (hoteluri)
- Weather provider (optional)

In `app/api/my-holiday/search/route.ts` se completeaza conectorii reali cand sunt disponibile cheile API.
