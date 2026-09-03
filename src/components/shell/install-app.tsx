import { Share } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAppInstall } from "@/lib/use-app-install";

export function InstallAppBlock() {
  const { promptEvent, installed, ios, standalone, install } = useAppInstall();
  const onPhone = standalone || installed;

  return (
    <li>
      <p className="font-medium">Enquiry app</p>
      {onPhone ? (
        <p className="mt-1 text-sm text-ok">On this phone. Opens as Enquiry, not a browser tab.</p>
      ) : (
        <>
          <p className="mt-1 text-sm text-ink-2">
            Today, a job, send. Add it to the Home Screen so it opens as the app.
          </p>
          {promptEvent ? (
            <Button className="mt-3" size="sm" onClick={() => void install()}>
              Add to Home Screen
            </Button>
          ) : ios ? (
            <p className="mt-3 flex items-start gap-2 text-sm text-ink-2">
              <Share className="mt-0.5 size-4 shrink-0" aria-hidden />
              <span>
                Share, then Add to Home Screen. Enquiry opens full-screen, with Today at the bottom.
              </span>
            </p>
          ) : (
            <p className="mt-3 text-sm text-ink-2">
              Add Enquiry to the Home Screen from the browser menu. It will open as the app, not a
              tab.
            </p>
          )}
        </>
      )}
    </li>
  );
}

export function InstallAppRow({ onDone }: { onDone?: () => void }) {
  const { promptEvent, installed, ios, standalone, install } = useAppInstall();
  if (standalone || installed) {
    return <p className="px-2 py-2 text-sm text-ok">Enquiry is on this phone.</p>;
  }
  if (promptEvent) {
    return (
      <Button
        className="mt-1 min-h-12 w-full"
        onClick={() => {
          void install();
          onDone?.();
        }}
      >
        Add to Home Screen
      </Button>
    );
  }
  return (
    <p className="px-2 py-2 text-sm leading-relaxed text-ink-2">
      {ios ? (
        <>Share, then Add to Home Screen. Enquiry opens as an app - Today, a job, send.</>
      ) : (
        <>Add Enquiry to the Home Screen. It opens as the app, not a tab.</>
      )}
    </p>
  );
}
