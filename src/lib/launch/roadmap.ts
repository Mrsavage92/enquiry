export type RoadmapStatus =
  | "working"
  | "building"
  | "testing"
  | "next"
  | "later"
  | "exploring"
  | "shipped";

export type RoadmapVisual =
  | "proof"
  | "brain"
  | "evaluators"
  | "states"
  | "connect"
  | "autopilot"
  | "leak"
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

export const ROADMAP_WRITTEN = "25 August 2026";
export const ROADMAP_PHASE = "Prototype / validation";
export const ROADMAP_ACCESS = "Early access waitlist open";

export const ROADMAP_LEGEND: { id: RoadmapStatus; label: string; mark: string; hint: string }[] = [
  { id: "working", label: "Working now", mark: "■", hint: "Exists in the current prototype." },
  { id: "building", label: "Building", mark: "▣", hint: "Actively being implemented." },
  { id: "testing", label: "Testing", mark: "◌", hint: "Hypothesis. Evidence still being gathered." },
  { id: "next", label: "Next", mark: "○", hint: "Direction is clear enough to publish." },
  { id: "later", label: "Later", mark: "–", hint: "Strategic direction, not a delivery promise." },
  { id: "exploring", label: "Exploring", mark: "·", hint: "A signal. Not a vote that ships it." },
  { id: "shipped", label: "Shipped", mark: "✓", hint: "Released with proof." },
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
    id: "prove",
    number: "00",
    short: "Prove",
    title: "Prove the idea",
    status: ["working", "testing"],
    current: true,
    goal: "Can Enquiry understand a messy service-business enquiry and work out the correct next action — without the owner maintaining a CRM?",
    narrative:
      "First, Enquiry has to prove it can do the thinking. If the owner still has to reconstruct every enquiry manually, nothing else matters. The prototype on this site is that test: a messy message becomes a case file, a number, a letter, send.",
    outcomes: [
      {
        id: "prove-thinking",
        title: "What exists in the prototype",
        items: [
          "A messy inbound becomes known facts, missing facts, and the checks that matter.",
          "A recommendation with a reason — why is a tap, not a paragraph.",
          "A draft in the business’s voice. You still send.",
          "A correction can stay on this job, or teach the business.",
        ],
      },
    ],
    promise: "First, Enquiry has to prove it can do the thinking.",
    notClaiming: [
      "Production-level accuracy across every business",
      "Hands-off Autopilot",
      "Every email, calendar or booking integration",
      "Perfect quoting for arbitrary businesses",
      "Product-market fit",
    ],
    visual: "proof",
  },
  {
    id: "learn",
    number: "01",
    short: "Learn",
    title: "Learn the business",
    status: ["building", "next"],
    goal: "Enquiry should understand your business, not just understand English.",
    narrative:
      "Glow is a worked example so the decision is visible. That is not the product. The product is your prices, your rules, your voice. Setup should feel like teaching a capable person, not configuring a CRM.",
    outcomes: [
      {
        id: "learn-brain",
        title: "Business Brain",
        items: [
          "Services, aliases, prices, what you never do.",
          "Required information, travel, operating preferences.",
          "A change in natural language. A future-dated rule when the season shifts.",
        ],
      },
      {
        id: "learn-teach",
        title: "Learning without silent corruption",
        items: [
          "Just this enquiry, or teach Enquiry.",
          "High-impact rules wait for an explicit yes.",
          "Provenance sits on what it learned.",
        ],
      },
    ],
    promise: "The setup should feel like teaching a capable assistant, not configuring a CRM.",
    caveat: "Exit: the business reaches a useful first enquiry with little setup, and can trust what Enquiry knows.",
    visual: "brain",
    feedbackEnabled: true,
  },
  {
    id: "decision",
    number: "02",
    short: "Decision",
    title: "Make every enquiry decision-ready",
    status: ["next"],
    goal: "Open Enquiry and see the decision, not the admin required to reach it.",
    narrative:
      "Not every business needs a price, a diary, or a travel check. Enquiry should run only the checks that matter for this job, and refuse to invent a number or a free Saturday.",
    outcomes: [
      {
        id: "decision-intel",
        title: "On every enquiry",
        items: [
          "What they want. What we know. What is missing. What is blocking the next move.",
          "What should happen next, and why.",
        ],
      },
      {
        id: "decision-mods",
        title: "Only the checks that matter",
        items: [
          "Pricing, eligibility, qualification, travel, availability, capacity — when they change the decision.",
          "Exact, estimate, or unknown. No fabricated prices. No false availability.",
        ],
      },
    ],
    promise: "Every enquiry arrives already understood.",
    visual: "evaluators",
    feedbackEnabled: true,
  },
  {
    id: "pipeline",
    number: "03",
    short: "Pipeline",
    title: "Stop managing the pipeline",
    status: ["next", "later"],
    goal: "The useful parts of a CRM should maintain themselves.",
    narrative:
      "Silence is not a decline. A reply is not a booking. Enquiry should know which, keep the record current, and bring back only what needs you — without a board you drag cards across.",
    outcomes: [
      {
        id: "pipeline-state",
        title: "State that keeps itself",
        items: [
          "Waiting on them. Waiting on you. Ready to book. Lost, declined, cancelled — recorded, not guessed.",
          "Search over automatically structured enquiries. No manual stage hygiene.",
        ],
      },
      {
        id: "pipeline-follow",
        title: "Smart follow-up",
        items: [
          "Whether a response is actually due. What changed since last contact.",
          "A letter that does not rewrite the sent sheet. And when not to follow up.",
        ],
      },
    ],
    promise: "You shouldn’t have to remember which enquiries need attention.",
    visual: "states",
    feedbackEnabled: true,
  },
  {
    id: "connect",
    number: "04",
    short: "Connect",
    title: "Connect what already runs the business",
    status: ["later", "exploring"],
    goal: "Enquiry becomes useful without forcing the business to migrate everything else.",
    narrative:
      "Integrate first. Replace selectively. Mail, calendar, forms and a booking handoff are the direction — named as direction, not as a logo wall of things we do not have. Two-way SMS is a real ask. It only ships if it improves conversion without turning Enquiry into another inbox.",
    outcomes: [
      {
        id: "connect-tools",
        title: "Direction, not a promise of availability",
        items: [
          "Mail and calendar where they change the decision.",
          "Forms and website intake. A booking handoff when the job is ready.",
          "Webhooks and a private intake remain first-class.",
        ],
      },
      {
        id: "connect-sms",
        title: "SMS",
        items: [
          "We’re testing whether a text in, a text out, materially improves conversion before we turn Enquiry into another inbox.",
        ],
      },
    ],
    promise: "Integrate first. Replace selectively.",
    visual: "connect",
    feedbackEnabled: true,
  },
  {
    id: "autopilot",
    number: "05",
    short: "Autopilot",
    title: "Earned Autopilot",
    status: ["later"],
    goal: "Let Enquiry handle the safe, boring decisions — only after it has earned that trust.",
    narrative:
      "There is no giant AI-on switch. Autonomy is a class of action, on a business that has earned Trust, after the recommendation is already good. Asking for a missing date can go. A large quote cannot. A complaint cannot. Pause outbound still wins.",
    outcomes: [
      {
        id: "auto-early",
        title: "Early, only when safe",
        items: [
          "Acknowledge receipt. Ask one missing fact that is already determined.",
          "Prepare or send an approved low-risk follow-up.",
        ],
      },
      {
        id: "auto-later",
        title: "Later, only with evidence",
        items: [
          "A validated quote send. A narrow decline. Selected booking actions.",
          "Permission, validation, health, a reason, an audit — every time.",
        ],
      },
    ],
    promise: "Enquiry does more only when the business is comfortable letting it do more.",
    visual: "autopilot",
    feedbackEnabled: true,
  },
  {
    id: "leak",
    number: "06",
    short: "Leak",
    title: "Understand where enquiries leak",
    status: ["later"],
    goal: "Turn the enquiry layer into measurable commercial intelligence.",
    narrative:
      "Show the owner where good enquiries are being mishandled before asking them to buy more leads. We will not call pipeline value lost revenue unless the causality is actually supportable.",
    outcomes: [
      {
        id: "leak-signals",
        title: "Signals, not theatre",
        items: [
          "Response-readiness. Follow-up coverage. Open enquiry value.",
          "Enquiries with no recorded follow-up. Conversion by type and source, where the numbers are honest.",
        ],
      },
    ],
    promise: "Show the owner where good enquiries are being mishandled before asking them to buy more leads.",
    caveat: "We will not call pipeline value lost revenue unless the causality is actually supportable.",
    visual: "leak",
    feedbackEnabled: true,
  },
  {
    id: "endgame",
    number: "07",
    short: "Endgame",
    title: "The self-maintaining enquiry layer",
    status: ["later"],
    goal: "A customer sends an enquiry. The business does almost nothing administrative.",
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

export const ROADMAP_PREVIEW = STAGES.slice(0, 4).map((s) => ({
  id: s.id,
  title: s.title,
  lede: s.goal,
  status: s.status[0],
  statusLabel: statusLabel(s.status[0]),
}));
