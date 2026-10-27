import { BookOpen, Menu, X, LogIn, LogOut, LayoutDashboard, CreditCard, UserPlus, Bell, Sun, Moon } from 'lucide-react';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../lib/firebase';
import { collection, query, where, onSnapshot, orderBy, updateDoc, doc } from 'firebase/firestore';
import { useSettings } from '../contexts/SettingsContext';

export default function Navbar() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(() => {
    return localStorage.getItem('theme') === 'dark' || 
      (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches);
  });

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [darkMode]);
  const { user, appUser, signOut, loading: authLoading } = useAuth();
  const { settings } = useSettings();
  const navigate = useNavigate();

  const [notifications, setNotifications] = useState<any[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);

  useEffect(() => {
    if (!user && !appUser) return;
    
    let targetUserId = appUser?.uid || user?.uid;
    if (appUser?.role === 'admin' || appUser?.role === 'assistant') {
      targetUserId = 'admin';
    }

    if (!targetUserId) return;

    const q = query(
      collection(db, 'notifications'), 
      where('userId', '==', targetUserId)
    );

    const unsub = onSnapshot(q, (snapshot) => {
      const notifs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      notifs.sort((a: any, b: any) => b.createdAt - a.createdAt);
      setNotifications(notifs);
    }, (error) => {
      console.warn("Notifications onSnapshot notice:", error?.message || error);
    });

    return () => unsub();
  }, [user, appUser]);

  const markAsRead = async (id: string) => {
    try {
      await updateDoc(doc(db, 'notifications', id), { read: true });
    } catch (err) {}
  };

  const markAllAsRead = async () => {
    try {
      const unread = notifications.filter(n => !n.read);
      for (const n of unread) {
        await updateDoc(doc(db, 'notifications', n.id), { read: true });
      }
    } catch (err) {}
  };


  return (
    <nav className="sticky top-0 z-50 glass-header shadow-xs transition-all duration-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-20 items-center">
          {/* Logo / Brand */}
          <Link to="/" className="flex items-center gap-3">
            {settings.platformLogoBase64 ? (
              <img src={settings.platformLogoBase64} alt={settings.platformName} className="w-12 h-12 object-contain" />
            ) : (
              <div className="bg-indigo-600 text-white p-2 rounded-xl">
                <BookOpen className="w-8 h-8" />
              </div>
            )}
            <div>
              <h1 className="font-bold text-xl leading-tight text-slate-900 dark:text-white">{settings.platformName}</h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">المنصة التعليمية للغة الإنجليزية</p>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-8">
            <button 
              onClick={() => setDarkMode(!darkMode)}
              className="p-2.5 text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-amber-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all"
              title={darkMode ? 'الوضع النهاري' : 'الوضع الليلي'}
            >
              {darkMode ? <Sun className="w-5 h-5 text-amber-400" /> : <Moon className="w-5 h-5" />}
            </button>
            <Link to="/" className="text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 font-semibold transition-colors">الرئيسية</Link>
            {(user || appUser) && !['admin', 'assistant'].includes(appUser?.role || '') && (
              <Link to="/dashboard" className="text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 font-semibold transition-colors flex items-center gap-1">
                <BookOpen className="w-4 h-4" /> منصتي التعليمية
              </Link>
            )}
            <Link to="/payment" className="text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 font-semibold transition-colors flex items-center gap-1">
              <CreditCard className="w-4 h-4" /> دفع الاشتراك
            </Link>
            {['admin', 'assistant'].includes(appUser?.role || '') && (
              <Link to="/admin" className="text-indigo-600 dark:text-indigo-400 font-bold hover:text-indigo-700 transition-colors flex items-center gap-1">
                <LayoutDashboard className="w-4 h-4" /> لوحة التحكم
              </Link>
            )}
          </div>

          {/* Desktop Actions */}
          <div className="hidden md:flex items-center gap-4">
            {authLoading ? (
              <div className="w-24 h-10 bg-slate-100 dark:bg-slate-800 rounded-lg animate-pulse"></div>
            ) : (user || appUser) ? (
              <div className="flex items-center gap-4">
                <div className="text-sm font-medium text-slate-700 dark:text-slate-200 flex items-center gap-2">
                  <span>مرحباً،</span>
                  {appUser?.role === 'admin' ? (
                    <span className="flex items-center gap-1.5 font-bold text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-800/80 px-2.5 py-1 rounded-xl text-xs">
                      <span>👑</span>
                      <span>{appUser?.name?.split(' ')[0]} (Admin)</span>
                    </span>
                  ) : appUser?.role === 'assistant' ? (
                    <span className="flex items-center gap-1.5 font-bold text-indigo-800 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800/80 px-2.5 py-1 rounded-xl text-xs">
                      <span>🛡️</span>
                      <span>{appUser?.name?.split(' ')[0]} (مساعد)</span>
                    </span>
                  ) : (
                    <span className="font-bold text-indigo-600 dark:text-indigo-400">
                      {appUser?.name?.split(' ')[0] || 'طالب'}
                    </span>
                  )}
                  {appUser?.role === 'student' && appUser?.grade && (
                    <span className="text-[11px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded-md font-medium">
                      {appUser.grade}
                    </span>
                  )}
                </div>
                <button 
                  onClick={() => signOut().then(() => navigate('/'))}
                  className="flex items-center gap-2 text-rose-600 dark:text-rose-400 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 font-semibold px-4 py-2 rounded-lg transition-colors cursor-pointer"
                >
                  <LogOut className="w-5 h-5" />
                  <span>خروج</span>
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Link 
                  to="/login"
                  className="text-slate-700 dark:text-slate-300 font-bold hover:text-indigo-600 dark:hover:text-indigo-400 px-4 transition-colors"
                >
                  تسجيل الدخول
                </Link>
                <Link 
                  to="/register"
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-lg font-bold shadow-md shadow-indigo-200 dark:shadow-none transition-all active:scale-95 flex items-center gap-2"
                >
                  إنشاء حساب
                </Link>
              </div>
            )}
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden flex items-center">
            <button 
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 focus:outline-none p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              {isMobileMenuOpen ? <X className="w-7 h-7" /> : <Menu className="w-7 h-7" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Navigation */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 overflow-hidden"
          >
            <div className="px-4 pt-2 pb-6 space-y-1 shadow-inner">
              <div className="flex items-center justify-between px-3 py-3 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-700 dark:text-slate-200 font-bold">المظهر (ليلي / نهاري)</span>
                <button 
                  onClick={() => setDarkMode(!darkMode)}
                  className="p-2 bg-slate-100 dark:bg-slate-800 rounded-xl text-slate-600 dark:text-slate-200 flex items-center gap-1.5 font-bold text-xs"
                >
                  {darkMode ? <><Sun className="w-4 h-4 text-amber-400" /><span>نهاري</span></> : <><Moon className="w-4 h-4" /><span>ليلي</span></>}
                </button>
              </div>
              <Link to="/" onClick={() => setIsMobileMenuOpen(false)} className="block px-3 py-3 rounded-md text-base font-semibold text-slate-700 dark:text-slate-200 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-50 dark:hover:bg-slate-800">الرئيسية</Link>
              {(user || appUser) && !['admin', 'assistant'].includes(appUser?.role || '') && (
                <Link to="/dashboard" onClick={() => setIsMobileMenuOpen(false)} className="block px-3 py-3 rounded-md text-base font-semibold text-slate-700 dark:text-slate-200 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2">
                  <BookOpen className="w-5 h-5" /> منصتي التعليمية
                </Link>
              )}
              <Link to="/payment" onClick={() => setIsMobileMenuOpen(false)} className="block px-3 py-3 rounded-md text-base font-semibold text-slate-700 dark:text-slate-200 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2">
                <CreditCard className="w-5 h-5" /> دفع الاشتراك
              </Link>
              {['admin', 'assistant'].includes(appUser?.role || '') && (
                <Link to="/admin" onClick={() => setIsMobileMenuOpen(false)} className="block px-3 py-3 rounded-md text-base font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 flex items-center gap-2">
                  <LayoutDashboard className="w-5 h-5" /> لوحة التحكم
                </Link>
              )}
              
              <div className="pt-4 mt-2 border-t border-slate-100 dark:border-slate-800 flex flex-col gap-3">
                
            {(user || appUser) && (
              <div className="relative">
                <button 
                  onClick={() => setShowNotifications(!showNotifications)}
                  className="p-2 relative text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                >
                  <Bell className="w-6 h-6" />
                  {notifications.filter(n => !n.read).length > 0 && (
                    <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-rose-500 rounded-full border-2 border-white dark:border-slate-900"></span>
                  )}
                </button>
                <AnimatePresence>
                  {showNotifications && (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      className="absolute left-0 mt-2 w-80 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-100 dark:border-slate-800 overflow-hidden z-50"
                    >
                      <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/60">
                        <h3 className="font-bold text-slate-800 dark:text-white">الإشعارات</h3>
                        {notifications.some(n => !n.read) && (
                          <button onClick={markAllAsRead} className="text-xs text-indigo-600 dark:text-indigo-400 font-bold hover:underline cursor-pointer">
                            تحديد الكل كمقروء
                          </button>
                        )}
                      </div>
                      <div className="max-h-80 overflow-y-auto">
                        {notifications.length === 0 ? (
                          <div className="p-6 text-center text-slate-500 dark:text-slate-400 text-sm">لا توجد إشعارات</div>
                        ) : (
                          notifications.map(n => (
                            <div 
                              key={n.id} 
                              onClick={() => markAsRead(n.id)}
                              className={`p-4 border-b border-slate-100 dark:border-slate-800/60 cursor-pointer transition-colors ${n.read ? 'bg-white dark:bg-slate-900 opacity-60' : 'bg-indigo-50/50 dark:bg-indigo-950/40 hover:bg-indigo-50 dark:hover:bg-indigo-900/50'}`}
                            >
                              <div className="flex justify-between items-start mb-1">
                                <h4 className="font-bold text-sm text-slate-800 dark:text-white">{n.title}</h4>
                                {!n.read && <span className="w-2 h-2 bg-indigo-600 dark:bg-indigo-400 rounded-full flex-shrink-0 mt-1"></span>}
                              </div>
                              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">{n.message}</p>
                              <span className="text-[10px] text-slate-400 dark:text-slate-500 mt-2 block">
                                {new Date(n.createdAt).toLocaleDateString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                          ))
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}
            
            {(user || appUser) ? (

                  <>
                    <div className="px-3 py-2 text-sm text-slate-600 dark:text-slate-300 flex items-center justify-between">
                      <span>مرحباً، <strong className="text-slate-900 dark:text-white">{appUser?.name}</strong></span>
                      {appUser?.role === 'admin' ? (
                        <span className="bg-amber-100 dark:bg-amber-950/70 text-amber-900 dark:text-amber-300 text-[11px] font-black px-2 py-0.5 rounded-full border border-amber-300 dark:border-amber-800">
                          👑 مدير المنصة
                        </span>
                      ) : appUser?.role === 'assistant' ? (
                        <span className="bg-indigo-100 dark:bg-indigo-950/70 text-indigo-900 dark:text-indigo-300 text-[11px] font-black px-2 py-0.5 rounded-full border border-indigo-200 dark:border-indigo-800">
                          🛡️ مساعد
                        </span>
                      ) : (
                        <span className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[11px] font-bold px-2 py-0.5 rounded-md">
                          {appUser?.grade || 'طالب'}
                        </span>
                      )}
                    </div>
                    <button 
                      onClick={() => { signOut(); setIsMobileMenuOpen(false); navigate('/'); }}
                      className="w-full flex items-center justify-center gap-2 text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/50 font-bold px-4 py-3 rounded-lg transition-colors cursor-pointer"
                    >
                      <LogOut className="w-5 h-5" />
                      <span>تسجيل خروج</span>
                    </button>
                  </>
                ) : (
                  <div className="flex flex-col gap-2">
                    <Link 
                      to="/login"
                      onClick={() => setIsMobileMenuOpen(false)}
                      className="w-full flex items-center justify-center gap-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 px-4 py-3 rounded-lg font-bold transition-colors"
                    >
                      <LogIn className="w-5 h-5" />
                      <span>تسجيل الدخول</span>
                    </Link>
                    <Link 
                      to="/register"
                      onClick={() => setIsMobileMenuOpen(false)}
                      className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-3 rounded-lg font-bold shadow-md transition-colors"
                    >
                      <UserPlus className="w-5 h-5" />
                      <span>إنشاء حساب جديد</span>
                    </Link>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}
