import React, { useEffect, useRef, useState } from 'react';
import { Camera, X, CheckCircle2, AlertCircle, RefreshCw, Volume2, Flashlight } from 'lucide-react';

interface CameraBarcodeScannerProps {
  isOpen: boolean;
  onClose: () => void;
  onScan: (scannedValue: string) => void;
  title?: string;
}

export const playScannerBeep = () => {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1046.5, ctx.currentTime); // C6 note
    gain.gain.setValueAtTime(0.25, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.12);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.12);
  } catch (e) {
    // Audio might be blocked by browser policies
  }
};

// Distinct harsh double-beep ("ديديد") error sound for duplicate attendance or error
export const playErrorBuzzerBeep = () => {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();

    // First beep: 280Hz
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sawtooth';
    osc1.frequency.setValueAtTime(280, ctx.currentTime);
    gain1.gain.setValueAtTime(0.35, ctx.currentTime);
    gain1.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.13);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(ctx.currentTime);
    osc1.stop(ctx.currentTime + 0.13);

    // Second beep ("ديديد"): 220Hz
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sawtooth';
    osc2.frequency.setValueAtTime(220, ctx.currentTime + 0.17);
    gain2.gain.setValueAtTime(0.35, ctx.currentTime + 0.17);
    gain2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(ctx.currentTime + 0.17);
    osc2.stop(ctx.currentTime + 0.35);
  } catch (e) {
    // Audio might be blocked by browser policies
  }
};

export default function CameraBarcodeScanner({
  isOpen,
  onClose,
  onScan,
  title = 'مسح كود / باركود الطالب بالكاميرا'
}: CameraBarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [lastScanned, setLastScanned] = useState<string>('');
  const [torchOn, setTorchOn] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isSupported, setIsSupported] = useState<boolean>(true);
  const scanningRef = useRef<boolean>(true);
  const detectorRef = useRef<any>(null);

  useEffect(() => {
    if (!isOpen) {
      stopCamera();
      return;
    }

    scanningRef.current = true;
    startCamera();

    return () => {
      stopCamera();
    };
  }, [isOpen]);

  const startCamera = async () => {
    setErrorMsg('');
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setIsSupported(false);
        setErrorMsg('الكاميرا غير مدعومة في هذا المتصفح أو البيئة.');
        return;
      }

      // Check BarcodeDetector API
      if ('BarcodeDetector' in window) {
        try {
          detectorRef.current = new (window as any).BarcodeDetector({
            formats: ['code_128', 'qr_code', 'code_39', 'ean_13', 'ean_8', 'upc_a', 'data_matrix']
          });
        } catch (e) {
          console.warn('BarcodeDetector format init error:', e);
        }
      }

      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment',
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      });

      setStream(mediaStream);
      setHasPermission(true);

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        await videoRef.current.play();
      }

      startScanningLoop();
    } catch (err: any) {
      console.error('Camera access error:', err);
      setHasPermission(false);
      setErrorMsg('تعذر فتح الكاميرا: يرجى منح إذن الوصول للكاميرا.');
    }
  };

  const stopCamera = () => {
    scanningRef.current = false;
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  };

  const startScanningLoop = () => {
    const scanInterval = setInterval(async () => {
      if (!scanningRef.current || !videoRef.current) {
        clearInterval(scanInterval);
        return;
      }

      if (videoRef.current.readyState < 2) {
        return; // Video not ready yet
      }

      if (detectorRef.current) {
        try {
          const barcodes = await detectorRef.current.detect(videoRef.current);
          if (barcodes && barcodes.length > 0) {
            const raw = barcodes[0].rawValue;
            if (raw && raw !== lastScanned) {
              handleFoundCode(raw);
            }
          }
        } catch (e) {
          // Frame detection transient error
        }
      }
    }, 220);
  };

  const handleFoundCode = (rawCode: string) => {
    const clean = rawCode.trim();
    if (!clean) return;

    setLastScanned(clean);
    playScannerBeep();
    onScan(clean);

    // Pause briefly to avoid duplicate bursts
    scanningRef.current = false;
    setTimeout(() => {
      scanningRef.current = true;
    }, 1500);
  };

  const toggleTorch = async () => {
    if (!stream) return;
    const track = stream.getVideoTracks()[0];
    if (track && (track.getCapabilities as any)?.torch) {
      try {
        await (track as any).applyConstraints({
          advanced: [{ torch: !torchOn }]
        });
        setTorchOn(!torchOn);
      } catch (e) {
        console.warn('Torch toggle failed:', e);
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-3xl overflow-hidden max-w-lg w-full shadow-2xl relative flex flex-col">
        {/* Header */}
        <div className="p-4 bg-slate-850 border-b border-slate-800 flex items-center justify-between text-white">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-indigo-600 flex items-center justify-center text-white">
              <Camera className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-black">{title}</h3>
              <p className="text-[11px] text-slate-400">وجه الكاميرا نحو باركود أو QR كارت الطالب</p>
            </div>
          </div>
          
          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Video Viewport */}
        <div className="relative aspect-video sm:aspect-square bg-black overflow-hidden flex items-center justify-center">
          <video
            ref={videoRef}
            playsInline
            muted
            className="w-full h-full object-cover"
          />

          {/* Scanner Overlay Guide */}
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center p-8">
            <div className="w-64 h-48 sm:w-72 sm:h-56 border-2 border-indigo-400 rounded-2xl relative shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]">
              {/* Corner Indicators */}
              <div className="absolute -top-1 -left-1 w-6 h-6 border-t-4 border-l-4 border-amber-400 rounded-tl-lg"></div>
              <div className="absolute -top-1 -right-1 w-6 h-6 border-t-4 border-r-4 border-amber-400 rounded-tr-lg"></div>
              <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-4 border-l-4 border-amber-400 rounded-bl-lg"></div>
              <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-4 border-r-4 border-amber-400 rounded-br-lg"></div>

              {/* Animated Laser Scanning Line */}
              <div className="w-full h-0.5 bg-gradient-to-r from-transparent via-amber-400 to-transparent absolute top-1/2 -translate-y-1/2 animate-pulse"></div>

              <div className="absolute bottom-2 inset-x-0 text-center">
                <span className="text-[10px] font-bold text-white bg-black/60 px-2.5 py-1 rounded-full backdrop-blur-xs">
                  ضع الباركود داخل الإطار
                </span>
              </div>
            </div>
          </div>

          {/* Error Banner */}
          {errorMsg && (
            <div className="absolute inset-x-4 top-4 bg-rose-500/90 text-white p-3 rounded-2xl text-xs font-bold flex items-center gap-2 z-10 backdrop-blur-xs">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Success Banner on detection */}
          {lastScanned && (
            <div className="absolute inset-x-4 bottom-4 bg-emerald-600/95 text-white p-3 rounded-2xl text-xs font-black flex items-center justify-between z-10 shadow-lg backdrop-blur-xs animate-bounce">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-200" />
                <span>تم المسح بنجاح: <b className="font-mono">{lastScanned}</b></span>
              </div>
              <Volume2 className="w-4 h-4 text-emerald-200" />
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-slate-900 border-t border-slate-800 flex items-center justify-between gap-2">
          <div className="text-[11px] text-slate-400">
            يدعم باركود كود 128 ورموز QR
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={startCamera}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer text-xs font-bold flex items-center gap-1.5"
              title="إعادة تشغيل الكاميرا"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>تحديث</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
            >
              تم
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
