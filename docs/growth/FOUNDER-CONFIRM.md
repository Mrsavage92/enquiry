# Founder confirm: owner-only decisions

Decisions only the founder can make. An agent must not settle these by
editing copy. Each item says what the site says today and where it lives.

## GST registration and ABN (open, 2026-10-12)

- **What the site says today:** nothing about GST. `PRICES_INCLUDE_GST` is
  `false` since 2026-10-14, so "Prices include GST.", "inc GST" on
  /early-access and "(inc GST)" in the Terms are all hidden. A$15 is the full
  price either way.
- **Why it matters:** "inc GST" says GST is charged and will appear on tax
  invoices. That is only true for a GST-registered business with an ABN. No ABN
  appears anywhere on the site. Registration is only mandatory from A$75K
  turnover, so the founder may not be registered.
- **Where it is controlled:** one switch, `PRICES_INCLUDE_GST` in
  `src/lib/site/offer.ts`. Every GST statement reads it.
- **Founder to confirm:**
  1. Is the operator registered for GST? If yes, provide the ABN so it can be
     shown on the site, the Terms, list emails and receipts, and an agent sets
     `PRICES_INCLUDE_GST = true`.
  2. If not registered, it stays `false`. Whether to add a line such as "No GST
     is charged" is also the founder's call.
- Source: go-live marketing review 2026-10-06, finding 35; business review (e).

## Founding-price cut-off for list members (open, 2026-10-12)

- **What the site says today:** everyone who joins the early-access list
  before public launch keeps the founding price. The Terms now say the same.
- **Open question:** there is no deadline for a list member to start paying.
  Someone who joined the list before launch could subscribe at A$15 a year
  later. If the founder wants a cut-off (the review suggested "subscribe within
  30 days of your invite"), it has to be decided, then added to `OFFER_TERMS`
  and `OFFER.next` in `src/lib/site/offer.ts`.
- Source: go-live marketing review 2026-10-06, finding 8.

## Paid-subscription Terms (open, 2026-10-12)

- The Terms are waitlist terms. They now say a paid-subscription version will
  be published before payments open. That version needs the legal name, the
  ABN and a lawyer read before the first charge.
- Source: go-live marketing review 2026-10-06, finding 34.

## Notification service named in Privacy (closed, 2026-10-14)

- Confirmed: `ALERT_WEBHOOK_URL` points at n8n cloud (n8n GmbH, Germany),
  which emails the founder through Resend. Privacy now names it and says the
  notifications can include roadmap feedback, email addresses and error
  details.
