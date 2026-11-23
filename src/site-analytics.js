let initialized = false;

function parseAbsoluteUrl(value) {
  if (!value) return null;
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

function canonicalLocation() {
  const canonical = document.head.querySelector('link[rel="canonical"]');
  const url = parseAbsoluteUrl(canonical?.getAttribute('href'));
  if (url?.protocol !== 'https:' || url.origin !== window.location.origin) return null;
  return url.origin + url.pathname;
}

export function initAnalytics() {
  if (initialized || window.location.protocol !== 'https:') return;
  const measurementId = document.head.querySelector('meta[name="ga-measurement-id"]')?.content.trim() ?? '';
  if (!/^G-[A-Z0-9]+$/.test(measurementId)) return;
  const initialLocation = canonicalLocation();
  if (!initialLocation) return;

  initialized = true;
  window.dataLayer ||= [];
  function gtag() { window.dataLayer.push(arguments); }

  const referrer = parseAbsoluteUrl(document.referrer);
  const initialReferrer = referrer?.protocol === 'https:' || referrer?.protocol === 'http:' ? referrer.origin : '';
  let previousLocation = '';

  function sendPageView(pageLocation) {
    if (!pageLocation || previousLocation === pageLocation) return;
    const page = {
      page_location: pageLocation,
      page_title: document.title,
      page_referrer: previousLocation || initialReferrer,
    };
    gtag('set', page);
    if (!previousLocation) {
      // Also disable "Page changes based on browser history events" in the GA4 web stream's Enhanced Measurement settings.
      gtag('config', measurementId, {
        send_page_view: false,
        allow_google_signals: false,
        allow_ad_personalization_signals: false,
      });
    }
    gtag('event', 'page_view', { ...page, send_to: measurementId });
    previousLocation = pageLocation;
  }

  gtag('js', new Date());
  sendPageView(initialLocation);
  window.addEventListener('playroom:navigate', () => sendPageView(canonicalLocation()));

  const script = document.createElement('script');
  script.async = true;
  script.referrerPolicy = 'no-referrer';
  script.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
  document.head.append(script);
}
