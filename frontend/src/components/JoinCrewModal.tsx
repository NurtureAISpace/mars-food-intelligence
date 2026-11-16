// "Judge, be our astronaut": QR code to the Astronaut App. Generated locally (qrcode lib, SVG), no CDN.
// The "App link" field is the shared link (src/appLink.ts): editing it updates this QR and the "Open Astronaut App"
// button at once, and it is remembered in this browser. For any network, paste the Cloudflare tunnel URL
// (apps/astronaut/README.md, "Live demo with judges").
import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import QRCode from 'qrcode';
import { AlertTriangle, RotateCcw, Smartphone, X } from 'lucide-react';
import { defaultAppUrl, getAppUrl, isLocalOnlyUrl, setAppUrl, useAppUrl } from '../appLink';

export const JoinCrewModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const url = useAppUrl(); // same link as the "Open Astronaut App" button
  const [draft, setDraft] = useState(getAppUrl);
  const [svg, setSvg] = useState<string | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const localOnly = isLocalOnlyUrl(url);

  useEffect(() => {
    QRCode.toString(url, { type: 'svg', margin: 1, errorCorrectionLevel: 'M', color: { dark: '#020617', light: '#ffffff' } })
      .then(setSvg)
      .catch(() => setSvg(null));
  }, [url]);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const change = (v: string) => { setDraft(v); setAppUrl(v); };
  const reset = () => { setAppUrl(''); setDraft(defaultAppUrl()); };

  // Portal to <body>: the glass panels use backdrop-filter, which would trap `position: fixed`.
  return createPortal(
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/80 p-4 backdrop-blur-sm max-lg:p-2" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-labelledby="join-title" onClick={(e) => e.stopPropagation()}
        className="relative max-h-[95vh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-white/15 bg-slate-900/95 p-8 text-center shadow-2xl max-lg:max-h-[calc(100dvh-1rem)] max-lg:p-5 max-lg:pt-14">
        <button ref={closeRef} onClick={onClose} aria-label="Close" className="absolute right-4 top-4 rounded-xl p-2 text-slate-300 hover:bg-white/10">
          <X className="h-6 w-6" aria-hidden />
        </button>
        <h2 id="join-title" className="flex items-center justify-center gap-3 text-[1.7778rem] font-semibold text-white max-lg:text-[1.5556rem]">
          <Smartphone className="h-8 w-8" aria-hidden /> Join the crew
        </h2>
        <p className="mx-auto mt-3 max-w-lg text-[1.1111rem] leading-relaxed text-slate-200">
          Scan, enter your name, check in. Your name stays on your phone — we only see a code.
        </p>
        <div className="mx-auto mt-6 w-full max-w-[22.2222rem] rounded-2xl bg-white p-4 max-lg:mt-4 max-lg:max-w-[16rem] max-lg:p-3">
          {svg ? <div className="[&>svg]:h-auto [&>svg]:w-full" role="img" aria-label={`QR code for ${url}`} dangerouslySetInnerHTML={{ __html: svg }} />
            : <div className="grid aspect-square place-items-center text-slate-500">QR code…</div>}
        </div>
        <p className="mt-5 break-all font-mono text-[1.3333rem] font-semibold text-white max-lg:mt-3 max-lg:text-[1rem]">{url}</p>

        <div className="mt-6 text-left">
          <label htmlFor="app-link" className="block text-[1rem] font-semibold text-slate-200">App link</label>
          <div className="mt-2 flex gap-2">
            <input id="app-link" type="url" inputMode="url" spellCheck={false} value={draft} onChange={(e) => change(e.target.value)}
              placeholder={defaultAppUrl()}
              className="min-h-[2.6667rem] min-w-0 flex-1 rounded-xl border border-white/20 bg-slate-950/70 px-4 font-mono text-[1rem] text-white placeholder:text-slate-500 focus:border-indigo-400 focus:outline-none" />
            <button type="button" onClick={reset} title="Back to the default link" aria-label="Back to the default link"
              className="grid min-h-[2.6667rem] w-[2.6667rem] shrink-0 place-items-center rounded-xl border border-white/20 text-slate-200 hover:bg-white/10">
              <RotateCcw className="h-5 w-5" aria-hidden />
            </button>
          </div>
          {localOnly ? (
            <p role="alert" className="mt-3 flex items-start gap-2 rounded-xl border border-watch/50 bg-watch/10 px-4 py-3 text-[0.8889rem] text-amber-100">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-watch" aria-hidden />
              This link points to “localhost”: a phone would open itself, not this laptop. Paste the tunnel link
              (https://….trycloudflare.com) or this laptop’s Wi-Fi address.
            </p>
          ) : (
            <p className="mt-2 text-[0.8889rem] text-slate-400">
              Used by this QR code and the “Open Astronaut App” button. A https://….trycloudflare.com link works on any network.
            </p>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
};
