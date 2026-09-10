import { useState } from "react";
import { PhoneBezel, Still, STILLS } from "@/components/site/still";
import { EmbedNavProvider } from "@/components/site/embed-nav";
import { PhoneDesk } from "@/components/enquiry/phone-desk";
import { usePrototype } from "@/store/prototype-store";
import { demoPhoneEnquiry } from "@/domain/live-demo-isolation";
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
  const demoMode = usePrototype((s) => s.demoMode);
  const enquiry = usePrototype((s) => demoPhoneEnquiry(s, id));
  const restoreFixture = usePrototype((s) => s.restoreFixture);

  if (!demoMode) {
    return (
      <Still
        src={STILLS.quote}
        alt="A prepared quote waiting for review in Enquiry."
        caption={caption}
        phone
        className={cn("mx-auto w-full max-w-[18.5rem] sm:max-w-[22rem]", className)}
      />
    );
  }

  return (
    <figure className={cn("mx-auto w-full max-w-[18.5rem] sm:max-w-[22rem]", className)}>
      <PhoneBezel>
        <div className="flex h-[min(26rem,58dvh)] min-h-[22rem] flex-col overflow-hidden bg-raised sm:h-[min(38rem,75dvh)] sm:min-h-[28rem]">
          <EmbedNavProvider value={{ open: setId, today: () => setId(enquiryId) }}>
            {enquiry ? <PhoneDesk enquiry={enquiry} /> : null}
          </EmbedNavProvider>
        </div>
      </PhoneBezel>
      <figcaption className="mt-3 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-sm text-stone">
        <span>{caption}</span>
        <button
          type="button"
          className="inline-flex min-h-11 items-center font-medium text-ink underline-offset-4 hover:underline"
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
