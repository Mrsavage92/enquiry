export type RoadmapStatus = "working" | "building" | "next" | "later";

export type RoadmapVisual =
  | "understand"
  | "brain"
  | "continuity"
  | "moving"
  | "trust"
  | "endgame";

export type RoadmapOutcome = {
  id: string;
  title: string;
  items: string[];
};

export type RoadmapStage = {
  id: string;
  number: string;
  short: string;
  title: string;
  status: RoadmapStatus[];
  goal: string;
  narrative: string;
  outcomes: RoadmapOutcome[];
  promise?: string;
  caveat?: string;
  notClaiming?: string[];
  visual: RoadmapVisual;
  current?: boolean;
  feedbackEnabled?: boolean;
};

export const ROADMAP_WRITTEN = "26 August 2026";
export const ROADMAP_PHASE = "Prototype / validation";
export const ROADMAP_ACCESS = "Early access waitlist open";

export const ROADMAP_LEGEND: { id: RoadmapStatus; label: string; mark: string; hint: string }[] = [
  { id: "working", label: "Working now", mark: "■", hint: "In the current product." },
  { id: "building", label: "Building", mark: "▣", hint: "Actively being made real." },
  { id: "next", label: "Next", mark: "○", hint: "Direction is clear enough to publish." },
  { id: "later", label: "Later", mark: "–", hint: "Strategic direction, not a delivery promise." },
];

export function statusLabel(id: RoadmapStatus) {
  return ROADMAP_LEGEND.find((s) => s.id === id)?.label ?? id;
}

export const NON_GOALS = [
  "A full ERP",
  "Accounting or payroll",
  "Inventory or POS",
  "Generic project management",
  "A catch-all CRM for every customer interaction forever",
  "A generic AI receptionist platform",
  "A giant no-code workflow builder",
];

