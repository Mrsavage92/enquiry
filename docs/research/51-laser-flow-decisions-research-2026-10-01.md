# 51 - Laser flow: four decisions, researched (2026-10-01)

Scope: the four open decisions from doc 50 (OD-1 coverage inside Copy, OD-2 name in the greeting, OD-3 channel deep links, R1 clipboard on iPhone). Each section gives evidence with URLs, a recommendation, and risks with mitigations. Anything not confirmed from a primary or first-hand source is marked **UNVERIFIED**. No device testing was done for this document.

## Decisions

| # | Decision | Recommendation | Confidence | Key source |
| --- | --- | --- | --- | --- |
| 1 | Fold "That's everything" into Copy | **Fold, with a risk gate.** The reply itself states, to the customer, what the price includes and leaves out, directly above Copy; Copy (labelled with the item count) is the attestation. Keep the separate tap only when any included item was inferred rather than stated by the customer, or the risk is HIGH / PROHIBITED_AUTO. | Medium | NN/g, Confirmation Dialogs (Nielsen 2018); Anderson et al. CHI 2015 (habituation after the 2nd exposure); Bravo-Lillo et al. SOUPS 2013 |
| 2 | Auto-fill "Hi Tom," vs "Hi there," + "Greet as Tom?" | **Auto-fill only when two independent signals agree** (the sign-off name matches the sender's display name, email local part or contact name). Otherwise "Hi there," plus a one-tap "Greet as Tom?". When auto-filled, show the name as a tappable chip inside the greeting, not as static text. | Medium | Baymard, input fields (prefilled static values get overlooked); Daneman & Stainton 1993 (fewer errors caught in familiar text); Parasuraman & Manzey 2010 |
| 3 | "Open in Messages / Mail / WhatsApp" buttons | **Ship "Open in Messages" (SMS) and "Open in WhatsApp" only for enquiries that arrived on that channel, and only after a real-device pass.** Each Open button also writes the clipboard in the same tap. **Hold "Open in Mail"** (mailto starts a new, unthreaded email and Gmail-as-default behaviour is unconfirmed). **Copy stays on every reply**, and is the only path for Messenger, Instagram, hipages, Airtasker, Gumtree and website forms. | Medium (SMS, WhatsApp), Low (Mail) | RFC 5724; Apple SMS Links (archived); WhatsApp Click to Chat FAQ; Meta m.me docs |
| 4 | Clipboard reliability on iPhone | **`navigator.clipboard.writeText(text)` as the first statement of the tap handler, with the text already in memory, no `await` before it.** Do not use `ClipboardItem` as the main path. On rejection: select the reply text with a DOM Range, say "copy it by hand", and offer "Copy again" (a fresh tap gives fresh activation). Record `copied_at` only when the promise resolves. **A real-device test is still required.** | High (pattern), Medium (iOS PWA) | MDN Clipboard API, security considerations; MDN browser-compat-data; WebKit blog "Async Clipboard API"; WebKit PR #74301 |

### Top 3 risks

1. **Reflex attestation (Decision 1).** Folding coverage into Copy makes the most-repeated tap the load-bearing one, and habituation to repeated prompts sets in after the second exposure (Anderson et al. 2015). Mitigation: the truth to the customer must not depend on the tap. The reply states the included and excluded items in words the customer reads, and the separate confirm comes back whenever the system is unsure.
2. **A wrong name goes out and cannot be undone (Decision 2).** Undo only exists until the owner pastes and sends in another app. Owners skim familiar, prefilled text (Daneman & Stainton 1993; Baymard), and the customer's own name is the single most noticed word in the message. Mitigation: two-signal gate, "Hi there," otherwise, and an editable chip.
3. **iOS behaviour is undocumented where it matters (Decisions 3 and 4).** Apple's own docs say an `sms:` URL "must not include any message text"; body prefill is de facto behaviour. WebKit changed clipboard writes to require transient activation on 2026-07-01 (316338@main), which caused intermittent first-tap `NotAllowedError` until a fix on 2026-09-19 (321448@main). Which shipping iOS builds carry the regression is UNVERIFIED. Home-screen (standalone) behaviour for `sms:`, `wa.me` and the clipboard is not documented by Apple. Mitigation: every Open button also copies; Copy always remains; a rejection path that selects the text; a device test matrix before shipping (section 5).

---

## 1. Fold the confirmation into Copy?

**Today:** "That's everything" (owner confirms what the quoted price covers), then Copy, then "Sent it? Yes".
**Proposal:** the reply lists exactly what is included right above Copy, and copying counts as the confirmation.

### Evidence

- **Generic confirmations get clicked through.** Nielsen: "When users are asked 'Are you sure you want to do this?' without further details, the only sensible reaction is 'of course I want to do the thing I just told you to do,' and hit Yes without further thinking." Overuse means "people will stop paying attention". Confirmations must be "sufficiently specific that users know what they're agreeing to", and undo should be provided anyway. NN/g, Confirmation Dialogs Can Prevent User Errors (If Not Overused), 2018, reviewed 2026: https://www.nngroup.com/articles/confirmation-dialog/
- **Habituation is fast and measurable.** An fMRI study found "a dramatic drop in the visual processing centers of the brain after only the second exposure to a warning", with further drops after that. Warnings whose appearance changes (polymorphic) habituated less. Anderson, Kirwan, Jenkins, Eargle, Howard, Vance, CHI 2015: https://dl.acm.org/doi/10.1145/2702123.2702322 . The same group showed habituation carries over between notifications and warnings ("It All Blurs Together"): https://www.researchgate.net/publication/311999532
- **What does work: make the user touch the salient information.** "Inhibitive attractors" (UI that briefly blocks the action and pulls attention to the key fact) made people two to three times more likely to make an informed decision than controls, and held up under repeated exposure. Bravo-Lillo et al., SOUPS 2013: https://cups.cs.cmu.edu/soups/2013/proceedings/a6_Bravo-Lillo.pdf
- **Prefer undo to warnings when undo is real.** "Never use a warning when you mean undo." Raskin, A List Apart, 2007: https://alistapart.com/article/neveruseawarning/ . Note: once the owner has sent the reply from their own phone, there is no undo. Undo only covers the in-app state.
- **Slips happen on autopilot; prevent them with good defaults and constraints, not blame.** Laubheimer, NN/g, 2015: https://www.nngroup.com/articles/slips/
- **ADHD: working memory and extra steps.** A meta-analysis of 38 studies found moderate working memory deficits that persist into adulthood. Alderson, Kasper, Hudec, Patros, Neuropsychology 27(3), 2013: https://pubmed.ncbi.nlm.nih.gov/23688211/ . Postcompletion errors (dropping a step once the main goal feels done) are explained by working memory load causing goal loss. Byrne & Bovair, Cognitive Science 21(1), 1997, summarised in Chung & Byrne 2004: http://chil.rice.edu/research/pdf/ChungByrne04.pdf . Each extra tap is another sub-goal to hold; with ADHD the cost of each is higher, and the "Sent it? Yes" tap after Copy is exactly the postcompletion shape. **UNVERIFIED:** no study was found that measures confirm-step error rates specifically in adults with ADHD.

### Reading of the evidence

The "That's everything" tap is a generic confirm in practice: it appears on every priced quote, its wording never changes, and it sits before the owner sees the consequence in the reply. That is the profile that habituates by the second or third quote. Its value is the moment it forces the owner to look at the list, and that value decays.

What protects the customer is not the tap. It is the reply saying, in plain words, "This covers walls and ceilings in 3 bedrooms. It doesn't include doors or the deck." If the owner copies by reflex and the scope is wrong, the customer still reads an accurate statement of what the price covers and can correct it. That keeps the product's rule (never tell a customer something untrue) without leaning on owner attention.

A forcing function is still worth its tap when the system itself is unsure. That is when friction is specific, rare, and therefore noticed (Bravo-Lillo; Nielsen).

### Recommendation: fold, with a risk gate

1. The reply always contains an explicit included / not included sentence for a priced quote, generated from the coverage list, and the server refuses a SEND_QUOTE whose body lacks it (extend the pre-check).
2. Directly above Copy, the same items show as a compact list (doc 50 slot D or the send line). The Copy label names the count: "Copy reply - covers 3 things".
3. Copy on a clean quote records coverage as confirmed **only when "Sent it? Yes" is tapped**, consistent with doc 50's "only recorded after confirmation" invariant. Copy itself still records no send.
4. Keep "That's everything" as its own tap when any of these hold: an included item was inferred (not stated by the customer); the coverage list changed after the owner last saw it; risk HIGH / PROHIBITED_AUTO; an estimate range. In those cases the tap is rare and specific, which is where confirmations work.

### Risks and mitigations

- **Reflex copying of a wrong scope.** Mitigation: scope is stated to the customer in the reply; the gate above restores the tap when the system is unsure.
- **A reply edited so it no longer states the scope.** Mitigation: the pre-check refuses a SEND_QUOTE body without the scope sentence (same mechanism as `namesAmount`).
- **Metrics hide the problem.** Mitigation: log how often owners edit the scope after Copy and how often "Not yet" follows Copy on priced quotes; a rise means owners are copying before reading.

---

## 2. The customer's name in the greeting

**Options:** (A) auto-fill "Hi Tom," with an Undo row; (B) "Hi there," with a one-tap "Greet as Tom?".

### Evidence

- **Prefilled values shown as static text get overlooked.** Baymard: "users often overlook prefilled and autofilled values when they are presented as static text", so they should be presented as open fields or other interactive elements; in testing, users did catch wrong geotargeted values when the values were in editable fields. https://baymard.com/blog/input-fields
- **People catch fewer errors in text that feels familiar.** Students proofreading their own essays detected about 20% fewer errors than when proofreading a familiar essay by someone else; the authors put it down to expectancy-driven reading. Daneman & Stainton, Reading and Writing 5, 1993 (via secondary summaries; the original was not fetched, **partly UNVERIFIED**): https://www.researchgate.net/publication/361805118_Revisiting_the_self-generation_effect_in_proofreading . A greeting the owner sees on every reply is the most familiar line on the screen.
- **Automation bias and complacency.** Complacency and automation bias result from the interaction of personal, situational and automation factors, with attention central; they are worse when the automation is usually right and the operator is busy. Parasuraman & Manzey, Human Factors 52(3), 2010: https://www.researchgate.net/publication/47792928 . A name reader that is right most of the time trains owners to stop checking it.
- **Defaults stick.** Opt-out defaults produced consent above 90% versus single digits to 25% for opt-in, because changing a default costs effort. Johnson & Goldstein, Science 2003: https://www.science.org/doi/10.1126/science.1091721 . Whatever Enquiry pre-fills is what will usually be sent.
- **The recipient's own name is the most salient word they read.** The own-name effect (Moray 1959; preregistered replication: "One's name captures attention, unexpected words do not"): https://www.researchgate.net/publication/343843497 . A wrong name will be noticed by the customer even if the owner missed it.
- **Undo over confirm, with a limit.** NN/g and Raskin (above) prefer undo. Here undo only works until the owner sends from their own app; after that the error is permanent. So "undo over confirm" applies to the in-app state, not to the customer.
- **Cost of a wrong name in a business reply: UNVERIFIED.** No controlled study was found that measures trust or reply rate after a wrong-name greeting. Studies show name personalisation raises survey response rates (for example +8.6 points in web surveys, https://www.researchgate.net/publication/248988916), so there is a real upside to getting it right. The size of the downside of getting it wrong is reasoned, not measured: a stranger's name or a suburb in the greeting tells the customer the reply was machine-made, which cuts against a trust-first product.
- **How often owners check a prefilled greeting: UNVERIFIED.** No data found. Enquiry's own beta logs can answer it: rate of Undo / edit on the greeting line versus later customer corrections.

### Recommendation: gate the auto-fill on two signals

- **Auto-fill "Hi Tom,"** only when the sign-off name agrees with a second independent signal: the sender's display name, the email local part, the contact name on the phone number, or a name the customer wrote elsewhere in the message ("I'm Tom"). The engine's existing filter ("titles and suburbs are never names") stays.
- **Otherwise "Hi there,"** plus "Greet as Tom?" (one tap) when a single-signal name exists.
- When auto-filled, render the name in the greeting as a tappable chip ("Hi [Tom]," with a dotted underline) that opens Change / Use "Hi there". This is Baymard's interactive-not-static rule applied inside the text. Keep doc 50's separate "Greeting: Tom (from sign-off) - Undo" row as well.
- Record the name as confirmed only on "Sent it? Yes" (doc 50 6.4 already does this).

This keeps the founder's direction (no tap in the common case) for the cases where the reading is very likely right, and spends a tap only where the reader is guessing.

### Risks and mitigations

- **Two signals agree and are both wrong** (for example a shared family email). Mitigation: the chip; low frequency; an edit to the greeting after Copy is logged.
- **"Hi there," feels cold.** Mitigation: "Greet as Tom?" sits on the same line; the cost is one tap only when the reading is weak.
- **Non-Latin or unusual names misread as non-names.** Mitigation: the fallback is a neutral greeting, never a wrong one.

---

## 3. "Open in Messages / Mail / WhatsApp"

### 3a. `sms:` with a body

- **Standard:** RFC 5724: `sms-uri = scheme ":" sms-hier-part [ "?" sms-fields ]`, field `body`, value percent-encoded UTF-8, `body` must not appear more than once. Example `sms:+15105550101?body=hello%20there`. No guidance on line breaks. https://www.rfc-editor.org/rfc/rfc5724.html
- **Apple's only documentation** (archived URL Scheme Reference) says `sms:<phone>` and "The URL string must not include any message text or other information." https://developer.apple.com/library/archive/featuredarticles/iPhoneURLScheme_Reference/SMSLinks/SMSLinks.html . Body prefill on iOS is therefore **de facto, undocumented** behaviour.
- **iOS separator:** widely reported as `&body=` (for example `sms:+61412345678&body=Hi%20Tom`). Sendblue's guide: "iOS has always used `&body=` instead", and prefilled bodies "have functioned consistently across iOS versions" as de facto behaviour: https://docs.sendblue.com/guides/imessage-link-button/ . Heymarket (2022): Android expects `?body=`, iOS `&body=`: https://www.heymarket.com/blog/sms-url/ . A 2025 report shows `sms:+15551234567?body=...` working on iPhone: https://sethmlarson.dev/sms-urls . Old iOS (6 and earlier) used `;body=` (Rick Strahl, 2013): https://weblog.west-wind.com/posts/2013/Oct/09/Prefilling-an-SMS-on-Mobile-Devices-with-the-sms-Uri-Scheme . **UNVERIFIED for iOS 15 to the current release:** which separators work on each version. No Apple statement exists.
- **Android Chrome:** RFC form `sms:+61412345678?body=...` (secondary sources above). The handler is whichever SMS app is default (Google Messages on most phones). **UNVERIFIED:** behaviour with Samsung Messages as default.
- **Newlines and encoding:** use `encodeURIComponent`, which turns a newline into `%0A`. **UNVERIFIED:** that every handler keeps `%0A` as a line break (no primary source states it). Emoji and curly quotes force UCS-2 encoding on the carrier side, so a long reply becomes more SMS segments; most AU plans have unlimited SMS, so this is cost-neutral for most owners (**UNVERIFIED** per plan).
- **Length:** no documented limit on the `body` parameter. A 300-word reply encodes to a few KB, well under browser URL limits. **UNVERIFIED** for the Messages app on iOS.
- **Multiple recipients:** Apple does not implement RFC 5724 comma-separated recipients (Seth Larson). Enquiry only ever needs one recipient.

### 3b. `mailto:` with subject and body

- **Standard:** RFC 6068: "Line breaks in the body of a message MUST be encoded with '%0D%0A'"; non-ASCII as percent-encoded UTF-8; no length limit in the spec. https://www.rfc-editor.org/rfc/rfc6068.html
- **Default mail app:** since iOS 14 the user can set Gmail or Outlook as default, and `mailto:` opens that app (https://nemecek.be/blog/61/ios-14-how-to-send-email-using-default-email-app). Google documents Gmail as a default iOS mail app (https://support.google.com/mail/answer/10079967). Secondary sources disagree on what happens next: one claims the Gmail iOS app ignores `subject` and `body` in mailto links, another that some mailto handoffs still open Apple Mail. **UNVERIFIED and conflicting;** needs a device test.
- **Threading:** a `mailto:` link opens a **new** message. It cannot reliably reply inside the customer's existing thread (clients thread on `In-Reply-To` / `References` headers, which mail apps generally ignore from a mailto URL; **UNVERIFIED** per client). A "Re: your painting enquiry" subject may group in some clients but not all. For an email enquiry, the owner replying in the existing thread (with Copy) keeps the customer's own words and the quote together.
- **Length:** Practical limits around 2,000 characters are often quoted for some desktop clients. **UNVERIFIED** for iOS Mail, Gmail and Outlook mobile.

### 3c. WhatsApp `wa.me`

- **Format (WhatsApp Click to Chat):** `https://wa.me/<number>?text=<urlencodedtext>`, number "in full international format", omitting "any zeroes, brackets, or dashes" and the plus sign. FAQ: https://faq.whatsapp.com/5913398998672934 (the FAQ page did not render for fetching; the wording above is as quoted consistently by secondary guides such as https://chatfuel.com/blog/create-whatsapp-link, **treat as verified-by-proxy**).
- **Australia:** drop the trunk 0 and prefix 61. Mobile `0412 345 678` becomes `https://wa.me/61412345678?text=Hi%20Tom`. Normalise from E.164 (`+61412345678`) by removing the `+`.
- **Length limit for `text`:** **UNVERIFIED.** WhatsApp documents none.
- **Alternative scheme:** `whatsapp://send?phone=61412345678&text=...` opens the app directly but fails if WhatsApp is not installed. **UNVERIFIED** as a documented, supported scheme today.
- **Only offer it when the enquiry came in on WhatsApp**, so the app is known to be installed and the number is known to be on WhatsApp.

### 3d. Messenger, Instagram, Gumtree, hipages, Airtasker

- **Facebook Messenger:** Meta's m.me docs list `ref` (and opt-in parameters), not `text`, and describe links to business Pages: https://developers.facebook.com/docs/messenger-platform/discovery/m-me-links/ . A `text` parameter is undocumented. An owner replying to a person cannot address them with a Page link anyway. **No prefill.**
- **Instagram:** `ig.me/m/<username>` supports only `ref`; appending `?text=` prefills nothing (consistent across multiple guides, for example https://creatorflow.so/blog/ig-me-link-guide/; Meta's own ig.me page was not fetched, **partly UNVERIFIED**). **No prefill.**
- **hipages:** tradie-homeowner conversations run inside the hipages app (Sendbird chat); tradies may also contact customers by SMS, email or click-to-call: https://delight.ai/customers/hipages , https://apps.apple.com/au/app/hipages-tradiecore/id1531412737 . No public deep link to prefill a hipages chat was found. **No prefill.**
- **Airtasker:** comments before assignment, private messages only after assignment, all in-app; contact details and third-party links are restricted in public areas: https://support.airtasker.com/hc/en-au/articles/200294269-How-do-I-send-a-private-message . **No prefill.**
- **Gumtree:** replies run through Gumtree's own messaging. **UNVERIFIED** (no primary page fetched), but no public prefill link is known.

### 3e. Installed PWA (iOS standalone)

- Out-of-scope links in an iOS home-screen web app open in an in-app browser, and link capturing into other apps is limited (firt.dev iOS PWA compatibility notes, last updated 2023): https://firt.dev/notes/pwa-ios/
- `sms:` and `mailto:` are system schemes, so they should hand off to Messages / Mail as in Safari. **UNVERIFIED** in standalone mode on current iOS.
- `https://wa.me/...` is an ordinary https link. In standalone mode it may open in the in-app browser showing WhatsApp's web page ("Continue to chat") instead of jumping straight to WhatsApp, which adds a tap. **UNVERIFIED.**
- Trigger every Open action from a real `<a href>` the owner taps, never from script after an `await`, so the navigation carries the user gesture.

### 3f. Which channels do AU owner-run service businesses actually receive enquiries on?

Primary, quantified data is thin.

- Yellow Social Media Report 2020 (1,020 AU SMBs): 63% use social media for two-way communication with customers: https://www.yellow.com.au/wp-content/uploads/sites/2/2020/07/Yellow_Social_Media_Report_2020_Business.pdf
- ServiceTitan Australian Tradies Market Report 2025 (1,025 respondents): most tradies market through word of mouth (70%) and their website (76%); only 13% use SMS/text messaging tools: https://www.servicetitan.com/blog/australian-tradies-market-report-2025 . This measures marketing tools, not inbound channel mix.
- hipages: in-app chat plus SMS, email and click-to-call (above).
- **UNVERIFIED:** a per-channel split of inbound enquiries for AU painters, cleaners and mobile beauty. Industry knowledge (not measured here) suggests phone and SMS dominate for trades, and Instagram / Facebook DMs dominate for mobile beauty, which are the two channels that cannot be prefilled. Enquiry should measure this from its own beta: log the source channel of each enquiry and which send button was used.

### Recommendation

1. **Copy stays on every reply.** It is the only path for Messenger, Instagram, marketplaces and website forms, and the fallback when a deep link misbehaves.
2. **"Open in Messages"** when the enquiry arrived by SMS and a mobile number is on file. iOS: `sms:+61412345678&body=<encoded>`; Android: `sms:+61412345678?body=<encoded>`; pick by user agent. Ship only after the device matrix in section 5 confirms prefill on the current and previous iOS releases.
3. **"Open in WhatsApp"** when the enquiry arrived by WhatsApp: `https://wa.me/61412345678?text=<encoded>`. Device-test the standalone PWA path.
4. **Hold "Open in Mail".** It starts an unthreaded new email, and the Gmail-default behaviour is unconfirmed. Revisit if beta data shows owners reply to email enquiries from a different client than the one the enquiry arrived in.
5. **Every Open button also copies** in the same tap (`writeText` first, then let the anchor navigate). If the composer opens empty, the owner pastes. The button is subject to the same pre-check gate as Copy and records nothing; "Sent it?" follows as for Copy.
6. Show at most one Open button, chosen by the enquiry's source channel, so each state still has one main action (doc 50 G1).

### Risks and mitigations

- **Prefill silently dropped on some iOS version.** Mitigation: the button also copies; label the status line "Copied too, in case it opens empty"; device matrix.
- **Wrong recipient** (number read wrongly). Mitigation: the button shows the number it will open ("Open in Messages - 0412 345 678") and only uses a number from the enquiry's own channel metadata, never one read from the message body.
- **The app opens but the owner never comes back to tap Yes.** Mitigation: doc 50's "came back after leaving" state; the deep link gives a clean "left to send" signal (doc 50 OD-3).

---

## 4. Clipboard reliability on iPhone

### Evidence

- **Writing needs transient activation in Safari and Firefox; Chromium accepts activation or the `clipboard-write` permission.** "Firefox & Safari: ... Writing requires transient activation. ... The `clipboard-read` and `clipboard-write` permissions are not supported (and not planned to be supported) by Firefox or Safari." "Chromium browsers: ... Writing requires either the `clipboard-write` permission or transient activation." MDN Clipboard API, Security considerations: https://developer.mozilla.org/en-US/docs/Web/API/Clipboard_API
- **WebKit's own statement:** "A call to `clipboard.write` or `clipboard.writeText` outside the scope of a user gesture (such as "click" or "touch" event handlers) will result in the immediate rejection of the promise." Safari 13.1 shipped the async Clipboard API. Each `ClipboardItem` maps a MIME type to a Promise resolving to a string or Blob. WebKit blog, 2020: https://webkit.org/blog/10855/async-clipboard-api/
- **Support (MDN browser-compat-data):** `writeText` Safari / iOS Safari 13.1, Chrome 66 (since Chrome 107 "must be called within user gesture event handlers, or the user must grant the `clipboard-write` permission"), Firefox 63. `ClipboardItem` Safari 13.1; Chrome 76-98 Blob only, 98-133 "Only accepts a Blob or a Promise resolving to a Blob", full support (strings) from 133; Firefox 127. https://github.com/mdn/browser-compat-data/blob/main/api/Clipboard.json , https://github.com/mdn/browser-compat-data/blob/main/api/ClipboardItem.json
- **An `await` before `writeText` breaks it on Safari.** Safari "won't work since the use of an async method between the user interaction & the clipboard write is not allowed"; the workaround is to pass the pending work to `ClipboardItem` as a Promise, and in Chrome the Promise must resolve to a Blob (a string "would silently fail and just write an empty string"): https://kian.org.uk/writing-to-clipboard-in-safari-transient-activation/ (2025), https://wolfgangrittner.dev/how-to-use-clipboard-api-in-safari/ . WebKit bug 225559 (open): Safari's gesture survives `setTimeout` for about 1 second but can be lost across other awaits: https://bugs.webkit.org/show_bug.cgi?id=225559
- **`write()` can fail in Safari where `writeText()` works.** Supabase Studio's copy buttons failed in Safari with `NotAllowedError` from `clipboard.write()`; the fix was a fallback to `writeText()`: https://github.com/supabase/supabase/issues/50769 , https://github.com/supabase/supabase/pull/50805
- **Recent WebKit regression.** 316338@main (2026-07-01) made the async clipboard API require transient activation instead of `processingUserGesture()`. Because Safari "evaluates JavaScript in the page a few milliseconds after a click", copy buttons "sometimes [did] not copy the first time" (`NotAllowedError`). Fixed by 321448@main, merged 2026-09-19: https://github.com/WebKit/WebKit/pull/74301 . **UNVERIFIED:** which Safari / iOS releases contain the regression and which contain the fix. An Apple forum thread (Safari 18.2-18.3) also shows `writeText` rejected from a `<select>` `input` event, so only click / touch handlers should be relied on: https://developer.apple.com/forums/thread/772275
- **Activation window:** the HTML Standard says the transient activation duration "is expected be at most a few seconds": https://html.spec.whatwg.org/multipage/interaction.html#tracking-user-activation . Activating events include `pointerup` (non-mouse) and `touchend`, so a normal `click` on a button qualifies.
- **`execCommand('copy')`:** deprecated, "not implemented consistently", returns `true` only "as part of a user interaction"; still present in browsers. https://developer.mozilla.org/en-US/docs/Web/API/Document/execCommand . On iOS it needs a selected, editable element, which tends to open the keyboard. **Not worth it** when `writeText` exists on every iOS since 13.1.
- **Prompts:** no permission prompt for writes in Safari, Firefox or Chrome (Chrome grants on activation). Reads are where prompts appear; Enquiry never reads.
- **Home-screen web app:** firt.dev lists the Clipboard API as available in iOS standalone apps: https://firt.dev/notes/pwa-ios/ . **UNVERIFIED** against current iOS; Apple publishes no standalone-specific clipboard rules.
- **Android Chrome:** same rule as desktop Chrome (activation or permission, no prompt for writes). Android 13+ "displays a standard visual confirmation when content is added to the clipboard" with a preview, and Android recommends "removing toasts or snackbars shown after an in-app copy for Android 13 and higher": https://developer.android.com/develop/ui/views/touch-and-input/copy-paste . Enquiry's copied line is a status line that also carries "Sent it?", not a toast, so it can stay; do not add a separate "Copied" toast. **UNVERIFIED:** that the system confirmation fires for a web page's `writeText` in Chrome (it is documented for apps).

### Recommended implementation (works without a device test, as far as the docs go)

```ts
function onCopyTap(text: string) {           // text already checked and in memory (doc 50 7.1)
  let promise: Promise<void>;
  try {
    promise = navigator.clipboard.writeText(text);   // first statement, no await before it
  } catch (err) {
    promise = Promise.reject(err);                    // API missing or threw synchronously
  }
  promise.then(
    () => markCopied(),                               // only now: copied_at, "Sent it?" state
    () => selectReplyAndShowHandCopy(),               // DOM Range selection, "Copy again" offered
  );
}
```

Rules:

1. Bind to `click` on a `<button>`, never to `change` / `input` / `focus`.
2. No `await`, `fetch`, state round-trip or `setTimeout` before `writeText`. Doc 50 already runs the pre-check before the tap, which is what makes this possible.
3. Use `writeText`, not `ClipboardItem`. Use `ClipboardItem` with a Promise resolving to a `Blob` (not a string) only if text ever has to be fetched inside the tap; Enquiry should never need that.
4. Treat success as the promise resolving. On rejection, select the reply text with a DOM Range (no input focus, so the keyboard stays shut), say "Couldn't reach your clipboard. The reply is selected - copy it by hand.", and show "Copy again": a second tap brings fresh activation and covers the WebKit first-tap regression.
5. No `execCommand('copy')` path.
6. Serve over HTTPS only (secure context); `localhost` counts in development.

### Is a real-device test still needed?

**Yes.** The pattern follows every documented rule, but three things are undocumented: the WebKit activation regression's reach into shipping iOS, iOS standalone (home-screen) behaviour, and the deep-link handoffs in Decision 3. One short session covers all of it (section 5).

---

## 5. Device test matrix (one session, before shipping 3 and 4)

| Device | Context | Checks |
| --- | --- | --- |
| iPhone, current iOS release | Safari tab | Copy first tap; Copy after 30s idle; `sms:&body=` and `sms:?body=` prefill with a 300-word body containing newlines, `$`, `&`, emoji; `wa.me` opens WhatsApp with text; `mailto:` with Gmail as default |
| iPhone, current iOS release | Home-screen app | Same as above, plus whether `wa.me` opens WhatsApp directly or an in-app browser page |
| iPhone, previous iOS major | Safari tab and home-screen app | Copy first tap; `sms:` separators |
| Android, Chrome, Google Messages default | Browser and installed PWA | Copy; `sms:?body=`; `wa.me` |
| Android, Samsung Internet or Samsung Messages default | Browser | `sms:?body=` |

Record pass / fail per cell in the spike notes; any fail on Copy first tap keeps "Copy again" prominent.

## Not verified (summary)

- Exact `sms:` body separator support per iOS version from 15 to the current release.
- Gmail and Outlook (iOS, Android) handling of mailto `subject` / `body`; per-client mailto length limits.
- WhatsApp `text` length limit; `whatsapp://send` support status; `wa.me` handoff from an iOS home-screen app.
- Which shipping Safari / iOS builds contain WebKit 316338@main without 321448@main.
- Clipboard and `sms:` behaviour in iOS standalone mode on current iOS.
- Gumtree messaging prefill (assumed none).
- Measured cost of a wrong name in a business reply; how often owners check a prefilled greeting.
- Confirm-step error rates measured in adults with ADHD.
- Inbound enquiry channel split for AU painters, cleaners and mobile beauty.
