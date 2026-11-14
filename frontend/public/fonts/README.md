# Bundled web fonts (offline-safe)

Self-hosted so the app renders identically with no internet (projector / demo laptop).
Latin subset, variable weight (400–700), WOFF2. Loaded via `@font-face` in `src/index.css`.

| File | Family | Use | Upstream |
|------|--------|-----|----------|
| `space-grotesk-latin-var.woff2` | Space Grotesk | display headlines | github.com/floriankarsten/space-grotesk |
| `inter-latin-var.woff2` | Inter | body text | github.com/rsms/inter |
| `jetbrains-mono-latin-var.woff2` | JetBrains Mono | numbers, labels | github.com/JetBrains/JetBrainsMono |

All three are licensed under the SIL Open Font License 1.1 (https://openfontlicense.org),
which permits bundling and redistribution with software. Files were taken unmodified from
the Google Fonts distribution of each family.

If a file is missing the CSS falls back to system fonts (Segoe UI / system-ui, Consolas / ui-monospace).
