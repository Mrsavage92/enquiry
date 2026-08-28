# Enquiry - Competitive Teardown and Positioning

**Status:** PARTIAL - v1, 2026-08-27
**Market:** Global. SaaS is not a local-only market - AU is one entry market among several, never the ceiling. Prices below are shown in the currency each vendor publishes.

**Purpose:** Find where every competitor is weak, what they do well enough to be worth beating, and where the pricing floor and ceiling actually sit - so Enquiry can be genuinely differentiated rather than another AI inbox.

**Completeness:** pricing structures and capability mapping are researched and cited. Deep review-mining (G2/Capterra/Trustpilot complaint frequency, direct user quotes, app-store sentiment) is NOT yet done - four research agents were cut off by a session limit. Section 7 lists exactly what is still missing. Do not treat the "user complaints" evidence here as complete.

---

## 1. The pricing ladder - where the money actually sits

Everything below is per month unless stated. Currency marked where known.

| Band | Product | Price | What you actually get |
|---|---|---|---|
| Free-ish | **Meta Business Agent** | ~4-5c per message (~$2/M tokens), billing from 2026-08-01 | Instagram + Messenger + WhatsApp only. Answers questions, qualifies, books. No email, no SMS, no web form. |
| Free | Meta Business Suite | $0 | 3-channel inbox. Automation is 5 keyword triggers + 15-min hold. Not decisioning. |
| Free | Google Business Profile | $0 | 120-char welcome message + FAQ menu. Trivial. |
| $10-20 | **Vagaro Connect AI** | $10 add-on | Booking assistant inside Vagaro. |
| $15-20 | Fresha base | $14.95-19.95 USD | Plus **20% commission on new-client marketplace bookings** + card fees. |
| $29-47 | **Jobber AI Receptionist** | $29 add-on - **30 conversations, then $0.79 each** | Answers calls/texts, captures lead, books. |
| $29-79 | **ServiceM8** (AU-native) | Free (30 jobs) / $29 / $79 / $149 / $349 AUD | **No native AI enquiry interpretation.** Zapier/Make only. |
| $38-47 | **Tradify** (AU/NZ-native) | $38-47 USD per user | **No native AI enquiry interpretation.** |
| $42-79 | **Timely** (AU/NZ-native) | AUD $42-79 **per staff member** | Salon booking. Per-staff pricing bites fast. |
| $25-105 | Front | $25-105 per seat + $20/seat AI | Generic shared inbox. No business-rule reasoning. |
| $19-99 | Chatwoot | $19-99 per agent + credit overages | Generic. Self-host is free but needs Docker/Postgres/Nginx. |
| ~$99 | Whippy AI | from ~$99 | Unified inbox, AI drafts, targets home services. |
| $99.95 | **Fresha AI Concierge** | $99.95 **per location** | Only inside Fresha's booking world. |
| $79-329 | Housecall Pro | $79-329 base **+ separate paid AI add-ons** | CSR AI / Voice / Instinct AI all cost extra. |
| $299-449 | Birdeye | $299-449+ **per location** + add-ons | Enterprise/multi-location oriented. |
| $399-999 | **Podium** | $399-999 base + **$99 AI add-on**; real-world **$500-800** | The direct competitor. Serves Australia. |
| $623-1,133 | Thryv | $623-1,133 premium tiers | All-in-one suite, AI at top tiers only. |

### The gap this exposes

**There is nothing credible between roughly US$40 and US$100/month that does real cross-channel enquiry decisioning - in any market.**

Below that band you get single-channel booking bots and keyword automations. Above it you get Podium at $500-800 real-world, or per-location/per-seat pricing that punishes a 1-3 person business. Jobber's $29 looks cheap until the 30-conversation cap converts it to $0.79 per conversation - which bills the busiest businesses hardest, exactly the ones with the most pain.

**Recommended price point: US$59-79/mo flat (~A$90-120), unlimited enquiries, no per-seat, no per-location, no commission, no conversation cap, month-to-month.** That undercuts Podium by ~85%, undercuts Fresha AI Concierge, beats Jobber the moment a business exceeds 30 conversations, and is defensible against Meta because Meta cannot cover email/SMS/forms at all.

---

## 2. Exploitable weaknesses, ranked by attackability

