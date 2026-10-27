import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useSettings } from '../contexts/SettingsContext';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { UserPlus, Loader2, Mail, Lock, User, Phone, GraduationCap } from 'lucide-react';

export default function Register() {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [parentPhone, setParentPhone] = useState('');
  const [grade, setGrade] = useState('الصف الثالث الثانوي');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  const { user, appUser, loading: authLoading, registerUser, signInWithGoogle } = useAuth();
  const { settings } = useSettings();
  const navigate = useNavigate();

  React.useEffect(() => {
    if (!authLoading && (user || appUser)) {
      if (appUser?.role === 'admin' || appUser?.role === 'assistant') {
        navigate('/admin', { replace: true });
      } else {
        navigate('/dashboard', { replace: true });
      }
    }
  }, [user, appUser, authLoading, navigate]);

  const handleGoogleRegister = async () => {
    if (settings.enableGoogleAuth === false) {
      setError('التسجيل عبر Google غير متاح حالياً بأمر إدارة المنصة.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await signInWithGoogle();
      navigate('/dashboard');
    } catch (err: any) {
      console.error(err);
      setError(err?.message || 'تعذر التسجيل عبر Google. يرجى استخدام نموذج التسجيل أدناه.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!name.trim()) {
      return setError('يرجى كتابة الاسم الرباعي الكامل.');
    }

    const cleanPhone = phone.replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString()).trim().replace(/\s+/g, '');
    const cleanParentPhone = parentPhone.replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString()).trim().replace(/\s+/g, '');

    if (!cleanPhone) {
      return setError('يرجى كتابة رقم هاتف الطالب.');
    }

    if (!cleanParentPhone) {
      return setError('يرجى كتابة رقم هاتف ولي الأمر.');
    }
    
    if (password !== confirmPassword) {
      return setError('كلمتا المرور غير متطابقتين.');
    }
    
    if (password.length < 6) {
      return setError('يجب أن لا تقل كلمة المرور عن 6 أحرف.');
    }

    setLoading(true);
    
    try {
      await registerUser({
        name,
        phone: cleanPhone,
        parentPhone: cleanParentPhone,
        grade,
        pass: password,
        email: email.trim() || undefined
      });
      navigate('/dashboard');
    } catch (err: any) {
      if (err.code === 'auth/email-already-in-use' || (err.message && (err.message.includes('already-in-use') || err.message.includes('مسجل بالفعل')))) {
        setError('رقم الهاتف أو الحساب هذا مسجل بالفعل. يمكنك تسجيل الدخول مباشرة.');
      } else if (err.code === 'auth/weak-password' || (err.message && err.message.includes('6 characters'))) {
        setError('كلمة المرور ضعيفة جداً، يجب أن تكون 6 أحرف أو أرقام على الأقل.');
      } else if (err.code === 'auth/invalid-email' || (err.message && err.message.includes('invalid-email'))) {
        setError('صيغة البريد الإلكتروني غير صحيحة.');
      } else {
        setError(err.message || 'حدث خطأ أثناء التسجيل. يرجى التأكد من البيانات والمحاولة مرة أخرى.');
      }
    } finally {
      setLoading(false);
    }
  };

  const gradeOptions = settings.grades && settings.grades.length > 0 
    ? settings.grades 
    : ['الصف الأول الثانوي', 'الصف الثاني الثانوي', 'الصف الثالث الثانوي'];

  return (
    <div className="flex-grow flex items-center justify-center p-4 bg-slate-50 dark:bg-[#070b14] min-h-[calc(100vh-80px)] py-12 transition-colors">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-xl bg-white dark:bg-slate-900 rounded-3xl shadow-xl overflow-hidden border border-slate-200 dark:border-slate-800"
      >
        <div className="p-8">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-emerald-50 dark:bg-emerald-950/60 rounded-2xl flex items-center justify-center mx-auto mb-4 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-800/50">
              <UserPlus className="w-8 h-8" />
            </div>
            <h1 className="text-2xl font-black text-slate-900 dark:text-white">إنشاء حساب جديد</h1>
            <p className="text-slate-500 dark:text-slate-400 font-medium mt-1">سجل برقم هاتفك وباسوردك وسجل دخولك بكل سهولة</p>
          </div>

          {error && (
            <div className="bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 p-4 rounded-2xl text-sm font-bold mb-6 border border-rose-200 dark:border-rose-800 flex flex-col gap-2.5">
              <div className="flex items-center gap-2">
                <span className="text-rose-600 dark:text-rose-400 font-black text-base">⚠️</span>
                <span>{error}</span>
              </div>
              {error.includes('مسجل بالفعل') && (
                <Link
                  to={`/login?phone=${encodeURIComponent(phone.replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString()).trim())}`}
                  className="mt-1 w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black py-2.5 px-4 rounded-xl text-center text-xs transition-colors shadow-sm cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <span>تسجيل الدخول إلى حسابك الآن 🔑</span>
                </Link>
              )}
            </div>
          )}

          {/* Quick Registration with Google (Admin Controlled) */}
          {(settings.enableGoogleAuth ?? true) && (
            <div className="mb-6">
              <button
                type="button"
                onClick={handleGoogleRegister}
                disabled={loading}
                className="w-full bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-750 border-2 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 text-slate-700 dark:text-slate-200 p-3.5 rounded-xl font-bold flex items-center justify-center gap-3 transition-all shadow-xs cursor-pointer"
              >
                <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                </svg>
                <span>التسجيل السريع باستخدام Google</span>
              </button>

              <div className="relative my-6 text-center">
                <span className="bg-white dark:bg-slate-900 px-3 text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider relative z-10">
                  أو التسجيل برقم الهاتف والبيانات
                </span>
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-200 dark:border-slate-800"></div>
                </div>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-slate-700 dark:text-slate-300 text-sm font-bold mb-2">الاسم الرباعي الكامل</label>
              <div className="relative">
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                  <User className="h-5 w-5 text-slate-400 dark:text-slate-500" />
                </div>
                <input 
                  type="text" 
                  required
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="مثال: أحمد محمد محمود علي"
                  className="w-full p-3 pr-10 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none font-medium" 
                />
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-5">
              <div>
                <label className="block text-slate-700 dark:text-slate-300 text-sm font-bold mb-2">رقم هاتف الطالب (للتسجيل والدخول)</label>
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
                    className="w-full p-3 pr-10 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none font-mono"
                    dir="ltr"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 text-sm font-bold mb-2">رقم هاتف ولي الأمر</label>
                <div className="relative">
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                    <Phone className="h-5 w-5 text-slate-400 dark:text-slate-500" />
                  </div>
                  <input 
                    type="tel" 
                    required
                    value={parentPhone}
                    onChange={e => setParentPhone(e.target.value)}
                    placeholder="011XXXXXXXX"
                    className="w-full p-3 pr-10 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none font-mono"
                    dir="ltr"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-slate-700 dark:text-slate-300 text-sm font-bold mb-2">السنة الدراسية</label>
              <div className="relative">
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                  <GraduationCap className="h-5 w-5 text-slate-400 dark:text-slate-500" />
                </div>
                <select
                  value={grade}
                  onChange={e => setGrade(e.target.value)}
                  className="w-full p-3 pr-10 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none font-bold text-slate-800 dark:text-white"
                >
                  {gradeOptions.map((g, idx) => (
                    <option key={idx} value={g}>{g}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-slate-700 dark:text-slate-300 text-sm font-bold mb-2">
                البريد الإلكتروني <span className="text-slate-400 dark:text-slate-500 font-normal">(اختياري)</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-slate-400 dark:text-slate-500" />
                </div>
                <input 
                  type="email" 
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="name@example.com (اختياري)"
                  className="w-full p-3 pr-10 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none" 
                  dir="ltr"
                />
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-5">
              <div>
                <label className="block text-slate-700 dark:text-slate-300 text-sm font-bold mb-2">كلمة المرور</label>
                <div className="relative">
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-slate-400 dark:text-slate-500" />
                  </div>
                  <input 
                    type="password" 
                    required
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full p-3 pr-10 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none" 
                    dir="ltr"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 text-sm font-bold mb-2">تأكيد كلمة المرور</label>
                <div className="relative">
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-slate-400 dark:text-slate-500" />
                  </div>
                  <input 
                    type="password" 
                    required
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full p-3 pr-10 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none" 
                    dir="ltr"
                  />
                </div>
              </div>
            </div>

            <button 
              type="submit" 
              disabled={loading}
              className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white p-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-md mt-4 text-lg cursor-pointer"
            >
              {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : 'إنشاء حساب جديد'}
            </button>
          </form>

          <p className="mt-8 text-center text-slate-600 dark:text-slate-400 font-medium">
            لديك حساب بالفعل؟{' '}
            <Link to="/login" className="text-emerald-600 dark:text-emerald-400 font-bold hover:underline">
              تسجيل الدخول
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
}
