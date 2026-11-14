// ONE source for the Astronaut App link, used by both the "Open Astronaut App" button and the "Join the crew" QR.
// Order: the "App link" saved in the QR modal (localStorage) -> VITE_ASTRONAUT_PUBLIC_URL -> http://<this host>:4173
// (the production build served by `npm run preview` in apps/astronaut; the astronaut dev server is never linked).
import { useEffect, useState } from 'react';

const KEY = 'nurtureai.appLink';
const EVENT = 'nurtureai:applink';

export function defaultAppUrl(): string {
  return import.meta.env.VITE_ASTRONAUT_PUBLIC_URL || `http://${window.location.hostname}:4173`;
}

function storedAppUrl(): string | null {
  try {
    const v = window.localStorage.getItem(KEY);
    return v && v.trim() ? v.trim() : null;
  } catch {
    return null; // storage blocked (private mode etc.): fall back to the default
  }
}

export function getAppUrl(): string {
  return storedAppUrl() ?? defaultAppUrl();
}

/** Save the link (empty = back to the default) and tell every open view. */
export function setAppUrl(value: string): void {
  try {
    if (value.trim()) window.localStorage.setItem(KEY, value.trim());
    else window.localStorage.removeItem(KEY);
  } catch {
    /* not persisted, but the event below still updates this tab */
  }
  window.dispatchEvent(new Event(EVENT));
}

/** A phone cannot open these: they point at the phone itself. */
export const isLocalOnlyUrl = (u: string) => /(^|\/\/)(localhost|127\.0\.0\.1)(:|\/|$)/i.test(u.trim());

/** Current app link; re-renders when it changes in this tab (QR modal) or another tab (storage event). */
export function useAppUrl(): string {
  const [url, setUrl] = useState(getAppUrl);
  useEffect(() => {
    const update = () => setUrl(getAppUrl());
    window.addEventListener(EVENT, update);
    window.addEventListener('storage', update);
    return () => {
      window.removeEventListener(EVENT, update);
      window.removeEventListener('storage', update);
    };
  }, []);
  return url;
}
