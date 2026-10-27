import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useSettings, PlatformSettings } from '../contexts/SettingsContext';
import AdminContentManager from '../components/AdminContentManager';
import AdminCourses from '../components/AdminCourses';
import AdminAssistants from '../components/AdminAssistants';
import AdminCenterManager from '../components/AdminCenterManager';
import AdminSupport from '../components/AdminSupport';
import AdminExams from '../components/AdminExams';
import AdminPerformance from '../components/AdminPerformance';
import AdminPlatformEvents from '../components/AdminPlatformEvents';
import AdminBunnyLibrariesManager from '../components/AdminBunnyLibrariesManager';
import { db, getStoredFirebaseConfig, saveCustomFirebaseConfig, clearCustomFirebaseConfig, effectiveFirebaseConfig, CustomFirebaseConfig } from '../lib/firebase';
import { collection, query, onSnapshot, doc, updateDoc, orderBy, setDoc, deleteDoc, getDocs, where } from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import { Check, X, Clock, ExternalLink, Filter, LayoutDashboard, Settings, Video, FileText, CheckSquare, MessageSquare, Save, Loader2, Book, Users, Award, CreditCard, Smartphone, Wallet, Building, Activity, ShieldAlert, Database, Key, Server, RefreshCw } from 'lucide-react';
import { Navigate } from 'react-router-dom';

interface PaymentReq {
  id: string;
  userId: string;
  userEmail: string;
  userName: string;
  courseName: string;
  courseId: string;
  amount: number;
  paymentMethod: string;
  receiptBase64: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: number;
}

type TabType = 'payments' | 'courses' | 'settings' | 'videos' | 'materials' | 'assistants' | 'exams' | 'performance' | 'support' | 'center' | 'activity';

