import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { GraduationCap, Sparkles, BookOpen, ShieldCheck } from 'lucide-react';
import { useSettings } from '../contexts/SettingsContext';

interface InitialAppLoaderProps {
  isReady: boolean;
  onFinish?: () => void;
  minDisplayTimeMs?: number;
}

export default function InitialAppLoader({
  isReady,
  onFinish,
  minDisplayTimeMs = 1500
}: InitialAppLoaderProps) {
  const { settings } = useSettings();
  const [progress, setProgress] = useState(12);
  const [stepIndex, setStepIndex] = useState(0);
  const [minTimeElapsed, setMinTimeElapsed] = useState(false);
  const [hasCompleted, setHasCompleted] = useState(false);

  const steps = [
    'تهيئة وتأمين الاتصال بالمنصة السحابية...',
    'تحميل المحاضرات والمقررات الدراسية...',
    'مزامنة بيانات الحساب والصلاحيات...',
    'اكتمل التحميل بنجاح! مرحباً بك 🚀'
  ];

  // Minimum display timer
  useEffect(() => {
    const timer = setTimeout(() => {
      setMinTimeElapsed(true);
    }, minDisplayTimeMs);
    return () => clearTimeout(timer);
  }, [minDisplayTimeMs]);

  // Simulated smooth progression
  useEffect(() => {
    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 92 && (!isReady || !minTimeElapsed)) {
          return 92;
        }
        if (prev >= 100) {
          clearInterval(interval);
          return 100;
        }
        const increment = Math.floor(Math.random() * 12) + 8;
        const next = Math.min(prev + increment, 92);
        return next;
      });
    }, 200);

    return () => clearInterval(interval);
  }, [isReady, minTimeElapsed]);

  // Cycle status messages
  useEffect(() => {
    if (progress < 35) setStepIndex(0);
    else if (progress < 65) setStepIndex(1);
    else if (progress < 95) setStepIndex(2);
    else setStepIndex(3);
  }, [progress]);

  // When both isReady and minTimeElapsed are true, finish smoothly
  useEffect(() => {
    if (isReady && minTimeElapsed) {
      setProgress(100);
      setStepIndex(3);
      const finishTimer = setTimeout(() => {
        setHasCompleted(true);
        onFinish?.();
      }, 450);
      return () => clearTimeout(finishTimer);
    }
  }, [isReady, minTimeElapsed, onFinish]);

  if (hasCompleted) return null;

  const teacherName = settings?.teacherName || 'مستر محمد صابر';
  const subject = settings?.subject || 'لغة إنجليزية';

  return (
    <AnimatePresence>
      <motion.div
        key="app-loader"
        initial={{ opacity: 1 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0, scale: 1.03 }}
        transition={{ duration: 0.55, ease: 'easeInOut' }}
        className="fixed inset-0 z-[99999] flex flex-col items-center justify-center bg-slate-950 text-white overflow-hidden select-none"
        dir="rtl"
      >
        {/* Ambient Glowing Orbs */}
        <div className="absolute top-1/4 -right-20 w-96 h-96 bg-indigo-600/20 rounded-full blur-3xl pointer-events-none animate-pulse"></div>
        <div className="absolute bottom-1/4 -left-20 w-96 h-96 bg-teal-500/15 rounded-full blur-3xl pointer-events-none animate-pulse" style={{ animationDelay: '1s' }}></div>

        {/* Center Content Card */}
        <div className="relative z-10 flex flex-col items-center max-w-md w-full px-6 text-center space-y-6">
          
          {/* Glowing Animated Icon Emblem */}
          <div className="relative">
            {/* Outer Rotating Ring */}
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
              className="absolute -inset-4 rounded-3xl border border-indigo-500/30 border-dashed"
            />
            {/* Inner Glow */}
            <div className="absolute -inset-2 bg-gradient-to-r from-indigo-500 to-teal-400 rounded-2xl blur-lg opacity-40"></div>

            {/* Core Box */}
            <div className="relative w-20 h-20 rounded-2xl bg-gradient-to-br from-indigo-600 to-teal-700 flex items-center justify-center text-white shadow-2xl border border-white/20">
              <GraduationCap className="w-10 h-10 text-white drop-shadow-md" />
            </div>

            {/* Floating Sparkle */}
            <motion.div
              animate={{ scale: [1, 1.25, 1], opacity: [0.7, 1, 0.7] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="absolute -top-1 -right-1 w-6 h-6 bg-amber-400 rounded-full flex items-center justify-center text-slate-950 shadow-md"
            >
              <Sparkles className="w-3.5 h-3.5" />
            </motion.div>
          </div>

          {/* Platform & Teacher Brand */}
          <div className="space-y-1.5">
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-wide">
              {teacherName}
            </h1>
            <p className="text-xs sm:text-sm font-bold text-indigo-300 flex items-center justify-center gap-2">
              <BookOpen className="w-4 h-4 text-teal-400" />
              <span>المنصة التعليمية الأولى لـ {subject}</span>
            </p>
          </div>

          {/* Modern Slim Progress Bar */}
          <div className="w-full space-y-2 pt-2">
            <div className="w-full h-2.5 bg-slate-900/90 rounded-full overflow-hidden p-0.5 border border-slate-800 shadow-inner">
              <motion.div
                className="h-full bg-gradient-to-r from-indigo-500 via-teal-400 to-emerald-400 rounded-full transition-all duration-300 relative shadow-sm"
                style={{ width: `${progress}%` }}
              >
                <div className="absolute inset-0 bg-white/20 animate-pulse rounded-full"></div>
              </motion.div>
            </div>

            <div className="flex items-center justify-between text-[11px] font-bold text-slate-400 px-1">
              <span className="text-indigo-300 flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-teal-400" />
                <span>{steps[stepIndex]}</span>
              </span>
              <span className="font-mono font-black text-white">{progress}%</span>
            </div>
          </div>

          {/* Subtitle Footer */}
          <div className="text-[11px] text-slate-500 font-medium">
            يرجى الانتظار ثوانٍ معدودة لتحميل تجربة تعليمية فائقة السرعة...
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
