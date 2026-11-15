/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** '1' = static demo build (GitHub Pages without a backend): read public/snapshot/*.json (src/api.ts). */
  readonly VITE_STATIC_DEMO?: string;
  /** Hosted backend origin, e.g. https://nurtureai-backend.onrender.com: API calls go there (src/api.ts). */
  readonly VITE_API_BASE?: string;
  /** "Open Dashboard" link when not on nurtureaispace.github.io (default http://<this host>:3000). */
  readonly VITE_DASHBOARD_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