export default function AdminDashboard() {
  const { user, appUser, loading: authLoading } = useAuth();
  const { settings, updateSettings } = useSettings();
  
  const [activeTab, setActiveTab] = useState<TabType>('payments');
  const [selectedCoursePreset, setSelectedCoursePreset] = useState<string | undefined>(undefined);
  const [payments, setPayments] = useState<PaymentReq[]>([]);
  const [paymentFilter, setPaymentFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending');
  
  // Settings Form State
  const [settingsForm, setSettingsForm] = useState<PlatformSettings>(settings);
  const [savingSettings, setSavingSettings] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [selectedReceipt, setSelectedReceipt] = useState<string | null>(null);

  // Custom Firebase configuration switcher state
  const [customFbConfig, setCustomFbConfig] = useState<CustomFirebaseConfig>(() => {
    return getStoredFirebaseConfig() || {
      projectId: effectiveFirebaseConfig.projectId || '',
      apiKey: effectiveFirebaseConfig.apiKey || '',
      authDomain: effectiveFirebaseConfig.authDomain || '',
      storageBucket: effectiveFirebaseConfig.storageBucket || '',
      firestoreDatabaseId: (effectiveFirebaseConfig as any).firestoreDatabaseId || '(default)'
    };
  });
  const [fbSaveNotice, setFbSaveNotice] = useState('');

  const handleSaveCustomFirebase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (appUser?.role !== 'admin') {
      alert('عذراً، تغيير إعدادات ومشروع Firebase متاح حصرياً للمدير العام الرئيسي للمنصة.');
      return;
    }
    if (!customFbConfig.projectId?.trim() || !customFbConfig.apiKey?.trim()) {
      alert('يرجى كتابة Project ID و API Key على الأقل لحفظ إعدادات Firebase الجديدة.');
      return;
    }
    const confirmed = confirm(
      `⚠️ تأكيد التبديل والانفصال:\nسيتم قطع الاتصال بمشروع Firebase الحالي تماماً وفصل جميع الجلسات القديمة، والربط فوراً بالمشروع الجديد (${customFbConfig.projectId}). هل أنت متأكد؟`
    );
    if (!confirmed) return;

    setFbSaveNotice('⏳ جاري فصل المشروع القديم وتنظيف الجلسات والربط بالمشروع الجديد...');
    await saveCustomFirebaseConfig(customFbConfig);
    setFbSaveNotice('✅ تم الانفصال عن المشروع القديم والربط بالجديد بنجاح! جاري إعادة التحميل...');
    setTimeout(() => {
      window.location.reload();
    }, 1200);
  };

  const handleResetDefaultFirebase = async () => {
    if (appUser?.role !== 'admin') {
      alert('عذراً، استعادة إعدادات Firebase متاحة حصرياً للمدير العام الرئيسي للمنصة.');
      return;
    }
    if (confirm('هل ترغب بالتأكيد في استعادة ربط Firebase الافتراضي الأصلي وفصل المشروع المخصص؟')) {
      setFbSaveNotice('⏳ جاري فصل المشروع المخصص واستعادة الحساب الافتراضي...');
      await clearCustomFirebaseConfig();
      setFbSaveNotice('✅ تمت استعادة إعدادات Firebase الافتراضية بنجاح! جاري التحديث...');
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    }
  };

  // Update form if settings change remotely
  useEffect(() => {
    setSettingsForm(settings);
  }, [settings]);

  useEffect(() => {
    if (!appUser || !['admin', 'assistant'].includes(appUser.role)) return;

    const q = query(collection(db, 'payments'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as PaymentReq[];
      setPayments(data);
    }, (error) => {
      console.warn("Error fetching payments (quota or offline):", error?.message || error);
    });

    return () => unsubscribe();
  }, [appUser]);

  const handleDeletePayment = async (paymentId: string) => {
    if (!confirm('هل أنت متأكد من حذف طلب الاشتراك هذا نهائياً؟')) return;
    try {
      await deleteDoc(doc(db, 'payments', paymentId));
    } catch (error) {
      console.error(error);
      alert('حدث خطأ أثناء الحذف.');
    }
  };

  const handleUpdateStatus = async (payment: PaymentReq, status: 'approved' | 'rejected') => {
    if (!confirm(`هل أنت متأكد من تغيير حالة الدفع إلى: ${status === 'approved' ? 'مقبول' : 'مرفوض'}؟`)) return;
    try {
      let finalCourseId = payment.courseId;
      
      // Migration: if payment is missing courseId (old data), try to find it by name
      if (!finalCourseId && payment.courseName) {
        const coursesSnap = await getDocs(query(collection(db, 'courses'), where('name', '==', payment.courseName)));
        if (!coursesSnap.empty) {
          finalCourseId = coursesSnap.docs[0].id;
        }
      }

      const paymentRef = doc(db, 'payments', payment.id);
      const updates: any = { status, updatedAt: Date.now() };
      if (finalCourseId && !payment.courseId) {
        updates.courseId = finalCourseId; // patch the payment
      }
      
      await updateDoc(paymentRef, updates);

      if (finalCourseId) {
        const subId = `${payment.userId}_${finalCourseId}`;
        const subRef = doc(db, 'subscriptions', subId);

        if (status === 'approved') {
          await setDoc(subRef, {
            userId: payment.userId,
            courseId: finalCourseId,
            createdAt: Date.now()
          });
        } else if (status === 'rejected') {
          await deleteDoc(subRef).catch(() => {});
        }
      }
    } catch (error) {
      console.error("Error updating status:", error);
      alert("حدث خطأ أثناء تحديث الحالة.");
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (appUser?.role !== 'admin') {
      alert('عذراً، تعديل وحفظ إعدادات المنصة مسموح به فقط للمدير العام الرئيسي للمنصة.');
      return;
    }
    setSavingSettings(true);
    setSaveMessage('');
    try {
      await updateSettings(settingsForm);
      setSaveMessage('تم حفظ الإعدادات بنجاح!');
      setTimeout(() => setSaveMessage(''), 3000);
    } catch (error) {
      setSaveMessage('خطأ في حفظ الإعدادات.');
    } finally {
      setSavingSettings(false);
    }
  };

  if (authLoading) {
    return <div className="flex-grow flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-4 border-indigo-600 border-t-transparent"></div></div>;
  }

  if (!appUser || !['admin', 'assistant'].includes(appUser.role)) {
    return <Navigate to="/" replace />;
  }

  const filteredPayments = paymentFilter === 'all' ? payments : payments.filter(p => p.status === paymentFilter);

  const pendingCount = payments.filter(p => p.status === 'pending').length;

  const tabSections = [
    {
      title: 'المنظومة التعليمية',
      items: [
        ...(appUser?.role === 'admin' || appUser?.role === 'assistant' ? [
          { id: 'courses', label: 'إدارة الكورسات', icon: Book },
        ] : []),
        { id: 'videos', label: 'المحاضرات والفيديوهات', icon: Video },
        { id: 'materials', label: 'المذكرات والملفات', icon: FileText },
      ]
    },
    {
      title: 'الاختبارات والتقييم',
      items: [
        { id: 'exams', label: 'الامتحانات الإلكترونية', icon: CheckSquare },
        { id: 'performance', label: 'أداء ونتائج الطلاب', icon: Award },
      ]
    },
    {
      title: 'السنتر والمالية',
      items: [
        ...(appUser?.role === 'admin' || appUser?.role === 'assistant' ? [
          { id: 'center', label: 'إدارة السنتر والحضور', icon: Building },
        ] : []),
        { id: 'payments', label: 'الاشتراكات والدفع الأونلاين', icon: LayoutDashboard, badge: pendingCount > 0 ? pendingCount : null },
      ]
    },
    {
      title: 'الإشراف والتحكم',
      items: [
        ...(appUser?.role === 'admin' || appUser?.role === 'assistant' ? [
          { id: 'assistants', label: 'إدارة المستخدمين', icon: Users },
        ] : []),
        { id: 'support', label: 'الدعم الفني والرسائل', icon: MessageSquare },
        ...(appUser?.role === 'admin' ? [
          { id: 'activity', label: 'أحداث المنصة المباشرة', icon: Activity },
          { id: 'settings', label: 'إعدادات المنصة', icon: Settings },
        ] : []),
      ]
    }
  ];

  return (
    <div className="flex-grow flex flex-col md:flex-row bg-slate-100 dark:bg-[#070b14] min-h-[calc(100vh-80px)] transition-colors">
      {/* Executive Command Sidebar */}
      <div className="w-full md:w-72 bg-slate-900 text-slate-300 border-l border-slate-800 shadow-2xl md:flex-shrink-0 flex flex-col justify-between">
        <div className="p-5">
          {/* Admin Identity Header */}
          <div className="bg-slate-800/80 p-4 rounded-2xl border border-slate-700/60 mb-6">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-indigo-600 to-indigo-500 text-white flex items-center justify-center font-black text-lg shadow-md shadow-indigo-600/40">
                {appUser.name ? appUser.name.charAt(0) : 'A'}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-white font-black text-sm truncate">{appUser.name || 'مدير المنصة'}</h3>
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                </div>
                <div className="text-[11px] font-bold text-indigo-300 flex items-center gap-1 mt-0.5">
                  {appUser.role === 'admin' ? '🛡️ الأدمن العام للمنصة' : '🎖️ مساعد إداري'}
                </div>
              </div>
            </div>
          </div>

          {/* Nav Sections */}
          <nav className="space-y-5">
            {tabSections.map((sec, secIdx) => (
              <div key={secIdx}>
                <div className="px-3 text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1.5">
                  {sec.title}
                </div>
                <div className="space-y-1">
                  {sec.items.map(tab => {
                    const isActive = activeTab === tab.id;
                    const Icon = tab.icon;
                    return (
                      <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as TabType)}
                        className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
                          isActive 
                            ? 'bg-gradient-to-r from-indigo-600 to-indigo-700 text-white shadow-lg shadow-indigo-900/50 scale-[1.02]' 
                            : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                          <span>{tab.label}</span>
                        </div>
                        
                        {(tab as any).badge ? (
                          <span className="bg-amber-500 text-slate-950 px-2 py-0.5 rounded-full text-[10px] font-black">
                            {(tab as any).badge}
                          </span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>
        </div>

        {/* Quick Footer Badge */}
        <div className="p-4 border-t border-slate-800/80 bg-slate-950/40 text-[11px] text-slate-500 flex items-center justify-between">
          <span>نظام التحكم الأكاديمي v2.5</span>
          <span className="text-emerald-400 font-bold">نشط ومتصل</span>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-6 md:p-8 overflow-x-hidden">
        <AnimatePresence mode="wait">
          
          {/* TAB: PAYMENTS */}
          {activeTab === 'payments' && (
            <motion.div
              key="payments"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                  <h1 className="text-2xl font-black text-slate-900 dark:text-white">مراجعة الاشتراكات</h1>
                  <p className="text-slate-500 dark:text-slate-400 font-medium">مراجعة واعتماد إيصالات الدفع للطلاب</p>
                </div>
                
                <div className="flex items-center gap-1 bg-white dark:bg-slate-900 p-1 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 flex-wrap">
                  {(['pending', 'approved', 'rejected', 'all'] as const).map((status) => (
                    <button
                      key={status}
                      onClick={() => setPaymentFilter(status)}
                      className={`px-4 py-2 rounded-lg font-bold text-sm transition-all cursor-pointer ${
                        paymentFilter === status 
                        ? 'bg-indigo-600 text-white shadow-md' 
                        : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                    >
                      {status === 'pending' ? 'قيد المراجعة' : status === 'approved' ? 'مقبولة' : status === 'rejected' ? 'مرفوضة' : 'الكل'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Payment Numbers Quick Card */}
              <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-5 rounded-2xl shadow-md border border-indigo-900/50 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center flex-shrink-0">
                    <Smartphone className="w-6 h-6 text-indigo-400" />
                  </div>
                  <div>
                    <h4 className="font-black text-base text-white flex items-center gap-2">
                      <span>بيانات وأرقام التحويل الحالية المعروضة للطلاب</span>
                    </h4>
                    <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-sm text-slate-300 mt-1 font-medium">
                      <div>📱 المحفظة (كاش): <span className="font-bold text-emerald-400 font-mono" dir="ltr">{settings.paymentWalletNumber || '01012345678'}</span></div>
                      <div>⚡ إنستا باي: <span className="font-bold text-cyan-300 font-mono" dir="ltr">{settings.paymentInstapayUsername || 'saber@instapay'}</span></div>
                    </div>
                  </div>
                </div>
                {appUser?.role === 'admin' && (
                  <button
                    onClick={() => setActiveTab('settings')}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-xl font-bold text-xs flex items-center gap-2 transition-all shadow-sm flex-shrink-0 cursor-pointer"
                  >
                    <span>تعديل أرقام التحويل</span>
                  </button>
                )}
              </div>

              <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden transition-colors">
                {filteredPayments.length === 0 ? (
                  <div className="p-12 text-center text-slate-500 dark:text-slate-400 font-medium flex flex-col items-center">
                    <Filter className="w-12 h-12 text-slate-300 dark:text-slate-600 mb-4" />
                    <p>لا توجد طلبات دفع {paymentFilter !== 'all' ? 'بهذه الحالة' : ''} حالياً.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-right text-sm text-slate-600 dark:text-slate-300">
                      <thead className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 font-bold">
                        <tr>
                          <th className="px-6 py-4">الطالب</th>
                          <th className="px-6 py-4">الكورس</th>
                          <th className="px-6 py-4 text-center">المبلغ</th>
                          <th className="px-6 py-4 text-center">طريقة الدفع</th>
                          <th className="px-6 py-4">التاريخ</th>
                          <th className="px-6 py-4 text-center">الإيصال</th>
                          <th className="px-6 py-4 text-center">الحالة</th>
                          <th className="px-6 py-4 text-center">الإجراء</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredPayments.map((payment) => (
                          <tr key={payment.id} className="border-b border-slate-100 dark:border-slate-800/70 hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors">
                            <td className="px-6 py-4">
                              <div className="font-bold text-slate-900 dark:text-white">{payment.userName}</div>
                              <div className="text-xs text-slate-500 dark:text-slate-400">{payment.userEmail}</div>
                            </td>
                            <td className="px-6 py-4 font-medium text-slate-800 dark:text-slate-200">{payment.courseName}</td>
                            <td className="px-6 py-4 text-center">
                              <span className="font-black text-emerald-600 dark:text-emerald-400">{payment.amount}</span> ج.م
                            </td>
                            <td className="px-6 py-4 text-center">
                              <span className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2 py-1 rounded text-xs font-bold block mb-1">
                                {payment.paymentMethod === 'instapay' ? 'إنستا باي' : payment.paymentMethod === 'wallet' ? 'محفظة إلكترونية' : '-'}
                              </span>
                              {(payment as any).transferNumber && (
                                <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono block">{(payment as any).transferNumber}</span>
                              )}
                            </td>
                            <td className="px-6 py-4 text-slate-600 dark:text-slate-400">
                              {new Date(payment.createdAt).toLocaleDateString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric' })}
                            </td>
                            <td className="px-6 py-4 text-center">
                              <button onClick={() => setSelectedReceipt(payment.receiptBase64)} className="inline-flex items-center justify-center w-10 h-10 bg-indigo-50 dark:bg-indigo-950/70 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-600 hover:text-white dark:hover:bg-indigo-600 dark:hover:text-white rounded-lg transition-colors cursor-pointer" title="عرض الإيصال">
                                <ExternalLink className="w-5 h-5" />
                              </button>
                            </td>
                            <td className="px-6 py-4 text-center">
                              {payment.status === 'pending' && <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-50 dark:bg-amber-950/70 text-amber-700 dark:text-amber-300 text-xs font-bold border border-amber-200 dark:border-amber-800">مراجعة</span>}
                              {payment.status === 'approved' && <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 text-xs font-bold border border-emerald-200 dark:border-emerald-800">مقبول</span>}
                              {payment.status === 'rejected' && <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-rose-50 dark:bg-rose-950/70 text-rose-700 dark:text-rose-300 text-xs font-bold border border-rose-200 dark:border-rose-800">مرفوض</span>}
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex items-center justify-center gap-2">
                                {payment.status !== 'approved' && (
                                  <button onClick={() => handleUpdateStatus(payment, 'approved')} className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg text-sm font-bold transition-colors cursor-pointer">قبول</button>
                                )}
                                {payment.status !== 'rejected' && (
                                  <button onClick={() => handleUpdateStatus(payment, 'rejected')} className="bg-rose-600 hover:bg-rose-700 text-white px-3 py-1.5 rounded-lg text-sm font-bold transition-colors cursor-pointer">رفض</button>
                                )}
                                <button onClick={() => handleDeletePayment(payment.id)} className="bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 px-3 py-1.5 rounded-lg text-sm font-bold transition-colors cursor-pointer">حذف</button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* TAB: COURSES */}
          {activeTab === 'courses' && (appUser?.role === 'admin' || appUser?.role === 'assistant') && (
            <motion.div
              key="courses"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <AdminCourses onNavigateTab={(tab, courseId) => {
                if (courseId) setSelectedCoursePreset(courseId);
                setActiveTab(tab as TabType);
              }} />
            </motion.div>
          )}

          {/* TAB: CENTER MANAGEMENT */}
          {activeTab === 'center' && (appUser?.role === 'admin' || appUser?.role === 'assistant') && (
            <motion.div
              key="center"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <AdminCenterManager />
            </motion.div>
          )}

          {/* TAB: ASSISTANTS */}
          {activeTab === 'assistants' && (appUser?.role === 'admin' || appUser?.role === 'assistant') && (
            <motion.div
              key="assistants"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <AdminAssistants />
            </motion.div>
          )}

          {/* TAB: PLATFORM EVENTS (Admin only) */}
          {activeTab === 'activity' && appUser?.role === 'admin' && (
            <motion.div
              key="activity"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <AdminPlatformEvents />
            </motion.div>
          )}

          {/* ACCESS BARRIER: If assistant somehow lands on settings or activity */}
          {(activeTab === 'settings' || activeTab === 'activity') && appUser?.role !== 'admin' && (
            <motion.div
              key="unauthorized"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-rose-50 border-2 border-rose-300 p-8 rounded-3xl text-center space-y-4 max-w-lg mx-auto my-12 shadow-lg"
            >
              <div className="w-16 h-16 bg-rose-100 text-rose-600 rounded-2xl flex items-center justify-center mx-auto shadow-sm">
                <ShieldAlert className="w-8 h-8" />
              </div>
              <h3 className="font-black text-rose-950 text-xl">قسم محظور - متاح للمدير العام فقط</h3>
              <p className="text-rose-700 text-xs sm:text-sm font-bold leading-relaxed">
                عذراً، إعدادات المنصة وسجل الأحداث مخصصة حصرياً للمدير العام الرئيسي للمنصة (Admin). تم قفل الوصول لحسابات المساعدين.
              </p>
              <button
                onClick={() => setActiveTab('center')}
                className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl text-xs font-black shadow-md hover:bg-indigo-700 transition-all cursor-pointer"
              >
                العودة لإدارة السنتر
              </button>
            </motion.div>
          )}

          {/* TAB: SETTINGS (Admin only) */}
          {activeTab === 'settings' && appUser?.role === 'admin' && (
            <motion.div
              key="settings"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6 max-w-3xl"
            >
              <div>
                <h1 className="text-2xl font-black text-slate-900 dark:text-white">إعدادات المنصة</h1>
                <p className="text-slate-500 dark:text-slate-400 font-medium">تغيير اسم المنصة، الإحصائيات، والنصوص العامة.</p>
              </div>

              <form onSubmit={handleSaveSettings} className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 space-y-6 transition-colors">
                
                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-slate-700 dark:text-slate-300 font-bold mb-2">اسم المنصة</label>
                    <input 
                      type="text" 
                      value={settingsForm.platformName}
                      onChange={e => setSettingsForm({...settingsForm, platformName: e.target.value})}
                      className="w-full p-3 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none" 
                    />
                  </div>
                  <div>
                    <label className="block text-slate-700 dark:text-slate-300 font-bold mb-2">اسم الأستاذ</label>
                    <input 
                      type="text" 
                      value={settingsForm.teacherName}
                      onChange={e => setSettingsForm({...settingsForm, teacherName: e.target.value})}
                      className="w-full p-3 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none" 
                    />
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-slate-700 dark:text-slate-300 font-bold mb-2">سنوات الخبرة</label>
                    <input 
                      type="number" 
                      value={settingsForm.yearsOfExperience || ''}
                      onChange={e => setSettingsForm({...settingsForm, yearsOfExperience: Number(e.target.value)})}
                      className="w-full p-3 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none" 
                    />
                  </div>
                  <div>
                    <label className="block text-slate-700 dark:text-slate-300 font-bold mb-2">عدد الطلاب (تقريبي)</label>
                    <input 
                      type="number" 
                      value={settingsForm.studentCount || ''}
                      onChange={e => setSettingsForm({...settingsForm, studentCount: Number(e.target.value)})}
                      className="w-full p-3 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none" 
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-bold mb-2">نبذة عن الأستاذ</label>
                  <textarea 
                    rows={4}
                    value={settingsForm.aboutText}
                    onChange={e => setSettingsForm({...settingsForm, aboutText: e.target.value})}
                    className="w-full p-3 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none resize-none" 
                  />
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-slate-700 dark:text-slate-300 font-bold mb-2">الأقسام أو المراحل الدراسية (مفصولة بفاصلة , )</label>
                    <input 
                      type="text" 
                      value={(settingsForm.grades || []).join(', ')}
                      onChange={e => setSettingsForm({...settingsForm, grades: e.target.value.split(',').map(s => s.trim()).filter(Boolean)})}
                      className="w-full p-3 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none" 
                      placeholder="مثال: الصف الأول الثانوي, الصف الثاني الثانوي"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-700 dark:text-slate-300 font-bold mb-2">رسالة الترحيب الآلية في الدعم الفني</label>
                    <input 
                      type="text" 
                      value={settingsForm.autoReplyMessage || ''}
                      onChange={e => setSettingsForm({...settingsForm, autoReplyMessage: e.target.value})}
                      className="w-full p-3 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none" 
                    />
                  </div>
                </div>

                {/* Contact and WhatsApp info */}
                <div className="grid md:grid-cols-2 gap-6 border-t border-slate-100 dark:border-slate-800 pt-6">
                  <div>
                    <label className="block text-slate-700 dark:text-slate-300 font-bold mb-2">رقم الواتساب</label>
                    <input 
                      type="text" 
                      value={settingsForm.whatsappNumber || ''}
                      onChange={e => setSettingsForm({...settingsForm, whatsappNumber: e.target.value})}
                      className="w-full p-3 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none" 
                      placeholder="+201000000000"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-700 dark:text-slate-300 font-bold mb-2">رقم الهاتف (تواصل معنا)</label>
                    <input 
                      type="text" 
                      value={settingsForm.contactPhone || ''}
                      onChange={e => setSettingsForm({...settingsForm, contactPhone: e.target.value})}
                      className="w-full p-3 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none" 
                    />
                  </div>
                  <div>
                    <label className="block text-slate-700 dark:text-slate-300 font-bold mb-2">البريد الإلكتروني (تواصل معنا)</label>
                    <input 
                      type="email" 
                      value={settingsForm.contactEmail || ''}
                      onChange={e => setSettingsForm({...settingsForm, contactEmail: e.target.value})}
                      className="w-full p-3 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none" 
                    />
                  </div>
                  <div>
                    <label className="block text-slate-700 dark:text-slate-300 font-bold mb-2">العنوان (تواصل معنا)</label>
                    <input 
                      type="text" 
                      value={settingsForm.contactAddress || ''}
                      onChange={e => setSettingsForm({...settingsForm, contactAddress: e.target.value})}
                      className="w-full p-3 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none" 
                    />
                  </div>
                </div>

                {/* Payment Numbers and Transfer Information */}
                <div className="border-t border-slate-100 dark:border-slate-800 pt-6 space-y-4">
                  <div className="flex items-center gap-3 text-indigo-950 dark:text-indigo-200">
                    <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/70 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                      <CreditCard className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-lg font-black text-slate-900 dark:text-white">أرقام وبيانات الدفع والتحويل للطلاب</h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">تظهر هذه الأرقام للطلاب في صفحة الدفع والاشتراك في الكورسات.</p>
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-6 bg-slate-50 dark:bg-slate-800/60 p-5 rounded-2xl border border-slate-200 dark:border-slate-700">
                    <div>
                      <label className="block text-slate-800 dark:text-slate-200 font-bold mb-2 flex items-center gap-2">
                        <Smartphone className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                        <span>رقم المحفظة الإلكترونية (فودافون كاش / اتصالات / أورانج / وي)</span>
                      </label>
                      <input 
                        type="text" 
                        value={settingsForm.paymentWalletNumber || ''}
                        onChange={e => setSettingsForm({...settingsForm, paymentWalletNumber: e.target.value})}
                        className="w-full p-3 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-indigo-500 font-mono text-sm outline-none" 
                        placeholder="مثال: 01012345678"
                        dir="ltr"
                      />
                      <span className="text-xs text-slate-500 dark:text-slate-400 mt-1 block">يظهر هذا الرقم للطالب عند اختيار الدفع عبر المحفظة الإلكترونية.</span>
                    </div>

                    <div>
                      <label className="block text-slate-800 dark:text-slate-200 font-bold mb-2 flex items-center gap-2">
                        <Wallet className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                        <span>عنوان أو يوزر إنستا باي (InstaPay Address / IPA)</span>
                      </label>
                      <input 
                        type="text" 
                        value={settingsForm.paymentInstapayUsername || ''}
                        onChange={e => setSettingsForm({...settingsForm, paymentInstapayUsername: e.target.value})}
                        className="w-full p-3 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-indigo-500 font-mono text-sm outline-none" 
                        placeholder="مثال: saber@instapay أو رقم الحساب"
                        dir="ltr"
                      />
                      <span className="text-xs text-slate-500 dark:text-slate-400 mt-1 block">يظهر هذا الحساب للطالب عند اختيار الدفع عبر إنستا باي.</span>
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-slate-800 dark:text-slate-200 font-bold mb-2">
                        ملاحظات وتعليمات التحويل التي تظهر للطالب
                      </label>
                      <textarea 
                        rows={3}
                        value={settingsForm.paymentInstructions || ''}
                        onChange={e => setSettingsForm({...settingsForm, paymentInstructions: e.target.value})}
                        className="w-full p-3 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-indigo-500 text-sm outline-none resize-none" 
                        placeholder="مثال: يرجى كتابة اسم الطالب في خانة ملاحظات التحويل، ثم رفع صورة إشعار التحويل وانتظار التفعيل الفوري."
                      />
                    </div>
                  </div>
                </div>

                {/* Hero Media */}
                <div className="grid md:grid-cols-2 gap-6 border-t border-slate-100 pt-6">
                  <div>
                    <label className="block text-slate-700 font-bold mb-2">صورة الأستاذ في الرئيسية (كبيرة وبدون خلفية)</label>
                    <input 
                      type="file" 
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          if (file.size > 800 * 1024) {
                            alert("حجم الصورة كبير جداً. يجب أن يكون أقل من 800 كيلوبايت لتجنب مشاكل الحفظ.");
                            e.target.value = '';
                            return;
                          }
                          const reader = new FileReader();
                          reader.onloadend = () => {
                            setSettingsForm({...settingsForm, heroImageBase64: reader.result as string});
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                      className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl outline-none" 
                    />
                    {settingsForm.heroImageBase64 && <img src={settingsForm.heroImageBase64} alt="Hero" className="mt-2 h-32 object-contain" />}
                  </div>
                  <div>
                    <label className="block text-slate-700 font-bold mb-2">شعار المنصة (في شريط المتصفح)</label>
                    <input 
                      type="file" 
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          if (file.size > 200 * 1024) {
                            alert("حجم الشعار يجب أن يكون أقل من 200 كيلوبايت.");
                            e.target.value = '';
                            return;
                          }
                          const reader = new FileReader();
                          reader.onloadend = () => {
                            setSettingsForm({...settingsForm, platformLogoBase64: reader.result as string});
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                      className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl outline-none" 
                    />
                    {settingsForm.platformLogoBase64 && <img src={settingsForm.platformLogoBase64} alt="Logo" className="mt-2 h-10 object-contain" />}
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-6 border-t border-slate-100 pt-6">
                  <div>
                    <label className="block text-slate-700 font-bold mb-2">رابط الفيسبوك</label>
                    <input 
                      type="text" 
                      value={settingsForm.facebookUrl || ''}
                      onChange={e => setSettingsForm({...settingsForm, facebookUrl: e.target.value})}
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none" 
                      placeholder="https://facebook.com/..."
                    />
                  </div>
                  <div>
                    <label className="block text-slate-700 font-bold mb-2">رابط الانستجرام</label>
                    <input 
                      type="text" 
                      value={settingsForm.instagramUrl || ''}
                      onChange={e => setSettingsForm({...settingsForm, instagramUrl: e.target.value})}
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none" 
                      placeholder="https://instagram.com/..."
                    />
                  </div>
                  <div>
                    <label className="block text-slate-700 font-bold mb-2">رابط اليوتيوب</label>
                    <input 
                      type="text" 
                      value={settingsForm.youtubeUrl || ''}
                      onChange={e => setSettingsForm({...settingsForm, youtubeUrl: e.target.value})}
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none" 
                      placeholder="https://youtube.com/..."
                    />
                  </div>
                  <div>
                    <label className="block text-slate-700 font-bold mb-2">رابط فيديو ترحيبي (يوتيوب وغيرها)</label>
                    <input 
                      type="text" 
                      value={settingsForm.heroVideoUrl || ''}
                      onChange={e => setSettingsForm({...settingsForm, heroVideoUrl: e.target.value})}
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none" 
                      placeholder="اتركه فارغاً لإخفائه"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-slate-700 font-bold mb-2">معرف Google Analytics 4 (GA4)</label>
                    <input 
                      type="text" 
                      value={settingsForm.gaMeasurementId || ''}
                      onChange={e => setSettingsForm({...settingsForm, gaMeasurementId: e.target.value})}
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-mono" 
                      placeholder="مثال: G-XXXXXXXXXX"
                    />
                    <p className="text-xs text-slate-500 mt-2">ضع المعرف هنا لتفعيل تتبع الزيارات. (يُطبق تلقائياً على كل الصفحات)</p>
                  </div>
                </div>

                {/* Manage Grades */}
                <div className="border-t border-slate-100 pt-6">
                  <label className="block text-slate-700 font-bold mb-2">إدارة المراحل الدراسية</label>
                  <p className="text-sm text-slate-500 mb-4">أضف أو احذف المراحل الدراسية المتاحة في المنصة.</p>
                  <div className="flex gap-2 mb-4">
                    <input 
                      type="text"
                      id="newGradeInput"
                      placeholder="اسم المرحلة (مثل: الصف الأول الإعدادي)"
                      className="flex-grow p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const input = document.getElementById('newGradeInput') as HTMLInputElement;
                        if (input && input.value.trim()) {
                          const val = input.value.trim();
                          const currentGrades = settingsForm.grades || [];
                          if (!currentGrades.includes(val)) {
                            setSettingsForm({...settingsForm, grades: [...currentGrades, val]});
                            input.value = '';
                          }
                        }
                      }}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 rounded-xl font-bold transition-all"
                    >
                      إضافة
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {(settingsForm.grades || []).map((grade, idx) => (
                      <div key={idx} className="bg-white border border-slate-200 rounded-lg px-3 py-2 flex items-center gap-2">
                        <span className="text-slate-700 font-medium">{grade}</span>
                        <button
                          type="button"
                          onClick={() => {
                            setSettingsForm({
                              ...settingsForm,
                              grades: (settingsForm.grades || []).filter(g => g !== grade)
                            });
                          }}
                          className="text-rose-500 hover:text-rose-700 bg-rose-50 p-1 rounded-md"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Toggles */}
                <div className="grid md:grid-cols-2 gap-4 border-t border-slate-100 pt-6">
                  {/* Google Sign-in / Registration Toggle */}
                  <div className={`p-4 rounded-xl border-2 transition-all md:col-span-2 flex items-center justify-between gap-4 ${
                    settingsForm.enableGoogleAuth ?? true
                      ? 'bg-amber-50/70 border-amber-300'
                      : 'bg-slate-50 border-slate-200'
                  }`}>
                    <div className="flex items-center gap-3.5">
                      <div className="w-11 h-11 rounded-xl bg-white border border-slate-200 flex items-center justify-center shadow-xs flex-shrink-0">
                        <svg className="w-6 h-6" viewBox="0 0 24 24">
                          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                        </svg>
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <label htmlFor="enableGoogleAuth" className="text-slate-900 font-black text-sm block cursor-pointer">
                            إتاحة التسجيل وتسجيل الدخول عبر Google (Google Sign-In)
                          </label>
                          <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                            settingsForm.enableGoogleAuth ?? true 
                              ? 'bg-emerald-100 text-emerald-800' 
                              : 'bg-rose-100 text-rose-800'
                          }`}>
                            {settingsForm.enableGoogleAuth ?? true ? 'متاح ومفعل للطلاب' : 'معطل ومغلق'}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 font-medium mt-0.5">
                          تحديد ما إذا كان الطلاب يمكنهم التسجيل والدخول المباشر بحساب Google. عند التعطيل: يُخفى زر Google تماماً من صفحة التسجيل وصفحة الدخول ويقتصر الحساب على رقم الهاتف والبيانات فقط.
                        </p>
                      </div>
                    </div>

                    <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
                      <input 
                        type="checkbox" 
                        id="enableGoogleAuth"
                        checked={settingsForm.enableGoogleAuth ?? true}
                        onChange={e => setSettingsForm({...settingsForm, enableGoogleAuth: e.target.checked})}
                        className="sr-only peer" 
                      />
                      <div className="w-12 h-6.5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[3px] after:left-[3px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                    </label>
                  </div>

                  <div className="flex items-center gap-3 p-4 bg-indigo-50 border border-indigo-100 rounded-xl">
                    <input 
                      type="checkbox" 
                      id="showFinalRevisions"
                      checked={settingsForm.showFinalRevisions}
                      onChange={e => setSettingsForm({...settingsForm, showFinalRevisions: e.target.checked})}
                      className="w-5 h-5 text-indigo-600 rounded focus:ring-indigo-500" 
                    />
                    <label htmlFor="showFinalRevisions" className="text-indigo-900 font-bold cursor-pointer">
                      تفعيل قسم المراجعات النهائية
                    </label>
                  </div>
                  <div className="flex items-center gap-3 p-4 bg-indigo-50 border border-indigo-100 rounded-xl">
                    <input 
                      type="checkbox" 
                      id="showMiddleSchool"
                      checked={settingsForm.showMiddleSchool ?? true}
                      onChange={e => setSettingsForm({...settingsForm, showMiddleSchool: e.target.checked})}
                      className="w-5 h-5 text-indigo-600 rounded focus:ring-indigo-500" 
                    />
                    <label htmlFor="showMiddleSchool" className="text-indigo-900 font-bold cursor-pointer">
                      عرض المرحلة الإعدادية في الصفحة الرئيسية
                    </label>
                  </div>
                  <div className="flex items-center gap-3 p-4 bg-indigo-50 border border-indigo-100 rounded-xl">
                    <input 
                      type="checkbox" 
                      id="autoDeleteChats"
                      checked={settingsForm.autoDeleteChats ?? true}
                      onChange={e => setSettingsForm({...settingsForm, autoDeleteChats: e.target.checked})}
                      className="w-5 h-5 text-indigo-600 rounded focus:ring-indigo-500" 
                    />
                    <label htmlFor="autoDeleteChats" className="text-indigo-900 font-bold cursor-pointer">
                      تفعيل الحذف التلقائي للمحادثات (بعد أسبوع)
                    </label>
                  </div>
                  <div className="flex items-center gap-3 p-4 bg-indigo-50 border border-indigo-100 rounded-xl">
                    <input 
                      type="checkbox" 
                      id="enableExams"
                      checked={settingsForm.enableExams ?? true}
                      onChange={e => setSettingsForm({...settingsForm, enableExams: e.target.checked})}
                      className="w-5 h-5 text-indigo-600 rounded focus:ring-indigo-500" 
                    />
                    <label htmlFor="enableExams" className="text-indigo-900 font-bold cursor-pointer">
                      تفعيل قسم الامتحانات الدورية
                    </label>
                  </div>
                  <div className="flex items-center gap-3 p-4 bg-indigo-50 border border-indigo-100 rounded-xl">
                    <input 
                      type="checkbox" 
                      id="enableSupport"
                      checked={settingsForm.enableSupport ?? true}
                      onChange={e => setSettingsForm({...settingsForm, enableSupport: e.target.checked})}
                      className="w-5 h-5 text-indigo-600 rounded focus:ring-indigo-500" 
                    />
                    <label htmlFor="enableSupport" className="text-indigo-900 font-bold cursor-pointer">
                      تفعيل قسم الدعم الفني
                    </label>
                  </div>
                  <div className="flex items-center gap-3 p-4 bg-indigo-50 border border-indigo-100 rounded-xl">
                    <input 
                      type="checkbox" 
                      id="showHonorsBoard"
                      checked={settingsForm.showHonorsBoard ?? true}
                      onChange={e => setSettingsForm({...settingsForm, showHonorsBoard: e.target.checked})}
                      className="w-5 h-5 text-indigo-600 rounded focus:ring-indigo-500" 
                    />
                    <label htmlFor="showHonorsBoard" className="text-indigo-900 font-bold cursor-pointer">
                      تفعيل وعرض لوحة الشرف وتكريم الأوائل
                    </label>
                  </div>
                  <div className="flex items-center gap-3 p-4 bg-indigo-50 border border-indigo-100 rounded-xl">
                    <label htmlFor="maxHonorsCount" className="text-indigo-900 font-bold whitespace-nowrap">
                      عدد الأوائل المعروضين:
                    </label>
                    <input 
                      type="number" 
                      id="maxHonorsCount"
                      min="1"
                      max="50"
                      value={settingsForm.maxHonorsCount || 12}
                      onChange={e => setSettingsForm({...settingsForm, maxHonorsCount: parseInt(e.target.value) || 12})}
                      className="w-24 p-2 bg-white border border-indigo-200 rounded-lg text-center font-bold text-indigo-900" 
                    />
                  </div>
                  <div className="flex items-center gap-3 p-4 bg-indigo-50 border border-indigo-100 rounded-xl">
                    <input 
                      type="checkbox" 
                      id="showWhatsApp"
                      checked={settingsForm.showWhatsApp ?? true}
                      onChange={e => setSettingsForm({...settingsForm, showWhatsApp: e.target.checked})}
                      className="w-5 h-5 text-indigo-600 rounded focus:ring-indigo-500" 
                    />
                    <label htmlFor="showWhatsApp" className="text-indigo-900 font-bold cursor-pointer">
                      تفعيل أيقونة الواتساب العائمة
                    </label>
                  </div>
                  <div className="flex items-center gap-3 p-4 bg-indigo-50 border border-indigo-100 rounded-xl">
                    <input 
                      type="checkbox" 
                      id="enableGoogleAuth"
                      checked={settingsForm.enableGoogleAuth ?? true}
                      onChange={e => setSettingsForm({...settingsForm, enableGoogleAuth: e.target.checked})}
                      className="w-5 h-5 text-indigo-600 rounded focus:ring-indigo-500" 
                    />
                    <label htmlFor="enableGoogleAuth" className="text-indigo-900 font-bold cursor-pointer flex-1">
                      <span className="block">تفعيل التسجيل وتسجيل الدخول عبر Google</span>
                      <span className="text-xs text-indigo-600 font-normal">يمكن للأدمن أو المساعدين تعطيل/تفعيل جوجل؛ وعند التعطيل يتم إيقاف تسجيل ودخول حسابات Google بالكامل.</span>
                    </label>
                  </div>
                </div>

                {/* Bunny.net Stream Dynamic Libraries Configuration Section */}
                <AdminBunnyLibrariesManager 
                  settingsForm={settingsForm} 
                  setSettingsForm={setSettingsForm} 
                />

                {/* Custom Firebase Switcher Section */}
                <div className="border-t border-slate-100 dark:border-slate-800 pt-6">
                  <div className="bg-gradient-to-br from-amber-50/70 via-white to-slate-50 dark:from-slate-850 dark:via-slate-900 dark:to-slate-850 border-2 border-amber-200/80 dark:border-amber-900/60 rounded-3xl p-6 shadow-sm">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-amber-600 text-white flex items-center justify-center shadow-md shrink-0">
                          <Database className="w-6 h-6" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-lg font-black text-slate-900 dark:text-white">تخصيص وتغيير ربط حساب Firebase (Firebase Switcher)</h3>
                            <span className="bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 text-xs font-bold px-2.5 py-0.5 rounded-full">
                              متقدم
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                            المشروع النشط حالياً: <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">{effectiveFirebaseConfig.projectId || 'المشروع الافتراضي'}</span>
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={handleResetDefaultFirebase}
                        className="bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs cursor-pointer"
                      >
                        <RefreshCw className="w-3.5 h-3.5 text-amber-600" />
                        <span>استعادة حساب Firebase الافتراضي</span>
                      </button>
                    </div>

                    <div className="p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3">
                      <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
                        إذا أردت ربط المنصة بحساب أو مشروع Firebase مختلف، قم بوضع بيانات المشروع الجديد هنا واضغط حفظ، وسيتم تحويل المنصة إليه مباشرة.
                      </p>

                      <div className="grid md:grid-cols-2 gap-3">
                        <div>
                          <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mb-1">Project ID (معرف المشروع):</label>
                          <input
                            type="text"
                            value={customFbConfig.projectId || ''}
                            onChange={e => setCustomFbConfig({ ...customFbConfig, projectId: e.target.value })}
                            placeholder="my-new-firebase-project"
                            className="w-full p-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl text-xs font-mono outline-none focus:ring-2 focus:ring-amber-500"
                            dir="ltr"
                          />
                        </div>
                        <div>
                          <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mb-1">API Key (مفتاح الـ API):</label>
                          <input
                            type="password"
                            value={customFbConfig.apiKey || ''}
                            onChange={e => setCustomFbConfig({ ...customFbConfig, apiKey: e.target.value })}
                            placeholder="AIzaSy..."
                            className="w-full p-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl text-xs font-mono outline-none focus:ring-2 focus:ring-amber-500"
                            dir="ltr"
                          />
                        </div>
                        <div>
                          <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mb-1">Auth Domain:</label>
                          <input
                            type="text"
                            value={customFbConfig.authDomain || ''}
                            onChange={e => setCustomFbConfig({ ...customFbConfig, authDomain: e.target.value })}
                            placeholder="my-new-project.firebaseapp.com"
                            className="w-full p-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl text-xs font-mono outline-none focus:ring-2 focus:ring-amber-500"
                            dir="ltr"
                          />
                        </div>
                        <div>
                          <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mb-1">Storage Bucket:</label>
                          <input
                            type="text"
                            value={customFbConfig.storageBucket || ''}
                            onChange={e => setCustomFbConfig({ ...customFbConfig, storageBucket: e.target.value })}
                            placeholder="my-new-project.appspot.com"
                            className="w-full p-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl text-xs font-mono outline-none focus:ring-2 focus:ring-amber-500"
                            dir="ltr"
                          />
                        </div>
                      </div>

                      <div className="pt-2 flex items-center justify-between">
                        <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">{fbSaveNotice}</span>
                        <button
                          type="button"
                          onClick={handleSaveCustomFirebase}
                          className="px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-black transition-all shadow-md cursor-pointer flex items-center gap-1.5"
                        >
                          <Save className="w-3.5 h-3.5" />
                          <span>تطبيق وحفظ ربط Firebase الجديد</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                  {saveMessage ? (
                    <span className="text-emerald-600 font-bold">{saveMessage}</span>
                  ) : <span></span>}
                  
                  <button 
                    type="submit" 
                    disabled={savingSettings}
                    className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white px-8 py-3 rounded-xl font-bold flex items-center gap-2 transition-all shadow-md"
                  >
                    {savingSettings ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                    حفظ التعديلات
                  </button>
                </div>
              </form>
            </motion.div>
          )}

          {/* TAB: VIDEOS */}
          {activeTab === 'videos' && (
            <motion.div
              key="videos"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <AdminContentManager type="video" presetCourseId={selectedCoursePreset} />
            </motion.div>
          )}

          {/* TAB: MATERIALS */}
          {activeTab === 'materials' && (
            <motion.div
              key="materials"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <AdminContentManager type="pdf" presetCourseId={selectedCoursePreset} />
            </motion.div>
          )}

          {/* TAB: PERFORMANCE */}
          {activeTab === 'performance' && (
            <motion.div
              key="performance"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <AdminPerformance />
            </motion.div>
          )}

          {/* TAB: SUPPORT */}
          {activeTab === 'support' && (
            <motion.div
              key="support"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="h-full"
            >
              <AdminSupport />
            </motion.div>
          )}

          {/* TAB: EXAMS */}
          {activeTab === 'exams' && (
            <motion.div
              key="exams"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <AdminExams presetCourseId={selectedCoursePreset} />
            </motion.div>
          )}

        </AnimatePresence>
      </div>

      {selectedReceipt && (
        <div className="fixed inset-0 bg-black/75 z-50 flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setSelectedReceipt(null)}>
          <div className="bg-white dark:bg-slate-900 rounded-2xl overflow-hidden max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl relative border border-slate-200 dark:border-slate-800 transition-colors" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/80">
              <h3 className="font-bold text-slate-800 dark:text-white text-lg">صورة الإيصال</h3>
              <button onClick={() => setSelectedReceipt(null)} className="text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 p-2 rounded-lg transition-colors cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-auto p-4 flex justify-center bg-slate-100 dark:bg-slate-950">
              <img src={selectedReceipt} alt="Receipt" className="max-w-full h-auto object-contain rounded shadow-sm border border-slate-200 dark:border-slate-800" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
