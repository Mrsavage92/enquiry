# Enquiry — Prototype Action → Live Server Semantics Matrix

**Status:** MANAGEMENT PREPARATION  
**Purpose:** Ensure every meaningful prototype action gets an explicit first-beta disposition rather than disappearing or remaining client-only by accident.

Execution authority remains `docs/CURRENT_PHASE.md`.

---

# Legend

- **UI LOCAL** — may remain device/client state.
- **DEMO ONLY** — keep only in fixture/demo runtime.
- **R2A** — real onboarding.
- **R2B** — read/runtime cutover.
- **R2C** — Business Brain/trust/business persistence.
- **R2D** — enquiry decision/lifecycle persistence.
- **R2E** — arbitrary ingestion/interpretation.
- **R2F** — review-first/manual action/telemetry.
- **DEFER** — not required for first five.

---

| Current prototype action/state | Live disposition | Phase | Server-authoritative meaning |
|---|---|---|---|
| `reset()` | DEMO ONLY | R2B | Never replace live tenant state with fixtures |
| `completeOnboarding(...)` | Replace local implementation | R2A | Create initial business + owner membership atomically |
| `startSetup()` | UI navigation/local | R2A/R2B | Open real onboarding; no fixture reset |
| `enterSample()` | DEMO ONLY | R2B | Navigate/open isolated `/demo` |
| `restoreFixture()` | DEMO ONLY | R2B | No live equivalent |
| `dismissHint()` | UI LOCAL | R2B | Device/session preference |
| `setOnboardingStep()` | UI LOCAL | R2A | Local form progress unless resume evidence later requires server |
| `setOnboardingSource()` | UI LOCAL / research | R2A | Selection is not an integration connection |
| `setBusinessFilter()` | UI LOCAL | R2B | Filter among authorised server-loaded businesses |
| `setQueueFilter()` | UI LOCAL | R2B | Presentation only |
| `setBrainTab()` | UI LOCAL | R2B | Presentation only |
| `setBrainFocusComposer()` | UI LOCAL | R2B | Presentation only |
| `track()` | Split | R2F | Demo instrumentation remains demo; live beta events server-derived |
| `editDraft()` | UI LOCAL until explicit save/use | R2F | Draft edit may remain local; decision outcome captured on review/use |
| `considerVoice()` | UI/learning candidate | R2C/R2F | Voice-only edit can propose preference change, never commercial rule |
| `decideVoice(enquiry)` | Persist only if useful | R2F | This message/draft only |
| `decideVoice(teach)` | Persist voice preference | R2C | Explicit business voice update |
| `approve()` | Replace prototype mutation | R2F | Record recommendation review + manual/authorised action semantics |
| `correctFact()` | Server mutation | R2D | Supersede old fact, insert corrected fact, re-evaluate |
| `decideTeach(enquiry)` | Server mutation | R2D | Enquiry correction only |
| `decideTeach(teach)` | Server + Brain proposal | R2C/R2D | Correct fact + propose Business Brain learning |
| `confirmLearning()` | Server mutation | R2C | Accept suggestion subject to high-impact confirmation rules |
| `dismissLearning()` | Server mutation | R2C | Persist dismissal |
| `confirmKnowledge()` | Server mutation | R2C | Confirm/activate according to governance |
| `resolveConflict()` | Server transaction | R2C | Preserve winner/loser history, recompile rule, re-evaluate open work |
| `tellEnquiry()` | Replace broad prototype behaviour | R2C | Create proposed knowledge/rule; no arbitrary immediate authoritative mutation |
| `confirmBrainChange()` | Server transaction | R2C | Confirm proposed business rule/change |
| `cancelBrainChange()` | UI + persisted proposal status if needed | R2C | Cancel/discard pending proposal safely |
| `setVoice()` | Server mutation where business-level | R2C | Persist tenant voice profile |
| `setTrustMode()` | Server mutation | R2C | Persist global trust posture; does not bypass action gates |
| `setActionPolicy()` | Existing/extend server mutation | R2C | Per-action authority mode |
| `pause()` | Existing server mutation | R2C | Persist business pause level |
| `resume()` | Existing server mutation | R2C | Persist resume |
| `reconnect(enquiryId)` | DEFER / truthful external status | Later | No fake integration reconnect in beta |
| `continueWithoutAvailability()` | Server decision mutation if retained | R2D | Explicit human chooses to proceed without validated availability; authority/reason recorded |
| `resolvePrice()` | Replace client-entered final price authority | R2D/R2C | Human correction/proposed rule depending scope; deterministic decision recompute |
| `resolveDuplicate()` | DEFER unless first-beta need | Phase 7/evidence | Cross-enquiry identity/merge is deferred |
| `markLost()` | Server mutation | R2D | Explicit terminal lifecycle + audit |
| `decline()` | Server mutation | R2D/R2F | Human-authorised decline; never silent automatic action |
| `acceptQuote()` | Server mutation | R2D/R2F | Record customer acceptance/manual evidence; update quote/lifecycle |
| `receiveClientReply()` | Replace fixture behavior | R2F | Append manual inbound update to same enquiry, interpret/re-evaluate |
| `recordClientQuestion()` | Server message/update | R2F | Persist actual customer question/update |
| `confirmExternalBooking()` | Server mutation | R2D/R2F | Manual external booking confirmation; idempotent |
| `setOfflineSimulated()` | DEMO ONLY | R2B | Fixture QA |
| `setNetworkOffline()` | UI/runtime | R2F | Actual browser network state may remain local; no false success |
| `arriveEnquiry()` | DEMO ONLY; real replacement | R2E | Live new enquiry creation is manual/private ingestion |
| `markArrivalSeen()` | UI LOCAL | R2B | Demo notice only or local read state |
| `reconnectBusiness()` | DEFER | Later | Real integration/provider recovery only |
| `undoLast()` | Remove for persisted live actions | R2C/R2D | Use explicit corrective server operation, not client snapshot rewind |
| `releaseFollowUp()` | Server mutation | R2D/R2F | Mark follow-up prepared/completed according to truthful action |
| `proposeRevision()` | Server/client decision flow | R2D/R2F | Prepare revised draft/quote without mutating sent history |
| `snooze()` | Existing server mutation | R2D | Persist until/clear |
| `setNote()` | Existing server mutation | R2D | Persist note |
| `declineLetter()` | Review/draft action | R2F | Prepare decline draft; actual decline requires human authority |
| `setPrefs()` | Split | R2C/R2B | Working hours/timezone server; device notifications local |
| `connectIntegration()` | Remove from live fake flow | R2B | Only real provider handshake can create connected status |
| `disconnectIntegration()` | DEFER until real integrations | Later | Server provider revocation when feature exists |
| `inviteToDm()` | DEFER / manual truthful workflow | Later | Do not claim Instagram action without integration |
| `runAutopilot()` | DEMO ONLY for first cohort | R2B/R2F | First beta review-first; real automation evidence later |
| `recordDeposit()` | Manual record only if needed | R2D/R2F | Never claim payment processing; record external/manual paid state |
| `rescheduleBooking()` | Manual record | R2D/R2F | Update Enquiry record only, unless external calendar integration later |
| `cancelBooking()` | Manual record | R2D/R2F | Update local system-of-record/handoff truthfully |
| `dismissNotice()` | UI LOCAL | R2B | Device/session |
| `dismissInstall()` | UI LOCAL | Phase 10 | Device local |
| `tickFollowUps()` | Server/domain scheduling semantics | R2C/R2D | Determine due state from persisted rules/time; no client-only authoritative timer |

