export type ClientIntent = "accept" | "question" | "other";

const ACCEPT =
  /\b(yes|yep|yeah|yup|ok|okay|sounds good|perfect|book (it|us|me)|lock it in|please (book|lock)|that works|we're in|we are in|go ahead|confirmed|please do)\b/i;
const QUESTION = /\?|\b(can you|could you|what about|how much|instead|move the date|change the)\b/i;

export function detectClientIntent(body: string): ClientIntent {
  const t = body.trim();
  if (!t) return "other";
  const accepts = ACCEPT.test(t);
  const asks = QUESTION.test(t);
  if (accepts && !asks) return "accept";
  if (asks && !accepts) return "question";
  if (accepts) return "accept";
  return "other";
}

export const DEMO_ACCEPT_REPLY = "Yes that works. Please lock it in.";
