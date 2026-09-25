import { FOUNDING_PRICE } from "@/lib/site/offer";
/**
 * The email a business receives the moment it joins the early-access list.
 *
 * Before this existed, joining the list produced silence: an in-page success
 * state that vanished on refresh and nothing else. This is the only contact
 * between signing up and being invited, so it does three things and stops:
 * confirm they are on the list, say what happens next, and give one action
 * that is useful to them and to us.
 *
 * Truth constraints (docs/PUBLIC_TRAFFIC_GATE.md, docs/PUBLIC_CLAIM_TRUTH_MATRIX.md):
 * - no invitation date is promised, because none is known;
 * - joining is not an account and not a subscription, and this says so;
 * - no capability is claimed that is not live;
 * - the reply address reaches a person.
 *
 * The markup mirrors emails/magic-link.html: inline table layout, system
 * fonts, an optional dark-mode block that clients may strip, and no images.
 */

import { SUPPORT_EMAIL } from "@/lib/site/contact";
import type { EmailMessage } from "./send.server";

export const WAITLIST_WELCOME_SUBJECT = "You are on the Enquiry early-access list";

const PREHEADER = "What happens next, and one thing that helps.";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function waitlistWelcomeText(siteOrigin: string): string {
  return [
    "You are on the list.",
    "",
    "Thanks for joining Enquiry early access.",
    "",
    "What happens next: we invite businesses in small groups, as the product is",
    "ready for them. When it is your turn you will get an email with a sign-in",
    "link. Joining the list is not an account and not a subscription, and there",
    "is nothing to pay. Everyone on the list keeps the founding price of",
    `${FOUNDING_PRICE} a month for as long as they stay subscribed.`,
    "",
    "One thing that helps: reply to this email and tell us what you do, for",
    "example painting, cleaning, mobile makeup, photography. When your",
    "invitation comes we will help you set your services and prices up, so",
    "your first real enquiry lands in a workspace that already knows your",
    "business.",
    "",
    `See what we are building: ${siteOrigin}/roadmap`,
    "",
    `You are receiving this because you joined the early-access list at ${siteOrigin}.`,
    "We will only email you about Enquiry access.",
  ].join("\n");
}

export function waitlistWelcomeHtml(siteOrigin: string): string {
  const origin = escapeHtml(siteOrigin);
  const support = escapeHtml(SUPPORT_EMAIL);
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="light dark" />
    <meta name="supported-color-schemes" content="light dark" />
    <title>${escapeHtml(WAITLIST_WELCOME_SUBJECT)}</title>
    <style>
      @media only screen and (max-width: 540px) {
        .email-padding { padding: 28px 24px !important; }
        .email-title { font-size: 26px !important; line-height: 34px !important; }
      }
      @media (prefers-color-scheme: dark) {
        .email-shell { background-color: #19171e !important; }
        .email-surface { background-color: #25222d !important; border-color: #494251 !important; }
        .email-ink { color: #f6f4fa !important; }
        .email-muted { color: #c5bfce !important; }
        .email-link, .email-dot { color: #c6b5ff !important; }
        .email-rule { border-color: #494251 !important; }
      }
    </style>
  </head>
  <body class="email-shell" style="margin:0;padding:0;background-color:#f5f3f9;font-family:Arial,Helvetica,sans-serif;-webkit-text-size-adjust:100%">
    <div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all">${PREHEADER}</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="email-shell" style="background-color:#f5f3f9">
      <tr>
        <td align="center" style="padding:40px 16px">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px">
            <tr>
              <td class="email-ink" style="padding:0 4px 24px;color:#1c1b1f;font-size:26px;line-height:32px;font-weight:700">
                Enquiry<span class="email-dot" style="color:#6c55c7">.</span>
              </td>
            </tr>
            <tr>
              <td class="email-surface email-padding" style="padding:36px;background-color:#ffffff;border:1px solid #e4deed;border-top:3px solid #6c55c7;border-radius:8px">
                <h1 class="email-ink email-title" style="margin:0 0 16px;color:#1c1b1f;font-size:30px;line-height:38px;font-weight:700">You are on the list.</h1>
                <p class="email-muted" style="margin:0 0 20px;color:#68656d;font-size:16px;line-height:26px">Thanks for joining Enquiry early access.</p>
                <p class="email-muted" style="margin:0 0 20px;color:#68656d;font-size:16px;line-height:26px">
                  <strong class="email-ink" style="color:#1c1b1f">What happens next.</strong> We invite businesses in small groups, as the product is ready for them. When it is your turn you will get an email with a sign-in link. Joining the list is not an account and not a subscription, and there is nothing to pay. Everyone on the list keeps the founding price of ${FOUNDING_PRICE} a month for as long as they stay subscribed.
                </p>
                <p class="email-muted" style="margin:0 0 24px;color:#68656d;font-size:16px;line-height:26px">
                  <strong class="email-ink" style="color:#1c1b1f">One thing that helps.</strong> Reply to this email and tell us what you do, for example painting, cleaning, mobile makeup, photography. When your invitation comes we will help you set your services and prices up, so your first real enquiry lands in a workspace that already knows your business.
                </p>
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td align="center" bgcolor="#6c55c7" style="background-color:#6c55c7;border-radius:6px;mso-padding-alt:16px 20px">
                      <a href="${origin}/roadmap" style="display:block;padding:16px 20px;border:1px solid #6c55c7;border-radius:6px;color:#ffffff;font-size:16px;line-height:22px;font-weight:700;text-align:center;text-decoration:none;mso-padding-alt:0">See what we are building</a>
                    </td>
                  </tr>
                </table>
                <div class="email-rule" style="border-top:1px solid #e4deed;margin-top:28px;padding-top:24px">
                  <p class="email-muted" style="margin:0;color:#68656d;font-size:13px;line-height:21px">
                    You are receiving this because you joined the early-access list at ${origin}. We will only email you about Enquiry access. Questions go to <a class="email-link" href="mailto:${support}" style="color:#583ac0;text-decoration:underline">${support}</a>.
                  </p>
                </div>
              </td>
            </tr>
            <tr>
              <td class="email-muted" style="padding:22px 4px 0;color:#68656d;font-size:12px;line-height:20px">Enquiry &nbsp;|&nbsp; Early access</td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

/** The full message for one new waitlist signup. */
export function waitlistWelcomeEmail(to: string, siteOrigin: string): EmailMessage {
  return {
    to,
    subject: WAITLIST_WELCOME_SUBJECT,
    html: waitlistWelcomeHtml(siteOrigin),
    text: waitlistWelcomeText(siteOrigin),
    replyTo: SUPPORT_EMAIL,
  };
}