**1. Field-service incumbents own the customer and have no AI enquiry layer at all.**
Both are AU/NZ-native, trusted, entrenched. Neither has native AI enquiry interpretation - it is Zapier/Make glue or nothing. They own the customer relationship and have a hole precisely where Enquiry lives. In AU that is ServiceM8/Tradify; the same hole exists per-market with the local incumbent (Jobber/Housecall in NA, Powered Now/Commusoft in UK).

**2. Podium's real cost is 25-100% above advertised, and its trust signals are poor.**
Advertised $399-999, real-world $500-800 after the $99 AI add-on, 10DLC messaging fees and annual contract terms. Trustpilot 4.1/5 but **BBB rating of D-**. Price resentment and billing-surprise are a documented attack surface. A transparent flat price with no contract is a direct counter-position.

**3. Jobber's AI Receptionist meters the wrong thing.**
$29 for 30 conversations, then $0.79 each. A salon or painter with 150 enquiries a month pays $29 + ~$95 = $124. The pricing actively penalises success. Unlimited flat pricing wins this comparison outright and is easy to put on a landing page.

**4. Fresha takes 20% commission on new-client bookings.**
Owners resent a platform that monetises their own client acquisition and competes for the relationship. Enquiry takes zero commission and does not own the customer - that is a clean, emotionally resonant contrast for the beauty vertical.

**5. Per-seat and per-location pricing is hostile to the actual ICP.**
Timely (AUD $42-79 per staff), Front ($25-105 per seat), Birdeye and Fresha Concierge (per location). A 3-chair salon on Timely pays A$126-237/mo. Flat pricing is a structural advantage against the entire band.

**6. Generic inboxes apply no business-specific rules.**
Front, Chatwoot, Trengo, Respond.io, SleekFlow aggregate messages and offer generic AI reply suggestions. None reason over this business's prices, eligibility, availability or policies. They are plumbing, not decisioning - and they still charge per seat for it.

**7. Meta Business Agent is structurally capped at three channels.**
Instagram, Messenger, WhatsApp. No email, no SMS, no web form, no phone. Most service-business enquiries still arrive by email and web form. Meta also auto-answers with no owner approval gate and no per-action control, which is a trust problem for anything involving a price or a commitment.

**8. ManyChat cannot close the loop.**
Intention-recognition routing, but cannot book inside the conversation - it hands off to an external Calendly-style link. Single-step AI, not multi-turn qualification.

---

## 3. What competitors do well - worth matching or beating

- **Numa's graduated autonomy** is the strongest validated pattern found. Unified cross-channel thread per customer, AI drafts, one-click approval, and explicitly: "higher-stakes actions are drafted and queued for one-click approval, so nothing ships without a human in the loop when it matters." Proven at 1,300+ paying dealerships with revenue tripled in 2026. **This is the same mechanism Enquiry claims** - it is validated, just not in this market. Match the approval UX quality specifically.
- **Podium's breadth** - phone, text, email, social, webchat in one place, with the AI knowing services/pricing/policies. The breadth is the reason it can charge $500-800. Enquiry must match channel coverage or the comparison fails.
- **Jobber's lead-to-job conversion flow** - the handoff from enquiry to scheduled job is smooth and is what 100K+ customers stay for.
- **Fresha's client-facing booking page** and **GlossGenius's design reputation** - both are praised for consumer-facing polish. Enquiry's customer-facing quote/booking pages should meet that bar.

---

## 4. Where Enquiry can be genuinely unique

Verified: **no funded incumbent in this market combines all four of these.**

1. **One coherent enquiry across channels** - not a unified inbox. The enquiry is the object; channels are just surfaces. A customer who submits a web form then follows up on Instagram updates the same enquiry.
2. **Refuses to guess** - renders "exact price cannot be decided until X is known" rather than fabricating confidence. Every incumbent either auto-answers or offers a generic suggestion.
3. **Minimum decision blocker** - asks only for the fact that actually changes the decision, not every empty field. If 5 vs 6 guests produces the same price and feasibility, it does not block on the count.
4. **Autonomy earned per action class** - not one AI on/off switch. Send-a-quote can stay manual while acknowledge-receipt goes automatic, with evidence gates per action.

Numa proves 1 and 4 work commercially. comeshop.ai and Lexomen claim 2 and 3 almost verbatim but have zero customers, funding or reviews - meaning the mechanic is unoccupied in this market, not unproven as an idea.

**The defensible one-line position:**
> Every other tool either answers for you or just sorts your messages. Enquiry works out what can actually be decided, tells you what is missing and why it matters, and only sends what you have allowed it to send.

