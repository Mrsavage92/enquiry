import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

type Status = {
  hasKey: boolean;
  keyHint: string;
  allowedOrigins: string[];
  rotatedAt: string | null;
};

const message = (err: unknown) =>
  err instanceof Error && err.message ? err.message : "That did not save. Try again.";

/**
 * The owner's website form key: create or replace it, and say which of their
 * websites may use it. The key is shown once, straight after it is made; only
 * its last four characters are kept after that.
 */
export function WebsiteFormSettings({ businessId }: { businessId: string }) {
  const [status, setStatus] = useState<Status | null>(null);
  const [freshKey, setFreshKey] = useState("");
  const [origins, setOrigins] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    void (async () => {
      try {
        const { getInboundKeyStatus } = await import("@/lib/server/inbound-key");
        const next = await getInboundKeyStatus({ data: { businessId } });
        if (!live) return;
        setStatus(next);
        setOrigins(next.allowedOrigins.join("\n"));
      } catch (err) {
        if (live) toast.error(message(err));
      }
    })();
    return () => {
      live = false;
    };
  }, [businessId]);

  const rotate = async () => {
    if (status?.hasKey && !window.confirm("Replace the key? The old one stops working at once.")) {
      return;
    }
    setBusy(true);
    try {
      const { rotateInboundKey } = await import("@/lib/server/inbound-key");
      const { key, keyHint } = await rotateInboundKey({ data: { businessId } });
      setFreshKey(key);
      setStatus((s) => ({
        hasKey: true,
        keyHint,
        allowedOrigins: s?.allowedOrigins ?? [],
        rotatedAt: new Date().toISOString(),
      }));
    } catch (err) {
      toast.error(message(err));
    } finally {
      setBusy(false);
    }
  };

  const saveOrigins = async () => {
    setBusy(true);
    try {
      const { setInboundOrigins } = await import("@/lib/server/inbound-key");
      const list = origins.split(/[\s,]+/).filter(Boolean);
      const res = await setInboundOrigins({ data: { businessId, origins: list } });
      setOrigins(res.origins.join("\n"));
      setStatus((s) => (s ? { ...s, allowedOrigins: res.origins } : s));
      toast("Website addresses saved.");
    } catch (err) {
      toast.error(message(err));
    } finally {
      setBusy(false);
    }
  };

  const endpoint =
    typeof window === "undefined"
      ? "/api/inbound/form"
      : `${window.location.origin}/api/inbound/form`;

  return (
    <div>
      <p>
        Your website's enquiry form can send each enquiry here as well as to your email. Put the key
        and the address below into your website's settings.
      </p>
      <p className="mt-3 break-words text-sm">
        <span className="text-stone">Address: </span>
        {endpoint}
      </p>
      <p className="mt-2 text-sm">
        <span className="text-stone">Key: </span>
        {status === null ? "Checking" : status.hasKey ? `ends in ${status.keyHint}` : "none yet"}
      </p>
      {freshKey ? (
        <label className="mt-3 block text-sm">
          <span className="mb-2 block text-stone">
            Your new key. Copy it now, it is not shown again.
          </span>
          <input
            className="field h-11 w-full"
            readOnly
            value={freshKey}
            onFocus={(e) => e.currentTarget.select()}
          />
        </label>
      ) : null}
      <Button
        size="sm"
        variant="secondary"
        className="mt-3"
        disabled={busy || status === null}
        onClick={() => void rotate()}
      >
        {status?.hasKey ? "Replace key" : "Create key"}
      </Button>
      {status?.hasKey ? (
        <div className="mt-4">
          <label className="block text-sm">
            <span className="mb-2 block text-stone">
              Websites allowed to send, one per line (for example https://www.yoursite.com.au)
            </span>
            <textarea
              className="field min-h-24 w-full py-2"
              value={origins}
              onChange={(e) => setOrigins(e.target.value)}
            />
          </label>
          <Button
            size="sm"
            variant="secondary"
            className="mt-3"
            disabled={busy}
            onClick={() => void saveOrigins()}
          >
            Save websites
          </Button>
        </div>
      ) : null}
    </div>
  );
}