export const STAGES: RoadmapStage[] = [
  {
    id: "understand",
    number: "00",
    short: "Understand",
    title: "Understand the enquiry",
    status: ["working"],
    current: true,
    goal: "Messy inbound becomes an understood request with the right next action.",
    narrative:
      "However the enquiry arrives, Enquiry puts the request together, sees what is known, missing or ambiguous, runs only the checks that matter for this business, and prepares the next action - with a Why? you can open. You still review and send.",
    outcomes: [
      {
        id: "understand-now",
        title: "What this already does",
        items: [
          "Known, missing and ambiguous facts - not a pile of empty fields.",
          "Only the checks that change the next decision. Pricing and capacity appear when they apply, and stay out of the way when they don’t.",
          "A recommended next action, with evidence.",
          "A draft in the business’s voice. Enquiry does not send until you do.",
        ],
      },
    ],
    promise: "First, Enquiry has to prove it can do the thinking.",
    caveat:
      "The prototype is being validated across different kinds of service business. Accuracy is not claimed as production-ready for every trade.",
    notClaiming: [
      "Production-level accuracy across every business",
      "Every channel already connected in production",
      "Hands-off Autopilot",
      "Product-market fit",
    ],
    visual: "understand",
  },
  {
    id: "business-brain",
    number: "01",
    short: "Business",
    title: "Understand your business",
    status: ["building"],
    goal: "Enquiry learns the services, rules and operating preferences it needs to make the right decision for your business.",
    narrative:
      "A worked example is not the product. The product is how you actually operate - what you offer, what you never do, the rules that change a job, prices where they apply, and how you like to sound. Setup should feel like teaching a capable person, not configuring a CRM.",
    outcomes: [
      {
        id: "brain-knows",
        title: "Business Brain",
        items: [
          "Services, aliases, and what you never take on.",
          "Prices and pricing rules where they apply - not every enquiry is a quote.",
          "Required information, travel, operating preferences, voice.",
        ],
      },
      {
        id: "brain-trust",
        title: "Learning without silent corruption",
        items: [
          "A correction can stay on this enquiry, or teach Enquiry.",
          "High-impact rules wait for an explicit yes.",
          "Provenance sits on what it learned.",
        ],
      },
    ],
    promise: "The setup should feel like teaching a capable assistant, not configuring a CRM.",
    visual: "brain",
  },
  {
    id: "continuity",
    number: "02",
    short: "Continuity",
    title: "One enquiry, even when the conversation moves",
    status: ["next"],
    goal: "A form becomes a text or a DM. The request changes. Enquiry keeps the enquiry - and the next decision - current.",
    narrative:
      "The promise is not all your messages in one inbox. It is one coherent enquiry even when the conversation moves channels. A website form and a later text about the same job should update the same decision, when identity is safely established.",
    outcomes: [
      {
        id: "continuity-story",
        title: "What this looks like",
        items: [
          "A website form starts the enquiry.",
          "A later text from the same number continues it.",
          "Changed facts - a tighter deadline, more of the house - change the business decision, not just the reply.",
        ],
      },
      {
        id: "continuity-honesty",
        title: "How connections will arrive",
        items: [
          "Supported channels will roll out progressively. Not every integration is live.",
          "Email, forms, text and social DMs are the direction, named as direction.",
          "Ambiguous identity stays a proposed match. Enquiry does not silently merge people.",
        ],
      },
    ],
    promise: "One enquiry. Even when the conversation moves.",
    caveat:
      "The current product can show this behaviour in the prototype. Production inboxes and social accounts are not all wired yet.",
    visual: "continuity",
    feedbackEnabled: true,
  },
  {
    id: "keep-moving",
    number: "03",
    short: "Moving",
    title: "Keep enquiries moving",
    status: ["next"],
    goal: "The useful parts of the pipeline maintain themselves, and follow-up comes back only when something genuinely needs attention.",
    narrative:
      "Silence is not a decline. A reply is not a booking. Enquiry should know which, keep the record current, and bring back only what needs you - without a board you drag cards across.",
    outcomes: [
      {
        id: "moving-state",
        title: "State that keeps itself",
        items: [
          "Waiting on them. Needs you. Ready to progress. Lost, declined, cancelled - recorded, not guessed.",
          "Search over automatically structured enquiries. No manual stage hygiene.",
        ],
      },
      {
        id: "moving-follow",
        title: "Follow-up that earns the interruption",
        items: [
          "Whether a response is actually due. What changed since last contact.",
          "A letter that does not rewrite a sent quote. And when not to follow up.",
        ],
      },
    ],
    promise: "You shouldn’t have to remember which enquiries need attention.",
    visual: "moving",
    feedbackEnabled: true,
  },
  {
    id: "trusted-action",
    number: "04",
    short: "Trust",
    title: "Trusted action",
    status: ["later"],
    goal: "Enquiry handles selected routine actions only after the business has explicitly allowed them.",
    narrative:
      "There is no giant AI-on switch. Autonomy is earned per class of action, on a business that has allowed it, after the recommendation is already good. Asking for one known missing fact can go. A large quote cannot. A complaint cannot. Pause outbound still wins.",
    outcomes: [
      {
        id: "trust-path",
        title: "Observe → Assist → selected authorised actions",
        items: [
          "Acknowledge receipt. Ask one missing fact that is already determined.",
          "Prepare or send an approved low-risk follow-up.",
        ],
      },
      {
        id: "trust-permission",
        title: "Permission is the product",
        items: [
          "A correct recommendation is not permission to send it.",
          "Each class of action is granted separately. High-risk and ambiguous work stays with you.",
        ],
      },
    ],
    promise: "Enquiry does more only when the business is comfortable letting it do more.",
    caveat: "Autonomous quoting, declines and booking are not a near-term fact. They have to be earned, then allowed.",
    visual: "trust",
    feedbackEnabled: true,
  },
  {
    id: "endgame",
    number: "05",
    short: "Endgame",
    title: "The self-maintaining enquiry layer",
    status: ["later"],
    goal: "From first interest to booked or lost, the business does almost nothing administrative.",
    narrative:
      "Enquiry becomes the intelligence layer between “someone is interested” and “the work is booked”. The owner handles exceptions, judgement, relationships, and the unusual commercial call. Enquiry interprets, remembers, checks, prepares, follows up, and executes only the routine it has been allowed.",
    outcomes: [
      {
        id: "endgame-flow",
        title: "The operating model",
        items: [
          "It already knows what you sell, how you qualify, what they asked, what is missing, and what it may do.",
          "Booked work is handed to the systems that fulfil it. The boundary stays first enquiry → booked or lost.",
        ],
      },
    ],
    promise: "Enquiry becomes the intelligence layer between “someone is interested” and “the work is booked”.",
    visual: "endgame",
  },
];

export const ROADMAP_PREVIEW = STAGES.slice(0, 3).map((s) => ({
  id: s.id,
  title: s.title,
  lede: s.goal,
  status: s.status[0],
  statusLabel: statusLabel(s.status[0]),
}));
