const SESSION_KEY = "enquiry-launch-session";
const WAITLIST_KEY = "enquiry-waitlist-id";
const QUALIFIED_KEY = "enquiry-waitlist-qualified";
const SKIPPED_KEY = "enquiry-waitlist-skipped";
const FIRST_TOUCH_KEY = "enquiry-first-touch";
const LATEST_TOUCH_KEY = "enquiry-latest-touch";
export const WAITLIST_EVENT = "enquiry-waitlist";

export type Touch = {
  utm_source: string;
  utm_medium: string;
  utm_campaign: string;
  utm_content: string;
  referrer: string;
  linkedin_post_id: string;
  landing_path: string;
};

function emptyTouch(): Touch {
  return {
    utm_source: "",
    utm_medium: "",
    utm_campaign: "",
    utm_content: "",
    referrer: "",
    linkedin_post_id: "",
    landing_path: "",
  };
}

export function launchSessionId(): string {
  if (typeof window === "undefined") return "";
  let id = localStorage.getItem(SESSION_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

export function storedWaitlistId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(WAITLIST_KEY);
}

export function storeWaitlistId(id: string) {
  if (!id) return;
  localStorage.setItem(WAITLIST_KEY, id);
  window.dispatchEvent(new Event(WAITLIST_EVENT));
}

export function storedQualified(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(QUALIFIED_KEY) === "1";
}

export function storeQualified() {
  localStorage.setItem(QUALIFIED_KEY, "1");
  window.dispatchEvent(new Event(WAITLIST_EVENT));
}

export function storedWaitlistDone(): boolean {
  if (typeof window === "undefined") return false;
  return storedQualified() || localStorage.getItem(SKIPPED_KEY) === "1";
}

export function storeWaitlistSkipped() {
  localStorage.setItem(SKIPPED_KEY, "1");
  window.dispatchEvent(new Event(WAITLIST_EVENT));
}

function readTouch(raw: string | null): Touch | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return null;
    const o = parsed as Record<string, unknown>;
    return {
      utm_source: typeof o.utm_source === "string" ? o.utm_source.slice(0, 80) : "",
      utm_medium: typeof o.utm_medium === "string" ? o.utm_medium.slice(0, 80) : "",
      utm_campaign: typeof o.utm_campaign === "string" ? o.utm_campaign.slice(0, 120) : "",
      utm_content: typeof o.utm_content === "string" ? o.utm_content.slice(0, 120) : "",
      referrer: typeof o.referrer === "string" ? o.referrer.slice(0, 400) : "",
      linkedin_post_id: typeof o.linkedin_post_id === "string" ? o.linkedin_post_id.slice(0, 80) : "",
      landing_path: typeof o.landing_path === "string" ? o.landing_path.slice(0, 200) : "",
    };
  } catch {
    return null;
  }
}

function isMeaningful(touch: Touch) {
  return Boolean(
    touch.utm_source ||
      touch.utm_campaign ||
      touch.linkedin_post_id ||
      touch.referrer ||
      (touch.landing_path && touch.landing_path !== "/"),
  );
}

export function captureAttribution(): { first: Touch | null; latest: Touch | null } {
  if (typeof window === "undefined") return { first: null, latest: null };
  const params = new URLSearchParams(window.location.search);
  const touch: Touch = {
    utm_source: params.get("utm_source") ?? "",
    utm_medium: params.get("utm_medium") ?? "",
    utm_campaign: params.get("utm_campaign") ?? "",
    utm_content: params.get("utm_content") ?? "",
    referrer: document.referrer,
    linkedin_post_id: params.get("li") ?? params.get("linkedin_post_id") ?? "",
    landing_path: `${window.location.pathname}${window.location.search}`.slice(0, 200),
  };
  if (isMeaningful(touch) || params.toString()) {
    if (!localStorage.getItem(FIRST_TOUCH_KEY)) {
      localStorage.setItem(FIRST_TOUCH_KEY, JSON.stringify(touch));
    }
    localStorage.setItem(LATEST_TOUCH_KEY, JSON.stringify(touch));
  }
  return {
    first: readTouch(localStorage.getItem(FIRST_TOUCH_KEY)),
    latest: readTouch(localStorage.getItem(LATEST_TOUCH_KEY)) ?? (isMeaningful(touch) ? touch : emptyTouch()),
  };
}

export function firstTouch(): Touch {
  if (typeof window === "undefined") return emptyTouch();
  captureAttribution();
  return readTouch(localStorage.getItem(FIRST_TOUCH_KEY)) ?? emptyTouch();
}

export function currentTouch(): Touch {
  if (typeof window === "undefined") return emptyTouch();
  captureAttribution();
  return (
    readTouch(localStorage.getItem(LATEST_TOUCH_KEY)) ??
    readTouch(localStorage.getItem(FIRST_TOUCH_KEY)) ??
    emptyTouch()
  );
}
