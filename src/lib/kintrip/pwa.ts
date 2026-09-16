// Registers the offline service worker in the published app only.
// Lovable previews, iframes and dev never register — and actively clean up.
const SW_URL = "/sw.js";

function isPreviewHost(hostname: string) {
  return (
    hostname.startsWith("id-preview--") ||
    hostname.startsWith("preview--") ||
    hostname === "lovableproject.com" ||
    hostname.endsWith(".lovableproject.com") ||
    hostname === "lovableproject-dev.com" ||
    hostname.endsWith(".lovableproject-dev.com") ||
    hostname === "beta.lovable.dev" ||
    hostname.endsWith(".beta.lovable.dev")
  );
}

export async function setupOfflineSupport() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

  const inIframe = window.self !== window.top;
  const killSwitch = new URL(window.location.href).searchParams.get("sw") === "off";
  const refuse =
    !import.meta.env.PROD || inIframe || killSwitch || isPreviewHost(window.location.hostname);

  if (refuse) {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.allSettled(
      registrations
        .filter((r) => (r.active?.scriptURL ?? r.installing?.scriptURL ?? "").endsWith(SW_URL))
        .map((r) => r.unregister()),
    );
    return;
  }

  try {
    await navigator.serviceWorker.register(SW_URL, { scope: "/" });
  } catch {
    // Offline caching is a nice-to-have; the saved itinerary still lives on the device.
  }
}
