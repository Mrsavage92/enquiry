import { useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { SheetContent } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { usePrototype } from "@/store/prototype-store";
import { useAppInstall } from "./install-app";
import { useEmbed } from "@/lib/embed";

export function InstallCue() {
  const dismissed = usePrototype((s) => s.installDismissed);
  const dismiss = usePrototype((s) => s.dismissInstall);
  const { promptEvent, installed, ios, standalone, install } = useAppInstall();
  const embed = useEmbed();
  const [open, setOpen] = useState(false);

  if (standalone || installed || dismissed || embed) return null;

  const close = () => {
    setOpen(false);
    dismiss();
  };

  return (
    <>
      <button
        type="button"
        className="mt-0.5 inline-flex min-h-11 items-center text-xs text-stone underline-offset-4 hover:text-ink hover:underline"
        onClick={() => setOpen(true)}
      >
        Add to this phone
      </button>
      <Dialog open={open} onOpenChange={(v) => (v ? setOpen(true) : close())}>
        <SheetContent title="Enquiry on this phone">
          <p className="text-sm leading-relaxed text-ink-2">
            Today, a job, send. Add Enquiry to the Home Screen and it opens as the app - not a tab.
          </p>
          <div className="mt-5 flex flex-col gap-2">
            {promptEvent ? (
              <Button
                className="min-h-12 w-full"
                onClick={() => {
                  void install();
                  close();
                }}
              >
                Add to Home Screen
              </Button>
            ) : ios ? (
              <p className="text-sm leading-relaxed text-ink-2">
                Share, then Add to Home Screen. Enquiry will sit next to Messages.
              </p>
            ) : (
              <p className="text-sm leading-relaxed text-ink-2">
                Use Add to Home Screen in the browser menu. Enquiry opens full-screen from then on.
              </p>
            )}
            <Button variant="secondary" className="min-h-12 w-full" onClick={close}>
              Not now
            </Button>
          </div>
        </SheetContent>
      </Dialog>
    </>
  );
}
