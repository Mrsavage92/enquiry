import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Building2, ChevronDown, CircleHelp, Plug, Search, ShieldCheck, X } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { WorkspaceDestination } from "@/components/ui/workspace-destination";

export const Route = createFileRoute("/_app/support")({ component: SupportPage });

const ANSWERS = [
  {
    question: "Has my reply been sent?",
    answer:
      "A prepared or copied reply has not been sent. A recorded action is your record of what happened, not proof of delivery. Customer messages are sent through your own channel.",
  },
  {
    question: "Why is a price or date still unconfirmed?",
    answer:
      "A missing detail, conflicting price or uncertain availability can prevent a firm answer. The enquiry keeps that uncertainty visible, with the supporting information under Why this reply?",
  },
  {
    question: "Can I connect my inbox?",
    answer:
      "Live channel connections are not generally available yet. The Connections page shows the status in your workspace. Sample connections do not read a real inbox.",
  },
  {
    question: "Where are my services and prices?",
    answer:
      "Services, pricing, availability, policies and voice are part of your Business profile. Changes that need your review remain separate from confirmed details.",
  },
  {
    question: "Why did my sign-in link not work?",
    answer:
      "Email links are short-lived and can be used once. An expired or already-used link cannot sign you in. A fresh link is available from the sign-in page.",
  },
  {
    question: "Does joining early access create a subscription?",
    answer:
      "No. Joining the list is an invitation request, not a purchase. Plan prices and access timing have not been announced.",
  },
] as const;

function SupportPage() {
  const [search, setSearch] = useState("");
  const matches = ANSWERS.filter((item) =>
    (item.question + " " + item.answer).toLowerCase().includes(search.trim().toLowerCase()),
  );
  return (
    <div className="ui-page-scroll">
      <div className="ui-page account-page support-page">
        <PageHeader
          title="Help & support"
          description="A little clarity, so you can get back to your day."
        />
        <div className="support-search">
          <Search size={19} aria-hidden="true" />
          <input
            type="search"
            aria-label="Search help"
            placeholder="Search help"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search ? (
            <button
              type="button"
              onClick={() => setSearch("")}
              aria-label="Clear search"
              title="Clear search"
            >
              <X size={17} aria-hidden="true" />
            </button>
          ) : null}
        </div>
        <section className="help-answers" aria-label="Answers">
          <p className="support-result-count" role="status">
            {search
              ? `${matches.length} ${matches.length === 1 ? "answer" : "answers"}`
              : "Common questions"}
          </p>
          {matches.map(({ question, answer }) => (
            <details key={question}>
              <summary>
                {question}
                <ChevronDown size={18} aria-hidden="true" />
              </summary>
              <p>{answer}</p>
            </details>
          ))}
          {matches.length === 0 ? (
            <div className="support-no-results">
              <CircleHelp size={24} aria-hidden="true" />
              <h2>No matching answers</h2>
              <p>Try a different word, such as reply, price or sign-in.</p>
            </div>
          ) : null}
        </section>
        <section className="account-section">
          <h2>Your workspace</h2>
          <div className="workspace-destinations">
            <WorkspaceDestination
              to="/business"
              icon={Building2}
              title="Business details"
              description="Services, prices and how you work"
            />
            <WorkspaceDestination
              to="/trust/access"
              icon={Plug}
              title="Connections"
              description="Accounts, access and connection status"
            />
            <WorkspaceDestination
              to="/trust"
              icon={ShieldCheck}
              title="Reply settings"
              description="Your permissions and review preferences"
            />
          </div>
        </section>
        <section className="support-contact">
          <CircleHelp size={18} aria-hidden="true" />
          <div>
            <h2>Contact support</h2>
            <p>A support contact is not available in this workspace yet.</p>
          </div>
        </section>
      </div>
    </div>
  );
}
