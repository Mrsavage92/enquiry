import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type {
  ActionPolicyMode,
  AuditEvent,
  AutomatedSend,
  Booking,
  BrainChangePreview,
  Business,
  Enquiry,
  InstrumentationEvent,
  KnowledgeItem,
  LearningSuggestion,
  TrustMode,
  VoiceProfile,
  WorkspacePrefs,
} from "@/domain/types";
import { BOOKINGS, BUSINESSES, ENQUIRIES } from "@/fixtures";
import {
  reconnectCalendar,
  reevaluateAfterFact,
  resolveFamilyPrice,
} from "@/domain/reeval";
import { applyVoiceToDraft } from "@/domain/voice-apply";
import { detectVoiceEdit } from "@/domain/voice-detect";
import {
  applyBrainToOpenEnquiries,
  compileBrainChange,
  knowledgeAfterPreview,
} from "@/domain/brain-apply";
import { arrivingEnquiry, resolveArriving } from "@/fixtures/arriving";
import { outboundBlocked } from "@/domain/situation";
import { isShortChannel, replyChannel, replyTo } from "@/domain/channel";
import { auditSummary } from "@/domain/audit-copy";
import {
  autopilotEligible,
  daysFromNow,
  declineWithLetter,
  defaultDeclineBody,
  defaultHold,
  enableFollowUp as buildFollowUp,
  proposeRevision as buildRevision,
  recordAutomatedSend,
  snoozeEnquiry as buildSnooze,
} from "@/domain/commercial";
import { shouldReleaseFollowUp } from "@/domain/working-hours";
import { DEMO_ACCEPT_REPLY, detectClientIntent } from "@/domain/client-intent";
import { bookingDraftFromEnquiry } from "@/domain/calendar";
import { toast } from "sonner";

export type BusinessFilter = "all" | string;
export type QueueFilter = "needs_you" | "waiting" | "at_risk" | "closed" | "all";

type TeachDialog = {
  enquiryId: string;
  factId: string;
  proposal: string;
} | null;

type DuplicateDialog = {
  enquiryId: string;
} | null;

type VoiceNotice = {
  enquiryId: string;
  businessId: string;
  from: string;
  to: string;
  reason: string;
  patch: Partial<VoiceProfile>;
} | null;

type PrototypeState = {
  onboarded: boolean;
  demoMode: boolean;
  onboardingStep: number;
  onboardingMaxStep: number;
  onboardingSource: string | null;
  businesses: Business[];
  enquiries: Enquiry[];
  bookings: Booking[];
  businessFilter: BusinessFilter;
  queueFilter: QueueFilter;
  brainTab: string;
  brainFocusComposer: boolean;
  drafts: Record<string, string>;
  teach: TeachDialog;
  duplicate: DuplicateDialog;
  brainPreview: BrainChangePreview | null;
  lastChangeAt: Record<string, number>;
  events: InstrumentationEvent[];
  sessionStartedAt: number;
  confirmSent: Record<string, boolean>;
  firstHint: boolean;
  offline: boolean;
  offlineSimulated: boolean;
  networkOffline: boolean;
  lastMerge: { fromId: string; toId: string; toName: string } | null;
  liveSeq: number;
  lastArrivalId: string | null;
  arrivalPlayed: boolean;
  voiceNotice: VoiceNotice;
  prefs: WorkspacePrefs;
  audit: AuditEvent[];
  undo: Snapshot | null;
  lastAutomated: AutomatedSend | null;
  dismissedNotices: string[];
  installDismissed: boolean;
};

type Snapshot = {
  enquiries: Enquiry[];
  bookings: Booking[];
  businesses: Business[];
  drafts: Record<string, string>;
  confirmSent: Record<string, boolean>;
};

type Actions = {
  reset: () => void;
  completeOnboarding: (profile?: {
    name: string;
    city: string;
    timezone: string;
    suburb?: string;
    team?: string;
  }) => void;
  startSetup: () => void;
  enterSample: () => void;
  restoreFixture: (enquiryId: string) => void;
  dismissHint: () => void;
  setOnboardingStep: (n: number) => void;
  setOnboardingSource: (s: string) => void;
  setBusinessFilter: (id: BusinessFilter) => void;
  setQueueFilter: (f: QueueFilter) => void;
  setBrainTab: (id: string) => void;
  setBrainFocusComposer: (v: boolean) => void;
  track: (fixtureId: string, action: string) => void;
  editDraft: (enquiryId: string, body: string) => void;
  considerVoice: (enquiryId: string) => void;
  decideVoice: (scope: "enquiry" | "teach") => void;
  approve: (enquiryId: string, opts?: { automated?: boolean }) => void;
  correctFact: (enquiryId: string, factId: string, value: string, display: string) => void;
  decideTeach: (scope: "enquiry" | "teach") => void;
  confirmLearning: (businessId: string, suggestionId: string) => void;
  dismissLearning: (businessId: string, suggestionId: string) => void;
  confirmKnowledge: (businessId: string, itemId: string) => void;
  resolveConflict: (businessId: string, keepId: string, dropId: string) => void;
  tellEnquiry: (businessId: string, input: string) => void;
  confirmBrainChange: () => void;
  cancelBrainChange: () => void;
  setVoice: (businessId: string, patch: Partial<VoiceProfile>) => void;
  setTrustMode: (businessId: string, mode: TrustMode) => void;
  setActionPolicy: (businessId: string, action: string, mode: ActionPolicyMode) => void;
  pause: (businessId: string, level: "outbound" | "all") => void;
  resume: (businessId: string) => void;
  reconnect: (enquiryId: string) => void;
  continueWithoutAvailability: (enquiryId: string) => void;
  resolvePrice: (enquiryId: string, amount: number) => void;
  resolveDuplicate: (enquiryId: string, mode: "merge" | "separate") => void;
  markLost: (enquiryId: string) => void;
  decline: (enquiryId: string, reason: string) => void;
  acceptQuote: (enquiryId: string, opts?: { fromReply?: boolean }) => void;
  receiveClientReply: (enquiryId: string, body?: string) => void;
  recordClientQuestion: (enquiryId: string, body?: string) => void;
  confirmExternalBooking: (enquiryId: string) => void;
  setOfflineSimulated: (v: boolean) => void;
  setNetworkOffline: (v: boolean) => void;
  arriveEnquiry: () => string;
  markArrivalSeen: () => void;
  reconnectBusiness: (businessId: string) => void;
  undoLast: () => void;
  releaseFollowUp: (enquiryId: string) => void;
  proposeRevision: (enquiryId: string) => void;
  snooze: (enquiryId: string) => void;
  setNote: (enquiryId: string, note: string) => void;
  declineLetter: (enquiryId: string) => void;
  setPrefs: (patch: Partial<WorkspacePrefs>) => void;
  connectIntegration: (businessId: string, integrationId: string) => void;
  disconnectIntegration: (businessId: string, integrationId: string) => void;
  inviteToDm: (enquiryId: string) => void;
  runAutopilot: (businessId: string, action: string) => void;
  recordDeposit: (bookingId: string) => void;
  rescheduleBooking: (bookingId: string, when: string, durationMinutes?: number) => void;
  cancelBooking: (bookingId: string) => void;
  dismissNotice: (id: string) => void;
  dismissInstall: () => void;
  tickFollowUps: () => void;
};

