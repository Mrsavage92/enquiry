import { Link, createFileRoute } from "@tanstack/react-router";
import { ONBOARDING_PATH } from "@/lib/auth/completion";
import { safeReturnPath } from "@/lib/auth/return-path";
import { AuthRequestForm } from "@/components/auth/auth-request-form";

type SignupSearch = { redirect?: string };

export const Route = createFileRoute("/signup")({
  validateSearch: (search: Record<string, unknown>): SignupSearch => {
    if (typeof search.redirect !== "string" || !search.redirect) return {};
    return { redirect: safeReturnPath(search.redirect) };
  },
  head: () => ({ meta: [{ title: "Set up Enquiry" }] }),
  component: SignupPage,
});

function SignupPage() {
  const { redirect } = Route.useSearch();
  return (
    <AuthRequestForm
      // New owner. Account creation is the point of this route.
      intent="signup"
      // A new account has no workspace, so onboarding is where it belongs. The
      // completion route re-resolves this against the real workspace anyway; a
      // returning customer who lands here is not sent to onboarding twice.
      destination={redirect ?? ONBOARDING_PATH}
      heading="Set up Enquiry"
      lede="See what each enquiry needs next, and review the reply before anything is sent."
      cta="Continue with email"
      footer={
        <>
          <p className="text-stone">Enquiry prepares. You approve.</p>
          <p className="mt-3">
            Already use Enquiry?{" "}
            <Link to="/login" className="underline underline-offset-4 hover:text-ink">
              Sign in
            </Link>
          </p>
          <p className="mt-3 text-stone">
            By continuing you agree to our{" "}
            <Link to="/terms" className="underline underline-offset-4 hover:text-ink">
              terms
            </Link>{" "}
            and{" "}
            <Link to="/privacy" className="underline underline-offset-4 hover:text-ink">
              privacy policy
            </Link>
            .
          </p>
        </>
      }
    />
  );
}