---

# Store state disposition

| Prototype state | Live disposition |
|---|---|
| `onboarded` | derive from server membership/workspace state |
| `demoMode` | explicit runtime context, not inferred from business id |
| `onboardingStep` | local UI |
| `onboardingMaxStep` | local UI |
| `onboardingSource` | local/research preference |
| `businesses` | SERVER AUTHORITATIVE |
| `enquiries` | SERVER AUTHORITATIVE |
| `bookings` | SERVER AUTHORITATIVE |
| `businessFilter` | UI LOCAL |
| `queueFilter` | UI LOCAL |
| `brainTab` | UI LOCAL |
| `brainFocusComposer` | UI LOCAL |
| `drafts` | local while editing; persist/record only at deliberate action |
| `teach` | UI LOCAL dialog state; resulting change server-side |
| `duplicate` | deferred |
| `brainPreview` | local preview of proposed server/domain change |
| `lastChangeAt` | UI LOCAL unless used for business logic |
| `events` | demo only; live evidence server/telemetry |
| `sessionStartedAt` | UI/analytics local |
| `confirmSent` | replace with persisted truthful manual send/use evidence |
| `firstHint` | UI LOCAL |
| `offline` | runtime UI |
| `offlineSimulated` | DEMO ONLY |
| `networkOffline` | runtime UI |
| `lastMerge` | deferred identity merge |
| `liveSeq` | DEMO ONLY |
| `lastArrivalId` | DEMO ONLY |
| `arrivalPlayed` | DEMO ONLY |
| `voiceNotice` | UI LOCAL; accepted business change server-side |
| `prefs` | split: decision-affecting server / device settings local |
| `audit` | SERVER AUTHORITATIVE in live mode |
| `undo` | DEMO ONLY / remove from persisted actions |
| `lastAutomated` | demo until real autonomy exists |
| `dismissedNotices` | UI LOCAL |
| `installDismissed` | UI LOCAL |

---

# Important first-beta decisions

## No generic "sync store to DB"

Do not implement persistence by periodically serialising the whole Zustand store to Postgres.

Persist domain operations, not state blobs.

## No optimistic authority for important actions

UI may optimistically update harmless presentation state.

For:
- fact correction;
- quote;
- booking;
- trust;
- Brain rule;
- lifecycle terminal action;

server success is required before the UI treats it as durable truth.

## No action loss

Before deleting a prototype action, decide:
- demo only;
- real first-beta server semantic;
- explicit defer.

This matrix is the checklist.

---

# Final-beta audit

Before `BETA_READINESS_GATE.md` passes, re-check every row in this matrix and ensure no meaningful live action remains silently client-only.