const seed = (): Omit<PrototypeState, never> => ({
  onboarded: true,
  demoMode: true,
  onboardingStep: 0,
  onboardingMaxStep: 0,
  onboardingSource: "website",
  businesses: structuredClone(BUSINESSES),
  enquiries: structuredClone(ENQUIRIES),
  bookings: structuredClone(BOOKINGS),
  businessFilter: "all",
  queueFilter: "needs_you",
  brainTab: "all",
  brainFocusComposer: false,
  drafts: Object.fromEntries(ENQUIRIES.map((e) => [e.id, e.decision.draft.body])),
  teach: null,
  duplicate: null,
  brainPreview: null,
  lastChangeAt: {},
  events: [],
  sessionStartedAt: Date.now(),
  firstHint: false,
  confirmSent: {},
  offline: false,
  offlineSimulated: false,
  networkOffline: false,
  lastMerge: null,
  liveSeq: 0,
  lastArrivalId: null,
  arrivalPlayed: false,
  voiceNotice: null,
  prefs: defaultPrefs(),
  audit: [],
  undo: null,
  lastAutomated: null,
  dismissedNotices: [],
  installDismissed: false,
});

function defaultPrefs(): WorkspacePrefs {
  return {
    hoursStart: "08:00",
    hoursEnd: "17:30",
    workingDays: "Monday–Friday",
    timezone: "Australia/Brisbane",
    notifyArrival: true,
    notifyFollowUp: true,
    notifyLearning: true,
  };
}

function snapshotOf(s: {
  enquiries: Enquiry[];
  bookings: Booking[];
  businesses: Business[];
  drafts: Record<string, string>;
  confirmSent: Record<string, boolean>;
}): Snapshot {
  return {
    enquiries: s.enquiries,
    bookings: s.bookings,
    businesses: s.businesses,
    drafts: s.drafts,
    confirmSent: s.confirmSent,
  };
}

