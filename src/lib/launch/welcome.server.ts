import type { EmailMessage } from "@/lib/email/send.server";
import type { UnsubscribeLinks } from "./unsubscribe.server";

export type WelcomeDeps = {
  links: (waitlistId: string, origin: string) => Promise<UnsubscribeLinks | null>;
  build: (to: string, origin: string, links: UnsubscribeLinks) => EmailMessage;
  send: (message: EmailMessage) => void;
  report: (error: unknown) => void;
};

/**
 * Sends the welcome email for a row that is already saved. It never throws:
 * the person is on the list whatever happens here, so a failure to make the
 * unsubscribe link alerts the owner and skips the email instead of turning a
 * saved signup into an error. The email is commercial, so it never goes out
 * without a working unsubscribe link.
 */
export async function welcomeNewSignup(
  input: { waitlistId: string; email: string; origin: string },
  deps: WelcomeDeps,
): Promise<"sent" | "skipped"> {
  try {
    const links = await deps.links(input.waitlistId, input.origin);
    if (!links) {
      deps.report(new Error("welcome email not sent: no unsubscribe secret"));
      return "skipped";
    }
    deps.send(deps.build(input.email, input.origin, links));
    return "sent";
  } catch (error) {
    deps.report(error);
    return "skipped";
  }
}
