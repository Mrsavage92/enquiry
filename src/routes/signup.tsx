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
      heading="Create your account"
      lede="Invited to Enquiry? Set up your early-access account."
      cta="Email me a setup link"
      footer={
        <>
          <p>
            Already have an account?{" "}
            <Link to="/login" className="underline underline-offset-4 hover:text-ink">
              Sign in
            </Link>
          </p>
          <p>
            No invitation yet?{" "}
            <Link to="/early-access" className="underline underline-offset-4 hover:text-ink">
              Join early access
            </Link>
          </p>
        </>
      }
    />
  );
}
