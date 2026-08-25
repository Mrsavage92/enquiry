import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Wordmark } from "@/components/ui/wordmark";

export function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center px-6 py-16">
      <Wordmark />
      <h1 className="mt-10 text-3xl font-semibold tracking-tight">That page isn’t here</h1>
      <p className="mt-3 text-sm leading-relaxed text-ink-2">
        The Enquiry website, the waitlist, and the app are a few links away. If you followed an old
        job link, it may have been reset with the prototype.
      </p>
      <div className="mt-8 flex flex-wrap gap-2">
        <Button asChild>
          <Link to="/">Home</Link>
        </Button>
        <Button asChild variant="secondary">
          <Link to="/early-access">Early access</Link>
        </Button>
        <Button asChild variant="secondary">
          <Link to="/enquiries">Open the app</Link>
        </Button>
      </div>
    </main>
  );
}
