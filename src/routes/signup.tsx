import { Link, createFileRoute } from "@tanstack/react-router";
import { AuthRequestForm } from "@/components/auth/auth-request-form";

export const Route = createFileRoute("/signup")({
  head: () => ({
    meta: [{ title: "Set up Enquiry" }, { name: "robots", content: "noindex,nofollow" }],
  }),
  component: SignupPage,
});

function SignupPage() {
  return (
    <AuthRequestForm
      // New early-access operator. Account creation is intentional here.
      intent="signup"
      destination="/onboarding"
      heading="Set up Enquiry"
      lede="This is early-access setup. If you have not been invited yet, join the waitlist first."
      cta="Email me a setup link"
      footer={
        <>
          Already invited and set up?{" "}
          <Link to="/login" className="underline underline-offset-4 hover:text-ink">
            Sign in
          </Link>
          . Not invited yet?{" "}
          <Link to="/early-access" className="underline underline-offset-4 hover:text-ink">
            Join early access
          </Link>
        </>
      }
    />
  );
}
