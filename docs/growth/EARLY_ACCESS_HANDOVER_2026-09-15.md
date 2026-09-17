# Early-access handover: owner runbook, cohort operations and the invite

Date: 15 September 2026 (Australia/Brisbane). Companion to `docs/evidence/early-access-audit-2026-09-15/README.md` (what was verified) and the research report `C:\Users\Adam\Documents\Enquiry\research\47-early-access-go-live-audit-2026-09-15.md` (evidence behind the offer design). This file is the operating document for inviting the first 10-20 businesses.

## 1. Owner runbook (the only things Claude cannot do)

Each step is a dashboard or DNS action. Order matters: 1 before anyone is invited, 2-4 the same day.

### 1. Custom SMTP for sign-in email (about 30 minutes, waits on DNS)

Why: today the sign-in link is sent by Supabase's built-in mailer. Clients see From "Supabase Auth <noreply@mail.app.supabase.io>", a "powered by Supabase / Opt out of these emails" footer under the branded template, best-effort delivery and a cap of a couple of messages an hour. Two clients signing in within the same hour can silently not receive a link.

1. Resend (resend.com), free tier: Domains, add the domain you will send from. Add the DNS records Resend shows (SPF TXT, DKIM records, and a DMARC TXT `v=DMARC1; p=none; rua=mailto:<your mailbox>`). Wait for "Verified".
2. Resend, API Keys: create one key with "Sending access". Copy it once.
3. Supabase dashboard, project `qzzvxfbitixpmfuirvhq`, Authentication, Emails, SMTP Settings: enable custom SMTP. Sender email `hello@<your domain>` (any verified address), sender name `Enquiry`, host `smtp.resend.com`, port `465`, username `resend`, password = the API key.
4. Authentication, Rate Limits: raise "emails sent" from the built-in default to something like 30 per hour.
5. Prove it: open a private window, `/login`, request a link for an address you can read, confirm the From is now `Enquiry <hello@...>` with no Supabase footer, and that the link lands on `/onboarding` or the workspace.
6. Swap the constant in `src/lib/site/contact.ts` to the same mailbox and merge (Claude does this on request).
7. In the same Resend account, create an API key with sending access, then add BOTH of these to Vercel (Production) and redeploy:
   - `RESEND_API_KEY` = that key
   - `EMAIL_FROM` = `Enquiry <hello@yourdomain>`, the same verified sender
   This switches on the waitlist welcome email, which is already built and shipped but
   inert until both variables exist. Until then a signup succeeds in silence and logs
   `[email] skipped`. See `emails/README.md`.

### 2. Alert webhook (5 minutes)

Why: the branch adds `src/lib/server/alert.ts`. Every unexpected server-function failure on the waitlist, roadmap and onboarding paths posts one message to `ALERT_WEBHOOK_URL`. Without the variable it only writes an `[alert]` line to the Vercel log.

1. Slack: create an Incoming Webhook for a private channel. Or Discord: channel settings, Integrations, Webhooks, New Webhook, copy URL.
2. Vercel dashboard, project `enquiry`, Settings, Environment Variables: add `ALERT_WEBHOOK_URL` for Production. Redeploy.

### 3. Vercel production environment check (5 minutes)

Same screen as step 2. Confirm `ANTHROPIC_API_KEY` exists for Production (optional `ENQUIRY_INTERPRETER_MODEL`). Without it invited businesses get deterministic rules only and no model interpretation, which the invite must then say. Claude cannot see this from the PC: the Vercel CLI is signed into team `asavage-5851`, and the project lives under `mrsavage92s-projects`. Running `vercel login` with the Mrsavage92 account on the PC would let Claude check and set variables from then on.

### 4. Revoke the historical Grok broker credential (5 minutes)

`docs/PUBLIC_TRAFFIC_GATE.md` section 1 is still unchecked. Revoke or rotate the OAuth credential at the Grok/xAI environment that issued it, then tick the box with the date. Removing it from the repository was not revocation.

