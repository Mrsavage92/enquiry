import { useState } from "react";
import { MediaFrame } from "@/components/site/device-frame";
import { EmbedNavProvider } from "@/components/site/embed-nav";
import { PhoneDesk } from "@/components/enquiry/phone-desk";
import { usePrototype } from "@/store/prototype-store";
import { cn } from "@/lib/utils";

export function LivePhone({
  enquiryId = "f01",
  caption = "This is the app. Send Priya’s quote.",
  className,
}: {
  enquiryId?: string;
  caption?: string;
  className?: string;
}) {
  const [id, setId] = useState(enquiryId);
  const enquiry = usePrototype((s) => s.enquiries.find((e) => e.id === id) ?? s.enquiries[0]);
  const restoreFixture = usePrototype((s) => s.restoreFixture);

  return (
    <figure className={cn("mx-auto w-full max-w-[18.5rem] sm:max-w-[22rem]", className)}>
      {/*
        The reference frames every product capture the same way, portrait or
        landscape, so the hand-drawn phone bezel is gone and this uses the
        shared MediaFrame. `mk-app-surface` re-asserts the app's own light
        palette inside it - the marketing layer remaps the app colour tokens
        at the document root, and without this the phone would render inverted
        (its bg-ink bezel turned near-white, its bg-paper screen near-black).
      */}
      <MediaFrame>
        <div className="mk-app-surface flex h-[min(26rem,58dvh)] min-h-[22rem] flex-col overflow-hidden bg-raised sm:h-[min(38rem,75dvh)] sm:min-h-[28rem]">
          <EmbedNavProvider value={{ open: setId, today: () => setId(enquiryId) }}>
            {enquiry ? <PhoneDesk enquiry={enquiry} /> : null}
          </EmbedNavProvider>
        </div>
      </MediaFrame>
      <figcaption className="mk-mini mt-4 flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
        <span>{caption}</span>
        <button
          type="button"
          className="mk-mini inline-flex min-h-11 items-center text-ink underline-offset-4 hover:underline"
          onClick={() => {
            restoreFixture(enquiryId);
            setId(enquiryId);
          }}
        >
          Start again
        </button>
      </figcaption>
    </figure>
  );
}
