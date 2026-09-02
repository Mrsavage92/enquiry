import { Link, Navigate, createFileRoute, useNavigate } from "@tanstack/react-router";
import { FIXTURE_INDEX } from "@/fixtures";
import { usePrototype } from "@/store/prototype-store";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";

export const Route = createFileRoute("/_app/lab")({
  component: LabPage,
});

function LabPage() {
  const demoMode = usePrototype((s) => s.demoMode);
  const events = usePrototype((s) => s.events);
  const reset = usePrototype((s) => s.reset);
  const arriveEnquiry = usePrototype((s) => s.arriveEnquiry);
  const offlineSimulated = usePrototype((s) => s.offlineSimulated);
  const setOfflineSimulated = usePrototype((s) => s.setOfflineSimulated);
  const navigate = useNavigate();
  const counts = (id: string) => events.filter((e) => e.fixtureId === id);

  // Every tool on this page acts on fixture ids (F01-F20) or reseeds the
  // fixture arrays outright - "Reset prototype state" calls the same reset()
  // that repopulates businesses/enquiries/bookings from BUSINESSES/ENQUIRIES/
  // BOOKINGS, and the arrival button calls arriveEnquiry() directly, bypassing
  // the demoMode gate that scheduling effect obeys elsewhere. /_app puts this
  // route behind RequireAuth + WorkspaceBoundary like every operator screen, so
  // a real signed-in tenant could reach /lab directly and, in one click, have
  // their live workspace overwritten with fixture data or handed a fabricated
  // enquiry. This page has no live-tenant purpose, so it is demo-only.
  if (!demoMode) return <Navigate to="/enquiries" replace />;

  return (
    <div className="mx-auto h-full max-w-3xl overflow-y-auto px-4 py-5 pb-8 sm:py-8">
      <PageHeader
        title="Fixture lab"
        description="F01–F20. Interaction counts are local, for Step 18 budgets."
      />
      <div className="mt-6 flex flex-wrap gap-2">
        <Button
          size="sm"
          onClick={() => {
            const id = arriveEnquiry();
            void navigate({ to: "/enquiries/$enquiryId", params: { enquiryId: id } });
          }}
        >
          A new enquiry just arrived
        </Button>
        <Button
          size="sm"
          variant={offlineSimulated ? "warn" : "secondary"}
          onClick={() => setOfflineSimulated(!offlineSimulated)}
        >
          {offlineSimulated ? "You’re back online" : "Pretend you’re offline"}
        </Button>
        <Button size="sm" variant="secondary" onClick={() => reset()}>
          Reset prototype state
        </Button>
      </div>
      <p className="mt-3 text-sm text-ink-2">
        Arrival also plays on its own in the queue after a few seconds. Use this to replay it.
      </p>

      <h2 className="mt-10 text-lg font-semibold tracking-tight">Bad mornings</h2>
      <span className="page-rule" aria-hidden />
      <ul className="mt-4 space-y-2 text-sm">
        <li>
          <Link
            to="/enquiries/$enquiryId"
            params={{ enquiryId: "f10" }}
            className="font-medium underline-offset-4 hover:underline"
          >
            Ibrahim Nassar · Calendar down
          </Link>
          <span className="text-ink-2"> - Unknown is not busy and not free.</span>
        </li>
        <li>
          <Link
            to="/enquiries/$enquiryId"
            params={{ enquiryId: "f11" }}
            className="font-medium underline-offset-4 hover:underline"
          >
            Rossi family · Price conflict
          </Link>
          <span className="text-ink-2"> - Enquiry will not pick $450 or $520.</span>
        </li>
        <li>
          <Link
            to="/enquiries/$enquiryId"
            params={{ enquiryId: "f13" }}
            className="font-medium underline-offset-4 hover:underline"
          >
            Marcus resend · Duplicate
          </Link>
          <span className="text-ink-2"> - No automatic merge.</span>
        </li>
        <li>
          <Link
            to="/enquiries/$enquiryId"
            params={{ enquiryId: "f09" }}
            className="font-medium underline-offset-4 hover:underline"
          >
            Leah Nguyen · Check this
          </Link>
          <span className="text-ink-2"> - Event coverage or brand portraits, not a guess.</span>
        </li>
        <li>
          <Link to="/trust" className="font-medium underline-offset-4 hover:underline">
            Trust · Pause Enquiry
          </Link>
          <span className="text-ink-2"> - Keeps reading, stops sending.</span>
        </li>
      </ul>

      <h2 className="mt-10 text-lg font-semibold tracking-tight">How they wrote in</h2>
      <span className="page-rule" aria-hidden />
      <ul className="mt-4 space-y-2 text-sm">
        <li>
          <Link
            to="/enquiries/$enquiryId"
            params={{ enquiryId: "f02" }}
            className="font-medium underline-offset-4 hover:underline"
          >
            Jordan Hale · Website form
          </Link>
          <span className="text-ink-2"> - A form that happens to email you is still a form.</span>
        </li>
        <li>
          <Link
            to="/enquiries/$enquiryId"
            params={{ enquiryId: "f03" }}
            className="font-medium underline-offset-4 hover:underline"
          >
            A. Patel · Text
          </Link>
          <span className="text-ink-2"> - Short. No invented quote. Two questions.</span>
        </li>
        <li>
          <Link
            to="/enquiries/$enquiryId"
            params={{ enquiryId: "f18" }}
            className="font-medium underline-offset-4 hover:underline"
          >
            Tash Morello · Instagram
          </Link>
          <span className="text-ink-2"> - Same engine. Short DM. Same quote sheet.</span>
        </li>
        <li>
          <Link
            to="/enquiries/$enquiryId"
            params={{ enquiryId: "f19" }}
            className="font-medium underline-offset-4 hover:underline"
          >
            Samira Ott · Facebook
          </Link>
          <span className="text-ink-2"> - Ask how long. Do not paste a letter into Messenger.</span>
        </li>
        <li>
          <Link
            to="/enquiries/$enquiryId"
            params={{ enquiryId: "f20" }}
            className="font-medium underline-offset-4 hover:underline"
          >
            @jess.k · Public comment
          </Link>
          <span className="text-ink-2"> - Not a quote. Invite to message, or ignore.</span>
        </li>
      </ul>

      <h2 className="mt-10 text-lg font-semibold tracking-tight">Fixtures</h2>
      <span className="page-rule" aria-hidden />
      <ul className="mt-6 space-y-2">
        {FIXTURE_INDEX.map((f) => {
          const c = counts(f.id);
          return (
            <li key={f.id} className="surface p-5">
              <div className="flex items-start justify-between gap-2">
                <Link
                  to="/enquiries/$enquiryId"
                  params={{ enquiryId: f.enquiryId }}
                  className="font-medium underline-offset-4 hover:underline"
                >
                  <span className="font-mono text-xs text-stone">{f.id}</span>
                  <span className="mx-1.5 text-stone">·</span>
                  {f.title}
                </Link>
                <Badge>{f.business}</Badge>
              </div>
              <p className="mt-1.5 text-sm text-ink-2">{f.expect}</p>
              <p className="mt-2 text-xs text-stone">
                {c.length} recorded action{c.length === 1 ? "" : "s"}
                {c.length ? `: ${c.map((x) => x.action).join(", ")}` : ""}
              </p>
            </li>
          );
        })}
      </ul>
      <h2 className="mt-10 text-lg font-semibold tracking-tight">Screens</h2>
      <span className="page-rule" aria-hidden />
      <ul className="mt-4 space-y-1.5 text-sm text-ink-2">
        <li>W01–W07 Onboarding - /onboarding</li>
        <li>W08 Queue - /enquiries</li>
        <li>W09–W18 Enquiry workspace - /enquiries/f01 … f17</li>
        <li>W19 Customer booking - /book/b2</li>
        <li>W20–W23 Trust - /trust</li>
        <li>W24 Bookings - /bookings</li>
        <li>W25 Insights - /insights</li>
        <li>Business Brain - /business</li>
      </ul>
    </div>
  );
}
