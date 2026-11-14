// "Judge, be our astronaut": QR code to the Astronaut App on the LAN. Generated locally (qrcode lib, SVG), no CDN.
import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import QRCode from 'qrcode';
import { Smartphone, X } from 'lucide-react';

import { useAppUrl } from '../appLink';

export const JoinCrewModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const url = useAppUrl(); // same link as the "Open Astronaut App" button
  const [svg, setSvg] = useState<string | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

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

  // Portal to <body>: the glass panels use backdrop-filter, which would trap `position: fixed`.
  return createPortal(
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/80 p-4 backdrop-blur-sm" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-labelledby="join-title" onClick={(e) => e.stopPropagation()}
        className="relative max-h-[95vh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-white/15 bg-slate-900/95 p-8 text-center shadow-2xl">
        <button ref={closeRef} onClick={onClose} aria-label="Close" className="absolute right-4 top-4 rounded-xl p-2 text-slate-300 hover:bg-white/10">
          <X className="h-6 w-6" aria-hidden />
        </button>
        <h2 id="join-title" className="flex items-center justify-center gap-3 text-[1.7778rem] font-semibold text-white">
          <Smartphone className="h-8 w-8" aria-hidden /> Join the crew
        </h2>
        <p className="mx-auto mt-3 max-w-lg text-[1.1111rem] leading-relaxed text-slate-200">
          Scan, enter your name, check in. Your name stays on your phone — we only see a code.
        </p>
        <div className="mx-auto mt-6 w-full max-w-[22.2222rem] rounded-2xl bg-white p-4">
          {svg ? <div className="[&>svg]:h-auto [&>svg]:w-full" role="img" aria-label={`QR code for ${url}`} dangerouslySetInnerHTML={{ __html: svg }} />
            : <div className="grid aspect-square place-items-center text-slate-500">QR code…</div>}
        </div>
        <p className="mt-5 break-all font-mono text-[1.3333rem] font-semibold text-white">{url}</p>
        <p className="mt-2 text-[0.8889rem] text-slate-400">Same Wi-Fi as this laptop. Pick “Guest” in the app.</p>
      </div>
    </div>,
    document.body,
  );
};
