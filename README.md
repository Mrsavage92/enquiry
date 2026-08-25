# Enquiry

Phone-first AI enquiry copilot for service businesses. A messy inbound becomes a case file, a number, a letter. You still send.

This is a working prototype (waitlist site + demo app). Nothing is publicly shipped yet.

## Run

```bash
npm install
npm run dev
```

Opens on `http://localhost:8080`.

```bash
npm run typecheck
```

## What’s in here

- **Today** — queue of enquiries that need you
- **Booked** — diary of accepted jobs
- **Brain** — prices, rules, voice
- **Waitlist site** — `/` and `/early-access`

Demo data is seeded (Glow & Co, Priya Shah, etc.). Reset from Settings.

## Stack

TanStack Start, React, Tailwind v4, Zustand, Postgres (PGLite / Neon). Auth is off; waitlist is on.
