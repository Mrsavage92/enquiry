# 50 - Laser-focus enquiry screen: design brief

Date: 2026-10-01. Status: REVISED after independent `/rate` and `/critique` (see "Review outcome" at the end). Build-ready subject to the founder's calls in section 13.
Scope: the single-enquiry screen (phone `PhoneDesk` + desktop `Workspace`, both rendering `Intelligence` inline) and the send step (`SendPreview`, used by the main reply and the waiting-desk follow-up), on branch `claude/app-pass11-2026-09-30` (PR #80, worktree `enquiry-app12`). Brief only: no product code.

Grounded in: `src/components/enquiry/intelligence.tsx`, `send-preview.tsx`, `coverage-check.tsx`, `asked-list.tsx`, `question-answer.tsx`, `answer-blocker.tsx`, `extra-decision.tsx`, `name-check.tsx`, `phone-desk.tsx`, `workspace.tsx`, `card-cues.ts`, `src/domain/labels.ts`, `src/domain/compose-reply.ts`, `src/domain/decide.ts`, `src/domain/next-action.ts`, `src/lib/repo/reviewed-send-core.ts`, `src/lib/repo/sent-reply-core.ts`, `src/domain/send-paths.test.ts`; `.impeccable.md`; `.21st/DESIGN.md`; research docs 15 (step budgets) and 39 (communication principles); the owner's screenshot of Tom Nguyen (desktop, 2026-10-01).

## 0. The problem in one paragraph

The owner's users have ADHD. Today a ready quote on a phone takes 4 taps at the very least and 7 on the normal path, and the owner measured 5 to 10. Along the way the screen states the verdict three times: the "Yes - reply ready" chip, the "Yes - reply ready, one date can't be done" eyebrow, and the "Send the quote" heading. It shows a six-row table in which every row is already settled. On desktop the reply sits in a 7-row textarea that scrolls on its own, behind "Read & edit reply" / "Finish editing". On the phone the reply text is not shown at all until "Read & edit reply" opens a bottom sheet (intelligence.tsx:919-954, 1605-1626). "Use this name" sits on a separate line. Then a second sheet ("Send this?") repeats the whole reply before Copy and "I've sent this externally". By hand count, the main column of the owner's screenshot carries about 96 app words (not counting the reply or the customer's own words); acceptance check 2 replaces this with a scripted baseline. The founder's instruction: as few clicks as literally possible from enquiry in to send, no wall of text, no scrolls inside scrolls, laser focus.

### Two premises corrected before designing

1. **The screenshot cannot show whether "the reply names no price".** The textarea's scroll thumb sits at the bottom, so its first lines are cut off. `composeReply` (compose-reply.ts:810-816) writes the total for an EXACT price once coverage is confirmed, and that line would be above the visible part. So the screenshot shows a different, worse problem: **the owner cannot tell whether the reply they are about to send names the price.** The fix is the same either way. The whole reply lives in the one page scroller, never clipped. The send line in the action bar says whether the reply actually names the amount, as checked by the server (section 5).
2. **The 2-tap clean quote is not reachable without weakening a safety gate.** Every EXACT-priced quote carries a coverage check (`decide.ts:1261-1270`). The reply names no total until the owner says "That's everything" (`compose-reply.ts:766-796`). So a priced quote with nothing flagged still has one owner decision. This brief keeps that gate: **a priced quote is 3 taps (That's everything, Copy, Yes)**. Replies that carry no price are 2: asking for a detail, a closed day, or a kind no. Merging the coverage tap into Copy is written up as OD-1, so the founder can choose it knowingly.

## 1. Goals

- **G1. Taps = owner decisions + 2.** From opening the enquiry to a recorded send, the only taps are one per real decision (a question, a check, coverage), then Copy, then Yes. No tap is spent opening, closing, expanding or reviewing.
- **G2. One scroller.** No inner scroll areas. The reply is never clipped and is edited where it sits.
- **G3. The verdict is said once**, and nothing on screen claims something about the reply that the reply does not say.
- **G4. Every safety invariant in section 8 holds unchanged.** The server send gate and the CC1 reviewed-send architecture come first.
- **G5. Quiet screen.** At most 60 app words above the fold in any state, and at most 50 in a ready state (the founder's bar is 60; 50 is this brief's own tighter target). Measured at 390x844 and at 390x664 (Safari's visible height with its toolbars), and at 1440x900 on desktop. Server-authored text (refusal messages, warning lists, stale messages) is shown word for word and is exempt from the cap; it is marked `data-count="server"` and checked separately (acceptance check 2). Customer data (name, recipient address or number, their message, the owner's own note) and the reply text are also not app words. The reply is deliberately uncapped: it is the one block the owner must read, and its focus aids are the amount and changed-sentence highlights in the read view (6.3).
- **G6. At most one filled (primary) button on screen**, and the next tap is always the obvious one.

## 2. Non-goals

- **No new visual language.** UI1 is locked: lavender shell, violet `mark` #6848d6, Inter, white working surfaces, light mode only. No new palette, typeface, dark mode, gradients or glass.
- **Enquiry never sends.** No auto-send, no "send from Enquiry", no channel integration in this build. Channel deep links are OD-3.
- **No change to what the decision engine decides or what `composeReply` writes**, except the small server changes S1-S3 in section 10.
- **No redesign of the Today list, Enquiries list, Business/pricing screen or waiting desk** beyond the touch points named here.
- **No new keyboard shortcut for Copy or Yes.** A stray keystroke must never attest a send. The existing demo-only Ctrl+Enter (`resolveSendKey`, workspace.tsx:70-85) stays as it is.

## 3. The screen, top to bottom

Six parts, in this order, at every breakpoint. Anything with nothing to say renders nothing. The visual order and the DOM/focus order are the same.

| # | Part | What it holds | Rule |
| --- | --- | --- | --- |
| 1 | **A. Summary** | Who, what, when, verdict | **Sticky at the top** (doc 39:21 requires the decision state visible without scrolling at 375px and wider), at most 96px tall on phone (name 20px + line 2 16px + verdict up to 2 x 20px + 20px padding). At 200% text only the verdict line stays sticky; name and line 2 scroll with the page. Line 1: name. Line 2: service · lead date (`leadDateCue`), cut with an ellipsis when it runs past one line. Other dates (`otherDateCues`) are in the settled expansion, not in line 2. Line 3: the verdict (section 5), 16px / 600 in its tone colour. |
| 2 | **M. Their message** | The latest message from the customer, and the owner's own note if there is one | Two-line excerpt. An existing private note shows as one line under it, "Your note: ...", opening in place (today it is inline at intelligence.tsx:527-534). A tap opens it in place. "Earlier messages (N)" opens the thread in place. **Open by default on desktop, and open by default on phone while the coverage question is open** (the owner cannot honestly answer "Anything else they asked for?" from two lines), capped at 8 lines with "Show all" in place so the question's first button stays on screen (check 7). |
| 3 | **B. Needs you** | The single unsettled thing, as one question with its buttons. Or, once nothing is unsettled, the settled line (6.5). | One item at a time. The step counter is the existing `checkStep` copy: "Check 2 of 4", or "Check 4 - 3 more came up" when checks appear later. |
| 4 | **R. The reply** | The reply, whole, edited where it sits (6.3) | Never given a height limit. Never inside another scroller. |
| 5 | **D. Notices** | In page flow directly under the reply: a "Why this reply" link (opens `rec.reason` and the evidence in place; for HIGH / PROHIBITED_AUTO risk the reason is shown in full in the review panel), then any refusal, warning, risk, drift or kept-edit notice. | Only what bears on the next tap. |
| 6 | **E. Action bar** | **The send line** (recipient · channel · amount, at most 2 lines) and the action for this state (section 7.2) | Phone: sticky at the bottom, at most 160px tall not counting the safe-area inset, hidden while the keyboard is open. Desktop: at the end of the main column, sticky to the column's bottom edge. **Hidden on phone and desktop while a decision is open.** This is wider than today's `quietFooter` (intelligence.tsx:396-411), which keeps the footer for situations, stale edits and `no_price` extras; here those hide it too. The decision's own buttons are the action. Because the send line lives in the sticky bar, recipient, channel and amount are on screen whenever Copy is enabled (invariant 11, acceptance check 17). |

Everything else lives in the overflow menu, the existing phone sheet "This job" and a new `...` button in the desktop header. The menu holds: **Why this reply** (evidence, confidence, non-blocking safeguards), **Hear it**, **Customer details and evidence**, **Note**, **Later**, **Decline**, and for practice enquiries **Delete it**.

On desktop the right-hand aside (Why this reply / details / customer details, workspace.tsx:236 onward) renders today above 1100px and is already hidden at 1100px and below (ui1.css:1620-1625). After this change it is **hidden by default above 1100px too**; it keeps its own scroller (`.enquiry-context`) when opened. The header icon that opens the details dialog today (workspace.tsx:217-224) toggles the aside instead, and the dialog's content merges into the aside.

### 3.1 Phone, ready state (390x844)

```text
+--------------------------------------+
| <  Tom Nguyen                    ... |  A  sticky, up to 96px
|    Interior painting . week of 9 N...|
|    Yes - reply ready                 |  verdict, once
|--------------------------------------|
| "Hi, looking for a quote to paint 3  |  M  2 lines, tap opens
|  rooms, feature wall, ceilings..." v |
|                                      |
|  6 settled . back on ceilings .      |  B  settled line (6.5)
|  not Sat 14 Nov                    v |
|                                      |
|  Greeting: Tom (from sign-off) . Undo|  name row (6.4)
|  Your reply (tap to edit)            |  R  label stays visible
|  Hi Tom,                             |
|  Thanks for getting in touch about   |
|  interior painting. ...              |
|  ...                                 |
|  Why this reply                      |  D  under the reply
|--------------------------------------|
|  To 0412 555 019 (from their         |  E  sticky bar: send line
|  message) . SMS . $2,040             |
|  [          Copy reply           ]   |      + the one action
+--------------------------------------+
```

App words above the fold, by the check 2 tokenizer (split on whitespace, drop punctuation-only tokens, exclude customer data, server text and the reply): line 2 for Tom's real cue, "Interior painting · Asked for \"the week of 9 Nov\"" = 9, verdict = 3, settled line = 9, name row = 5, reply label = 5, "Why this reply" = 3, send line = 6 ("To", "from their message", "SMS", "$2,040"; the number is customer data), button = 2. Total 42. With the idle hint for a new account (7 words) it is 49, inside the 50 ready target. Showing `rec.reason` inline instead (typically 10 to 25 words) would break the target; that trade is OD-4. Bar height: send line 2 x 18px + 8px gap + 56px button + 24px padding = 124px, plus the safe-area inset.

### 3.2 Phone, one decision open (coverage)

```text
| <  Tom Nguyen                    ... |
|    Interior painting . week of 9 N...|
|    Not yet - check what the price    |
|    covers                            |
|--------------------------------------|
| "Hi, looking for a quote to paint 3  |  M  open in full while
|  rooms, a feature wall in the lounge |     coverage is asked
|  and the ceilings. Are you insured?  |
|  Week of 9 Nov ideally. Tom"         |
| +----------------------------------+ |
| | Interior painting x 3    $2,040  | |  B  lavender card
| | Anything else they asked for?    | |
| | [That's everything]              | |  primary (filled)
| | [They asked for more]            | |  secondary
| +----------------------------------+ |
|  Your reply - tap to edit            |  R  reply, no price yet
|  Hi Tom, ...                         |
+--------------------------------------+   no action bar
```

### 3.3 After Copy

```text
|  Copied. Nothing is sent or      Copy |  E  status line, with
|  recorded yet. Sent it?         again |     "Copy again" as a 44px link
|  [ Yes, I sent it ] [ Not yet ]       |  both unfilled until you come
|                                       |  back (7.2), then Yes is filled
```

In the Copied state the status line takes the send line's place (the copy has already happened, so invariant 11 is met). Height: 2 x 18px + 8px + 56px + 24px = 124px plus inset.

### 3.4 Desktop, 1440x900

The left nav is unchanged (208px). The main column is centred, max 720px, with the same six parts in the same order. Their message opens by default. The notices sit under the reply, and the action bar (send line + action) sits at the end of the column, sticky to its bottom edge. The aside is hidden by default (see above). Nothing on desktop repeats something in the main column. Word budget: 60 / 50, as on phone.

## 4. Tap budget

Taps are counted on the phone, from the enquiry screen being open to the send being recorded. Typing, scrolling and waiting are not taps. "Before" is traced through the code on PR #80:

- **min** is the owner who never opens the reply editor but does copy the text. Today "I've sent this externally" is not gated on Copy (send-preview.tsx:188-191), so a strict minimum is one lower. Copy is counted because the owner needs the text to send it.
- **typical** adds reading the reply (the phone shows no reply text until "Read & edit reply" opens the sheet, so "Read & edit reply" + "Done") and "Use this name" when a name was read.
- **"After"** assumes the name is applied automatically (6.4).

Each row names the fixture the acceptance script uses. Where no fixture exists yet, the row says "new fixture" and the build adds it.

| Enquiry type (fixture) | Before: min / typical | After | Owner decisions after |
| --- | --- | --- | --- |
| **Clean quote**: priced, nothing flagged (new fixture) | 4 / 7: That's everything, [Read & edit, Done, Use this name], Review reply, Copy the message, I've sent this externally | **3**: That's everything, Copy reply, Yes | 1 (coverage) |
| **Several items**, like Tom: "Are you insured?", feature wall, ceilings, then coverage (new fixture, 4 open items assumed) | 7 / 10 | **6** | 4 |
| **One question, then priced**: "Do you do ceilings?" | 5 / 8 | **4**: answer, That's everything, Copy, Yes | 2 |
| **One question, no price follows**: an availability ask | 4 / 7 | **3**: answer, Copy, Yes | 1 |
| **Closed day, nothing bookable**: the reply asks to move the date and names no price | 3 / 6 | **2**: Copy, Yes | 0 |
| **Closed day with other open flags**: `ESCALATE_HUMAN`, coverage lines empty | 1 per flag + 3 / + 6 | 1 per flag + 2 | the flags |
| **Decline as a reply**: kind no, action `DECLINE` (catalogue risk HIGH) | 3 / 6 | **3**: Copy (opens the review panel), Copy, Yes | 0 |
| **Decline without replying**: closes the enquiry | 3: More, Decline, Decline this enquiry | **3** | unchanged on purpose: a destructive close keeps its confirm |
| **Needs detail, ask the customer**: `REQUEST_INFORMATION` | 3 / 6 | **2** | 0 |
| **Needs detail they already gave**: confirm the reading | 5 / 8 | **4**: Yes 3 bedrooms, That's everything, Copy, Yes | 2 |
| **Needs prices** | P + 5: Add your prices (leaves the screen; saving returns by itself through the existing `back` param, next-action.ts:58-67), the pricing screen's own P taps, That's everything, Review, Copy, I've sent | **P + 4**: Add your prices, P, That's everything, Copy, Yes | 2 + the pricing screen |
| **Practice, priced** | 2, then a dead end: That's everything, Review reply. The server refuses `practice`, and nothing further is possible. | **3**: That's everything, Copy, Yes (simulated, records nothing) | 1 |
| **Practice, needs prices** | 3, then a dead end | **4**: Use a sample price, That's everything, Copy, Yes (simulated) | 2 |
| Modifier: **edit warnings** | +1 (Send anyway) | **+0**. The warnings show before the tap, and the button reads "Copy anyway" (7.3). | |
| Modifier: **send refused** | +1 to +3 (sheet, fix, reopen) | **+1** (the fix; Copy comes back by itself) | |
| Modifier: **just edited** | n/a | **+0**, a short wait while the check covers the new text (7.1) | |
| Modifier: **risk HIGH or PROHIBITED_AUTO** (7.1 risk rule) | +0 (every send already had the sheet) | **+1**: the first Copy tap opens the review panel (doc 39 keeps a full preview for these) | |
| Modifier: **availability, one day of several** | n/a | **+1**: "Only some days" opens, then the day | |
| Modifier: **OD-2 decided as "Greet as Tom?"** | n/a | **+1** when a name was read | |

**The rule behind every row: after = owner decisions + 2** (+1 for a high-risk send). Two exceptions:

- **Decline without replying** stays at 3, because a destructive close keeps its confirm.
- **Needs prices** runs through the pricing screen, which is out of scope. Its own taps (P) are the same in both builds; check 1 measures P on the fixture's pricing flow and asserts before = P + 5, after = P + 4.

## 5. The verdict: once, and true

Today three sources speak at once: `statusChip` (header chip), `promiseVerdict(...).line` (eyebrow), and `rec.label` / `nextStepLabel` (heading), plus a "Priced:" line. After this change, **slot A shows one verdict, `promiseVerdict(enquiry).line`**. Its existing words are kept for every branch (labels.ts:150-207), with one change, to the ACTION_READY row:

| promiseVerdict branch | Slot A says |
| --- | --- |
| BOOKED | Yes - booked |
| DECLINED / LOST / CANCELLED | No - closed |
| DECLINE or eligibility FAIL | No - outside what you offer |
| EVALUATING | Not yet - still reading it |
| WAITING_ON_CLIENT, quoted | Yes - your quote is with them |
| WAITING_ON_CLIENT, other | Not yet - waiting on their answer |
| questionPending | Not yet - {questionStep reason}; a quoted customer phrase is cut at 24 characters with an ellipsis |
| extraPending | Not yet - they also asked for {label} (label cut at 24 characters) |
| coverage to check | Not yet - check what the price covers |
| blocking reading | Not yet - check one detail they gave |
| owner estimate | Not yet - your estimate decides it |
| closed day, not bookable | Not yet - that day is a closed day |
| NEEDS_INFORMATION | Not yet - one detail decides it |
| pricing step | Not yet - your prices decide it |
| say which service | Not yet - say which service |
| **ACTION_READY (changed)** | **Yes - reply ready**, the same words as `STATUS.replyReady`, so the chip and the card still say the same thing. The ", N dates can't be done" and ", one date to check" tails move to the settled line (6.5), where the owner can see and change them. |
| BOOKING_PENDING | Yes - confirm the booking |
| fallback | Not yet - your call |

**Amounts are never claimed in slot A.** The amount sits in the send line (in the action bar) only, and only as the server read it from the reply. The pre-check result gains `namesAmount` (S2). If a SEND_QUOTE reply names no amount (for example, the owner edited it out), the send line says "No price in this reply" in warn tone, and Copy stays available. Until the check returns, the send line shows the amount slot as "checking".

The list-row chip (`derivedLabel`) keeps its short `StatusWord`, with one addition: an ACTION_READY `DECLINE` gets the new word "No - reply ready" (added to `STATUS`; `status-vocabulary.test.ts` updated). Where that word implies a promise, it must agree with slot A. The mapping the unit test asserts:

| StatusWord (labels.ts:110-133) | Must agree with slot A word |
| --- | --- |
| Yes - reply ready, Booked, Booking to confirm | Yes |
| No - reply ready (new StatusWord for an ACTION_READY `DECLINE`; today `derivedLabel` says "Yes - reply ready" there while slot A says "No - outside what you offer") | No |
| Not yet, Reading, Needs your prices, Your call, Open | Not yet |
| Declined, Lost, Cancelled | No |
| Waiting, Follow up, Gone quiet, Later, Public comment | no promise word; exempt |

**Cap:** the whole verdict fits in two lines at 390px at 16px / 600 (measured, about 34 characters a line, so 68 characters in all). A quoted customer phrase or label inside it is cut with an ellipsis to fit. A unit test renders every branch over every fixture and fails on a third line.

## 6. Anatomy per state

This table covers every state that exists in the code today and where it goes. "Q" means it becomes the one question in slot B, with its first filled button as the action, and no action bar on phone.

| State (code source) | Where | Action | Notes |
| --- | --- | --- | --- |
| **Evaluating** (`situation.kind === "evaluating"`) | A: verdict; M | none | No reply, no bar. One line: "This takes a few seconds." |
| **Needs prices** (`setupStep` add_prices / add_price) | Q: "Add a price for {service} and this reply fills in." | "Add your prices" (link; saving returns here through `back`) | Practice adds a secondary "Use a sample price for practice". |
| **Say which service** (choose_service, `ServiceReadAs`) | Q | the service choice | Uses the existing bare `ServiceReadAs`. |
| **Needs detail, ask them** (blocking missing, not inferred) | R and D; B shows only "Already know it? Enter it" as a closed disclosure | Copy reply | The existing `AnswerBlocker folded`. The pre-check runs here (the action is sendable and nothing is on hold). |
| **Needs detail they gave** (`missing.inferred`) | Q: From their message: "3 bedrooms". Correct? | "Yes, 3 bedrooms" | Secondary: Edit. |
| **Owner estimate** (`isOwnerEstimate`) | Q with the input | Confirm | |
| **Check this** (`situation.kind === "check_this"`) | Q | first choice | |
| **Question** (`questionPending`: service / availability / ask) | Q, using the existing `QuestionAnswer` bodies | the one filled answer (none for availability) | **Availability changes:** the choices stay unfilled, as today, because a filled "Yes" would nudge the owner into promising a day. Today the card shows 3 buttons plus one "Only {day}" per open day (question-answer.tsx:167-210), so three open days give 6. The "Only {day}" choices fold under one "Only some days" disclosure, leaving at most 4 visible. Ask with a saved answer: "Use this answer" is filled. |
| **Extra** (`extraPending`) | Q, using the existing `ExtraDecision` | "Add your $60 oven clean" when priced | For a `no_price` extra the Extra card wins over the Needs-prices row: its answers (Leave it out and tell them / Tell them I'll come back on it / They didn't ask) are unfilled, and "Add a price for {extra}" is a text link in the card. |
| **Rule checks** (coverage flag `kind: "rule"`) | Q, one at a time, before coverage | first rule choice | The existing `RuleChoices`. |
| **Coverage flags** (`toSettle`) | Q, one at a time | the first `FlagChoices` button | |
| **Asked items to settle** (`openAskedItems`) | Q, one at a time | first choice | |
| **Coverage check** (`coverage && !confirmed`, no flags open) | Q: price lines, total, "Anything else they asked for?" | That's everything | Secondary: "They asked for more", which opens in place inside the card. The included-line "Change" and the rough-size "It's exactly X" stay inside the card as text links. |
| **Closed day with open flags** (`ESCALATE_HUMAN`, `coverage.lines: []`, decide.ts:1375-1391) | Q, one flag at a time; no price lines shown | first flag choice | The verdict comes from `promiseVerdict`. |
| **All settled** | B: the settled line (6.5) | Copy reply | |
| **Conflict** (`situation.kind === "conflict"`) | Q: the situation title + `conflictChoices` | first choice | The reply is on hold (compose names no price). |
| **Duplicate / public comment** (`situation`) | Q with the existing choices | first choice | |
| **Calendar down** (`calendar_down`) | D: warn notice | Copy reply if sendable | Secondary: Reconnect {provider}. |
| **Closed day, rest bookable** | settled line names it ("can't do Sat 14 Nov") | Copy reply | Changing it ("I can do that day") is in the settled expansion. |
| **Ready** | B settled line; R; D | Copy reply | |
| **Copied, not answered** | E: status line | Yes, I sent it / Not yet (7.2) | Link: Copy again. |
| **Copied an earlier version** (copied text differs from the reply now) | E: "You copied an earlier version at 2:14 pm. Sent it?" | Yes, that version / No | "Yes" confirms the copied artefact. If the decision moved, the server answers `stale` and the bar offers "I already sent that older message" (`staleAttestation`). |
| **Stale edit / keep my edit** (`showStaleEdit`) | Q: "Details changed since your edit" + the change list. R shows one version at a time, chosen by a two-option toggle (New reply / Your edit), each shown whole. | Use new reply | Secondary: Keep my edit. The reply is read-only until chosen (the existing `editLocked`). This replaces today's two `max-h-40 overflow-y-auto` boxes. |
| **Kept edit notice** (`coverageOutcome.editKept`) | D | Copy reply | "Your words kept. Changed: {figures}. Not in your edit: {lines}." |
| **Recheck** (`coverageOutcome.recheck`) | D: "Something changed - take another look." | per state | |
| **Price drift / sheet drift** (`detectPriceDrift`, `detectSheetLetterMismatch`) | D | "Use the sheet" when offered, else Copy reply | |
| **Risk and safeguards** (risk HIGH or PROHIBITED_AUTO by the 7.1 risk rule; `failedGates`, intelligence.tsx:751-790) | D, worded as today ("This requires your personal review", "Pricing could not be verified"). **Every gate the inline card shows today** (all except "Action class ... is set to") stays in D; nothing moves to the overflow. | Copy reply, then the review step | Doc 39 discusses the inline variant only "for low-risk sends" (39:35). So for risk HIGH or PROHIBITED_AUTO, the first Copy tap does not copy. It opens a review panel in place, inside the bar: channel, recipient with address, amount, `rec.reason`, and the risk line, then "Copy reply" again. That costs +1 tap for high-risk sends only. |
| **Send refused** (pre-check, 7.4) | D: danger callout with the server's message; the bar repeats it in one line ("Can't copy: {first sentence}") with "Details" scrolling to D | the fix ("Use the prepared total") | Secondary: Add a line (opens in place). Copy is not offered until the check passes. |
| **Check failed** (prepare threw or timed out; today a toast, intelligence.tsx:338-339) | D: "Couldn't check this reply." | Try again | Copy stays off. No spinner left running. |
| **Already recorded** (prepare returns `alreadyConfirmed`, reviewed-send-core.ts:654) | D: "This exact reply is already recorded as sent. To send the same words again, change one word." | none | "Copy again" link only; Yes is not offered, because the unique (enquiry, text) row can be recorded once. |
| **No recipient on file** (`preview.recipient` and `recipientRead` empty) | send line: "No recipient on file - reach them yourself" (warn) | Copy reply | |
| **Estimate range** (SEND_ESTIMATE, RANGE price) | send line shows "$1,800-$2,200" | Copy reply | `namesAmount` is true only when the body names both ends. |
| **Long email address** | send line: middle ellipsis, full address in the accessible name; a tap opens Customer details | | |
| **Booking pending** (BOOKING_PENDING) | Q: the existing booking confirm control | its confirm | Verdict "Yes - confirm the booking". |
| **Practice, after Yes** | E: "Practice - nothing recorded." | Back to Today | Secondary: Delete it. |
| **Confirm refused after sending** (7.5a) | D: what the server said | per 7.5a | The owner has already sent it in the real world; every row offers a way to keep that on record. |
| **Edit warnings** (`warnings[]`) | D: "Check this before you send" + list | **Copy anyway** (7.3) | |
| **Blocked channel** (`outboundBlocked`: offline, paused, or channel not connected) | D: the existing `channelBlocked` message for that cause, word for word | Connect {provider} when the cause is "not connected" | Copy is off in all three. Offline: the check needs the server (string table: offline). Paused or not connected: the owner's own setting says this channel is not in use, so the bar does not offer to copy for it. The text stays selectable. |
| **Service unconfirmed** (`awaitingService`) | Q | the confirm control | |
| **Blocked reason** (`rec.blockedReason`) | D danger | none | |
| **Your call** (nothing Enquiry can prepare) | B: "This one is your call. Reply to them yourself, or use Later in the menu." | none | |
| **Follow-up due** (`followUpDue`) | D: the reason; **R shows the follow-up draft whole and editable**, exactly as for a first reply; "What you sent" is a one-line link above it that opens in place | Copy follow-up, using the same pre-check and Copy / Sent it? flow | Today the follow-up text is shown only inside `SendPreview`; it is never copyable unseen. |
| **Waiting** (`awaitingInformation`, `awaitingOutcome`), no follow-up ready | A verdict; R: what you sent, read-only, first 3 lines, "Show all" opens in place | none | `WaitingDesk` actions are unchanged; `LastingUndo` stays. |
| **Recorded, more to do** | E: "Recorded as sent by you." + Undo link | Next: {name} | No auto-advance. The screen stays in this state until the owner taps Next or leaves; on the next visit it is Waiting, with `LastingUndo` as the only Undo. Never both at once. |
| **Recorded, nothing left** | E: "All done for now." + Undo link | Back to Today | |
| **Decision updated** (`lastChange`, `ReturnContext` changes) | top of B: one line "Updated: 3 rooms -> 4 rooms", gone after the next tap | per state | |
| **Name read, unconfirmed** (`NameCheck`) | its own row above the reply (6.4) | per state | |
| **Voice notice** (`voiceNotice`) | after a recorded send, under the Recorded line | none | "Keep 'Hey' for next time? Yes / Just this once." Never shown mid-flow. |
| **Practice** (`enquiry.practice`) | A: "Practice" badge; one line: "Nothing is sent or counted." | per state | Client-only send path (7.1): no pre-check, Copy works, Yes says "Practice - nothing recorded" and calls nothing. The server keeps refusing `practice` if anything ever asks. |
| **Demo mode** | labelled "(demo)" as today | per state | Client-only send path, as practice; Yes uses today's demo `approve()` simulation. Demo Ctrl+Enter is unchanged. |

### 6.1 What moves where

| Today | After |
| --- | --- |
| Header chip + eyebrow verdict + `rec.label` heading + "Priced:" | One verdict, slot A. The amount moves to the send line in the action bar. |
| "Everything they asked" table at full height, all settled | The settled line (6.5), which expands in place |
| `DateNotes` under the heading | Inside the settled expansion |
| Reply in a 7-row textarea behind "Read & edit reply" / "Finish editing" (desktop), or a bottom sheet with "Done" (phone) | The reply in the page, edited where it sits |
| "Use this name" row | Name applied, with its own row and Undo (6.4) |
| "Review reply", then the "Send this?" sheet | For LOW / MEDIUM risk: the sticky send line (recipient with the "from their message" caveat, channel, amount) + "Why this reply" under the reply (OD-4) + the reply itself. For HIGH / PROHIBITED_AUTO: an in-place review panel in the bar (6, risk row). |
| "Copy the message", then "I've sent this externally" | "Copy reply", then "Sent it? Yes / Not yet" |
| "Send anyway" | "Copy anyway", enabled once the warnings have been on screen |
| Why? / Hear it / confidence badge, inline | Overflow menu (Why this reply holds confidence and evidence) |
| Inline `failedGates` list | Stays in D, as today. Only the evidence and confidence move to Why this reply. |
| A success toast after each answer | The changed sentence in the reply is highlighted for 2s (a static tint under reduced motion), only when it is on screen, plus a polite live-region line |
| Recorded-send toast with Undo | The bar's Undo link + `LastingUndo`. No toast, so Undo is not offered twice. |
| "You send from your own inbox, then record it here." | The idle hint (7.2), shown only for the owner's first 3 recorded sends |

### 6.2 Removed outright

- The `SendPreview` dialog/sheet. Both callers move to the new inline component together (the main reply and the waiting-desk follow-up), so the two paths still cannot drift. See section 8 for the C10 test.
- The phone reply `Dialog` / `SheetContent` with its `max-h-[40dvh]` textarea.
- The "Read & edit reply" / "Finish editing" / "Continue your reply" button.
- The separate `NameCheck` row's button.
- The eyebrow line and the `rec.label` heading in inline mode.
- The duplicate status chip in the desktop header.
- The preview's "Back" button.
- The stale-edit `max-h-40 overflow-y-auto` boxes.
- The "serif for long channels" distinction, which is a no-op: `--font-serif` is Inter (styles.css:9).

### 6.3 The reply, edited where it sits

- **Two layers in the same box.**
  - The **textarea is the one real control**, always in the DOM, labelled "Your reply to {first name}". It auto-grows with `field-sizing: content` where supported, or by measuring `scrollHeight` otherwise. Keyboard and screen-reader users reach it by Tab like any field; there is no separate edit mode for them.
  - A **read view** (rendered paragraphs, `aria-hidden`) is laid over it while it is not focused. It carries the 2s change highlight, a persistent highlight on the amount, and the name marker, which a plain textarea cannot draw. The two layers share font, size, line-height and padding, and caret placement from a tap is mapped from the read view's text offset; both are proven in the R1 spike. A tap on the read view focuses the textarea under it, with the caret at the tapped point. Focus hides the read view; blur shows it again. Escape blurs.
  - No button opens the editor. Scrolling over the reply never focuses it.
- **Visible affordance.**
  - The label "Your reply - tap to edit" stays visible, in stone #68656d (5.72:1 on white).
  - The box edge is `--color-line-control` #8a8491: 3.63:1 on white and 3.21:1 on lavender, which passes the 3:1 non-text rule (1.4.11). It replaces `line-strong` (1.68:1).
  - The focus ring is `mark` #6848d6 (6.02:1).
- **Undoing edits.** After an edit, a line under the reply reads "Edited. Back to the prepared reply". The link restores `decision.draft.body`. Autosave stays (`useDraftSaver`, `DraftSaveNote`).
- **Keyboard on phone.** While the keyboard is open, the action bar hides. Copy is never tapped mid-edit: once editing stops, the check runs (7.1) and the bar returns.

### 6.4 The customer's name

`NameCheck` exists because "a suburb or a job title read as a name would otherwise have gone straight into the greeting" (name-check.tsx:7-10). That risk was real while the reply was hidden. With the reply in full view, the owner reads "Hi Parramatta," right above Copy. Following the founder's direction:

- The server composes the greeting with the read name (S3). The engine already refuses titles and suburbs as names (attention-pass4.db.test.ts:447, "titles and suburbs are never names"); that filter stays.
- A row of its own sits directly above the reply: "Greeting: Tom (from sign-off) · Undo". The row is separate from the greeting text, so a tap meant for editing cannot hit Undo.
- Undo is a fact write, not a text edit: it marks the name reading as rejected (S3), the server recomposes with "Hi there,", and no owner-edit warning is raised.
- Recording the send confirms the name fact, because the owner attested a text that contains it. Nothing confirms it earlier. The confirmation happens inside the confirm transaction **before** `after_revision` is read, so the send's Undo (which compares revisions, undo-send-core.ts) still works. Undoing the recorded send does not un-confirm the name: the customer has seen it.
- If the founder prefers the old safety (OD-2), the row reads "Greet as Tom?" instead, one tap (+1 in section 4).

### 6.5 The settled line

When nothing is open, B is one line that names, after the count, every item whose reply wording commits the owner to something later or turns something down, so a promise is never folded away. The items are kept in ledger order:

- "Come back to them" items: "back on ceilings".
- Closed or not-available days: "not Sat 14 Nov".
- Left-out items: "no deck".
- Date-to-confirm items: "day to confirm".

Example: "6 settled · back on ceilings · not Sat 14 Nov". Expanded, each of these reads in full ("You'll come back to them on ceilings"). It is cut at two lines with "+N more". A tap expands, in place, the existing `AskedList` rows (with their change choices), `DateNotes`, and the full `otherDateCues` ("Trial Sat 24 Oct").

## 7. The Copy -> Sent it? flow

### 7.1 Check before the tap, using the existing prepare

Today `openReview` calls `prepareReview` (`prepareReviewedSendInTransaction`) when "Review reply" is tapped. That call already upserts **one `reviewed_send` row per exact text** (`on conflict (enquiry_id, body_hash)`, reviewed-send-core.ts:585-619). It re-binds an unrecorded row to the current decision revision and leaves recorded rows untouched. So it can run before the tap, with no new server path.

**When the pre-check runs, and when it does not.** It runs only when the state is not any "Q" row of section 6 and not a blocked row. Concretely, all of: `isSendableAction(rec.action)`; `!replyOnHold` (no question, coverage, reading, estimate or setup step open); `!awaitingService`; `!showStaleEdit`; no `situation` other than `calendar_down`; `rec.primaryEnabled`; no `rec.blockedReason`; no `outboundBlocked`; not practice; demo off. In the excluded states the server would only refuse (`not_sendable` for `ESCALATE_HUMAN` decisions such as coverage, decide.ts:1286-1290; `unconfirmed_reading` for a reading still to confirm, which is a `REQUEST_INFORMATION` action; `service_unconfirmed` while the service is unconfirmed), which would paint a red callout over a normal step. In those states the bar is hidden and nothing is checked. The predicate is one exported function with a unit test per section 6 row. **Practice and demo use a client-only send path**: no pre-check, Copy writes the text, and Yes calls nothing on the server (practice says "Practice - nothing recorded"; demo uses today's `approve()` simulation, intelligence.tsx:313-321, 353-357).

- **Pre-check.** `prepareReview` runs when the screen opens in an eligible state, on blur of the reply, after 1s without typing, and at once after any decision that rewrites the reply. At most one request is in flight per enquiry, and at most one starts every 2s; a newer text cancels the wait for an older one. It returns `reviewedSendId`, `warnings` or a refusal, and `namesAmount` (S2). The result is shown in D before the owner taps. Rows created are bounded by the distinct texts the owner paused on. Unrecorded rows are inert (cleanup is follow-up F2). Two side effects are accepted and recorded here: each call takes the enquiry row lock (`select ... for update`, decision-apply.ts:97-100) and re-sets `reviewed_by`, and a `reviewed_send` row no longer means "the owner opened a review", only "this text was checked". Prepare p95 on PR #80 is measured in the spike before the 400ms target is fixed.
- **Copy** is a synchronous `navigator.clipboard.writeText` inside the tap. It is enabled only when the latest pre-check covered exactly the text on screen (compared as strings, no hashing in the tap) at the current decision revision. While a check is running, the button keeps its label, is disabled with `aria-busy`, and a small spinner sits in the send line. A failed or timed-out check (5s) shows the Check failed state with Try again; Copy never waits on a spinner indefinitely.
- **Yes, I sent it** calls the existing confirm (`confirmReviewedSendInTransaction`) with the copied `reviewedSendId`, unchanged. That keeps the CC1 architecture: the record is the server-frozen artefact, pinned to its revision, with the `stale` path and record-once intact. **No client body is ever recorded.**
- **Risk rule.** The review-panel escalation uses the higher of the action catalogue's risk for `rec.action` (`action-catalogue.ts`: `DECLINE` is HIGH, `REQUEST_INFORMATION` LOW, quotes, estimates and follow-ups MEDIUM) and `decision.risk`. Live snapshots default `decision.risk` to MEDIUM (decision-snapshot.ts:46), so the catalogue is what makes the rule fire in production. Doc 39's amount threshold adds emphasis, not a gate: an amount of $2,000 or more is shown at 600 weight in the send line.

### 7.2 States of the action bar

Every string is in the string table (7.6).

| Bar state | Filled button | Other | Status line |
| --- | --- | --- | --- |
| Decision open (phone and desktop) | bar hidden | | |
| Idle, check passed | Copy reply | none | idle hint (first 3 sends only) |
| Idle, warnings | Copy anyway (enabled once every warning has been seen, 7.3) | "2 things to check" link that scrolls to them | none |
| Idle, high risk (HIGH / PROHIBITED_AUTO) | Copy reply (first tap opens the review panel in the bar) | none | the risk line, in D |
| Check failed | Try again | none | "Couldn't check this reply." |
| Checking | Copy reply, disabled, `aria-busy` | none | spinner in the send line |
| Refused | the fix, e.g. Use the prepared total | Add a line | the server's message, in D |
| Copied, owner has not left the page | **none filled**: Yes, I sent it and Not yet, equal weight | Copy again (link) | copied line |
| Copied, owner left and came back (`visibilitychange` hidden then visible, or window `blur` then `focus`, after the copy) | Yes, I sent it | Not yet; Copy again | copied line |
| Clipboard failed | none filled: Yes, I sent it and Not yet | | failed line. The bar stays visible: the read view (not the textarea) is made selectable and its text is selected with a DOM Range, so no field is focused and the phone keyboard does not open. Proven in the R1 spike on iOS. |
| Recording | Yes, I sent it, disabled, "Recording..." | | |
| Recorded | Next: {name}, or Back to Today | Undo (link) | recorded line |
| Stale on confirm | I already sent that older message | Not yet | the server's stale message |
| Confirm refused after sending: `warnings` changed (recomputed at confirm, sent-reply-core.ts:281-291) | Record it anyway (sends the new list as acknowledged) | Not yet | "Before recording: {new list}" |
| Confirm refused after sending, enquiry closed meanwhile (closing bumps the revision, so the server answers `stale`) | I already sent that older message | Not yet | "This enquiry was closed after you copied. If you sent it, record it as it was." The server records such a send on purpose, exactly as written, without reviving the enquiry (sent-reply-core.ts:236-273). |
| Confirm refused after sending: `missing` (the artefact was removed by an undo, undo-send-core.ts:119) | none: the client prepares the copied text again once and retries the confirm | | if the retry fails, the refusal it returns is shown with the matching row above |
| Network error while recording | Try again | Not yet | "Couldn't reach the server. Nothing recorded yet." The Copied state is kept. |

**Rules:**

- **Yes is never the filled button until the owner has plausibly been away to send.** It does not wait for that signal to become tappable, which covers sending from another device.
- **Yes is visibly disabled for the first 600ms after it appears, then enabled whether or not the owner has left.** This, plus the existing `recordingSend` guard, means a double tap on Copy can never attest a send, and a double tap on Yes records once.
- **The bar is at most 160px tall on phone, not counting the safe-area inset.** Copy again is an inline link, not a third button. The high-risk review panel and the post-send refusal rows are the only states allowed to grow past it; they push the page, not overlay the reply (section 9, 200% rule).

### 7.3 Warnings

The server's `warnings` (a discount, a booking promise, a day they don't work) appear in D as soon as the pre-check returns them, under "Check this before you send" with the list. There is no idle delay for warnings.

The filled button reads **Copy anyway**. It is enabled only once **every warning item has been seen since the list last changed**: each item counts as seen when at least half of it has intersected the visible area, or when it or the list has received keyboard or screen-reader focus. Counting per item means a list taller than the screen (6 warnings at 200% text) can still be acknowledged by scrolling through it once. The tap is the acknowledgement. On confirm, the client sends the acknowledged list (S1). The server already recomputes `ownerEditWarnings` at confirm (sent-reply-core.ts:281-290) and refuses when its list differs from the one acknowledged. Today it accepts a bare boolean.

### 7.4 Refusals

- **Any refusal from a pre-check that ran under the 7.1 scope** (`closed`, `not_sendable`, `service_unconfirmed`, `amount_mismatch`, `unconfirmed_reading`, `coverage_unconfirmed`, `amount_unreadable`) shows in D as a danger callout with the server's words. **Copy is not offered** while the text is refused (the owner can still select it by hand; the product does not help).
- **`amount_mismatch`** keeps the existing fixes: "Use the prepared total", "Add a line" with `lineChoices`, and the "Add a price" link. After a fix, the pre-check reruns and Copy returns by itself.
- **Practice and demo** never reach this list: they use the client-only send path (7.1), so `practice` cannot appear as a refusal on screen.

### 7.5 Leaving without answering "Sent it?"

- **On Copy**, the client marks the copied `reviewed_send` row with `copied_at` (S3), so it survives reload and other devices. Copy records no send.
- **On return to that enquiry**, the bar opens in the Copied state if the reply still matches: "You copied this at 2:14 pm. Sent it?" If the reply has changed, it shows the "Copied an earlier version" state (section 6). That is the whole reminder.
- **Today / Enquiries row:** a secondary line "Copied, not marked sent", in stone #68656d (5.72:1 on white). No badge count, no toast, no notification, no row colour.
- **"Not yet" clears it,** and the enquiry stays in Needs you, which is the real reminder. A recorded send clears it. It expires after 7 days.

### 7.6 String table (the only wording for these lines)

| Key | Text |
| --- | --- |
| idle hint | Copy, send it yourself, then tap Yes. |
| copied | Copied. Nothing is sent or recorded yet. Sent it? |
| copied on return | You copied this at {time}. Sent it? |
| copied earlier version | You copied an earlier version at {time}. Sent it? |
| failed | Couldn't reach your clipboard. The reply is selected - copy it by hand. Nothing is sent or recorded. |
| recorded | Recorded as sent by you. |
| all done | All done for now. |
| no price | No price in this reply. |
| offline | You're offline. Every reply is checked before you copy it, so Copy is off until you're back. |
| paused / not connected | the existing `channelBlocked` message, word for word |
| practice end | Practice - nothing recorded. |
| check failed | Couldn't check this reply. |
| already recorded | This exact reply is already recorded as sent. |
| network on record | Couldn't reach the server. Nothing recorded yet. |
| practice recorded | Practice - nothing recorded. |

New strings do not add the product's name (`.21st/DESIGN.md`:87 asks for no new instances while the name is under review).

## 8. Safety invariants that must not change

1. **Nothing is sent by Enquiry.** Nothing is recorded as sent except by the owner's own "Yes, I sent it", and Copy records no send. Wording never says "sent" before Yes (doc 39 principle 7).
2. **CC1 reviewed-send architecture.** The recorded message is the server-frozen `reviewed_send` artefact the owner copied, pinned to its decision revision. No path records a client-supplied body (reviewed-send.db.test.ts:12-23). Every refusal reason in `reviewed-send-core.ts` is enforced by the server; the client pre-check only reports what the server said.
3. **Coverage gate.** The reply names no total until "That's everything" is confirmed with the coverage key and decision revision. Confirmation is refused while any flag or asked item is open.
4. **Asked-ledger gate.** `holdingItems` still blocks confirmation and send.
5. **Warnings acknowledgement.** A confirm over warnings needs the acknowledged list to equal the server's list. It is set only by a "Copy anyway" (or, after sending, "Record it anyway") tap made after every item was seen (7.3).
6. **Stale decisions.** Confirming against an older revision needs the explicit "I already sent that older message" (`staleAttestation`).
7. **Stale edits are never dropped silently.** Nothing can type over either version until the owner chooses (`editLocked`).
8. **Undo stays everywhere it exists today**: recorded send (the bar link + `LastingUndo`), Later, edits ("Back to the prepared reply"). There is a new Undo for the applied name.
9. **Record once.** A double tap records one send.
10. **Practice records nothing.** Demo is labelled as a simulation.
11. **Doc 39 principle 3.** Whenever Copy is enabled, the sticky parts of the screen show the recipient (name in slot A plus address or number in the send line, with "from their message" when read), the channel and the amount; the exact text is the reply itself; any risk line sits directly under the reply, and `rec.reason` is one tap away there ("Why this reply") for LOW / MEDIUM risk (OD-4). For risk HIGH or PROHIBITED_AUTO, all of these are shown together in the bar's review panel before the copy happens (acceptance check 17).
12. **Truthful clipboard.** "Copied" appears only when the write resolved. A failure says so and selects the text.

**Tests that must stay green unchanged:** `reviewed-send.db.test.ts`, `composed-draft-send.db.test.ts`, `trust-pass10.db.test.ts`, `review71.db.test.ts`, `card-cues.test.ts`, `reply-presentation.test.ts`.

**Tests that change with S1 and S3, with their new assertions:**

- `trust-pass11.db.test.ts:575` sends `acknowledgedWarnings: true`. With S1 it sends the warning list; new assertions: the exact list records, a different list is refused with `warnings`, the boolean form is rejected.
- `attention-pass3.db.test.ts:213` asserts `/^Hi there,/` for a name read from the sign-off. With S3 it asserts `/^Hi Tom,/` with the name fact still unconfirmed; then that a rejected reading recomposes to `Hi there,`; then that recording the send confirms the fact.
- `attention-pass4.db.test.ts:447-476` ("a read name is not in the greeting until the owner confirms it; titles and suburbs are never names"). The first half changes the same way; the titles-and-suburbs half stays unchanged. New: a db test that Undo of a send carrying a read name still succeeds (name confirmed before `after_revision`).

**C10 replacement.** `src/domain/send-paths.test.ts` today requires `<SendPreview` on every file that calls `recordSent(` or `approve(`. The replacement keeps the scan and asserts that every such file renders the new inline send component (working name `SendStrip`), and that this component shows channel, recipient, amount and reason. A component test on every send path (first reply, follow-up) also asserts that **the exact string Copy writes is the text rendered in the reply in the same view**, so no path can copy a body the owner has not seen. The old assertion is removed in the same commit that removes `SendPreview`, never before.

## 9. Accessibility

- **Focus order** is the visual order: back, name heading, overflow, verdict, their message toggle, the question (heading, then buttons), settled toggle, reply label, reply, the notices in D, the bar.
- **After answering a question**, focus moves to the next question's heading, or to the reply label when none is left. It never moves to a button, so a second Enter cannot act by accident. A polite live region says what changed: "Saved. The reply now says you do ceilings."
- **Copy -> Sent flow for screen readers.**
  - On Copy, focus moves to the "Sent it?" group label (`tabindex=-1`), not to Yes, and the live region reads the copied line.
  - On Yes, it reads the recorded line.
  - On failure (assertive), it reads the failed line.
  - On return to the tab, nothing is announced; the state is already there.
- **Targets.** Every button is at least 44x44 CSS px (`min-h-11`); the filled bar button is 56px (`min-h-14`). Inline text links (Why, Undo, Copy again, Back to the prepared reply, Details) are 44px tall and at least 24px wide with 8px clear space around them (WCAG 2.5.8 is met with room to spare).
- **Focus not hidden (WCAG 2.4.11).** `scroll-padding-top` and `scroll-padding-bottom` on the page scroller equal the current heights of the sticky header and bar, so a focused question button or the reply caret is never covered by either.
- **200% text.** At 390px width with text at 200%, there is no horizontal scroll and buttons wrap their labels. If the bar would exceed 25% of the visible height, it stops being sticky and sits in the page after D; the header keeps only its verdict line sticky (section 3). Because recipient, channel and amount can then be off screen, **the first Copy tap in that layout opens the review panel**, exactly as for a high-risk send, so invariant 11 still holds at the moment of Copy (+1 tap at 200% text only).
- **Clipboard failure.** As in 7.2: the read view's text is selected with a DOM Range (no field is focused, so the phone keyboard does not open and the bar stays visible), the failed line shows and is announced, and Yes / Not yet are still offered because the owner may copy by hand. On desktop, where no keyboard is at stake, the same Range selection is used for one behaviour everywhere.
- **Contrast**, measured with the WCAG formula on existing tokens:

| Text on background | Ratio |
| --- | --- |
| ink #1c1b1f on white | 17.13:1 |
| ink #1c1b1f on lavender #f3efff | 15.17:1 |
| ink-2 #4f4b55 on white | 8.50:1 |
| ink-2 #4f4b55 on lavender | 7.53:1 |
| stone #68656d on white | 5.72:1 |
| stone #68656d on lavender | 5.07:1 |
| white on mark #6848d6 | 6.02:1 |
| warn #8b5e00 on warn-bg #fff2d8 | 5.12:1 |
| danger #b42318 on danger-bg #fff0ed | 5.93:1 |
| ok #24724f on ok-bg #e8f4ee | 5.18:1 |

  Verdict and send-line tones on white: ok #24724f 5.84:1, warn #8b5e00 5.68:1, danger #b42318 6.57:1, mark-strong #49378e 9.46:1. On the phone reply surface #f7f4fd (ui1.css:1800): ink 15.75:1, ink-2 7.82:1, stone 5.26:1.

  Non-text: the reply edge `line-control` #8a8491 is 3.63:1 on white, 3.21:1 on lavender and 3.34:1 on #f7f4fd. No text uses `line-strong` #cbc5d3 (1.68:1). Any new pairing is measured on its rendered background before it ships.

- **Reduced motion.** The reply highlight is a static tint until the next interaction, and bar changes are instant.

## 10. What engineering needs (the contract, not code)

- **S1 Warnings digest.** `confirmReviewedSendInTransaction` accepts `acknowledgedWarnings: string[]`, compares it with its recomputed list, and refuses `warnings` on any difference. The boolean form is removed.
- **S2 `namesAmount`.** The prepare result reports whether the frozen body names the decision's amount (server-side `moneyFigures` with `ownerTexts`; `reviewed-send-core.ts` imports `node:crypto` and cannot run in the client).
- **S3 Copied state and name.**
  - The copied state is a nullable `copied_at` column on `reviewed_send`, the row that already holds the frozen text and its id (not `reply_draft`, which has no row for an unedited reply). The client finds "copied, not recorded" as the newest row for the enquiry with `copied_at` set and `consumed_at` null. Not yet sets `copied_at` back to null; a record consumes the row; rows older than 7 days are ignored. One migration, named in the build.
  - The greeting is composed with the read name (marked as a reading), and the name fact is confirmed on record.
  - Name Undo writes the name reading as rejected through the existing `answerFact` path (a new reserved value), which recomposes the reply with "Hi there,". A test proves the reserved value never reaches `customer_name`, the greeting or any list row. It is a fact write, so it raises no owner-edit warning.
- **S4 `data-variant`.** The `Button` component emits `data-variant` so check 4 can count filled buttons.
- **Build approach.**
  - Build a new component with an explicit state list, rather than more branches inside the 1,976-line `intelligence.tsx`. Section 6 is its fixture-driven test matrix, and the old component stays until every row passes.
  - Component anchoring follows the harness rule (`mcp__21st__get_inspiration`), inside UI1 tokens only.
  - A 30-minute spike on a real iPhone proves first (R1): Safari's synchronous clipboard write; the keyboard and sticky-bar behaviour; Range selection of the read view on clipboard failure without opening the keyboard; caret mapping and identical metrics between the read view and the textarea; and prepare p95 on PR #80.

## 11. Acceptance checks (measurable)

1. **Tap counts.** Counts match section 4 exactly, on each row's fixture. A Playwright script counts clicks from screen open to the tap on Yes (practice and demo rows end there too, since they send no confirm request).
2. **App words above the fold.** At most 60 in every state and at most 50 in ready states, at 390x844, 390x664 and 1440x900. The tokenizer splits on whitespace and drops punctuation-only tokens. The script counts text nodes whose box starts above the fold line and excludes, by a selector list written against both builds, the reply text (PR #80: the draft textarea, `.inline-reply-body`, `.letter-body`), the customer's messages (the `Conversation` bubbles), the customer name heading, and server-authored text (`data-count="server"` in the new build; the refusal and warning callouts in PR #80). Server text is reported separately and is not capped. The baseline is the same script run on the PR #80 build before any change.
3. **No inner scroll areas.** The only allowed scrollers are `.phone-conversation-scroll` (phone), `.enquiry-conversation-scroll` (desktop main column) and `.enquiry-context` (the desktop aside, when opened), plus the app nav and queue outside the enquiry. No other element inside the enquiry screen has `overflow` auto/scroll with `scrollHeight > clientHeight + 1`. This is checked for replies of 40, 120 and 300 words.
4. **At most one filled button.** At most one visible `data-variant="primary"` button in every state of section 6. Zero is allowed in Evaluating, Your call, the availability question, a `no_price` extra, Already recorded, Copied-not-left and Clipboard failed.
5. **Verdict once.** The verdict appears once in the accessibility tree. The list-row chip agrees with slot A per the section 5 mapping table, and every `promiseVerdict` branch's reason part is at most 40 characters after cutting, over every fixture (unit tests).
6. **Amount truth.** In every ready SEND_QUOTE fixture, the send line shows the amount if and only if `namesAmount` is true, and otherwise shows "No price in this reply".
7. **On screen when it matters.** In ready states, the reply label starts above the action bar at 390x664. In every Q row, the question's first button is inside the viewport at 390x664 on first render, with their message open where the row says so.
8. **Contrast.** Every text node is at or above 4.5:1 (3:1 large) on its rendered background, measured by script, not by token name. The reply edge is at least 3:1.
9. **Targets.** Every button's box is at least 44x44; every inline text link is at least 44px tall and 24px wide with 8px clear space.
10. **200% text.** No horizontal scroll, the bar rule of section 9 holds, and the action is reachable.
11. **Clipboard denied.** In Playwright with clipboard permission denied: the text is selected, the failed line is shown and announced, and nothing is recorded until Yes.
12. **Leaving after Copy.** A reload shows the Copied state once. Not yet clears it. A changed reply shows the earlier-version state. No toast or badge appears anywhere else.
13. **Double taps and attestation.** A double tap on Copy never records, and a double tap on Yes records once. Yes is disabled for 600ms after it appears, then enabled; it is not filled until a hidden/blur and return event follows the copy.
14. **Warnings.** A confirm with an acknowledged list that differs from the server's list is refused (new db test). "Copy anyway" is disabled until every item has been seen or focused, and becomes enabled at 200% text with 6 warnings by scrolling once (component test).
15. **Server gate.** A confirm against a refused or stale artefact is refused even when the client skipped the pre-check. Every test named in section 8 passes, plus the C10 replacement.
16. **Bar height.** The phone bar is 160px or shorter, not counting the safe-area inset, in every state at 390x664 except the two allowed in 7.2.
17. **Send facts on screen.** With Tom's fixture and a 300-word reply at 390x664, at every moment Copy is enabled, the recipient, channel and amount are inside the viewport; at 200% text, the first Copy tap opens the review panel showing them and writes nothing to the clipboard; for a HIGH / PROHIBITED_AUTO fixture, the first Copy tap shows the review panel and writes nothing to the clipboard.
18. **Post-send refusals.** Each "Confirm refused after sending" row of 7.2 is reached by a db-backed test through the real flow (warnings changed; enquiry closed after Copy, which arrives as `stale` and records as written without reopening it; artefact missing after an undo; network error) and offers its stated way forward.
19. **Pre-check scope.** No `prepareReview` request is made in any state the 7.1 predicate excludes (every Q row, service unconfirmed, stale edit, situations other than calendar down, blocked, practice, demo), asserted on the network log per section 6 fixture.
20. **Follow-up seen before copy.** In the Follow-up due fixture, the follow-up text is rendered whole in R before Copy follow-up is enabled, and the clipboard payload equals it.
21. **Focus not hidden.** Tabbing through every control at 390x664 never leaves the focused element covered by the sticky header or bar.

## 12. Top risks

- **R1 Clipboard on iOS Safari.** The copy is synchronous in the tap because the check already ran, which should satisfy WebKit's user-gesture rule. This has to be proven in the spike before the build. The fallback is `ClipboardItem` with a promised blob.
- **R2 Reflex attestation.** With the sheet gone, Copy and Yes are two taps apart.
  - Mitigations: Yes stays unfilled until the owner has left and returned, there is a 600ms visible guard, and Undo is available.
  - Metrics: the undo rate of recorded sends, and the "recorded, no customer reply in 7 days" rate, compared before and after.
- **R3 The founder's 2-tap target.** A priced quote stays at 3 because of the coverage gate (OD-1).
- **R4 Wrong name in the greeting.** Mitigated by the visible name row, its Undo, and the full reply above Copy. OD-2 offers the stricter option.
- **R5 Dropping a state in the rebuild.** `intelligence.tsx` has dozens of interacting conditions. Mitigation: section 6 as the fixture matrix, and the old component stays until every row passes.
- **R6 Pre-check load and `reviewed_send` rows.** Bounded by the 7.1 scope, the debounce (1s idle, blur) and the one-row-per-text upsert. Each call takes the enquiry row lock and re-sets `reviewed_by`. Measure prepare p95 on PR #80 in the spike; watch rows per recorded send in the beta; cleanup is F2.
- **R7 Long replies and Safari's short viewport.** At 390x664 a 120-word reply runs below the fold. Page scroll is allowed and inner scroll is not. The sticky header and bar keep the verdict, recipient, channel, amount and action on screen (check 17); "Why this reply" is under the reply.
- **R8 Sticky bar and the iOS keyboard.** VisualViewport behaviour varies, and the bar hides while editing. This is covered by the spike.

## 13. Open decisions for the founder

- **OD-1 Coverage inside Copy (a priced quote in 2 taps).**
  - Option A (this brief): "That's everything" stays its own tap, so a clean quote takes 3.
  - Option B: the server composes the confirmed reply in advance and shows it, and one button "Covers everything - copy reply" confirms coverage and copies. B saves one tap per priced quote. It changes the invariant "a total is only written after confirmation" to "only recorded after confirmation", and it makes the most skippable tap the load-bearing one.
  - Recommendation: A for this build.
- **OD-2 Name applied automatically** (6.4, the founder's direction) or "Greet as Tom?" (one tap, today's safety). Recommendation: applied, with the Undo row.
- **OD-3 Channel deep links in this build.** "Open in Messages" / "Open in Mail" with the body prefilled (`sms:` / `mailto:`) would remove the paste and the thread search, which the in-app tap count does not show. It would also give a reliable "left to send" signal for R2. It needs the same pre-check gate and records nothing. Recommendation: the next build, right after this one lands, so this build keeps a single action per state.

- **OD-4 `rec.reason` inline for every send.** Doc 39 principle 3 asks for a one-line reason in the preview. This brief puts it one tap away ("Why this reply") for LOW / MEDIUM risk and in full for HIGH / PROHIBITED_AUTO, because the typical 10 to 25 word reason would take the ready screen past the 50-word target and towards the founder's 60. Recommendation: keep it one tap away; the verdict line already says why in three words.

## Follow-ups (out of scope)

- F1 Inline price entry from the needs-prices question, instead of going to the pricing screen.
- F2 Cleanup of unconsumed `reviewed_send` rows older than 30 days.

## Review outcome

Four cold `/rate` runs and one `/critique` run checked this brief. Each was a fresh Opus subagent that was not shown any earlier score or this section. Each was told to verify claims against the PR #80 code. Every reviewer claim that drove a change was spot-checked against the code before it was accepted, including:

- the CC1 removal of the client-body record path (`reviewed-send.db.test.ts:12-23`)
- the one-row-per-text upsert (`reviewed-send-core.ts:585-619`)
- the C10 test (`send-paths.test.ts`)
- the `back` pricing return (`next-action.ts:58-67`)
- `--color-line-control` (3.63:1)
- the live default of risk MEDIUM (`decision-snapshot.ts:46`) against the catalogue's DECLINE = HIGH
- stale attestation recording on closed enquiries (`sent-reply-core.ts:236-273`)
- `attention-pass4.db.test.ts:447`

| Run | Version rated | Score |
| --- | --- | --- |
| /rate 1 | first draft | **64/100** |
| /critique | first draft | Nielsen 26/40, verdict REFINE, cognitive load 4 of 8 checks failed |
| /rate 2 | after round 1 fixes | 66/100 |
| /rate 3 | after round 2 fixes | 68/100 |
| /rate 4 | after round 3 fixes | **73/100** |

Round 4 fixes (the P0 and the seven P1s from /rate 4) were applied after the last run, and no run has scored that final text. Each run found new issues in a long spec, so the scores show direction, not convergence.

### P0 findings and how they were resolved

| # | Source | Finding | Resolution |
| --- | --- | --- | --- |
| 1 | rate 1 | The old S2 ("Yes sends the copied text") brought back the client-body record path that CC1 removed, and dropped the revision pin. | S1/S2 rewritten. The pre-check uses the existing idempotent `prepareReviewedSendInTransaction`, and Yes calls the existing confirm with the copied `reviewedSendId`. No client body is ever recorded (7.1, invariant 2). |
| 2 | rate 1 | The warnings acknowledgement could fire before the warnings were on screen, and it was a bare boolean. | Warnings show as soon as the check returns. "Copy anyway" is enabled only after every item has been seen. S1 sends the acknowledged list, and the server refuses a mismatch (7.3, S1, check 14). |
| 3 | rate 1 | `send-paths.test.ts` (C10) requires `<SendPreview>` and was not mentioned. | C10 replacement specified in section 8, removed in the same commit as `SendPreview`. |
| 4 | critique | Yes became the filled button in Copy's spot before the owner could have sent anything. | Yes stays unfilled until a hidden/blur and return event. It is tappable after a visible 600ms guard (7.2, check 13). |
| 5 | critique | Nothing said what stays pinned at the moment of Copy. | The send line (recipient, channel, amount) moved into the sticky bar, and slot A is sticky (section 3, invariant 11, check 17). |
| 6 | critique | Copy mid-edit needed a network save inside the gesture. | Removed. The bar hides while typing, and Copy waits until the check covers the exact text (6.3, 7.1). |
| 7 | rate 2 | The pre-check had no defined scope, so it would paint refusals over normal decision steps and over practice. | An explicit eligibility predicate, unit-tested per row. Practice and demo get a client-only path (7.1, check 19). |
| 8 | rate 2 | Invariant 11 could not hold with only the bar sticky. | Same fix as 5, plus check 17 at 390x664 with a 300-word reply. |
| 9 | rate 3 | The waiting-desk follow-up lost its only preview. | Follow-up due shows the follow-up draft whole in R before Copy follow-up (section 6, check 20). |
| 10 | rate 3 | The C10 replacement did not assert the text itself. | It now also asserts that the clipboard payload equals the rendered reply on every send path. |
| 11 | rate 3 | The high-risk review panel depended on `decision.risk`, which live data never sets. | The risk rule uses the higher of the action catalogue's risk and `decision.risk`. DECLINE is HIGH in production (7.1). |
| 12 | rate 3 | "Decline as a reply = 2" contradicted the high-risk +1. | Recounted to 3 (section 4). |
| 13 | rate 4 | At 200% text the bar stops sticking, so recipient, channel and amount could be off screen at Copy. | In that layout the first Copy tap opens the review panel. Check 17 covers 200% text (section 9). |

### P1 findings and how they were resolved

| Source | Finding | Resolution |
| --- | --- | --- |
| rate 1 | Slot order differed across the table, wireframes and focus order. | One order (A, M, B, R, D, E) in all three. |
| rate 1, rate 2 | The verdict spec missed most `promiseVerdict` branches; the cap and the Waiting row were inconsistent. | A full branch table. One change only (ACTION_READY tails move to the settled line). A two-line measured cap with a render test. A StatusWord-to-PromiseWord mapping table (section 5). |
| rate 1 | No desktop aside toggle exists. | Specified: hidden by default above 1100px; the header icon toggles it. Already hidden at 1100px and below (ui1.css:1620-1625). |
| rate 1, rate 2 | Check 3 assumed a document scroller the shell does not have. | The allowed scrollers are named per breakpoint, including `.enquiry-context`. |
| rate 1, critique | The reply edge was 1.68:1, and the label hid after the first edit. | `--color-line-control` (3.63:1); the label stays visible (6.3). |
| rate 1, rate 2 | Doc 39's inline variant applies to low-risk sends only. | HIGH / PROHIBITED_AUTO get the in-place review panel (+1 tap). Gates stay in D. |
| rate 1 | `moneyFigures` cannot run in the client. | Moved server-side as `namesAmount` in the prepare result (S2). |
| rate 1 | A disabled Copy in decision states reversed `quietFooter`. | The bar is hidden while a decision is open, on phone and desktop. |
| rate 1 | S5 already ships. | Deleted; the `back` param is cited instead. |
| rate 1, rate 3 | Missing states. | Added: closed day with open flags, multi-message thread, Recorded with nothing left, demo key, Already recorded, Check failed, no recipient, estimate range, long email, booking pending, practice end. |
| rate 1 | The name plausibility test had no data source. | Uses the engine's existing title/suburb filter (attention-pass4.db.test.ts:447). |
| critique | "N things settled" hid "come back" promises. | The settled line names every commitment or refusal (6.5). |
| critique | The Copied state vanished when the reply changed. | A new "Copied an earlier version" state confirms the copied artefact, with a stale path. |
| critique | The verdict named an amount the reply did not contain. | Amounts are never in slot A; they come only from the server's `namesAmount`. |
| critique | A plain textarea cannot draw highlights. | A read view (`aria-hidden`) over the always-present textarea (6.3). |
| critique | The fold was measured only at 844px. | Every word and visibility check also runs at 390x664. |
| critique | The sticky bar had no height budget. | 160px, excluding the inset; two states may grow and push the page. |
| critique | The availability card had 5+ buttons. | "Only {day}" choices fold into one disclosure. Rejected: making "Yes" filled (rate 2 showed it nudges a promise of availability). |
| critique | The step counter was misdescribed. | The existing `checkStep` copy, quoted exactly. |
| critique | Channel deep links. | Raised as OD-3 for the next build, not this one: a second action per state. |
| rate 2 | Two "unchanged" tests assert what S1/S3 change. | Moved to a "tests that change" list with their new assertions. `attention-pass4` was added in round 3. |
| rate 2 | No states for failures after the owner has already sent. | Rows for changed warnings, closed meanwhile, missing artefact and network error (7.2, check 18). |
| rate 2 | No pre-check-failed state. | Check failed, with Try again and a 5s timeout. |
| rate 2, rate 3 | The coverage question was asked from a two-line excerpt, and the button could fall off screen. | The message opens in full while coverage is open, capped at 8 lines. Check 7 covers every Q row. |
| rate 2 | Word caps clashed with verbatim server text. | Server text is exempt and reported separately. |
| rate 2, rate 4 | The "Copy anyway" gate could never fire at 200% text or with a screen reader. | Per-item seen-or-focused counting. |
| rate 2 | "Blocking" gates were undefined. | Every gate shown inline today stays in D. |
| rate 3 | Pre-check scope missed `awaitingService`, stale edit, situations and `!primaryEnabled`; the ESCALATE_HUMAN justification was wrong. | The predicate lists every exclusion with the real server reasons. |
| rate 3 | The name confirmation could break Undo. | The name is confirmed before `after_revision` is read; a db test covers Undo. |
| rate 3, rate 4 | The word count in mock 3.1 was understated. | Recounted with a named tokenizer and Tom's real date cue. `rec.reason` moved behind "Why this reply" (OD-4). Ready target 50, founder cap 60. |
| rate 3, rate 4 | The post-send "closed" row was unreachable, then wrongly downgraded a real send. | It arrives as `stale`. "I already sent that older message" records it as written without reopening the enquiry, as the server intends. |
| rate 3, rate 4 | The clipboard fallback focused the textarea and opened the keyboard. | Range selection of the read view in both 7.2 and section 9; proven in the spike. |
| rate 3 | WCAG 2.4.11 (focus hidden by sticky parts). | `scroll-padding` equals the sticky heights; check 21. |
| rate 3 | The private note had no slot. | It shows as one line under their message. |
| rate 4 | Desktop budget 60/40 vs 60/50. | 60/50 everywhere. |
| rate 4 | The needs-prices count was not exact. | P + 5 before, P + 4 after, with P measured on the fixture. |
| rate 4 | DECLINE chip vs verdict disagreement. | New StatusWord "No - reply ready" for an ACTION_READY decline. |
| rate 4 | The copied state stored on `reply_draft`. | Moved to a `copied_at` column on `reviewed_send`. |

### Rejected or deferred, with reasons

- **Critique: "Not yet" should keep a list-row cue.** Rejected. The enquiry stays in Needs you, which is already the reminder; a second cue would be the nagging the founder ruled out.
- **Critique: Later as the idle bar's secondary.** Rejected. It keeps the bar to one action; Later stays two taps away, as it is on the phone today.
- **Critique: "Copy without the check" when offline.** Rejected. It would let a refused text be copied, which is the thing the check exists to stop.
- **P2s from rate 4 left for the build.** These are:
  - undo refusals after 15 minutes
  - name Undo over an owner's edit
  - a minimum view time before a warning counts as seen
  - a Copy click lost on desktop right after typing
  - gaps in the string table
  - check numbering
  - two citations it called wrong (not re-verified)

  None of them changes a safety invariant or the tap budget.
