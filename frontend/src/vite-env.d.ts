/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Astronaut App link for the "Open Astronaut App" button and the "Join the crew" QR (default http://<this host>:4173).
   *  The "App link" field in the QR window overrides it (src/appLink.ts). */
  readonly VITE_ASTRONAUT_PUBLIC_URL?: string;
}
