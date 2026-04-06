declare global {
  interface Window {
    gtag(...args: [string, ...unknown[]]): void;
    dataLayer: unknown[];
  }
}

const GA_ID = 'G-9BCHW3Z6Y1';

export function trackEvent(
  name: string,
  params?: Record<string, string | boolean | number>,
): void {
  if (typeof window.gtag !== 'function') return;
  window.gtag('event', name, params ?? {});
}

export function trackPageView(path: string): void {
  if (typeof window.gtag !== 'function') return;
  window.gtag('config', GA_ID, { page_path: path });
}
