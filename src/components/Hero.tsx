import { motion } from 'motion/react';
import { PlayCircle, GraduationCap, ArrowLeft, Star, Zap, X } from 'lucide-react';
import { useSettings } from '../contexts/SettingsContext';
import { useAuth } from '../contexts/AuthContext';
import { useState } from 'react';
import { Link } from 'react-router-dom';

function getEmbedVideoUrl(url: string): string {
  if (!url) return '';
  const trimmed = url.trim();
  if (trimmed.includes('youtube.com/watch')) {
    const vParam = new URLSearchParams(trimmed.split('?')[1] || '').get('v');
    if (vParam) return `https://www.youtube.com/embed/${vParam}?autoplay=1`;
  }
  if (trimmed.includes('youtu.be/')) {
    const id = trimmed.split('youtu.be/')[1]?.split(/[?#]/)[0];
    if (id) return `https://www.youtube.com/embed/${id}?autoplay=1`;
  }
  if (trimmed.includes('youtube.com/embed/')) {
    return trimmed.includes('autoplay') ? trimmed : `${trimmed}${trimmed.includes('?') ? '&' : '?'}autoplay=1`;
  }
  if (trimmed.includes('youtube.com/shorts/')) {
    const id = trimmed.split('youtube.com/shorts/')[1]?.split(/[?#]/)[0];
    if (id) return `https://www.youtube.com/embed/${id}?autoplay=1`;
  }
  if (trimmed.includes('vimeo.com/') && !trimmed.includes('player.vimeo.com')) {
    const id = trimmed.split('vimeo.com/')[1]?.split(/[?#]/)[0];
    if (id) return `https://player.vimeo.com/video/${id}?autoplay=1`;
  }
  return trimmed;
}

export default function Hero() {
  const { settings } = useSettings();
  const { user, appUser } = useAuth();
  const [showVideo, setShowVideo] = useState(false);

  // Determine destination based on auth state
  let ctaLink = "/register";
  let ctaText = "ابدأ رحلة التفوق الآن مجاناً";
  if (user || appUser) {
    if (appUser?.role === 'admin' || appUser?.role === 'assistant') {
      ctaLink = "/admin";
      ctaText = "لوحة التحكم والإدارة";
    } else {
      ctaLink = "/dashboard";
      ctaText = "الانتقال إلى منصتي التعليمية";
    }
  }

  // High quality clean educational teacher image
  const defaultImage = "https://images.unsplash.com/photo-1546410531-bb4caa6b424d?q=80&w=2071&auto=format&fit=crop";
  const embedUrl = settings.heroVideoUrl ? getEmbedVideoUrl(settings.heroVideoUrl) : '';

  return (
    <div className="relative bg-gradient-to-b from-indigo-50/40 via-white to-slate-50 dark:from-indigo-950/20 dark:via-[#070b14] dark:to-[#070b14] overflow-hidden transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="pt-12 pb-16 md:pt-20 md:pb-24 flex flex-col lg:flex-row items-center gap-10 lg:gap-12">
          
          {/* Text Content */}
          <div className="flex-1 text-center lg:text-right">
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
            >
              {/* Clean Badge */}
              <div className="flex flex-wrap items-center justify-center lg:justify-start gap-2 mb-5">
                <div className="inline-flex items-center gap-2 py-1.5 px-4 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-black text-xs md:text-sm border border-indigo-200 dark:border-indigo-800 shadow-sm">
                  <span className="w-2 h-2 rounded-full bg-indigo-600 dark:bg-indigo-400 animate-ping"></span>
                  <span>🇬🇧 English Language Excellence</span>
                </div>
                <div className="inline-flex items-center gap-1.5 py-1.5 px-3.5 rounded-full bg-amber-50 dark:bg-amber-950/60 text-amber-900 dark:text-amber-300 font-black text-xs md:text-sm border border-amber-300 dark:border-amber-800 shadow-sm">
                  <span>🎓 دفعة 2027 نحو الدرجة النهائية</span>
                </div>
              </div>

              {/* Main Heading */}
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-slate-900 dark:text-white leading-[1.25] mb-5 tracking-tight">
                طريقك للدرجة النهائية مع <br />
                <span className="text-indigo-600 dark:text-indigo-400">
                  {settings.teacherName}
                </span>
              </h1>

              <p className="text-base sm:text-lg text-slate-600 dark:text-slate-400 mb-7 max-w-2xl mx-auto lg:mx-0 leading-relaxed font-medium">
                شروحات وافية وتدريب مستمر على أنماط الأسئلة الحديثة مع متابعة دقيقة لضمان أعلى المراتب والتفوق.
              </p>
              
              {/* Teacher Highlight Card */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 mb-8 text-right max-w-2xl mx-auto lg:mx-0 shadow-sm">
                <div className="flex items-center gap-2 mb-1.5">
                  <div className="w-7 h-7 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-bold border border-indigo-100 dark:border-indigo-800/60">
                    <Star className="w-4 h-4 fill-indigo-600 dark:fill-indigo-400" />
                  </div>
                  <h3 className="font-black text-slate-900 dark:text-white text-sm sm:text-base">عن المحاضر والمنهج:</h3>
                </div>
                <p className="text-slate-600 dark:text-slate-400 text-xs sm:text-sm leading-relaxed font-medium">
                  {settings.aboutText}
                </p>
              </div>
              
              {/* CTA Buttons */}
              <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-3.5">
                <Link 
                  to={ctaLink} 
                  className="w-full sm:auto bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-3.5 rounded-xl font-black text-sm md:text-base shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2.5 cursor-pointer"
                >
                  <GraduationCap className="w-5 h-5" />
                  <span>{ctaText}</span>
                  {(user || appUser) ? <ArrowLeft className="w-4 h-4" /> : <Zap className="w-4 h-4 text-amber-300 fill-amber-300" />}
                </Link>
                
                {settings.heroVideoUrl && (
                  <button 
                    onClick={() => setShowVideo(true)}
                    className="w-full sm:w-auto bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-750 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 px-6 py-3.5 rounded-xl font-black text-sm md:text-base transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <PlayCircle className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                    <span>فيديو المقدمة</span>
                  </button>
                )}
              </div>
            </motion.div>
          </div>

          {/* Clean Natural Photo Presentation - Large, natural, uncropped, straight to page without distracting borders or curved frames */}
          <motion.div 
            className="flex-1 w-full max-w-lg lg:max-w-xl flex items-center justify-center"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4, delay: 0.15 }}
          >
            <div className="w-full flex items-center justify-center">
              <img 
                src={settings.heroImageBase64 || defaultImage} 
                alt={settings.teacherName || "منصة الأستاذ"} 
                className="w-full h-auto max-h-[580px] object-contain object-bottom drop-shadow-md select-none"
              />
            </div>
          </motion.div>

        </div>
      </div>

      {/* Video Modal */}
      {showVideo && embedUrl && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setShowVideo(false)}>
          <div className="bg-slate-950 rounded-2xl overflow-hidden max-w-4xl w-full aspect-video shadow-2xl relative border border-slate-800" onClick={e => e.stopPropagation()}>
            <button
              onClick={() => setShowVideo(false)}
              className="absolute top-3 left-3 z-10 w-9 h-9 rounded-full bg-black/60 text-white hover:bg-black flex items-center justify-center transition-colors"
              title="إغلاق"
            >
              <X className="w-5 h-5" />
            </button>
            <iframe 
              src={embedUrl} 
              title="فيديو ترحيبي" 
              className="w-full h-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
              allowFullScreen
            ></iframe>
          </div>
        </div>
      )}
    </div>
  );
}
