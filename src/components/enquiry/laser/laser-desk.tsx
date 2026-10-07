import { useCallback, useEffect, useRef, useState } from "react";
import type { Enquiry } from "@/domain/types";
import { firstName } from "@/domain/customer-name";
import { replyChannel } from "@/domain/channel";
import { laserNext, precheckEligible, type LaserNext } from "@/domain/laser";
import { preparedBody } from "@/domain/labels";
import { replaceAmounts } from "@/domain/voice-detect";
import { IDLE_HINT_SENDS, openLink, openLinksEnabled } from "@/domain/send-flow";
import { enquirySituation } from "@/domain/situation";
import { BUSINESS_BY_ID } from "@/fixtures";
import { resolveBusiness } from "@/lib/workspace/resolve-business";
import { discardSavedDraft, useDraftSaver } from "@/lib/workspace/owner-sync";
import { usePrototype } from "@/store/prototype-store";
import { DoneProvider } from "../done-notice";
import { SituationCard } from "../situation-card";
import { Summary } from "./summary";
import { TheirMessage } from "./their-message";
import { NeedsYou } from "./needs-you";
import { ReplyBox } from "./reply-box";
import { GreetingRow } from "./greeting-row";
import { Notices, type CoverageNote } from "./notices";
import { SendBar, type Recorded } from "./send-bar";
import { RecordedBar } from "./recorded-bar";
import { WaitingView } from "./waiting-view";
import { JobMenu, type MenuPanel } from "./job-menu";
import { StaleEditChoice } from "./stale-edit";
import { DriftNotes } from "./drift-notes";
import { RefusedFix } from "./refused-fix";
import { useSendCheck } from "./use-send-check";
import { useSeen } from "./use-seen";
import { useFreshLines } from "./use-fresh-lines";

/** How long the polite "what changed" line stays before it is cleared. */
const SAID_MS = 5000;

/**
 * The laser-focus enquiry screen (research doc 50): one verdict, their message,
 * the one thing that needs the owner, the whole reply, what bears on the next
 * tap, and the one action. Phone and desktop render the same six parts in the
 * same order; everything else is in the "..." menu.
 */
