import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  LogIn, 
  Loader2, 
  Mail, 
  Lock, 
  KeyRound, 
  Phone, 
  X, 
  HelpCircle, 
  ShieldCheck, 
  CheckCircle2, 
  ArrowRight, 
  Eye, 
  EyeOff, 
  Smartphone, 
  RefreshCw, 
  AlertCircle 
} from 'lucide-react';
import { useSettings } from '../contexts/SettingsContext';
import { auth } from '../lib/firebase';
import { RecaptchaVerifier, ConfirmationResult } from 'firebase/auth';

export default function Login({ defaultForgot = false }: { defaultForgot?: boolean }) {
  const [searchParams] = useSearchParams();
  const [loginMode, setLoginMode] = useState<'phone' | 'email' | 'code'>('phone');
  const [phone, setPhone] = useState(searchParams.get('phone') || '');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  // Forgot Password Modal States
  const [showForgotModal, setShowForgotModal] = useState(defaultForgot || searchParams.get('forgot') === 'true');
  const [forgotTab, setForgotTab] = useState<'phone' | 'email'>('phone');

  // Phone SMS Reset State
  const [resetPhone, setResetPhone] = useState('');
  const [smsStep, setSmsStep] = useState<'phone' | 'otp' | 'success'>('phone');
  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);
  const [otpCode, setOtpCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [smsLoading, setSmsLoading] = useState(false);
  const [smsError, setSmsError] = useState('');
  const [smsSuccessMessage, setSmsSuccessMessage] = useState('');
  const [resendTimer, setResendTimer] = useState(0);

  // Email Reset State
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotStatus, setForgotStatus] = useState<{type: 'idle' | 'success' | 'error', message: string}>({type: 'idle', message: ''});
  const [forgotLoading, setForgotLoading] = useState(false);

  const { 
    user, 
    appUser, 
    loading: authLoading, 
    loginWithPhone, 
    loginWithEmail, 
    loginWithCode, 
    signInWithGoogle, 
    resetPassword,
    sendPhoneResetOtp,
    confirmPhoneResetOtp
  } = useAuth();
  
  const { settings } = useSettings();
  const navigate = useNavigate();

  useEffect(() => {
    let interval: any = null;
    if (resendTimer > 0) {
      interval = setInterval(() => {
        setResendTimer(prev => prev - 1);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [resendTimer]);

  useEffect(() => {
    if (!authLoading && (user || appUser)) {
      if (appUser?.role === 'admin' || appUser?.role === 'assistant') {
        navigate('/admin', { replace: true });
      } else {
        navigate('/dashboard', { replace: true });
      }
    }
  }, [user, appUser, authLoading, navigate]);

  const initRecaptchaVerifier = () => {
    try {
      if ((window as any).recaptchaVerifier) {
        try {
          (window as any).recaptchaVerifier.clear();
        } catch (e) {}
        (window as any).recaptchaVerifier = null;
      }
      const verifier = new RecaptchaVerifier(auth, 'recaptcha-sms-container', {
        size: 'invisible',
        callback: () => {
          // reCAPTCHA solved
        },
        'expired-callback': () => {
          setSmsError('انتهت صلاحية التحقق الأمني (reCAPTCHA)، يرجى إعادة المحاولة.');
        }
      });
      (window as any).recaptchaVerifier = verifier;
      return verifier;
    } catch (err: any) {
      console.error("Recaptcha initialization error:", err);
      throw new Error('تعذر تهيئة أداة التحقق الأمني reCAPTCHA. يرجى إعادة تحميل الصفحة.');
    }
  };

  const handleSendPhoneOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSmsError('');
    setSmsSuccessMessage('');

    const clean = resetPhone.replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString()).trim().replace(/\s+/g, '');
    if (!clean || clean.length < 10) {
      setSmsError('يرجى كتابة رقم هاتف مصري صحيح مكون من 11 رقماً (مثال: 01012345678).');
      return;
    }

    setSmsLoading(true);
    try {
      const verifier = initRecaptchaVerifier();
      const confirmRes = await sendPhoneResetOtp(clean, verifier);
      setConfirmationResult(confirmRes);
      setSmsStep('otp');
      setResendTimer(60);
      setSmsSuccessMessage(`تم إرسال كود التحقق في رسالة نصية SMS إلى ${clean}.`);
    } catch (err: any) {
      console.error("SMS Send Error:", err);
      setSmsError(err.message || 'حدث خطأ أثناء إرسال رسالة SMS. تأكد من تفعيل خدمة الهاتف في Firebase.');
    } finally {
      setSmsLoading(false);
    }
  };

  const handleConfirmOtpAndReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setSmsError('');

    const cleanOtp = otpCode.replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString()).trim().replace(/\s+/g, '');
    if (!cleanOtp || cleanOtp.length < 6) {
      setSmsError('يرجى إدخال كود التحقق المكون من 6 أرقام والمستلم في رسالة SMS.');
      return;
    }

    if (!newPassword || newPassword.length < 6) {
      setSmsError('يجب أن لا تقل كلمة المرور الجديدة عن 6 أحرف أو أرقام.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setSmsError('كلمة المرور وتأكيد كلمة المرور غير متطابقتين.');
      return;
    }

    if (!confirmationResult) {
      setSmsError('انتهت صلاحية جلسة كود التحقق. يرجى طلب كود جديد.');
      setSmsStep('phone');
      return;
    }

    setSmsLoading(true);
    try {
      await confirmPhoneResetOtp(confirmationResult, cleanOtp, newPassword, resetPhone);
      setSmsStep('success');
      setSmsSuccessMessage('تم بنجاح التحقق وتعيين كلمة المرور الجديدة! جاري تسجيل الدخول...');
      setTimeout(() => {
        setShowForgotModal(false);
        navigate('/dashboard');
      }, 2000);
    } catch (err: any) {
      console.error("Confirm OTP error:", err);
      if (err.code === 'auth/invalid-verification-code') {
        setSmsError('كود التحقق غير صحيح، يرجى التأكد من الرقم المكتوب في الرسالة.');
      } else if (err.code === 'auth/code-expired') {
        setSmsError('انتهت صلاحية هذا الكود، يرجى طلب كود جديد.');
      } else {
        setSmsError(err.message || 'حدث خطأ أثناء تأكيد الكود وإعادة تعيين كلمة المرور.');
      }
    } finally {
      setSmsLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail) return;
    setForgotLoading(true);
    setForgotStatus({type: 'idle', message: ''});
    try {
      await resetPassword(forgotEmail);
      setForgotStatus({
        type: 'success', 
        message: 'تم إرسال رابط إعادة تعيين كلمة المرور إلى بريدك الإلكتروني بنجاح! تفقد صندوق الوارد أو مجلد الرسائل غير المرغوب فيها (Spam).'
      });
      setForgotEmail('');
    } catch (err: any) {
      if (err.code === 'auth/user-not-found' || (err.message && err.message.includes('غير مسجل'))) {
        setForgotStatus({
          type: 'error', 
          message: err.message || 'هذا البريد الإلكتروني غير مسجل لدينا في المنصة. يرجى التأكد من البريد أو إنشاء حساب جديد.'
        });
      } else if (err.code === 'auth/invalid-email') {
        setForgotStatus({type: 'error', message: 'صيغة البريد الإلكتروني غير صحيحة.'});
      } else {
        setForgotStatus({type: 'error', message: err.message || 'حدث خطأ. تأكد من البريد الإلكتروني وحاول مرة أخرى.'});
      }
    } finally {
      setForgotLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    
    const cleanPhone = phone.replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString()).trim().replace(/\s+/g, '');
    const cleanCode = code.replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString()).trim().replace(/\s+/g, '');

    try {
      if (loginMode === 'phone') {
        await loginWithPhone(cleanPhone, password);
      } else if (loginMode === 'email') {
        await loginWithEmail(email, password);
      } else {
        await loginWithCode(cleanCode, password);
      }
      navigate('/dashboard');
    } catch (err: any) {
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
        setError('بيانات الدخول غير صحيحة. يرجى التأكد من كلمة المرور ورقم الهاتف.');
      } else if (err.code === 'auth/operation-not-allowed') {
        setError('تأكد من تفعيل طريقة تسجيل الدخول هذه في إعدادات المنصة.');
      } else {
        setError(err.message || 'حدث خطأ أثناء تسجيل الدخول. حاول مرة أخرى.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    if (settings.enableGoogleAuth === false) {
      setError('تم إيقاف التسجيل والدخول عبر Google من قبل إدارة المنصة.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await signInWithGoogle();
      navigate('/dashboard');
    } catch (err: any) {
      console.error(err);
      setError(err?.message || 'تعذر تسجيل الدخول بـ Google. حاول مرة أخرى أو استخدم رقم الهاتف.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-grow flex items-center justify-center p-4 bg-slate-50 dark:bg-[#070b14] min-h-[calc(100vh-80px)] transition-colors">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-xl overflow-hidden border border-slate-200 dark:border-slate-800"
      >
        <div className="p-8">
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-indigo-50 dark:bg-indigo-950/60 rounded-2xl flex items-center justify-center mx-auto mb-4 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-800/50">
              <LogIn className="w-8 h-8" />
            </div>
            <h1 className="text-2xl font-black text-slate-900 dark:text-white">تسجيل الدخول</h1>
            <p className="text-slate-500 dark:text-slate-400 font-medium mt-1">مرحباً بك مجدداً في منصتك التعليمية</p>
          </div>

          {/* Mode Switcher */}
          <div className="flex rounded-xl bg-slate-100 dark:bg-slate-800 p-1 mb-6 border border-slate-200 dark:border-slate-700">
            <button
              type="button"
              onClick={() => { setLoginMode('phone'); setError(''); }}
              className={`flex-1 py-2.5 rounded-lg font-bold text-xs sm:text-sm transition-all ${loginMode === 'phone' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-white shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}
            >
              رقم الهاتف
            </button>
            <button
              type="button"
              onClick={() => { setLoginMode('email'); setError(''); }}
              className={`flex-1 py-2.5 rounded-lg font-bold text-xs sm:text-sm transition-all ${loginMode === 'email' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-white shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}
            >
              الإيميل
            </button>
            <button
              type="button"
              onClick={() => { setLoginMode('code'); setError(''); }}
              className={`flex-1 py-2.5 rounded-lg font-bold text-xs sm:text-sm transition-all ${loginMode === 'code' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-white shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}
            >
              كود السنتر 🔑
            </button>
          </div>

          {error && (
            <div className="bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-300 p-4 rounded-xl text-sm font-bold mb-6 border border-rose-100 dark:border-rose-800 flex items-center gap-2">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {loginMode === 'phone' ? (
              <div>
                <label className="block text-slate-700 dark:text-slate-300 text-sm font-bold mb-2">رقم هاتف الطالب</label>
                <div className="relative">
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                    <Phone className="h-5 w-5 text-slate-400 dark:text-slate-500" />
                  </div>
                  <input 
                    type="tel" 
                    required
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    placeholder="010XXXXXXXX"
                    className="w-full p-3 pr-10 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-mono" 
                    dir="ltr"
                  />
                </div>
              </div>
            ) : loginMode === 'email' ? (
              <div>
                <label className="block text-slate-700 dark:text-slate-300 text-sm font-bold mb-2">البريد الإلكتروني</label>
                <div className="relative">
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                    <Mail className="h-5 w-5 text-slate-400 dark:text-slate-500" />
                  </div>
                  <input 
                    type="email" 
                    required
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="example@domain.com"
                    className="w-full p-3 pr-10 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none" 
                    dir="ltr"
                  />
                </div>
              </div>
            ) : (
              <div>
                <label className="block text-slate-700 dark:text-slate-300 text-sm font-bold mb-2">كود الطالب</label>
                <div className="relative">
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                    <KeyRound className="h-5 w-5 text-slate-400 dark:text-slate-500" />
                  </div>
                  <input 
                    type="text" 
                    required
                    value={code}
                    onChange={e => setCode(e.target.value)}
                    placeholder="مثال: 104523 أو رقم الهاتف"
                    className="w-full p-3 pr-10 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-mono" 
                    dir="ltr"
                  />
                </div>
              </div>
            )}

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-slate-700 dark:text-slate-300 text-sm font-bold">كلمة المرور</label>
                <button 
                  type="button" 
                  onClick={() => {
                    setShowForgotModal(true);
                    setSmsStep('phone');
                    setSmsError('');
                    setResetPhone(phone || code || '');
                  }}
                  className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 transition-colors"
                >
                  نسيت كلمة المرور؟
                </button>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-slate-400 dark:text-slate-500" />
                </div>
                <input 
                  type="password" 
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full p-3 pr-10 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none" 
                  dir="ltr"
                />
              </div>
            </div>

            <button 
              type="submit" 
              disabled={loading}
              className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white p-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-md cursor-pointer"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'تسجيل الدخول'}
            </button>
          </form>

          {(settings.enableGoogleAuth ?? true) && (
            <div className="mt-6 border-t border-slate-100 dark:border-slate-800 pt-6">
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={loading}
                className="w-full bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-750 border-2 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 p-3.5 rounded-xl font-bold flex items-center justify-center gap-3 transition-colors shadow-sm cursor-pointer"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                </svg>
                <span>تسجيل الدخول باستخدام Google</span>
              </button>
            </div>
          )}

          <p className="mt-8 text-center text-slate-600 dark:text-slate-400 font-medium">
            ليس لديك حساب؟{' '}
            <Link to="/register" className="text-indigo-600 dark:text-indigo-400 font-bold hover:underline">
              سجل الآن
            </Link>
          </p>
        </div>
      </motion.div>

      {/* Forgot Password Modal with Phone SMS Verification */}
      <AnimatePresence>
        {showForgotModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm" dir="rtl">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-200 w-full max-w-lg relative max-h-[90vh] flex flex-col"
            >
              <button 
                onClick={() => {
                  setShowForgotModal(false);
                  setSmsStep('phone');
                  setSmsError('');
                }}
                className="absolute top-4 left-4 p-2 text-slate-400 hover:text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-full transition-colors z-10"
              >
                <X className="w-5 h-5" />
              </button>
              
              <div className="p-6 sm:p-8 overflow-y-auto">
                <div className="text-center mb-6">
                  <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center mx-auto mb-3 text-indigo-600 shadow-inner">
                    <ShieldCheck className="w-7 h-7" />
                  </div>
                  <h2 className="text-2xl font-black text-slate-900">إعادة تعيين كلمة المرور</h2>
                  <p className="text-slate-500 font-medium text-sm mt-1">التحقق الآمن المباشر عبر رسائل SMS أو البريد الإلكتروني</p>
                </div>

                {/* Tabs Switcher */}
                <div className="flex rounded-xl bg-slate-100 p-1 mb-6 border border-slate-200">
                  <button
                    type="button"
                    onClick={() => { setForgotTab('phone'); setSmsError(''); }}
                    className={`flex-1 py-2.5 rounded-lg font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all ${forgotTab === 'phone' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
                  >
                    <Smartphone className="w-4 h-4" />
                    <span>رسالة SMS على الهاتف</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => { setForgotTab('email'); }}
                    className={`flex-1 py-2.5 rounded-lg font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all ${forgotTab === 'email' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
                  >
                    <Mail className="w-4 h-4" />
                    <span>البريد الإلكتروني</span>
                  </button>
                </div>

                {/* Container for invisible reCAPTCHA */}
                <div id="recaptcha-sms-container"></div>

                {forgotTab === 'phone' ? (
                  <div className="space-y-4">
                    {smsError && (
                      <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-rose-700 text-xs sm:text-sm font-semibold flex items-start gap-3">
                        <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-rose-600" />
                        <div className="flex-1">
                          <p className="leading-relaxed">{smsError}</p>
                          {smsError.includes('غير مسجل') && (
                            <div className="mt-2.5 pt-2.5 border-t border-rose-200/80 flex flex-wrap items-center justify-between gap-2">
                              <span className="text-xs text-rose-800">ليس لديك حساب على المنصة بعد؟</span>
                              <Link
                                to="/register"
                                onClick={() => setShowForgotModal(false)}
                                className="inline-flex items-center gap-1 text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-3 py-1 rounded-lg transition-all"
                              >
                                <span>إنشاء حساب جديد الآن</span>
                                <ArrowRight className="w-3.5 h-3.5 rotate-180" />
                              </Link>
                            </div>
                          )}
                          {smsError.includes('Firebase') && (
                            <p className="text-xs text-rose-500 mt-1">
                              تأكد من تفعيل "Phone" في Firebase Console &gt; Authentication &gt; Sign-in method.
                            </p>
                          )}
                        </div>
                      </div>
                    )}

                    {smsStep === 'phone' && (
                      <form onSubmit={handleSendPhoneOtp} className="space-y-4">
                        <div className="bg-indigo-50/60 border border-indigo-100 rounded-2xl p-4 text-xs sm:text-sm text-indigo-900 flex items-start gap-3">
                          <Smartphone className="w-5 h-5 text-indigo-600 flex-shrink-0 mt-0.5" />
                          <p className="leading-relaxed">
                            أدخل رقم الهاتف المسجل بحسابك لاستلام كود تحقق مكون من 6 أرقام عبر رسالة نصية <strong>SMS</strong> مباشرة على هاتفك.
                          </p>
                        </div>

                        <div>
                          <label className="block text-slate-700 text-sm font-bold mb-2">رقم هاتف الطالب</label>
                          <div className="relative">
                            <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-slate-400">
                              <Phone className="w-5 h-5" />
                            </div>
                            <input 
                              type="tel"
                              required
                              value={resetPhone}
                              onChange={e => setResetPhone(e.target.value)}
                              placeholder="010XXXXXXXX"
                              className="w-full p-3.5 pr-10 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-mono text-base"
                              dir="ltr"
                            />
                          </div>
                          <p className="text-xs text-slate-400 mt-1.5">
                            يقبل الأرقام المصرية (010, 011, 012, 015) أو أي رقم دولي يبدأ بـ +
                          </p>
                        </div>

                        <button
                          type="submit"
                          disabled={smsLoading || !resetPhone.trim()}
                          className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white p-3.5 rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-md cursor-pointer text-sm sm:text-base"
                        >
                          {smsLoading ? (
                            <>
                              <Loader2 className="w-5 h-5 animate-spin" />
                              <span>جاري إرسال الرسالة النصية...</span>
                            </>
                          ) : (
                            <>
                              <Smartphone className="w-5 h-5" />
                              <span>إرسال كود التحقق SMS 📩</span>
                            </>
                          )}
                        </button>
                      </form>
                    )}

                    {smsStep === 'otp' && (
                      <form onSubmit={handleConfirmOtpAndReset} className="space-y-4">
                        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 text-xs sm:text-sm text-emerald-900 flex items-start gap-3">
                          <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                          <div className="flex-1">
                            <p className="font-bold">تم إرسال كود التحقق بنجاح!</p>
                            <p className="text-xs text-emerald-700 mt-0.5 font-mono">
                              أدخل الكود المكون من 6 أرقام المستلم على: <span dir="ltr" className="font-bold">{resetPhone}</span>
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => { setSmsStep('phone'); setSmsError(''); }}
                            className="text-xs text-emerald-800 underline font-bold hover:text-emerald-950"
                          >
                            تغيير الرقم
                          </button>
                        </div>

                        {/* OTP Input */}
                        <div>
                          <label className="block text-slate-700 text-sm font-bold mb-2">كود التحقق المستلم (SMS Code)</label>
                          <input 
                            type="text"
                            required
                            maxLength={6}
                            value={otpCode}
                            onChange={e => setOtpCode(e.target.value.replace(/[^0-9٠-٩]/g, ''))}
                            placeholder="123456"
                            className="w-full p-3.5 bg-slate-50 border-2 border-indigo-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-mono text-center text-2xl tracking-widest font-black"
                            dir="ltr"
                            autoFocus
                          />
                        </div>

                        {/* New Password */}
                        <div>
                          <label className="block text-slate-700 text-sm font-bold mb-2">كلمة المرور الجديدة</label>
                          <div className="relative">
                            <input 
                              type={showNewPassword ? 'text' : 'password'}
                              required
                              value={newPassword}
                              onChange={e => setNewPassword(e.target.value)}
                              placeholder="أدخل كلمة مرور جديدة (6 أحرف على الأقل)"
                              className="w-full p-3.5 pl-10 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                              dir="ltr"
                            />
                            <button
                              type="button"
                              onClick={() => setShowNewPassword(!showNewPassword)}
                              className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 hover:text-slate-600"
                            >
                              {showNewPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                            </button>
                          </div>
                        </div>

                        {/* Confirm Password */}
                        <div>
                          <label className="block text-slate-700 text-sm font-bold mb-2">تأكيد كلمة المرور</label>
                          <input 
                            type={showNewPassword ? 'text' : 'password'}
                            required
                            value={confirmPassword}
                            onChange={e => setConfirmPassword(e.target.value)}
                            placeholder="أعد كتابة كلمة المرور"
                            className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                            dir="ltr"
                          />
                        </div>

                        {/* Submit Reset */}
                        <button
                          type="submit"
                          disabled={smsLoading || otpCode.length < 6 || !newPassword}
                          className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white p-3.5 rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-md cursor-pointer text-sm sm:text-base"
                        >
                          {smsLoading ? (
                            <>
                              <Loader2 className="w-5 h-5 animate-spin" />
                              <span>جاري التحقق وتغيير كلمة المرور...</span>
                            </>
                          ) : (
                            <>
                              <CheckCircle2 className="w-5 h-5" />
                              <span>تأكيد الكود وتعيين كلمة المرور الجديدة 🔐</span>
                            </>
                          )}
                        </button>

                        {/* Resend OTP */}
                        <div className="text-center pt-2">
                          {resendTimer > 0 ? (
                            <p className="text-xs text-slate-500">
                              يمكنك إعادة إرسال الكود بعد <span className="font-mono font-bold text-indigo-600">{resendTimer}</span> ثانية
                            </p>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleSendPhoneOtp()}
                              disabled={smsLoading}
                              className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center justify-center gap-1 mx-auto"
                            >
                              <RefreshCw className="w-3.5 h-3.5" />
                              <span>لم تستلم الكود؟ إعادة إرسال SMS الآن</span>
                            </button>
                          )}
                        </div>
                      </form>
                    )}

                    {smsStep === 'success' && (
                      <div className="text-center py-6 space-y-4">
                        <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
                          <CheckCircle2 className="w-10 h-10" />
                        </div>
                        <h3 className="text-xl font-black text-slate-900">تم التعيين بنجاح!</h3>
                        <p className="text-slate-600 text-sm">
                          {smsSuccessMessage || 'تم تحديث كلمة المرور لحسابك، يمكنك الآن استخدامها لتسجيل الدخول.'}
                        </p>
                        <button
                          type="button"
                          onClick={() => {
                            setShowForgotModal(false);
                            navigate('/dashboard');
                          }}
                          className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-xl font-bold text-sm inline-flex items-center gap-2"
                        >
                          <span>الدخول إلى لوحة التحكم</span>
                          <ArrowRight className="w-4 h-4 rotate-180" />
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  /* Email Tab */
                  <div className="space-y-4">
                    <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200">
                      <h3 className="font-bold text-slate-900 mb-2 text-sm flex items-center gap-2">
                        <Mail className="w-4 h-4 text-indigo-600" />
                        <span>استعادة الحساب عبر البريد الإلكتروني</span>
                      </h3>
                      <p className="text-xs text-slate-500 mb-4 leading-relaxed">
                        أدخل البريد الإلكتروني المسجل به، وسنرسل لك رابطاً مباشراً لتعيين كلمة مرور جديدة لحسابك.
                      </p>
                      <form onSubmit={handleForgotPassword} className="flex gap-2">
                        <input 
                          type="email"
                          required
                          value={forgotEmail}
                          onChange={e => setForgotEmail(e.target.value)}
                          placeholder="example@domain.com"
                          className="flex-1 p-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                          dir="ltr"
                        />
                        <button 
                          type="submit"
                          disabled={forgotLoading}
                          className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white px-4 py-3 rounded-xl font-bold transition-all text-sm whitespace-nowrap cursor-pointer"
                        >
                          {forgotLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'إرسال رابط'}
                        </button>
                      </form>
                      {forgotStatus.type !== 'idle' && (
                        <div className={`mt-3 p-3.5 rounded-xl border text-xs sm:text-sm font-medium ${forgotStatus.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-800'}`}>
                          <div className="flex items-start gap-2">
                            {forgotStatus.type === 'success' ? (
                              <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                            ) : (
                              <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
                            )}
                            <div className="flex-1">
                              <p className="leading-relaxed">{forgotStatus.message}</p>
                              {forgotStatus.type === 'error' && forgotStatus.message.includes('غير مسجل') && (
                                <div className="mt-2 pt-2 border-t border-rose-200/80 flex flex-wrap items-center justify-between gap-2">
                                  <span className="text-xs text-rose-700">تريد إنشاء حساب جديد؟</span>
                                  <Link
                                    to="/register"
                                    onClick={() => setShowForgotModal(false)}
                                    className="inline-flex items-center gap-1 text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-2.5 py-1 rounded-lg transition-all"
                                  >
                                    <span>التسجيل في المنصة</span>
                                    <ArrowRight className="w-3 h-3 rotate-180" />
                                  </Link>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Footer Help */}
                <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                  <span>تواجه مشكلة في استعادة الحساب؟</span>
                  <a 
                    href={`https://wa.me/${(settings?.whatsappNumber || '').replace(/[^0-9]/g, '')}`} 
                    target="_blank" 
                    rel="noreferrer"
                    className="font-bold text-emerald-600 hover:text-emerald-700 flex items-center gap-1"
                  >
                    <Phone className="w-3.5 h-3.5" />
                    <span>تواصل مع السكرتارية</span>
                  </a>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
