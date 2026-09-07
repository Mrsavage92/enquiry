import test from 'node:test';
import assert from 'node:assert/strict';
import { detectClientIntent } from '../../../../src/domain/client-intent.ts';
import { fixtureLinksAllowed } from '../../../../src/lib/public-links.ts';

// A bounded truth-table check, not authentication or endpoint penetration testing.
for (const authEnabled of [false,true]) {
  for (const optedIn of [false,true]) {
    test(`public fixture link containment: auth=${authEnabled}, optIn=${optedIn}`, () => {
      assert.equal(fixtureLinksAllowed({authEnabled,optedIn}), optedIn && !authEnabled);
    });
  }
}
for (const [body,expected] of [
  ['Yes that works. Please lock it in.','accept'],
  ['Could you explain the travel charge?','question'],
  ['','other'],
] as const) {
  test(`existing intent behaviour: ${JSON.stringify(body)}`, () => assert.equal(detectClientIntent(body),expected));
}
// These intentionally expose the demo parser's unsuitability for arbitrary real replies.
// They are not evidence that a live server endpoint currently accepts those replies.
for (const body of [
  'Yes, could you confirm whether travel is included?',
  'Please do not book it.',
  'That is not confirmed.',
  'Okay, but only if the total stays under $500.',
  'Please do not go ahead.',
]) {
  test(`do not treat a question, negation or condition as acceptance: ${JSON.stringify(body)}`, () => {
    assert.notEqual(detectClientIntent(body),'accept');
  });
}
