import React, { useEffect, useState } from 'react';
import { Download, X, Smartphone } from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
// PWAInstallPrompt — Banner de instalación de la PWA
//
// Aparece automáticamente cuando el navegador dispara el evento
// `beforeinstallprompt` (Chrome/Edge en Android y Desktop).
// En iOS muestra instrucciones manuales (Safari no soporta el evento).
// ─────────────────────────────────────────────────────────────────────────────

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const PWAInstallPrompt: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showBanner, setShowBanner]         = useState(false);
  const [showIOS, setShowIOS]               = useState(false);
  const [installing, setInstalling]         = useState(false);

  useEffect(() => {
    // No mostrar si ya está instalada
    if (window.matchMedia('(display-mode: standalone)').matches) return;
    if ((window.navigator as any).standalone === true) return;

    const dismissed = localStorage.getItem('pwa_install_dismissed');
    if (dismissed) {
      const ts = parseInt(dismissed, 10);
      // No mostrar por 7 días si fue descartado
      if (Date.now() - ts < 7 * 24 * 60 * 60 * 1000) return;
    }

    // Chrome / Edge / Samsung Browser — evento nativo
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShowBanner(true);
    };
    window.addEventListener('beforeinstallprompt', handler);

    // iOS Safari — detectar manualmente
    const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
    if (isIOS && isSafari) {
      setTimeout(() => setShowIOS(true), 3000); // mostrar después de 3s
    }

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    setInstalling(true);
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setShowBanner(false);
    }
    setInstalling(false);
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setShowBanner(false);
    setShowIOS(false);
    localStorage.setItem('pwa_install_dismissed', Date.now().toString());
  };

  // ── Banner Chrome/Edge ──────────────────────────────────────────────────────
  if (showBanner && deferredPrompt) {
    return (
      <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:max-w-sm z-[9999] animate-in slide-in-from-bottom-4">
        <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 p-4 flex items-start gap-3">
          <div className="w-12 h-12 bg-indigo-600 rounded-xl flex items-center justify-center flex-shrink-0">
            <img src="/icons/icon-96x96.png" alt="POSmaster" className="w-10 h-10 rounded-lg" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-slate-800 text-sm">Instalar POSmaster</p>
            <p className="text-xs text-slate-500 mt-0.5 leading-snug">
              Accede más rápido desde tu pantalla de inicio, sin abrir el navegador.
            </p>
            <div className="flex gap-2 mt-3">
              <button
                onClick={handleInstall}
                disabled={installing}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700 disabled:opacity-60 transition-colors"
              >
                <Download size={12} />
                {installing ? 'Instalando...' : 'Instalar'}
              </button>
              <button
                onClick={handleDismiss}
                className="px-3 py-1.5 text-slate-500 rounded-lg text-xs hover:bg-slate-100 transition-colors"
              >
                Ahora no
              </button>
            </div>
          </div>
          <button onClick={handleDismiss} className="text-slate-300 hover:text-slate-500 flex-shrink-0">
            <X size={16} />
          </button>
        </div>
      </div>
    );
  }

  // ── Instrucciones iOS ───────────────────────────────────────────────────────
  if (showIOS) {
    return (
      <div className="fixed bottom-4 left-4 right-4 z-[9999]">
        <div className="bg-slate-900 text-white rounded-2xl shadow-2xl p-4 relative">
          <button onClick={handleDismiss} className="absolute top-3 right-3 text-slate-400 hover:text-white">
            <X size={16} />
          </button>
          <div className="flex items-center gap-2 mb-3">
            <Smartphone size={16} className="text-indigo-400" />
            <p className="font-bold text-sm">Instalar POSmaster en iPhone</p>
          </div>
          <ol className="text-xs text-slate-300 space-y-1.5">
            <li className="flex items-start gap-2">
              <span className="text-indigo-400 font-bold flex-shrink-0">1.</span>
              Toca el botón <strong className="text-white">Compartir</strong> <span className="text-lg leading-none">⎋</span> en la barra inferior de Safari
            </li>
            <li className="flex items-start gap-2">
              <span className="text-indigo-400 font-bold flex-shrink-0">2.</span>
              Selecciona <strong className="text-white">"Agregar a pantalla de inicio"</strong>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-indigo-400 font-bold flex-shrink-0">3.</span>
              Toca <strong className="text-white">Agregar</strong> — listo 🎉
            </li>
          </ol>
        </div>
      </div>
    );
  }

  return null;
};

export default PWAInstallPrompt;