## 2. What the branch changes (for the reviewer)

- `src/lib/site/contact.ts`: single public contact constant, defaulting to the owner's GitHub commit identity (already public in this repo). Footer, Privacy "Your choices", Terms, and the "Check your email" state all read it.
- `src/routes/privacy.tsx`: names Vercel, Supabase (Sydney) and Anthropic (United States) as processors, adds a retention section and the operator line. Last updated 15 September 2026.
- `src/routes/terms.tsx`: 30 days of written notice before billing; contact address.
- `src/routes/early-access.tsx` and the home FAQ: 20-minute setup call, "first 20 invited businesses" cap on the founding offer (owner to confirm the number), week-one feedback expectation, 30 days of notice.
- `src/routes/index.tsx`: hero kicker "For owner-run service businesses".
- `src/routes/login.tsx`: `noindex,nofollow`, matching `/signup`.
- `src/lib/server/alert.ts` (+ tests): webhook alerting, wrapped around the six launch server functions and the two onboarding functions. Rate-limit and cross-site rejections are excluded as expected outcomes.
- `docs/growth/cohort-activation.sql`: the week-one scoreboard (section 3).

No auth, tenancy, commercial engine, schema or deploy changes. No production data touched by the branch.

## 3. Cohort operations

Activation event: a business records its first reviewed reply (a `reviewed_send` with `consumed_at`). It is the one number to watch in week one. Run `docs/growth/cohort-activation.sql` in the Supabase SQL editor every morning; the `follow_up` column names who to contact.

MUST, before the first invite: steps 1-3 above done and proven; Terms and Privacy live (they are); the invite states the beta end date, the notice period and an indicative price range.

MUST, during cohort one:

- Invite in groups of 10-20 at most; fix what cohort one surfaces before cohort two.
- One 20-30 minute setup call per business, booked from the invite reply.
- Reply to every signup and every question the same day.
- Anyone with no activation event by day 3 gets a personal message, not a reminder sequence.

SHOULD: a fixed weekly review slot; an `/updates` entry each week naming what changed because of cohort feedback; 30-60 days of notice before billing, with a 6-12 month grandfathering window, never "forever".

Do not: offer lifetime pricing; stack a money-back guarantee on a free period; promise a dated feature.

## 4. The invite

Written for hand-picked service-business owners, sent from the owner's own mailbox. Fill the bracketed items. Keep the three-part shape: you are in, what happens next, one action.

Subject: Early access to Enquiry - [first name], you are in

Hi [first name],

You are one of the first [20] businesses I am inviting into Enquiry. It is the tool I have been building for service businesses where an enquiry needs working out before it can be quoted or booked: what they actually want, what is missing, what to charge, and what happens next.

What it does today: you paste in an enquiry (or the follow-up texts), Enquiry keeps the conversation and the details together, and prepares the next reply using your services, prices and rules. You review it, send it through your own channel, and record what happened. It does not send anything for you, and it will not invent a price it cannot support.

What it does not do yet: connect to your inbox, Instagram or SMS, take bookings, or handle payments. Those are on the public roadmap as direction, not dates.

What happens next:
1. Reply to this email with a time for a 20-minute setup call this week. I will set up your services and rules with you on the call.
2. You sign in at https://enquiry-ashy.vercel.app/login with this email address. No password; you get a link.
3. In week one I will ask for 15 minutes of honest feedback. What you tell me shapes what gets built next, and I will publish what changed each week.

The commercial side, plainly: early access is free. Enquiry will become a paid product. You will get at least 30 days of written notice before any billing starts, and as a founding business you keep 30% off the standard price for your first 12 months. Indicative pricing is [A$X-Y per month inc GST]; the final number will be confirmed before anyone pays.

If it is not for you, say so and I will remove your account and data.

[Adam]
[contact mailbox]