export function LaserDesk({
  enquiry,
  compact,
  onDone,
  asideOpen,
  onAside,
}: {
  enquiry: Enquiry;
  compact: boolean;
  onDone?: () => void;
  asideOpen?: boolean;
  onAside?: () => void;
}) {
  const businesses = usePrototype((s) => s.businesses);
  const demoMode = usePrototype((s) => s.demoMode);
  const offline = usePrototype((s) => s.offline);
  const drafts = usePrototype((s) => s.drafts);
  const staleDraft = usePrototype((s) => s.staleDrafts[enquiry.id]);
  const considerVoice = usePrototype((s) => s.considerVoice);
  const sentCount = usePrototype(
    (s) =>
      s.enquiries.flatMap((e) => e.conversation).filter((m) => m.direction === "outbound").length,
  );
  const editDraft = useDraftSaver();
  const business = resolveBusiness(businesses, enquiry.businessId, {
    demoMode,
    fixtures: BUSINESS_BY_ID,
  });
  const prepared = preparedBody(enquiry);
  const own = drafts[enquiry.id];
  const staleEdit =
    !demoMode &&
    staleDraft !== undefined &&
    own === undefined &&
    staleDraft.trim() !== "" &&
    staleDraft !== prepared;
  const [staleView, setStaleView] = useState<"new" | "yours">("new");
  const next = laserNext(enquiry, { business, demoMode, offline, staleEdit });
  const text = staleEdit && staleView === "yours" ? staleDraft! : (own ?? prepared);
  const edited = own !== undefined && own !== prepared;

  const [editing, setEditing] = useState(false);
  const [panel, setPanel] = useState<MenuPanel>(null);
  const [recorded, setRecorded] = useState<Recorded | null>(null);
  const [coverage, setCoverage] = useState<CoverageNote | null>(null);
  const [said, setSaid] = useState("");
  const readRef = useRef<HTMLDivElement>(null);
  const fresh = useFreshLines(prepared, edited);

  // The live line is said, then cleared: never left behind as stale text.
  useEffect(() => {
    if (!said) return;
    const t = window.setTimeout(() => setSaid(""), SAID_MS);
    return () => window.clearTimeout(t);
  }, [said]);

  useEffect(() => {
    setSaid("");
    setRecorded(null);
    setCoverage(null);
    setStaleView("new");
  }, [enquiry.id]);

  const practice = Boolean(enquiry.practice);
  const eligible =
    precheckEligible(next, enquiry, { business, demoMode, offline }) && !staleEdit && !recorded;
  const { state: check, retry } = useSendCheck({
    enquiryId: enquiry.id,
    text,
    revision: enquiry.decisionRevision ?? 0,
    channel: replyChannel(enquiry),
    eligible,
    editing,
  });
  const ok = check.status === "ok" && check.text === text ? check.result : null;
  const warnings = ok?.warnings ?? [];
  const seen = useSeen(warnings);
  const refused = check.status === "refused" && check.text === text ? check.result : null;

  // After an answer, focus goes to the next question's heading, or to the
  // reply's label when none is left; never to a button a second Enter could press.
  const firstNext = useRef(true);
  const nextKey = `${next.kind}:${next.kind === "decide" ? next.decision : ""}:${enquiry.decisionRevision}`;
  useEffect(() => {
    if (firstNext.current) {
      firstNext.current = false;
      return;
    }
    const target =
      document.getElementById("laser-step-heading") ?? document.getElementById("laser-reply-label");
    target?.focus({ preventScroll: false });
  }, [nextKey]);

  const selectReply = useCallback(() => {
    const node = readRef.current;
    const selection = window.getSelection();
    if (!node || !selection) return;
    const range = document.createRange();
    range.selectNodeContents(node);
    selection.removeAllRanges();
    selection.addRange(range);
  }, []);

  const backToPrepared = () => void discardSavedDraft(enquiry.id);
  const onEditing = useCallback((on: boolean) => setEditing(on), []);
  const situation = enquirySituation(enquiry, business);
  const link =
    next.kind === "send" &&
    openLinksEnabled(typeof window === "undefined" ? null : window.localStorage)
      ? openLink(enquiry, text, typeof navigator === "undefined" ? "" : navigator.userAgent)
      : null;
  const waiting = next.kind === "waiting" || next.kind === "closed";
  const showReply = !waiting && next.kind !== "reading" && Boolean(text.trim());
  const quietBar = next.kind !== "send" || (compact && editing);

  return (
    <DoneProvider value={setSaid}>
      <div className="laser-desk" data-compact={compact || undefined}>
        <Summary
          enquiry={enquiry}
          compact={compact}
          onMenu={() => setPanel("menu")}
          asideOpen={asideOpen}
          onAside={onAside}
        />
        <div className="laser-column">
          <TheirMessage
            key={enquiry.id}
            enquiry={enquiry}
            startOpen={!compact || (next.kind === "decide" && next.decision === "coverage")}
          />
          {waiting ? (
            <WaitingView enquiry={enquiry} onDone={onDone} justRecorded={Boolean(recorded)} />
          ) : (
            <NeedsYou
              enquiry={enquiry}
              business={business}
              next={next}
              body={text}
              onCoverage={setCoverage}
              staleEdit={
                <StaleEditChoice
                  enquiryId={enquiry.id}
                  view={staleView}
                  onView={setStaleView}
                  staleDraft={staleDraft ?? ""}
                />
              }
            />
          )}
          <p className="sr-only" aria-live="polite">
            {said}
          </p>
          {showReply ? (
            <>
              {edited || staleEdit ? null : <GreetingRow enquiry={enquiry} text={text} />}
              <ReplyBox
                label={`Your reply to ${firstName(enquiry)}`}
                text={text}
                onChange={(value) => editDraft(enquiry.id, value)}
                locked={staleEdit}
                fresh={fresh}
                readRef={readRef}
                onEditing={onEditing}
                onBlur={() => considerVoice(enquiry.id)}
              />
              {edited ? (
                <button type="button" className="laser-link" onClick={backToPrepared}>
                  Edited. Back to the prepared reply
                </button>
              ) : null}
              <Notices
                enquiry={enquiry}
                business={business}
                onWhy={() => setPanel("why")}
                refused={refused?.message ?? null}
                refusedFix={null}
                warnings={warnings}
                warningRef={seen.itemRef}
                onWarningsFocus={seen.markAll}
                blocked={next.kind === "blocked" ? next.reason : null}
                alreadyRecorded={Boolean(ok?.alreadyConfirmed)}
                checkFailed={check.status === "failed"}
                coverage={coverage}
                drift={
                  <>
                    {situation?.kind === "calendar_down" ? (
                      <SituationCard enquiry={enquiry} situation={situation} compact />
                    ) : null}
                    <DriftNotes enquiry={enquiry} prepared={prepared} text={text} />
                  </>
                }
              />
            </>
          ) : null}
        </div>
        <div className="laser-spacer" />
        {recorded ? (
          <RecordedBar
            enquiry={enquiry}
            recorded={recorded}
            onUndone={() => setRecorded(null)}
            onDone={onDone}
          />
        ) : next.kind === "send" ? (
          <SendBar
            key={`${enquiry.id}:${enquiry.copied?.at ?? ""}`}
            enquiry={enquiry}
            next={next as Extract<LaserNext, { kind: "send" }>}
            text={text}
            check={check}
            onRetry={retry}
            allSeen={seen.allSeen}
            practice={practice}
            demo={demoMode}
            selectReply={selectReply}
            refusedFix={
              refused ? (
                <RefusedFix
                  enquiry={enquiry}
                  business={business}
                  refused={refused}
                  onUsePrepared={(named, expected) =>
                    editDraft(
                      enquiry.id,
                      (expected !== null ? replaceAmounts(text, named, expected) : null) ??
                        prepared,
                    )
                  }
                  onBackToPrepared={backToPrepared}
                />
              ) : null
            }
            openLink={link}
            hidden={quietBar}
            idleHint={sentCount < IDLE_HINT_SENDS}
            onRecorded={(r) => {
              setSaid("");
              setRecorded(r);
            }}
          />
        ) : null}
        <JobMenu
          enquiry={enquiry}
          business={business}
          compact={compact}
          panel={panel}
          onPanel={setPanel}
          replyText={text}
          onDone={onDone}
        />
      </div>
    </DoneProvider>
  );
}
