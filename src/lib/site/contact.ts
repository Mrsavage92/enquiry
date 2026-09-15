/**
 * The one public contact address for Enquiry. Every mailto on the public
 * site, the legal pages and the auth "check your email" state read it from
 * here, so swapping the mailbox is a one-line change. The default is the
 * owner's GitHub commit identity, already public in this repository; replace
 * it with a product mailbox once custom SMTP and a sending domain exist
 * (docs/growth/EARLY_ACCESS_HANDOVER_2026-09-15.md, owner runbook step 1).
 */
export const SUPPORT_EMAIL = "adamsavage6@hotmail.co.uk";

export const SUPPORT_MAILTO = `mailto:${SUPPORT_EMAIL}`;

/** Operator identity for the legal pages. Name and state only, never an address. */
export const OPERATOR_LINE = "Enquiry is operated by Adam Savage from Queensland, Australia.";
