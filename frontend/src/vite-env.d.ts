/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** URL of the offline-first Astronaut App (apps/astronaut). */
  readonly VITE_ASTRONAUT_APP_URL?: string;
  /** Phone-reachable Astronaut App for the "Join the crew" QR (default http://<this host>:4173). */
  readonly VITE_ASTRONAUT_PUBLIC_URL?: string;
}
