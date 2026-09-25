import { useMemo } from "react";
import { useLoaderData } from "@tanstack/react-router";
import { buildSignatureBusinesses, buildSignatureDemo } from "./signature-demo";

/**
 * The sample story's dates, built from ONE moment shared by the server render
 * and the browser.
 *
 * A module constant was computed when the server instance started: a warm
 * instance still rendered yesterday's dates after Brisbane midnight while the
 * browser computed today's, and React reported a text mismatch on /demo, /how
 * and the og card. The root loader stamps `renderedAt` on the server and it is
 * serialized to the client, so both build from the same instant.
 */
export function useSignatureDemo() {
  const renderedAt = useLoaderData({ from: "__root__", select: (d) => d.renderedAt });
  return useMemo(() => {
    const demo = buildSignatureDemo(new Date(renderedAt));
    return { demo, businesses: buildSignatureBusinesses(demo) };
  }, [renderedAt]);
}
