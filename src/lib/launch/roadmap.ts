export type RoadmapStatus = "now" | "next" | "later" | "exploring";

export type RoadmapStage = {
  id: string;
  title: string;
  summary: string;
  status: RoadmapStatus;
  details: string[];
  boundary: string;
};

export const ROADMAP_WRITTEN = "15 September 2026";
export const ROADMAP_LEGEND: { id: RoadmapStatus; label: string; hint: string; purpose: string }[] =
  [
    { id: "now", label: "Now", hint: "Current product", purpose: "A clearer next step, today." },
    {
      id: "next",
      label: "Next",
      hint: "Priority direction",
      purpose: "Less catching up. More staying current.",
    },
    {
      id: "later",
      label: "Later",
      hint: "Planned direction",
      purpose: "Less chasing. More moving forward.",
    },
    {
      id: "exploring",
      label: "Exploring",
      hint: "Not yet committed",
      purpose: "More room for the work you love.",
    },
  ];

// Existing IDs retain their meaning so saved interest and old links are not lost.
export const STAGES: RoadmapStage[] = [
  {
    id: "understand",
    status: "now",
    title: "Know what needs you",
    summary: "Focus on the enquiries that need a decision. Let the rest stay quiet.",
    details: [
      "Today brings enquiries needing attention together with booking context.",
      "Open an enquiry to see the customer conversation and a prepared next step, with the evidence available when you need it.",
    ],
    boundary:
      "Early access is invitation-only. The public demo uses sample enquiries, not live customer data.",
  },
  {
    id: "business-brain",
    status: "now",
    title: "Reply with context",
    summary: "Your services, your rules, your voice. A prepared reply, with you in control.",
    details: [
      "Business settings hold your services, policies, working preferences and voice. Pricing and availability matter only where they apply; not every enquiry is a quote.",
      "Material unknowns stay visible. You can inspect why a reply was prepared before deciding what to do.",
    ],
    boundary:
      "Prepared is not sent. You review and send externally; copying or recording a reply does not deliver it.",
  },
  {
    id: "clear-outcomes",
    status: "now",
    title: "Keep the outcome clear",
    summary: "See what is waiting, what moved forward and what became booked or lost.",
    details: [
      "Enquiries and Booked keep the conversation and its recorded outcome in view.",
      "Insights summarise supported enquiry and booking records, without invented revenue or time-saved figures.",
    ],
    boundary:
      "A reply is not a confirmed booking. Outcomes depend on what has actually been recorded.",
  },
  {
    id: "continuity",
    status: "next",
    title: "One enquiry, wherever it starts",
    summary: "Connected conversations. One coherent request, even when the channel changes.",
    details: [
      "Progressively connect supported email, forms, text and social channels to the same enquiry.",
      "When a customer changes the scope or date elsewhere, the proposed next step should reflect that change, not just collect another message.",
    ],
    boundary:
      "Connections are planned, not all live. Uncertain identities remain proposed matches for review, never silent merges.",
  },
  {
    id: "native-apps",
    status: "later",
    title: "Enquiry in your pocket",
    summary: "Planned native iPhone and Android apps. A quick check between everything else.",
    details: [
      "Review enquiries, prepare replies and see booking updates on the move, with focused notifications.",
      "Native apps are intended for the Apple App Store and Google Play. Availability will be announced after development and store approval.",
    ],
    boundary:
      "Planned, not yet available. The illustration is a concept, not a native-app screenshot or store listing.",
  },
  {
    id: "catch-up",
    status: "next",
    title: "Catch me up",
    summary: "Only what changed while you were busy. Pick up without rereading everything.",
    details: [
      "A short return-to-work briefing: changed requests, replies received and decisions that now need you.",
      "Go straight from a meaningful change to the conversation and proposed next action, with the original evidence one step away.",
    ],
    boundary:
      "Planned beyond the current Today view. Changes must come from recorded evidence, not guessed activity.",
  },
  {
    id: "keep-moving",
    status: "later",
    title: "Follow-up that remembers",
    summary: "The right enquiry returns at the right moment, with the context ready.",
    details: [
      "Bring back enquiries where a response is genuinely due, with a relevant follow-up prepared.",
      "Remember the last agreement and changed circumstances, including when not to chase.",
    ],
    boundary:
      "Planned follow-up assistance. Silence is not a decline, and a prepared follow-up is not permission to send.",
  },
  {
    id: "booking-path",
    status: "later",
    title: "From yes to booked",
    summary: "Fewer steps between agreement and a confirmed booking.",
    details: [
      "Help customers resolve the remaining details through a focused confirmation path.",
      "Connect supported availability and booking steps when the business has authorised them, while keeping the agreed scope intact.",
    ],
    boundary:
      "Planned. Calendar connections and customer self-booking are not being claimed as live; unknown availability stays unconfirmed.",
  },
  {
    id: "trusted-action",
    status: "later",
    title: "Routine actions you allow",
    summary: "Permission for the routine. You for the important decisions.",
    details: [
      "Allow selected low-risk actions, such as acknowledging an enquiry or asking a known missing question.",
      "Permissions are granted separately for each class of action. Review the record, revoke permission or pause outbound activity.",
    ],
    boundary:
      "Planned, with no blanket autopilot. High-risk, ambiguous and unsupported decisions stay with you.",
  },
  {
    id: "busy-mode",
    status: "exploring",
    title: "Busy mode",
    summary: "Less interruption when you are with customers. Important changes still reach you.",
    details: [
      "Explore batching routine updates into a quiet catch-up while you are working.",
      "Let the business choose what earns an interruption, with a clear view of everything held for later.",
    ],
    boundary:
      "Exploring, not committed. Important blockers and time-sensitive changes must not disappear behind a quiet screen.",
  },
  {
    id: "teach-by-correction",
    status: "exploring",
    title: "Teach it by correcting it",
    summary: "Better business context with every approved correction. Less repeated setup.",
    details: [
      "Explore a simpler way to turn a correction into a proposed improvement for future enquiries.",
      "Keep a change on one enquiry or explicitly teach it to the business, with its source and scope visible.",
    ],
    boundary:
      "Exploring improvements to learning. Pricing, policy and other high-impact rules still require explicit approval.",
  },
  {
    id: "endgame",
    status: "exploring",
    title: "Booked, then handed off",
    summary: "Agreed scope, dates and details, ready for the people delivering the work.",
    details: [
      "Explore handing the confirmed brief to supported tools and people responsible for delivery, without retyping the conversation.",
      "Keep Enquiry focused on first enquiry to booked or lost, rather than turning it into another project-management system.",
    ],
    boundary:
      "Exploring. No delivery-system connections or automatic handoffs are claimed as available today.",
  },
];

export const NON_GOALS = [
  "Accounting or payroll",
  "Inventory or point of sale",
  "A general-purpose CRM",
  "Project management after booking",
];

export function statusLabel(id: RoadmapStatus) {
  return ROADMAP_LEGEND.find((status) => status.id === id)?.label ?? id;
}

export const ROADMAP_PREVIEW = STAGES.slice(0, 3).map((stage) => ({
  id: stage.id,
  title: stage.title,
  lede: stage.summary,
  status: stage.status,
  statusLabel: statusLabel(stage.status),
}));
