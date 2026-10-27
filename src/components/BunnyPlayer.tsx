import React, { useState, useEffect, useRef, useCallback } from 'react';
import { AlertCircle, RefreshCw, Play, Maximize, Minimize } from 'lucide-react';

export interface BunnyPlayerProps {
  /** The Bunny.net Stream Video GUID / ID */
  videoId: string;
  /** Student full name for the anti-recording watermark */
  studentName?: string;
  /** Student ID, code, or phone number for the watermark */
  studentId?: string | number;
  /** Optional Bunny.net Video Library ID (defaults to primary library) */
  libraryId?: string | number;
  /** Optional video title for accessibility and metadata */
  title?: string;
  /** Auto play video on load */
  autoPlay?: boolean;
  /** Start video muted */
  muted?: boolean;
  /** Loop playback */
  loop?: boolean;
  /** Additional CSS classes for wrapper */
  className?: string;
  /** Custom aspect ratio (defaults to 16/9) */
  aspectRatio?: string;
  /** Security token authentication key for Bunny Stream */
  watermarkTokenKey?: string;
}

export default function BunnyPlayer({
  videoId,
  studentName = 'طالب المنصة',
  studentId = '',
  libraryId = '767125',
  title = 'محاضرة تعليمية',
  autoPlay = false,
  muted = false,
  loop = false,
  className = '',
  aspectRatio = '16/9',
  watermarkTokenKey = ''
}: BunnyPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  // Single Elegant Moving Watermark (Coordinates % and subtle drift)
  const [watermarkPos, setWatermarkPos] = useState({
    top: 25,
    left: 20
  });

  // Randomize Watermark Position Every 6 Seconds across safe viewing boundaries
  useEffect(() => {
    const updatePositions = () => {
      // Safe boundary (16% to 74%) so it stays well clear of edges and controls
      const randomTop = Math.floor(Math.random() * 58) + 16;
      const randomLeft = Math.floor(Math.random() * 52) + 12;

      setWatermarkPos({
        top: randomTop,
        left: randomLeft
      });
    };

    const interval = setInterval(updatePositions, 6000);
    return () => clearInterval(interval);
  }, []);

  const exitFullscreen = useCallback(async () => {
    const doc: any = document;
    try {
      if (doc.fullscreenElement || doc.webkitFullscreenElement || doc.mozFullScreenElement || doc.msFullscreenElement) {
        if (doc.exitFullscreen) {
          await doc.exitFullscreen();
        } else if (doc.webkitExitFullscreen) {
          await doc.webkitExitFullscreen();
        } else if (doc.mozCancelFullScreen) {
          await doc.mozCancelFullScreen();
        } else if (doc.msExitFullscreen) {
          await doc.msExitFullscreen();
        }
      }
    } catch (err) {
      console.warn('Exit fullscreen error:', err);
    }
    setIsFullscreen(false);
  }, []);

  const toggleFullscreen = useCallback(async (e?: React.SyntheticEvent) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    const elem: any = containerRef.current;
    if (!elem) return;

    const doc: any = document;
    const isCurrentlyFs = Boolean(
      doc.fullscreenElement ||
      doc.webkitFullscreenElement ||
      doc.mozFullScreenElement ||
      doc.msFullscreenElement
    );

    if (!isCurrentlyFs) {
      try {
        if (elem.requestFullscreen) {
          await elem.requestFullscreen({ navigationUI: 'hide' });
        } else if (elem.webkitRequestFullscreen) {
          await elem.webkitRequestFullscreen();
        } else if (elem.mozRequestFullScreen) {
          await elem.mozRequestFullScreen();
        } else if (elem.msRequestFullscreen) {
          await elem.msRequestFullscreen();
        }
      } catch (err) {
        console.warn('Native fullscreen request fallback to viewport mode:', err);
      }
      setIsFullscreen(true);
    } else {
      await exitFullscreen();
    }
  }, [exitFullscreen]);

  // Intercept & Handle Browser Fullscreen Changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      const doc: any = document;
      const fsElem = (
        doc.fullscreenElement ||
        doc.webkitFullscreenElement ||
        doc.mozFullScreenElement ||
        doc.msFullscreenElement
      );

      if (!fsElem) {
        setIsFullscreen(false);
      } else {
        setIsFullscreen(true);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullscreen) {
        exitFullscreen();
      } else if ((e.key === 'f' || e.key === 'F') && !['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) {
        toggleFullscreen();
      }
    };

    const handleBunnyMessage = (event: MessageEvent) => {
      if (!event.data) return;
      try {
        let msg = event.data;
        if (typeof msg === 'string' && (msg.includes('fullscreen') || msg.includes('requestFullscreen'))) {
          try { msg = JSON.parse(msg); } catch (_) {}
        }
        if (typeof msg === 'object' && (msg.type === 'fullscreen' || msg.event === 'fullscreen' || msg.action === 'fullscreen')) {
          toggleFullscreen();
        }
      } catch (_) {}
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('message', handleBunnyMessage);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
      document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('message', handleBunnyMessage);
    };
  }, [isFullscreen, toggleFullscreen, exitFullscreen]);

  if (!videoId) {
    return (
      <div className={`w-full bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center text-slate-400 ${className}`}>
        <div className="w-12 h-12 mx-auto mb-3 text-rose-400 bg-rose-950/50 rounded-full flex items-center justify-center">
          <AlertCircle className="w-6 h-6" />
        </div>
        <h4 className="font-bold text-white text-base mb-1">تعذر تشغيل الفيديو</h4>
        <p className="text-xs text-slate-400">معرّف الفيديو (Video ID) غير متوفر.</p>
      </div>
    );
  }

  // Construct Bunny.net Stream Embed URL
  const queryParams = new URLSearchParams({
    autoplay: autoPlay ? 'true' : 'false',
    muted: muted ? 'true' : 'false',
    loop: loop ? 'true' : 'false',
    preload: 'true',
    responsive: 'true'
  });

  if (watermarkTokenKey) {
    queryParams.set('token', watermarkTokenKey);
  }

  const embedUrl = `https://iframe.mediadelivery.net/embed/${libraryId}/${videoId}?${queryParams.toString()}`;

  // Watermark text formulation (clean format: الاسم • الرقم)
  const watermarkText = studentId 
    ? `${studentName} • ${studentId}` 
    : studentName;

  return (
    <div
      ref={containerRef}
      onDoubleClick={toggleFullscreen}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`bunny-player-container relative w-full overflow-hidden bg-black select-none group transition-all duration-300 isolate ${
        isFullscreen
          ? 'fixed inset-0 z-[2147483647] !w-screen !h-screen !max-w-none !max-h-none !rounded-none !m-0 !p-0 flex items-center justify-center bg-black'
          : `rounded-2xl shadow-2xl border border-slate-800 ${className}`
      }`}
      style={{ aspectRatio: isFullscreen ? 'auto' : aspectRatio }}
    >
      {/* 1. SIMPLE & ELEGANT LOADING SCREEN */}
      {!isLoaded && !hasError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950 text-slate-300 z-10 transition-opacity duration-500">
          <div className="relative flex items-center justify-center mb-3">
            <div className="w-12 h-12 border-2 border-indigo-500/20 border-t-indigo-400 rounded-full animate-spin" />
            <Play className="w-4 h-4 text-indigo-400 absolute opacity-80" />
          </div>
          <span className="text-xs font-medium text-slate-400">
            جاري تجهيز المحاضرة...
          </span>
        </div>
      )}

      {/* 2. Error Fallback */}
      {hasError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950 text-slate-300 p-6 text-center z-10">
          <div className="text-rose-400 text-2xl mb-2">⚠️</div>
          <h4 className="font-bold text-white text-sm mb-1">تعذر تحميل مشغل الفيديو</h4>
          <p className="text-xs text-slate-400 mb-3 max-w-sm">
            يرجى التأكد من اتصال الإنترنت والمحاولة مجدداً.
          </p>
          <button
            type="button"
            onClick={() => {
              setHasError(false);
              setIsLoaded(false);
            }}
            className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm"
          >
            <RefreshCw className="w-3 h-3" />
            <span>إعادة المحاولة</span>
          </button>
        </div>
      )}

      {/* 3. Responsive Bunny Stream Iframe with Fullscreen Permissions */}
      <iframe
        ref={iframeRef}
        src={embedUrl}
        title={title}
        loading="lazy"
        className={`w-full h-full border-0 absolute inset-0 z-0 ${isFullscreen ? '!h-screen !w-screen object-contain' : ''}`}
        allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture; fullscreen;"
        allowFullScreen
        onLoad={() => setIsLoaded(true)}
        onError={() => setHasError(true)}
      />

      {/* ================================================================= */}
      {/* 4. CLEAN & ELEGANT WATERMARK (Placing after iframe guarantees top) */}
      {/* Sleek, soft semi-transparent pill that glides gently every 6s     */}
      {/* ================================================================= */}
      <div
        className="absolute pointer-events-none select-none z-[2147483640] transition-all duration-1000 ease-in-out flex flex-col items-center"
        style={{
          top: `${watermarkPos.top}%`,
          left: `${watermarkPos.left}%`,
          transform: 'translate3d(0, 0, 100px)',
          willChange: 'top, left'
        }}
      >
        <div 
          className={`bg-slate-950/40 backdrop-blur-[2px] border border-white/10 rounded-full text-white/70 font-sans font-medium tracking-wide flex items-center shadow-sm whitespace-nowrap ${
            isFullscreen 
              ? 'px-4 py-1.5 text-sm bg-slate-950/45 text-white/80 border-white/15' 
              : 'px-3 py-1 text-xs'
          }`}
          style={{ textShadow: '1px 1px 2px rgba(0,0,0,0.85)' }}
        >
          <span>{watermarkText}</span>
        </div>
      </div>

      {/* Subtle Permanent Corner Mark for Security Audit */}
      <div 
        className="absolute bottom-2 left-3 pointer-events-none select-none z-[2147483639] opacity-35 text-[10px] font-mono text-white tracking-wider"
        style={{ transform: 'translate3d(0, 0, 100px)' }}
      >
        {watermarkText}
      </div>

      {/* ================================================================= */}
      {/* 5. MINIMALIST FULLSCREEN TOGGLE (ICON ONLY - NO TEXT LABELS)      */}
      {/* Bottom-Right corner icon overlay                                 */}
      {/* ================================================================= */}
      <div 
        className={`absolute bottom-3 right-3 z-[2147483645] transition-opacity duration-200 ${
          isHovered || isFullscreen ? 'opacity-100' : 'opacity-0 sm:opacity-0 group-hover:opacity-100'
        }`}
      >
        <button
          type="button"
          onClick={toggleFullscreen}
          className="p-2 bg-black/60 hover:bg-black/90 text-white rounded-lg border border-white/20 hover:border-white/40 shadow-lg backdrop-blur-sm transition-all hover:scale-110 active:scale-95 cursor-pointer flex items-center justify-center"
          aria-label={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
        >
          {isFullscreen ? (
            <Minimize className="w-4 h-4 text-white" />
          ) : (
            <Maximize className="w-4 h-4 text-white" />
          )}
        </button>
      </div>

      {/* ================================================================= */}
      {/* 6. TOP-LEFT EXIT BUTTON IN FULLSCREEN MODE (ICON ONLY - NO TEXT)  */}
      {/* ================================================================= */}
      {isFullscreen && (
        <div className="absolute top-3 left-3 z-[2147483645]">
          <button
            type="button"
            onClick={exitFullscreen}
            className="p-2 bg-black/60 hover:bg-black/90 text-white rounded-lg border border-white/20 hover:border-white/40 shadow-lg backdrop-blur-sm transition-all hover:scale-110 active:scale-95 cursor-pointer flex items-center justify-center"
            aria-label="Exit Fullscreen"
          >
            <Minimize className="w-4 h-4 text-white" />
          </button>
        </div>
      )}
    </div>
  );
}
