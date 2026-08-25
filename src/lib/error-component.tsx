import type { ErrorComponentProps } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

function publicMessage(error: { message?: string }) {
  const m = (error.message ?? "").trim();
  if (!m || m.length > 180) return "An unexpected error occurred. Try again.";
  if (/sql|postgres|database|econn|stack|at\s+\S+\s+\(/i.test(m)) {
    return "An unexpected error occurred. Try again.";
  }
  return m;
}

export function AppErrorComponent({ error }: ErrorComponentProps) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-paper px-6 text-center text-ink">
      <TriangleAlert className="size-8 text-danger" aria-hidden />
      <h1 className="text-lg font-semibold tracking-tight">Something went wrong</h1>
      <p className="max-w-md text-sm leading-relaxed text-ink-2">{publicMessage(error)}</p>
      <div className="mt-4 flex flex-wrap justify-center gap-2">
        <Button asChild variant="secondary">
          <Link to="/">Home</Link>
        </Button>
        <Button asChild>
          <Link to="/enquiries">Open the app</Link>
        </Button>
      </div>
    </main>
  );
}