---

## 5. Counter-positioning against the two real threats

**Against Meta Business Agent (free, near-zero marginal cost):**
Do not compete on the three channels Meta owns. Compete on the ones it structurally cannot reach - email, web form, SMS, phone - plus the things it will not do: apply your actual pricing rules, refuse to answer when it should not, and ask permission before committing you to a price. Meta answers questions. It does not make commercial decisions on your behalf, and businesses should not want it to.

**Against Podium (funded, owns the customer, serves AU):**
Compete on price transparency and contract terms, where their trust signals are weakest. US$59-79 flat, month-to-month, no setup fee, no messaging surcharge, no annual lock-in, against $500-800 real-world on an annual contract with a BBB D-. Do not compete on breadth of suite - Podium wins that and it does not matter to a solo operator.

---

## 6. Action plan

**Immediate (positioning, no build required)**
- Lock pricing at US$59-79 flat, unlimited, month-to-month. Put the anti-metering promise on the landing page explicitly.
- Build a comparison page against Jobber's 30-conversation cap and Fresha's 20% commission. Both are concrete and verifiable.
- Wedge on trades and beauty in whichever market you can reach first; the enquiry layer is open in all of them because field-service and booking incumbents everywhere stop at job management.

**Build priorities that follow from this teardown**
- Channel coverage must include **email and web form first** - that is where Meta cannot follow and where the incumbents are weakest.
- The approval queue is the product's trust surface. Benchmark it against Numa's one-click approval.
- Customer-facing quote and booking pages need Fresha/GlossGenius-grade polish.

**Still to validate**
- Whether trades and salon owners (any market) feel the enquiry-triage pain enough to pay US$59-79. Nothing in this document proves willingness to pay.

---

## 7. Research gaps - what this document does NOT yet have

Four teardown agents were cut off by a session limit before completing. Outstanding:

- **User complaint mining at depth** - G2, Capterra, Trustpilot, GetApp, TrustRadius, app-store reviews. Need complaint frequency counts and direct quotes per competitor, not just the headline signals captured here.
- **Field-service tier detail** - Jobber, Housecall Pro, ServiceM8, Tradify, simPRO. Specifically: do users complain about leads getting lost before they become jobs? That is the wedge hypothesis and it is currently assumed, not evidenced.
- **Beauty vertical detail** - Fresha, Vagaro, GlossGenius, Timely, Phorest. Specifically: what happens today to a "how much for balayage, and can you do Saturday?" enquiry. Also the strength of commission resentment.
- **Meta Business Agent early sentiment** - is anyone turning it off, and is it answering wrongly? This determines how strong the trust counter-position is.
- **Verification of secondary pricing** - several figures here come from SEO comparison sites rather than vendor primary pages. Marked in section 1 where known; needs a primary-source pass.

Re-run these when limits reset.

---

## Sources

- [Meta Business Agent launch](https://about.fb.com/news/2026/06/meta-business-agent/) - 2026-06-03, 1M+ businesses in ~3 months
- [Meta Business Agent billing](https://www.techtimes.com/articles/320787/20260716/meta-business-agent-billing-starts-aug-1-free-test-window-ends-days.htm) - billing from 2026-08-01
- [Podium AI Employee](https://www.podium.com/product/ai-employee) / [Podium pricing](https://www.podium.com/getpricing)
- [Jobber AI Receptionist](https://www.getjobber.com/features/ai-receptionist/) / [launch release](https://www.prnewswire.com/news-releases/jobber-launches-ai-powered-receptionist-to-answer-calls-and-texts-for-busy-home-service-businesses-302531125.html)
- [Numa](https://numa.com/) / [1,300+ dealerships, revenue tripled](https://www.prnewswire.com/news-releases/numa-triples-revenue-surpasses-1-300-dealerships-and-acquires-ficus-to-expand-into-ai-powered-dealership-sales-302737809.html)
- [ServiceM8 AU pricing](https://www.servicem8.com/au/pricing)
- [Fresha pricing and commission](https://pabau.com/blog/fresha-pricing/)
- [Timely AU pricing](https://bellabooking.com/guides/salon-software-pricing-comparison)
- [Podium real-world cost](https://astucia.io/blog/podium-pricing-2026-what-smbs-actually-pay)
- [comeshop.ai](https://comeshop.ai/) / [Lexomen](https://lexomen.com/) - indie, claim the same mechanic, no traction