function appendAudit(
  audit: AuditEvent[],
  event: Omit<AuditEvent, "id" | "at">,
): AuditEvent[] {
  return [
    {
      id: `a-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      at: new Date().toISOString(),
      ...event,
    },
    ...audit,
  ].slice(0, 80);
}

function bump(list: Enquiry[], next: Enquiry): Enquiry[] {
  return list.map((e) => (e.id === next.id ? next : e));
}

let arriveTimer: ReturnType<typeof setTimeout> | null = null;
let replyTimer: ReturnType<typeof setTimeout> | null = null;

export const usePrototype = create<PrototypeState & Actions>()(
  persist(
    (set, get) => ({
      ...seed(),
      reset: () => {
        if (arriveTimer) {
          clearTimeout(arriveTimer);
          arriveTimer = null;
        }
        if (replyTimer) {
          clearTimeout(replyTimer);
          replyTimer = null;
        }
        set({ ...seed(), onboarded: get().onboarded });
      },
      completeOnboarding: (profile) => {
        const s = get();
        const name = profile?.name.trim();
        set({
          onboarded: true,
          demoMode: false,
          onboardingStep: 8,
          businessFilter: "glow",
          queueFilter: "needs_you",
          firstHint: true,
          arrivalPlayed: false,
          lastArrivalId: null,
          enquiries: [],
          bookings: [],
          drafts: {},
          confirmSent: {},
          prefs: {
            ...s.prefs,
            timezone: profile?.timezone || s.prefs.timezone || "Australia/Brisbane",
          },
          businesses: s.businesses.map((b) =>
            b.id === "glow" && name
              ? {
                  ...b,
                  name,
                  city: profile?.city || b.city,
                  timezone: profile?.timezone || b.timezone,
                  baseLocation: profile?.suburb || b.baseLocation,
                  soloOrTeam: profile?.team === "solo" || !profile?.team ? "solo" : "team",
                }
              : b,
          ),
        });
      },
      startSetup: () =>
        set({
          onboarded: false,
          demoMode: false,
          onboardingStep: 0,
          onboardingMaxStep: 0,
          firstHint: false,
        }),
      enterSample: () =>
        set({
          onboarded: true,
          demoMode: true,
          businesses: structuredClone(BUSINESSES),
          enquiries: structuredClone(ENQUIRIES),
          bookings: structuredClone(BOOKINGS),
          drafts: Object.fromEntries(ENQUIRIES.map((e) => [e.id, e.decision.draft.body])),
          businessFilter: "all",
          queueFilter: "needs_you",
          firstHint: false,
          arrivalPlayed: false,
          lastArrivalId: null,
        }),
      restoreFixture: (enquiryId) => {
        const fixture = ENQUIRIES.find((e) => e.id === enquiryId);
        if (!fixture) return;
        if (replyTimer) {
          clearTimeout(replyTimer);
          replyTimer = null;
        }
        const next = structuredClone(fixture);
        set((s) => ({
          enquiries: s.enquiries.some((e) => e.id === enquiryId)
            ? s.enquiries.map((e) => (e.id === enquiryId ? next : e))
            : [next, ...s.enquiries],
          bookings: s.bookings.filter((b) => b.enquiryId !== enquiryId),
          drafts: { ...s.drafts, [enquiryId]: next.decision.draft.body },
          confirmSent: { ...s.confirmSent, [enquiryId]: false },
        }));
      },
      dismissHint: () => set({ firstHint: false }),
      setOnboardingStep: (n) =>
        set((s) => ({
          onboardingStep: n,
          onboardingMaxStep: Math.max(s.onboardingMaxStep, n),
        })),
      setOnboardingSource: (s) => set({ onboardingSource: s }),
      setBusinessFilter: (id) => set({ businessFilter: id }),
      setQueueFilter: (f) => set({ queueFilter: f }),
      setBrainTab: (id) => set({ brainTab: id }),
      setBrainFocusComposer: (v) => set({ brainFocusComposer: v }),
      track: (fixtureId, action) =>
        set((s) => ({
          events: [
            ...s.events,
            { id: `${Date.now()}-${action}`, fixtureId, action, at: Date.now() },
          ],
        })),
      editDraft: (enquiryId, body) =>
        set((s) => ({ drafts: { ...s.drafts, [enquiryId]: body } })),
      considerVoice: (enquiryId) => {
        const s = get();
        const enquiry = s.enquiries.find((e) => e.id === enquiryId);
        if (!enquiry) return;
        const business = s.businesses.find((b) => b.id === enquiry.businessId);
        if (!business) return;
        const edited = s.drafts[enquiryId] ?? enquiry.decision.draft.body;
        const firstName = enquiry.customerName.split(" ")[0] ?? enquiry.customerName;
        const proposal = detectVoiceEdit(enquiry.decision.draft.body, edited, business.voice, firstName);
        if (!proposal) {
          if (s.voiceNotice?.enquiryId === enquiryId) set({ voiceNotice: null });
          return;
        }
        set({
          voiceNotice: {
            enquiryId,
            businessId: business.id,
            from: proposal.from,
            to: proposal.to,
            reason: proposal.reason,
            patch: proposal.patch,
          },
        });
      },
      decideVoice: (scope) => {
        const s = get();
        const notice = s.voiceNotice;
        if (!notice) return;
        get().track(notice.enquiryId, scope === "teach" ? "voice_teach" : "voice_enquiry");
        if (scope === "teach") get().setVoice(notice.businessId, notice.patch);
        set({ voiceNotice: null });
      },
      approve: (enquiryId, opts) => {
        const s = get();
        const enquiry = s.enquiries.find((e) => e.id === enquiryId);
        if (!enquiry) return;
        if (!enquiry.decision.recommendation.primaryEnabled) return;
        const business = s.businesses.find((b) => b.id === enquiry.businessId);
        if (outboundBlocked(business, s.offline, enquiry)) return;
        const automated = Boolean(opts?.automated);
        get().track(enquiry.fixtureId, automated ? "approve_auto" : "approve");
        const action = enquiry.decision.recommendation.action;
        const next = structuredClone(enquiry);
        const body = s.drafts[enquiryId] ?? next.decision.draft.body;
        const draftQuote =
          next.decision.quotes.find((q) => q.status === "draft") ??
          next.decision.quotes[next.decision.quotes.length - 1];
        const sendingQuote = action === "SEND_QUOTE" || action === "SEND_ESTIMATE";
        const channel = replyChannel(enquiry);
        next.conversation = [
          ...next.conversation,
          {
            id: `${enquiryId}-out-${Date.now()}`,
            direction: "outbound",
            channel,
            at: new Date().toISOString(),
            from: automated ? `${business?.ownerName ?? "You"} · Enquiry` : (business?.ownerName ?? "You"),
            to: replyTo(enquiry),
            subject: isShortChannel(channel) ? undefined : next.decision.draft.subject,
            body,
            quoted: sendingQuote,
            quoteId: sendingQuote ? draftQuote?.id : undefined,
          },
        ];
        if (sendingQuote) {
          next.state.commercial = action === "SEND_ESTIMATE" ? "ESTIMATED" : "QUOTED";
          next.state.decision = "WAITING_ON_CLIENT";
          next.state.responsibility = "CUSTOMER";
          next.followUpDue = false;
          next.snoozedUntil = undefined;
          next.decision.quotes = next.decision.quotes.map((q) =>
            q.status === "draft"
              ? {
                  ...q,
                  status: "sent",
                  sentAt: new Date().toISOString(),
                  hold: q.hold ?? defaultHold(q.total?.amount),
                }
              : q,
          );
          next.decision.recommendation = {
            ...next.decision.recommendation,
            action: "FOLLOW_UP",
            label: "Send follow-up",
            reason: "The quote is with them. Silence is not a decline.",
            primaryEnabled: false,
            reasonCodes: ["FOLLOW_UP"],
          };
        } else if (action === "REQUEST_INFORMATION" || action === "FOLLOW_UP" || action === "SEND_QUALIFICATION_RESPONSE") {
          next.state.decision = "WAITING_ON_CLIENT";
          next.state.responsibility = "CUSTOMER";
          next.followUpDue = false;
          next.atRisk = false;
          next.snoozedUntil = undefined;
        } else if (action === "HANDOFF_BOOKING") {
          next.state.decision = "BOOKING_PENDING";
          next.state.commercial = "ACCEPTED";
          next.state.responsibility = "CUSTOMER";
        } else if (action === "RECOMMEND_OFFER") {
          next.state.decision = "WAITING_ON_CLIENT";
          next.state.responsibility = "CUSTOMER";
        } else if (action === "DECLINE") {
          next.state = {
            lifecycle: "DECLINED",
            decision: "NONE",
            commercial: next.state.commercial,
            responsibility: "NONE",
          };
          next.followUpDue = false;
          next.atRisk = false;
        }
        set({
          enquiries: bump(s.enquiries, next),
          confirmSent: { ...s.confirmSent, [enquiryId]: true },
          undo: snapshotOf(s),
          lastAutomated: automated && business ? recordAutomatedSend(enquiry, business) : s.lastAutomated,
          audit: appendAudit(s.audit, {
            actor: automated ? "Enquiry (Autopilot)" : (business?.ownerName ?? "You"),
            summary: auditSummary(automated ? "approve_auto" : "approve", enquiry.fixtureId),
            detail: next.decision.recommendation.label,
            objectType: "enquiry",
            objectId: enquiryId,
          }),
        });
        if (sendingQuote && s.demoMode && !automated) {
          if (replyTimer) clearTimeout(replyTimer);
          replyTimer = setTimeout(() => {
            get().receiveClientReply(enquiryId);
          }, 7200);
        }
      },
      correctFact: (enquiryId, factId, value, display) => {
        const s = get();
        const enquiry = s.enquiries.find((e) => e.id === enquiryId);
        if (!enquiry) return;
        get().track(enquiry.fixtureId, "correct_fact");
        const original = enquiry.facts.find((f) => f.id === factId);
        const next = reevaluateAfterFact(enquiry, factId, value, display);
        const teachable = Boolean(original?.teachable) && !original?.customerSpecific;
        set({
          enquiries: bump(s.enquiries, next),
          drafts: { ...s.drafts, [enquiryId]: next.decision.draft.body },
          lastChangeAt: { ...s.lastChangeAt, [enquiryId]: Date.now() },
          teach: teachable
            ? {
                enquiryId,
                factId,
                proposal:
                  enquiry.teachPrompt ??
                  `When a customer says this, interpret it as “${display}”.`,
              }
            : null,
        });
      },
      decideTeach: (scope) => {
        const teach = get().teach;
        if (!teach) return;
        if (scope === "enquiry") {
          get().track(
            get().enquiries.find((e) => e.id === teach.enquiryId)?.fixtureId ?? "",
            "just_this_enquiry",
          );
          set({ teach: null });
          return;
        }
        const enquiry = get().enquiries.find((e) => e.id === teach.enquiryId);
        if (!enquiry) {
          set({ teach: null });
          return;
        }
        get().track(enquiry.fixtureId, "teach_enquiry");
        const suggestion: LearningSuggestion = {
          id: `learn-${Date.now()}`,
          businessId: enquiry.businessId,
          title: "Proposed interpretation",
          proposal: teach.proposal,
          class: "interpretive",
          examples: [enquiry.customerName],
          status: "pending",
          highImpact: false,
        };
        set((s) => ({
          teach: null,
          brainTab: "learning",
          businessFilter: enquiry.businessId,
          businesses: s.businesses.map((b) =>
            b.id === enquiry.businessId
              ? { ...b, learningSuggestions: [suggestion, ...b.learningSuggestions] }
              : b,
          ),
        }));
      },
      confirmLearning: (businessId, suggestionId) => {
        const s = get();
        const businesses = s.businesses.map((b) => {
          if (b.id !== businessId) return b;
          const sug = b.learningSuggestions.find((x) => x.id === suggestionId);
          if (!sug) return b;
          if (sug.highImpact) return b;
          const item: KnowledgeItem = {
            id: `k-${suggestionId}`,
            businessId,
            section: "alias",
            title: sug.title,
            body: sug.proposal,
            class: sug.class,
            state: "Active",
            source: { kind: "user", label: "Approved learning suggestion" },
            version: "learn-v1",
          };
          return {
            ...b,
            learningSuggestions: b.learningSuggestions.map((x) =>
              x.id === suggestionId ? { ...x, status: "accepted" as const } : x,
            ),
            knowledge: [item, ...b.knowledge],
          };
        });
        const business = businesses.find((b) => b.id === businessId);
        if (!business) {
          set({ businesses });
          return;
        }
        const applied = applyBrainToOpenEnquiries(business, s.enquiries);
        const lastChangeAt = { ...s.lastChangeAt };
        const drafts = { ...s.drafts };
        for (const id of applied.affectedIds) {
          lastChangeAt[id] = Date.now();
          const enquiry = applied.enquiries.find((e) => e.id === id);
          if (enquiry) drafts[id] = enquiry.decision.draft.body;
        }
        set({ businesses, enquiries: applied.enquiries, lastChangeAt, drafts });
      },
      dismissLearning: (businessId, suggestionId) =>
        set((s) => ({
          businesses: s.businesses.map((b) =>
            b.id === businessId
              ? {
                  ...b,
                  learningSuggestions: b.learningSuggestions.map((x) =>
                    x.id === suggestionId ? { ...x, status: "dismissed" } : x,
                  ),
                }
              : b,
          ),
        })),
      confirmKnowledge: (businessId, itemId) => {
        const s = get();
        const businesses = s.businesses.map((b) =>
          b.id === businessId
            ? {
                ...b,
                knowledge: b.knowledge.map((k) =>
                  k.id === itemId ? { ...k, state: "Active" as const } : k,
                ),
              }
            : b,
        );
        const business = businesses.find((b) => b.id === businessId);
        if (!business) {
          set({ businesses });
          return;
        }
        const applied = applyBrainToOpenEnquiries(business, s.enquiries);
        const lastChangeAt = { ...s.lastChangeAt };
        const drafts = { ...s.drafts };
        for (const id of applied.affectedIds) {
          lastChangeAt[id] = Date.now();
          const enquiry = applied.enquiries.find((e) => e.id === id);
          if (enquiry) drafts[id] = enquiry.decision.draft.body;
        }
        set({ businesses, enquiries: applied.enquiries, lastChangeAt, drafts });
      },
      resolveConflict: (businessId, keepId, dropId) => {
        const s = get();
        const businesses = s.businesses.map((b) =>
          b.id === businessId
            ? {
                ...b,
                knowledge: b.knowledge.map((k) => {
                  if (k.id === keepId) {
                    return { ...k, state: "Active" as const, conflictWith: undefined };
                  }
                  if (k.id === dropId) {
                    return { ...k, state: "Superseded" as const, conflictWith: undefined };
                  }
                  return k;
                }),
              }
            : b,
        );
        const business = businesses.find((b) => b.id === businessId);
        if (!business) {
          set({ businesses });
          return;
        }
        const applied = applyBrainToOpenEnquiries(business, s.enquiries);
        const lastChangeAt = { ...s.lastChangeAt };
        const drafts = { ...s.drafts };
        for (const id of applied.affectedIds) {
          lastChangeAt[id] = Date.now();
          const enquiry = applied.enquiries.find((e) => e.id === id);
          if (enquiry) drafts[id] = enquiry.decision.draft.body;
        }
        set({ businesses, enquiries: applied.enquiries, lastChangeAt, drafts });
      },
      tellEnquiry: (businessId, input) => {
        const business = get().businesses.find((b) => b.id === businessId);
        if (!business) return;
        const preview = compileBrainChange(business, input, get().enquiries);
        if (!preview) return;
        set({ brainPreview: preview });
      },
      confirmBrainChange: () => {
        const preview = get().brainPreview;
        if (!preview) return;
        const s = get();
        const businesses = s.businesses.map((b) =>
          b.id === preview.businessId
            ? { ...b, knowledge: knowledgeAfterPreview(b.knowledge, preview, preview.businessId) }
            : b,
        );
        const business = businesses.find((b) => b.id === preview.businessId);
        if (!business) {
          set({ brainPreview: null, businesses });
          return;
        }
        const applied = applyBrainToOpenEnquiries(business, s.enquiries);
        const lastChangeAt = { ...s.lastChangeAt };
        const drafts = { ...s.drafts };
        for (const id of applied.affectedIds) {
          lastChangeAt[id] = Date.now();
          const enquiry = applied.enquiries.find((e) => e.id === id);
          if (enquiry) drafts[id] = enquiry.decision.draft.body;
        }
        set({
          brainPreview: null,
          businesses,
          enquiries: applied.enquiries,
          lastChangeAt,
          drafts,
        });
      },
      cancelBrainChange: () => set({ brainPreview: null }),
      setVoice: (businessId, patch) => {
        const s = get();
        const businesses = s.businesses.map((b) =>
          b.id === businessId
            ? { ...b, voice: { ...b.voice, ...patch, version: `v${Date.now()}` } }
            : b,
        );
        const voice = businesses.find((b) => b.id === businessId)?.voice;
        if (!voice) {
          set({ businesses });
          return;
        }
        const lastChangeAt = { ...s.lastChangeAt };
        const drafts = { ...s.drafts };
        const enquiries = s.enquiries.map((enquiry) => {
          if (enquiry.businessId !== businessId) return enquiry;
          if (enquiry.state.lifecycle !== "OPEN") return enquiry;
          const current = drafts[enquiry.id] ?? enquiry.decision.draft.body;
          const firstName = enquiry.customerName.split(" ")[0] ?? enquiry.customerName;
          const body = applyVoiceToDraft(current, voice, firstName);
          if (body === current) return enquiry;
          lastChangeAt[enquiry.id] = Date.now();
          drafts[enquiry.id] = body;
          const next = structuredClone(enquiry);
          next.decision.draft = { ...next.decision.draft, body, voiceVersion: voice.version };
          next.decision.changeDiff = [
            { factLabel: "Voice", from: "Previous greeting and sign-off", to: "Updated for this business" },
          ];
          return next;
        });
        set({ businesses, enquiries, drafts, lastChangeAt });
      },
      setTrustMode: (businessId, mode) =>
        set((s) => ({
          businesses: s.businesses.map((b) => (b.id === businessId ? { ...b, trustMode: mode } : b)),
        })),
      setActionPolicy: (businessId, action, mode) => {
        set((s) => ({
          businesses: s.businesses.map((b) =>
            b.id === businessId
              ? {
                  ...b,
                  actionPolicies: b.actionPolicies.map((p) =>
                    p.action === action ? { ...p, mode } : p,
                  ),
                }
              : b,
          ),
          audit: appendAudit(s.audit, {
            actor: s.businesses.find((b) => b.id === businessId)?.ownerName ?? "You",
            summary: `${action.replaceAll("_", " ")} set to ${mode}`,
            objectType: "trust",
            objectId: businessId,
          }),
        }));
        if (mode === "Automatic when safe") get().runAutopilot(businessId, action);
      },
      pause: (businessId, level) =>
        set((s) => ({
          businesses: s.businesses.map((b) =>
            b.id === businessId ? { ...b, paused: true, pauseLevel: level } : b,
          ),
        })),
      resume: (businessId) =>
        set((s) => ({
          businesses: s.businesses.map((b) =>
            b.id === businessId ? { ...b, paused: false, pauseLevel: "none" } : b,
          ),
        })),
      reconnect: (enquiryId) => {
        const s = get();
        const enquiry = s.enquiries.find((e) => e.id === enquiryId);
        if (!enquiry) return;
        get().track(enquiry.fixtureId, "reconnect");
        const next = reconnectCalendar(enquiry);
        set({
          enquiries: bump(s.enquiries, next),
          drafts: { ...s.drafts, [enquiryId]: next.decision.draft.body },
          lastChangeAt: { ...s.lastChangeAt, [enquiryId]: Date.now() },
          businesses: s.businesses.map((b) =>
            b.id === enquiry.businessId
              ? {
                  ...b,
                  integrations: b.integrations.map((i) =>
                    i.kind === "calendar"
                      ? { ...i, status: "connected", lastSuccessAt: new Date().toISOString() }
                      : i,
                  ),
                }
              : b,
          ),
        });
      },
      continueWithoutAvailability: (enquiryId) => {
        const s = get();
        const enquiry = s.enquiries.find((e) => e.id === enquiryId);
        if (!enquiry) return;
        get().track(enquiry.fixtureId, "continue_without_availability");
        const next = structuredClone(enquiry);
        next.decision.draft.body =
          "Hi Ibrahim,\n\nHall and living is $1,680 including prep and two coats.\n\nI can't confirm the week of 7 September until the job diary is back online, so I won't hold a date yet. I'll write as soon as I can check.\n\nTom\nRidge & Co";
        next.decision.recommendation = {
          ...next.decision.recommendation,
          action: "ACKNOWLEDGE",
          label: "Send without claiming availability",
          primaryEnabled: true,
          blockedReason: undefined,
        };
        set({
          enquiries: bump(s.enquiries, next),
          drafts: { ...s.drafts, [enquiryId]: next.decision.draft.body },
        });
      },
      resolvePrice: (enquiryId, amount) => {
        const s = get();
        const enquiry = s.enquiries.find((e) => e.id === enquiryId);
        if (!enquiry) return;
        get().track(enquiry.fixtureId, "resolve_price");
        const next = resolveFamilyPrice(enquiry, amount);
        set({
          enquiries: bump(s.enquiries, next),
          drafts: { ...s.drafts, [enquiryId]: next.decision.draft.body },
          lastChangeAt: { ...s.lastChangeAt, [enquiryId]: Date.now() },
          businesses: s.businesses.map((b) =>
            b.id === "northlight"
              ? {
                  ...b,
                  knowledge: b.knowledge.map((k) => {
                    if (k.id === "nl-family-list" && amount === 520) {
                      return { ...k, state: "Active", conflictWith: undefined };
                    }
                    if (k.id === "nl-family-web" && amount === 520) {
                      return { ...k, state: "Superseded", conflictWith: undefined };
                    }
                    if (k.id === "nl-family-web" && amount === 450) {
                      return { ...k, state: "Active", conflictWith: undefined };
                    }
                    if (k.id === "nl-family-list" && amount === 450) {
                      return { ...k, state: "Superseded", conflictWith: undefined };
                    }
                    return k;
                  }),
                }
              : b,
          ),
        });
      },
      resolveDuplicate: (enquiryId, mode) => {
        const s = get();
        const enquiry = s.enquiries.find((e) => e.id === enquiryId);
        if (!enquiry) return;
        get().track(enquiry.fixtureId, `duplicate_${mode}`);
        if (mode === "merge" && enquiry.duplicateOf) {
          const original = s.enquiries.find((e) => e.id === enquiry.duplicateOf);
          const attached = original
            ? {
                ...original,
                conversation: [...original.conversation, ...enquiry.conversation],
                updatedAt: new Date().toISOString(),
                decision: {
                  ...original.decision,
                  changeDiff: [
                    {
                      factLabel: "Related message",
                      from: "One email",
                      to: "Resend attached — same job",
                    },
                  ],
                },
              }
            : null;
          set({
            enquiries: s.enquiries
              .filter((e) => e.id !== enquiryId)
              .map((e) => (attached && e.id === attached.id ? attached : e)),
            duplicate: null,
            lastMerge: {
              fromId: enquiryId,
              toId: enquiry.duplicateOf,
              toName: original?.customerName ?? "the existing enquiry",
            },
            lastChangeAt: original
              ? { ...s.lastChangeAt, [original.id]: Date.now() }
              : s.lastChangeAt,
          });
          return;
        }
        const next = structuredClone(enquiry);
        next.duplicateOf = undefined;
        next.state.decision = "ACTION_READY";
        next.serviceLabel = "Deep clean — separate job";
        next.decision.recommendation = {
          ...next.decision.recommendation,
          action: "SEND_QUOTE",
          label: "Send quote",
          reason: "Treated as a separate job. Quote the deep clean on its own.",
          primaryEnabled: true,
          blockedReason: undefined,
        };
        set({ enquiries: bump(s.enquiries, next), duplicate: null, lastMerge: null });
      },
      markLost: (enquiryId) => {
        const s = get();
        const enquiry = s.enquiries.find((e) => e.id === enquiryId);
        if (!enquiry) return;
        const next = structuredClone(enquiry);
        next.state = {
          lifecycle: "LOST",
          decision: "NONE",
          commercial: next.state.commercial,
          responsibility: "NONE",
        };
        next.atRisk = false;
        next.followUpDue = false;
        next.snoozedUntil = undefined;
        set({
          enquiries: bump(s.enquiries, next),
          undo: snapshotOf(s),
          audit: appendAudit(s.audit, {
            actor: "You",
            summary: auditSummary("mark_lost", enquiry.fixtureId),
            objectType: "enquiry",
            objectId: enquiryId,
          }),
        });
      },
      decline: (enquiryId, _reason) => {
        get().declineLetter(enquiryId);
      },
      acceptQuote: (enquiryId, opts) => {
        const s = get();
        const enquiry = s.enquiries.find((e) => e.id === enquiryId);
        if (!enquiry) return;
        const business = s.businesses.find((b) => b.id === enquiry.businessId);
        get().track(enquiry.fixtureId, "accept_quote");
        const next = structuredClone(enquiry);
        const inbound = opts?.fromReply
          ? []
          : [
              {
                id: `${enquiryId}-in-accept-${Date.now()}`,
                direction: "inbound" as const,
                channel: replyChannel(enquiry),
                at: new Date().toISOString(),
                from: enquiry.customerHandle || enquiry.customerName,
                to: business?.ownerName ?? "you",
                subject: isShortChannel(replyChannel(enquiry)) ? undefined : enquiry.decision.draft.subject,
                body: isShortChannel(replyChannel(enquiry))
                  ? "Yes that works. Please lock it in."
                  : "Yes — that works. Please lock it in.",
              },
            ];
        next.conversation = [...next.conversation, ...inbound];
        if (!opts?.fromReply) {
          next.conversation.push({
            id: `${enquiryId}-out-booked-${Date.now()}`,
            direction: "outbound",
            channel: replyChannel(enquiry),
            at: new Date().toISOString(),
            from: business?.ownerName ?? "You",
            to: replyTo(enquiry),
            subject: isShortChannel(replyChannel(enquiry)) ? undefined : enquiry.decision.draft.subject,
            body: isShortChannel(replyChannel(enquiry))
              ? `You're booked. I'll write with the start details.`
              : `Hi ${enquiry.customerName.split(" ")[0] ?? enquiry.customerName},\n\nYou're booked. I'll write separately with the start details.\n\n${business?.ownerFirstName ?? ""}`,
            quoted: true,
            quoteId: enquiry.decision.quotes.find((q) => q.status === "sent" || q.status === "draft")?.id,
          });
        }
        next.state = {
          lifecycle: "BOOKED",
          decision: "NONE",
          commercial: "ACCEPTED",
          responsibility: "NONE",
        };
        next.followUpDue = false;
        next.atRisk = false;
        next.decision.quotes = next.decision.quotes.map((q) =>
          q.status === "sent" || q.status === "draft" ? { ...q, status: "accepted" as const } : q,
        );
        const accepted = next.decision.quotes.find((q) => q.status === "accepted");
        const hold = accepted?.hold ?? defaultHold(accepted?.total?.amount);
        const draft = bookingDraftFromEnquiry(next, business);
        const booking = {
          id: `b-${enquiryId}`,
          enquiryId,
          businessId: enquiry.businessId,
          customerName: enquiry.customerName,
          serviceLabel: enquiry.serviceLabel,
          when: draft.when,
          durationMinutes: draft.durationMinutes,
          location: draft.location,
          value: accepted?.total ?? enquiry.valueExact,
          status: hold ? ("pending" as const) : ("confirmed" as const),
          depositPaid: false,
        };
        set({
          enquiries: bump(s.enquiries, next),
          bookings: [booking, ...s.bookings.filter((b) => b.enquiryId !== enquiryId)],
          undo: snapshotOf(s),
          audit: appendAudit(s.audit, {
            actor: enquiry.customerName,
            summary: auditSummary("accept_quote", enquiry.fixtureId),
            objectType: "booking",
            objectId: booking.id,
          }),
        });
      },
      receiveClientReply: (enquiryId, body) => {
        const s = get();
        const enquiry = s.enquiries.find((e) => e.id === enquiryId);
        if (!enquiry) return;
        if (enquiry.state.decision !== "WAITING_ON_CLIENT") return;
        const business = s.businesses.find((b) => b.id === enquiry.businessId);
        const text = (body ?? DEMO_ACCEPT_REPLY).trim();
        const intent = detectClientIntent(text);
        if (intent === "question") {
          get().recordClientQuestion(enquiryId, text);
          toast("They asked a question. The sent sheet stays on file.");
          return;
        }
        const inbound = {
          id: `${enquiryId}-in-reply-${Date.now()}`,
          direction: "inbound" as const,
          channel: replyChannel(enquiry),
          at: new Date().toISOString(),
          from: enquiry.customerHandle || enquiry.customerName,
          to: business?.ownerName ?? "you",
          subject: isShortChannel(replyChannel(enquiry)) ? undefined : enquiry.decision.draft.subject,
          body: text,
        };
        const withReply = structuredClone(enquiry);
        withReply.conversation = [...withReply.conversation, inbound];
        set({
          enquiries: bump(s.enquiries, withReply),
          lastChangeAt: { ...s.lastChangeAt, [enquiryId]: Date.now() },
        });
        if (intent === "accept") {
          get().acceptQuote(enquiryId, { fromReply: true });
          toast("Booked.");
        }
      },
      recordClientQuestion: (enquiryId, body) => {
        const s = get();
        const enquiry = s.enquiries.find((e) => e.id === enquiryId);
        if (!enquiry) return;
        const business = s.businesses.find((b) => b.id === enquiry.businessId);
        get().track(enquiry.fixtureId, "client_question");
        const next = structuredClone(enquiry);
        const firstName = enquiry.customerName.split(" ")[0] ?? enquiry.customerName;
        const question = body?.trim()
          ? body.trim().slice(0, 2000)
          : isShortChannel(replyChannel(enquiry))
            ? "Could we move the date? Does the price still hold?"
            : "Could we move the date? Let me know if the price still holds.";
        next.conversation = [
          ...next.conversation,
          {
            id: `${enquiryId}-in-q-${Date.now()}`,
            direction: "inbound",
            channel: replyChannel(enquiry),
            at: new Date().toISOString(),
            from: enquiry.customerHandle || enquiry.customerPhone || enquiry.customerName,
            to: business?.ownerName ?? "you",
            subject: isShortChannel(replyChannel(enquiry)) ? undefined : enquiry.decision.draft.subject,
            body: question,
          },
        ];
        next.state.decision = "NEEDS_HUMAN";
        next.state.responsibility = "BUSINESS";
        next.followUpDue = false;
        next.atRisk = false;
        next.decision.recommendation = {
          ...next.decision.recommendation,
          action: "REQUEST_INFORMATION",
          label: "Reply",
          reason: "They asked a new question. The sent quote stays on file — do not rewrite it.",
          primaryEnabled: true,
          reasonCodes: ["REQUEST_INFORMATION"],
        };
        const reply = `Hi ${firstName},\n\nHappy to look at a different date. The quote already sent stays as written until we re-price if the work changes.\n\n${business?.ownerFirstName ?? ""}`;
        next.decision.draft = {
          ...next.decision.draft,
          action: "REQUEST_INFORMATION",
          body: reply,
        };
        set({
          enquiries: bump(s.enquiries, next),
          drafts: { ...s.drafts, [enquiryId]: reply },
          lastChangeAt: { ...s.lastChangeAt, [enquiryId]: Date.now() },
        });
      },
      confirmExternalBooking: (enquiryId) => {
        const s = get();
        const enquiry = s.enquiries.find((e) => e.id === enquiryId);
        if (!enquiry) return;
        const next = structuredClone(enquiry);
        next.state = {
          lifecycle: "BOOKED",
          decision: "NONE",
          commercial: "ACCEPTED",
          responsibility: "NONE",
        };
        set({
          enquiries: bump(s.enquiries, next),
          bookings: s.bookings.map((b) =>
            b.enquiryId === enquiryId ? { ...b, status: "confirmed" } : b,
          ),
        });
      },
      setOfflineSimulated: (v) =>
        set((s) => ({
          offlineSimulated: v,
          offline: v || s.networkOffline,
        })),
      setNetworkOffline: (v) =>
        set((s) => ({
          networkOffline: v,
          offline: s.offlineSimulated || v,
        })),
      arriveEnquiry: () => {
        const s = get();
        const seq = s.liveSeq + 1;
        const id = `live-${seq}`;
        const enquiry = arrivingEnquiry(id);
        if (arriveTimer) clearTimeout(arriveTimer);
        set({
          liveSeq: seq,
          lastArrivalId: id,
          arrivalPlayed: true,
          enquiries: [enquiry, ...s.enquiries.filter((e) => e.fixtureId !== "LIVE" || e.state.decision !== "EVALUATING")],
          drafts: { ...s.drafts, [id]: "" },
        });
        get().track("LIVE", "arrive");
        arriveTimer = setTimeout(() => {
          const current = get().enquiries.find((e) => e.id === id);
          if (!current || current.state.decision !== "EVALUATING") return;
          const resolved = resolveArriving(current);
          set({
            enquiries: bump(get().enquiries, resolved),
            drafts: { ...get().drafts, [id]: resolved.decision.draft.body },
            lastChangeAt: { ...get().lastChangeAt, [id]: Date.now() },
          });
        }, 2800);
        return id;
      },
      markArrivalSeen: () => set({ lastArrivalId: null }),
      reconnectBusiness: (businessId) => {
        const s = get();
        const targets = s.enquiries.filter(
          (e) =>
            e.businessId === businessId &&
            e.decision.evaluators.some(
              (ev) =>
                (ev.type === "capacity" || ev.type === "availability") &&
                ev.status === "UNKNOWN_INTEGRATION",
            ),
        );
        let enquiries = s.enquiries;
        const drafts = { ...s.drafts };
        const lastChangeAt = { ...s.lastChangeAt };
        for (const enquiry of targets) {
          const next = reconnectCalendar(enquiry);
          enquiries = bump(enquiries, next);
          drafts[enquiry.id] = next.decision.draft.body;
          lastChangeAt[enquiry.id] = Date.now();
        }
        set({
          enquiries,
          drafts,
          lastChangeAt,
          businesses: s.businesses.map((b) =>
            b.id === businessId
              ? {
                  ...b,
                  integrations: b.integrations.map((i) =>
                    i.kind === "calendar"
                      ? { ...i, status: "connected", lastSuccessAt: new Date().toISOString() }
                      : i,
                  ),
                }
              : b,
          ),
        });
        get().track("F10", "reconnect_business");
      },
      undoLast: () => {
        const undo = get().undo;
        if (!undo) return;
        set({
          enquiries: undo.enquiries,
          bookings: undo.bookings,
          businesses: undo.businesses,
          drafts: undo.drafts,
          confirmSent: undo.confirmSent,
          undo: null,
        });
      },
      releaseFollowUp: (enquiryId) => {
        const s = get();
        const enquiry = s.enquiries.find((e) => e.id === enquiryId);
        if (!enquiry) return;
        const next = buildFollowUp(enquiry);
        set({
          enquiries: bump(s.enquiries, next),
          drafts: { ...s.drafts, [enquiryId]: next.decision.draft.body },
          lastChangeAt: { ...s.lastChangeAt, [enquiryId]: Date.now() },
          undo: snapshotOf(s),
          audit: appendAudit(s.audit, {
            actor: "You",
            summary: auditSummary("follow_up_due", enquiry.fixtureId),
            objectType: "enquiry",
            objectId: enquiryId,
          }),
        });
        get().track(enquiry.fixtureId, "follow_up_due");
      },
      proposeRevision: (enquiryId) => {
        const s = get();
        const enquiry = s.enquiries.find((e) => e.id === enquiryId);
        if (!enquiry) return;
        const next = buildRevision(enquiry);
        set({
          enquiries: bump(s.enquiries, next),
          drafts: { ...s.drafts, [enquiryId]: next.decision.draft.body },
          lastChangeAt: { ...s.lastChangeAt, [enquiryId]: Date.now() },
          undo: snapshotOf(s),
          audit: appendAudit(s.audit, {
            actor: "You",
            summary: auditSummary("propose_revision", enquiry.fixtureId),
            objectType: "enquiry",
            objectId: enquiryId,
          }),
        });
        get().track(enquiry.fixtureId, "propose_revision");
      },
      snooze: (enquiryId) => {
        const s = get();
        const enquiry = s.enquiries.find((e) => e.id === enquiryId);
        if (!enquiry) return;
        const next = buildSnooze(enquiry, daysFromNow(2));
        set({
          enquiries: bump(s.enquiries, next),
          undo: snapshotOf(s),
          audit: appendAudit(s.audit, {
            actor: "You",
            summary: auditSummary("snooze", enquiry.fixtureId),
            objectType: "enquiry",
            objectId: enquiryId,
          }),
        });
        get().track(enquiry.fixtureId, "snooze");
      },
      setNote: (enquiryId, note) => {
        const s = get();
        const enquiry = s.enquiries.find((e) => e.id === enquiryId);
        if (!enquiry) return;
        const next = structuredClone(enquiry);
        next.notes = note;
        set({
          enquiries: bump(s.enquiries, next),
          audit: appendAudit(s.audit, {
            actor: "You",
            summary: auditSummary("note", enquiry.fixtureId),
            objectType: "enquiry",
            objectId: enquiryId,
          }),
        });
      },
      declineLetter: (enquiryId) => {
        const s = get();
        const enquiry = s.enquiries.find((e) => e.id === enquiryId);
        if (!enquiry) return;
        const business = s.businesses.find((b) => b.id === enquiry.businessId);
        const body = s.drafts[enquiryId]?.trim()
          ? s.drafts[enquiryId]
          : defaultDeclineBody(enquiry, business?.ownerFirstName ?? "");
        const next = declineWithLetter(enquiry, {
          body,
          from: business?.ownerName ?? "You",
          to: replyTo(enquiry),
        });
        set({
          enquiries: bump(s.enquiries, next),
          undo: snapshotOf(s),
          audit: appendAudit(s.audit, {
            actor: business?.ownerName ?? "You",
            summary: auditSummary("decline", enquiry.fixtureId),
            objectType: "enquiry",
            objectId: enquiryId,
          }),
        });
        get().track(enquiry.fixtureId, "decline");
      },
      setPrefs: (patch) => set((s) => ({ prefs: { ...s.prefs, ...patch } })),
      connectIntegration: (businessId, integrationId) => {
        const s = get();
        set({
          businesses: s.businesses.map((b) =>
            b.id === businessId
              ? {
                  ...b,
                  integrations: b.integrations.map((i) =>
                    i.id === integrationId || i.kind === integrationId
                      ? { ...i, status: "connected", lastSuccessAt: new Date().toISOString() }
                      : i,
                  ),
                }
              : b,
          ),
          audit: appendAudit(s.audit, {
            actor: "You",
            summary: `${integrationId} connected`,
            objectType: "integration",
            objectId: businessId,
          }),
        });
        if (integrationId === "calendar") get().reconnectBusiness(businessId);
      },
      disconnectIntegration: (businessId, integrationId) => {
        const s = get();
        set({
          businesses: s.businesses.map((b) =>
            b.id === businessId
              ? {
                  ...b,
                  integrations: b.integrations.map((i) =>
                    i.id === integrationId || i.kind === integrationId
                      ? { ...i, status: "not_connected", lastSuccessAt: undefined }
                      : i,
                  ),
                }
              : b,
          ),
          audit: appendAudit(s.audit, {
            actor: "You",
            summary: `${integrationId} disconnected. Enquiry kept the case files already open.`,
            objectType: "integration",
            objectId: businessId,
          }),
        });
      },
      inviteToDm: (enquiryId) => {
        const s = get();
        const enquiry = s.enquiries.find((e) => e.id === enquiryId);
        if (!enquiry) return;
        const business = s.businesses.find((b) => b.id === enquiry.businessId);
        const next = structuredClone(enquiry);
        const dest = enquiry.commentOn === "facebook" ? "facebook" : "instagram";
        next.source = dest;
        next.conversation = [
          ...next.conversation,
          {
            id: `${enquiryId}-out-invite-${Date.now()}`,
            direction: "outbound",
            channel: "comment",
            at: new Date().toISOString(),
            from: business?.ownerName ?? "You",
            to: enquiry.customerHandle || enquiry.customerName,
            body:
              s.drafts[enquiryId]?.trim() ||
              "Message us and we’ll send a proper quote — we don’t price in comments.",
            commentContext: enquiry.conversation[0]?.commentContext,
          },
        ];
        next.state.decision = "WAITING_ON_CLIENT";
        next.state.responsibility = "CUSTOMER";
        next.decision.recommendation = {
          ...next.decision.recommendation,
          action: "WAIT",
          label: "Waiting for a message",
          reason: "The comment reply is not a quote. The engine runs when they write in private.",
          primaryEnabled: false,
          blockedReason: "Waiting on a DM. Silence here is not a decline.",
        };
        set({
          enquiries: bump(s.enquiries, next),
          undo: snapshotOf(s),
          audit: appendAudit(s.audit, {
            actor: "You",
            summary: `Invited ${enquiry.customerName} to message privately`,
            objectType: "enquiry",
            objectId: enquiryId,
          }),
        });
        get().track(enquiry.fixtureId, "invite_dm");
      },
      runAutopilot: (businessId, action) => {
        const s = get();
        const business = s.businesses.find((b) => b.id === businessId);
        if (!business) return;
        const hits = s.enquiries.filter(
          (e) =>
            e.businessId === businessId &&
            autopilotEligible(e, business, action) &&
            !outboundBlocked(business, s.offline, e),
        );
        for (const enquiry of hits) {
          get().approve(enquiry.id, { automated: true });
        }
      },
      recordDeposit: (bookingId) =>
        set((s) => ({
          bookings: s.bookings.map((b) => (b.id === bookingId ? { ...b, depositPaid: true, status: "confirmed" } : b)),
        })),
      rescheduleBooking: (bookingId, when, durationMinutes) => {
        const s = get();
        const current = s.bookings.find((b) => b.id === bookingId);
        if (!current || current.status === "cancelled") return;
        set({
          undo: snapshotOf(s),
          bookings: s.bookings.map((b) =>
            b.id === bookingId
              ? {
                  ...b,
                  when,
                  durationMinutes: durationMinutes ?? b.durationMinutes,
                }
              : b,
          ),
          audit: appendAudit(s.audit, {
            actor: "You",
            summary: auditSummary("reschedule", current.enquiryId),
            objectType: "booking",
            objectId: bookingId,
          }),
        });
      },
      cancelBooking: (bookingId) => {
        const s = get();
        const current = s.bookings.find((b) => b.id === bookingId);
        if (!current || current.status === "cancelled") return;
        set({
          undo: snapshotOf(s),
          bookings: s.bookings.map((b) => (b.id === bookingId ? { ...b, status: "cancelled" as const } : b)),
          audit: appendAudit(s.audit, {
            actor: "You",
            summary: auditSummary("cancel_booking", current.enquiryId),
            objectType: "booking",
            objectId: bookingId,
          }),
        });
      },
      dismissNotice: (id) =>
        set((s) => ({
          dismissedNotices: s.dismissedNotices.includes(id)
            ? s.dismissedNotices
            : [...s.dismissedNotices, id],
        })),
      dismissInstall: () => set({ installDismissed: true }),
      tickFollowUps: () => {
        const s = get();
        let changed = false;
        const next = s.enquiries.map((enquiry) => {
          if (!shouldReleaseFollowUp(enquiry, s.prefs)) return enquiry;
          changed = true;
          return buildFollowUp(enquiry);
        });
        if (changed) set({ enquiries: next });
      },
    }),
    {
      name: "enquiry-proto-v9",
      storage: createJSONStorage(() => {
        const memory = {
          getItem: () => null,
          setItem: () => {},
          removeItem: () => {},
        };
        if (typeof window === "undefined") return memory;
        try {
          if (window.self !== window.top) return memory;
        } catch {
          return memory;
        }
        return sessionStorage;
      }),
      partialize: (s) => ({
        onboarded: s.onboarded,
        demoMode: s.demoMode,
        onboardingStep: s.onboardingStep,
        onboardingSource: s.onboardingSource,
        businesses: s.businesses,
        enquiries: s.enquiries,
        bookings: s.bookings,
        businessFilter: s.businessFilter,
        queueFilter: s.queueFilter,
        brainTab: s.brainTab,
        drafts: s.drafts,
        lastChangeAt: s.lastChangeAt,
        firstHint: s.firstHint,
        confirmSent: s.confirmSent,
        offlineSimulated: s.offlineSimulated,
        lastArrivalId: s.lastArrivalId,
        arrivalPlayed: s.arrivalPlayed,
        liveSeq: s.liveSeq,
        prefs: s.prefs,
        audit: s.audit,
        lastAutomated: s.lastAutomated,
        dismissedNotices: s.dismissedNotices,
        installDismissed: s.installDismissed,
      }),
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<PrototypeState>;
        return {
          ...current,
          ...p,
          enquiries: Array.isArray(p.enquiries) ? p.enquiries : current.enquiries,
          bookings: Array.isArray(p.bookings) ? p.bookings : current.bookings,
          businesses: Array.isArray(p.businesses) ? p.businesses : current.businesses,
          drafts: p.drafts && typeof p.drafts === "object" ? p.drafts : current.drafts,
          prefs: { ...current.prefs, ...(p.prefs && typeof p.prefs === "object" ? p.prefs : {}) },
          audit: Array.isArray(p.audit) ? p.audit : current.audit,
          dismissedNotices: Array.isArray(p.dismissedNotices)
            ? p.dismissedNotices
            : current.dismissedNotices,
        };
      },
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        const pending = state.enquiries.find(
          (e) => e.fixtureId === "LIVE" && e.state.decision === "EVALUATING",
        );
        if (!pending) return;
        if (arriveTimer) clearTimeout(arriveTimer);
        arriveTimer = setTimeout(() => {
          const current = usePrototype.getState().enquiries.find((e) => e.id === pending.id);
          if (!current || current.state.decision !== "EVALUATING") return;
          const resolved = resolveArriving(current);
          usePrototype.setState({
            enquiries: bump(usePrototype.getState().enquiries, resolved),
            drafts: { ...usePrototype.getState().drafts, [pending.id]: resolved.decision.draft.body },
            lastChangeAt: { ...usePrototype.getState().lastChangeAt, [pending.id]: Date.now() },
          });
        }, 1200);
      },
    },
  ),
);

export function useBusiness(id?: string): Business | undefined {
  return usePrototype((s) => {
    const fid = id ?? (s.businessFilter === "all" ? undefined : s.businessFilter);
    if (fid) return s.businesses.find((b) => b.id === fid);
    return s.businesses[0];
  });
}
