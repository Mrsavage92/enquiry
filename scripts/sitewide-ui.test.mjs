import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("legal contents point to actual document headings", () => {
  for (const page of ["privacy", "terms"]) {
    const source = ts.createSourceFile(
      page + ".tsx",
      read(`src/routes/${page}.tsx`),
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX,
    );
    const targets = new Set();
    const links = [];
    const visit = (node) => {
      if (
        ts.isJsxAttribute(node) &&
        node.name.getText(source) === "id" &&
        node.initializer &&
        ts.isStringLiteral(node.initializer)
      )
        targets.add(node.initializer.text);
      if (
        ts.isPropertyAssignment(node) &&
        node.name.getText(source) === "id" &&
        ts.isStringLiteral(node.initializer)
      )
        links.push(node.initializer.text);
      ts.forEachChild(node, visit);
    };
    visit(source);
    assert.ok(links.length >= 5);
    for (const link of links) assert.ok(targets.has(link), `${page}: missing ${link}`);
    assert.match(read(`src/routes/${page}.tsx`), /LegalLayout/);
  }
});

test("the public story uses the authoritative sample and cannot send or book", () => {
  const story = read("src/components/site/enquiry-story.tsx");
  for (const value of [
    "SIGNATURE_DEMO.form.message",
    "SIGNATURE_DEMO.text.message",
    "RIDGE_CREW_WINDOW_RULE.body",
    "Nothing has been sent or booked",
    "Sample conversation",
  ])
    assert.ok(story.replace(/\s+/g, " ").includes(value), value);
  assert.doesNotMatch(story, /fetch\(|sendReply|acceptQuote|confirmExternalBooking/);
  assert.match(read("src/routes/demo.tsx"), /<CrossChannelDecisionDemo compact/);
});

test("settings retain controls, sample boundaries and server-backed pause mutations", () => {
  const settings = read("src/components/settings/settings-page.tsx");
  for (const value of [
    "workingDays",
    "hoursStart",
    "hoursEnd",
    "timezone",
    "notifyArrival",
    "notifyFollowUp",
    "notifyLearning",
    "InstallAppBlock",
    "startSetup",
    "reset()",
    "useLiveTrustMutations",
    "trust.pauseBusiness",
    "trust.resumeBusiness",
    "demoMode && id",
    "Connect sample",
  ])
    assert.ok(settings.includes(value), value);
  assert.doesNotMatch(settings, /⌘Enter send|Open Business Brain|Enquiry will keep reading/);
});

test("permission controls expose selection and retain high-risk restrictions", () => {
  const trust = read("src/components/trust/trust-screen.tsx");
  assert.match(trust, /aria-pressed=\{business.trustMode === m\}/);
  assert.match(trust, /aria-pressed=\{p.mode === m\}/);
  assert.match(trust, /disabled=\{p.risk === "HIGH" && m === "Automatic when safe"\}/);
  assert.match(trust, /useLiveTrustMutations/);
  assert.match(trust, /business\?\.id/);
});

test("customer quote and booking routes still fail closed", () => {
  for (const page of ["book/$bookingId", "q/$enquiryId"]) {
    const source = read(`src/routes/${page}.tsx`);
    assert.match(source, /fixtureLinksAllowed/);
    assert.match(source, /authEnabled,/);
    assert.match(source, /component: FIXTURE_LINKS_OK \? Customer\w+ : LinkUnavailable/);
    assert.match(source, /CustomerLinkUnavailable/);
    assert.match(source, /Sample customer view/);
  }
});

test("onboarding still persists before navigation and preserves the auth boundary", () => {
  const source = read("src/routes/onboarding.tsx");
  for (const value of [
    "<RequireAuth>",
    "<WorkspaceGate isOnboardingRoute>",
    "await completeOnboarding",
    "markOnboarded()",
    "Your details are still here",
    "Not saved yet",
    "stageHeading.current?.focus()",
    'const currency = "AUD"',
  ])
    assert.ok(source.includes(value), value);
  assert.ok(source.indexOf("await completeOnboarding") < source.indexOf("markOnboarded()"));
});

test("utility pages retain truthful unavailable states and help has real filtering", () => {
  assert.match(read("src/routes/_app/usage.tsx"), /No plan or usage allowance/);
  assert.match(read("src/routes/_app/refer.tsx"), /no active referral programme or reward/);
  const help = read("src/routes/_app/support.tsx");
  for (const value of [
    'aria-label="Search help"',
    "ANSWERS.filter",
    "No matching answers",
    "A support contact is not available",
  ])
    assert.ok(help.includes(value));
  assert.doesNotMatch(help, /mailto:|24\/7|live chat/i);
});

test("insights keep existing scoped calculations without invented trends", () => {
  const source = read("src/routes/_app/insights.tsx");
  assert.match(source, /e.businessId === filter/);
  assert.match(source, /briefing\(enquiries, businesses, bookings, filter\)/);
  assert.match(source, /data-priority=\{priority \|\| undefined\}/);
  assert.match(source, /Separate counts, not stages of a conversion funnel/);
  assert.doesNotMatch(source, /Last 30 days|This month|% growth|time saved/i);
});

test("new visual families retain reduced-motion and bounded responsive layouts", () => {
  for (const path of ["src/site-story.css", "src/workspace-refinement.css"]) {
    const css = read(path);
    assert.match(css, /prefers-reduced-motion: reduce/);
    assert.match(css, /max-width: 600px/);
    assert.doesNotMatch(css, /font-size:[^;]*vw|letter-spacing:\s*-/);
  }
});

test("reference story keeps four stages and three native working surfaces", () => {
  const source = read("src/components/site/enquiry-story.tsx");
  for (const title of [
    "The initial enquiry",
    "The details change",
    "Keep the bigger picture",
    "What you can promise",
  ])
    assert.ok(source.includes(title));
  assert.match(source, /className="story-progress"/);
  assert.match(source, /className="story-surfaces"/);
  assert.equal((source.match(/<article /g) ?? []).length, 3);
  assert.doesNotMatch(source, /<img|Send a reply/);
});

test("demo keeps context with the conversation and evidence with the next step", () => {
  const source = read("src/components/site/cross-channel-decision-demo.tsx");
  const context = source.indexOf('className="demo-context"');
  const action = source.indexOf('className="demo-action"');
  const reasons = source.indexOf('className="demo-reasons"');
  assert.ok(context > 0 && context < action && action < reasons);
  assert.match(source, /state\.facts\.map/);
  assert.match(source, /state\.checks\.map/);
  assert.match(source, /aria-expanded=\{whyOpen\}/);
  assert.match(source, /Nothing has been sent or booked/);
  assert.match(source, /state\.commercialNote/);
});

test("Business directory retains every destination and review warnings in a single group", () => {
  const source = read("src/components/business/brain-screen.tsx");
  assert.match(source, /destinations\.map/);
  assert.doesNotMatch(source, /destinations\.slice/);
  assert.match(source, /summary\.needsReview > 0/);
  assert.match(source, /businessSectionPreview\(business, section\)/);
  assert.match(source, /to: "\/trust\/access"/);
});

test("illustrated journal keeps real product assets and labels their sample status", () => {
  const source = read("src/routes/updates.tsx");
  assert.match(source, /Current sample workspace/);
  assert.match(source, /Not customer data/);
  assert.match(source, /className="product-journal"/);
  const paths = [...source.matchAll(/"(\/product\/[^"\s]+\.(?:jpg|webp))"/g)].map(
    (match) => match[1],
  );
  assert.ok(paths.length >= 5);
  for (const path of paths)
    assert.ok(readFileSync(new URL(`../public${path}`, import.meta.url)).length > 0);
});
