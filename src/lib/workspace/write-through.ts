/**
 * Report a failed write without pretending it succeeded.
 *
 * Deliberately has no dependency on the store, auth client, or any server
 * function - `run` is passed in, so this stays a pure function a node:test
 * file can import directly. Anything in this module's own import graph
 * (prototype-store, auth/client, the `@tanstack/react-start` server actions)
 * only runs under Vite/the browser, so pulling those in here would make the
 * module untestable outside one, the same trap `live-handoff.test.ts`
 * documents for `prototype-store.ts`.
 *
 * Returns `true` when `run` resolved, `false` when it threw. A caller that
 * ignores the return value gets exactly the old fire-and-forget behaviour
 * (the failure is still reported through `onFailure`); a caller that checks
 * it can refuse to treat a failed write as a success.
 */
export async function writeThrough(
  label: string,
  run: () => Promise<unknown>,
  onFailure: (message: string) => void,
): Promise<boolean> {
  try {
    await run();
    return true;
  } catch (err) {
    onFailure(
      err instanceof Error && err.message
        ? `${label} was not saved: ${err.message}`
        : `${label} was not saved. Please try again.`,
    );
    return false;
  }
}
