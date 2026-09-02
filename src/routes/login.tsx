import { Link, createFileRoute } from "@tanstack/react-router";
import { DEFAULT_RETURN_PATH, safeReturnPath } from "@/lib/auth/return-path";
import { AuthRequestForm } from "@/components/auth/auth-request-form";

type LoginSearch = { redirect?: string };

export const Route = createFileRoute("/login")({
  validateSearch: (search: Record<string, unknown>): LoginSearch => {
    // Only carry a redirect when one was actually supplied. Returning the
    // default here made every plain visit to /login redirect to
    // /login?redirect=/enquiries, because validateSearch was rewriting the URL
    // to a value that was never in it. The invariant still applies - anything
    // present is validated by the same rule used to build the auth redirect
    // URL (see lib/auth/return-path) - the default just belongs at the use site.
    if (typeof search.redirect !== "string" || !search.redirect) return {};
    return { redirect: safeReturnPath(search.redirect) };
  },
  head: () => ({ meta: [{ title: "Sign in - Enquiry" }] }),
  component: LoginPage,
});

function LoginPage() {
  const { redirect } = Route.useSearch();
  return (
    <AuthRequestForm
      // Returning owner. Must NOT create an account for a mistyped address.
      intent="signin"
      destination={redirect ?? DEFAULT_RETURN_PATH}
      heading="Sign in"
      lede="Enquiry sends a link. There is no password."
      cta="Email me a link"
      footer={
        <>
          New to Enquiry?{" "}
          <Link to="/signup" className="underline underline-offset-4 hover:text-ink">
            Set up your workspace
          </Link>
        </>
      }
    />
  );
}
