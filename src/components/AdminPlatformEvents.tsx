import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, query, orderBy, limit, onSnapshot, where, getDocs, doc, deleteDoc } from 'firebase/firestore';
import { 
  Activity, Shield, ShieldAlert, CheckCircle2, XCircle, Clock, 
  Search, Filter, User, CreditCard, BookOpen, FileText, CheckSquare, 
  Calendar, RefreshCw, Smartphone, Eye, Sparkles, Building, AlertTriangle, Trash2
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useSettings } from '../contexts/SettingsContext';

export interface PlatformEvent {
  id: string;
  type: 'attendance' | 'payment' | 'exam' | 'content' | 'user' | 'security';
  title: string;
  details: string;
  actorName?: string;
  actorEmail?: string;
  actorRole?: string;
  targetStudentName?: string;
  targetStudentCode?: string;
  timestamp: number;
  metadata?: any;
}

export default function AdminPlatformEvents() {
  const { appUser } = useAuth();
  const { settings } = useSettings();
  const [events, setEvents] = useState<PlatformEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Security check: Only Admin (Main Admin) can access
  if (appUser?.role !== 'admin') {
    return (
      <div className="bg-rose-50 border-2 border-rose-300 rounded-3xl p-8 text-center space-y-4 max-w-xl mx-auto my-12">
        <div className="w-16 h-16 bg-rose-100 text-rose-600 rounded-2xl flex items-center justify-center mx-auto shadow-md">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-black text-rose-950">صلاحية محظورة - الأدمن الرئيسي فقط</h2>
        <p className="text-sm font-bold text-rose-700 leading-relaxed">
          سجل أحداث المنصة يحتوي على بيانات رقابية حساسة ومتاح حصرياً للمدير العام الرئيسي للمنصة (Admin).
        </p>
      </div>
    );
  }

  useEffect(() => {
    // 1. Subscribe to real-time events from 'platform_events'
    const qEvents = query(collection(db, 'platform_events'), orderBy('timestamp', 'desc'), limit(150));
    const unsubscribeEvents = onSnapshot(qEvents, (snapshot) => {
      const liveEvents = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as PlatformEvent[];
      
      // If no events recorded yet in platform_events, synthesize live events from attendance, payments, exams
      if (liveEvents.length === 0) {
        synthesizeRecentEvents();
      } else {
        setEvents(liveEvents);
        setLoading(false);
      }
    }, (err) => {
      console.warn("Live events fallback:", err);
      synthesizeRecentEvents();
    });

    return () => unsubscribeEvents();
  }, []);

  const synthesizeRecentEvents = async () => {
    try {
      const synthesized: PlatformEvent[] = [];

      // 1. Recent Attendance Scans
      const attSnap = await getDocs(query(collection(db, 'attendance'), orderBy('timestamp', 'desc'), limit(40)));
      attSnap.docs.forEach(doc => {
        const d = doc.data();
        synthesized.push({
          id: `att_${doc.id}`,
          type: 'attendance',
          title: `تسجيل حضور بالسنتر: ${d.studentName || 'طالب'}`,
          details: `الحالة: ${d.status === 'present' ? 'حاضر ✅' : d.status === 'late' ? 'متأخر ⏳' : 'غائب ❌'} • التاريخ: ${d.date} ${d.time || ''} • ملاحظات: ${d.notes || 'تسجيل اعتيادي'}`,
          targetStudentName: d.studentName,
          targetStudentCode: d.studentCode,
          timestamp: d.timestamp || Date.now(),
          metadata: d
        });
      });

      // 2. Recent Payments
      const paySnap = await getDocs(query(collection(db, 'payments'), orderBy('createdAt', 'desc'), limit(30)));
      paySnap.docs.forEach(doc => {
        const d = doc.data();
        synthesized.push({
          id: `pay_${doc.id}`,
          type: 'payment',
          title: `طلب اشتراك جديد: ${d.courseName || 'كورس'}`,
          details: `الطالب: ${d.userName} (${d.userEmail}) • المبلغ: ${d.amount} ج.م • الحالة: ${d.status === 'approved' ? 'مقبول ✅' : d.status === 'rejected' ? 'مرفوض ❌' : 'قيد المراجعة ⏳'}`,
          targetStudentName: d.userName,
          actorEmail: d.userEmail,
          timestamp: d.createdAt || Date.now(),
          metadata: d
        });
      });

      // 3. Center Payments
      const centerPaySnap = await getDocs(query(collection(db, 'center_payments'), orderBy('createdAt', 'desc'), limit(25)));
      centerPaySnap.docs.forEach(doc => {
        const d = doc.data();
        synthesized.push({
          id: `cpay_${doc.id}`,
          type: 'payment',
          title: `تحصيل مصاريف سنتر: ${d.studentName || 'طالب'}`,
          details: `المبلغ: ${d.amount} ج.م • شهر: ${d.month} • إيصال: ${d.receiptNumber || '-'} • المستلم: ${d.receivedBy || 'السنتر'}`,
          targetStudentName: d.studentName,
          targetStudentCode: d.studentCode,
          timestamp: d.createdAt || Date.now(),
          metadata: d
        });
      });

      // 4. Recent Exam Results
      const examSnap = await getDocs(query(collection(db, 'exam_results'), orderBy('submittedAt', 'desc'), limit(25)));
      examSnap.docs.forEach(doc => {
        const d = doc.data();
        synthesized.push({
          id: `exam_${doc.id}`,
          type: 'exam',
          title: `تسليم اختبار إلكتروني: ${d.examTitle || 'امتحان'}`,
          details: `الطالب: ${d.studentName} • النتيجة: ${d.score} / ${d.totalMarks} (${Math.round((d.score / (d.totalMarks || 1)) * 100)}%) • التقدير: ${d.gradeLabel || '-'}`,
          targetStudentName: d.studentName,
          timestamp: d.submittedAt || Date.now(),
          metadata: d
        });
      });

      synthesized.sort((a, b) => b.timestamp - a.timestamp);
      setEvents(synthesized);
    } catch (e) {
      console.error("Error synthesizing events:", e);
    } finally {
      setLoading(false);
    }
  };

  const filteredEvents = events.filter(ev => {
    if (filterType !== 'all' && ev.type !== filterType) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const matchTitle = (ev.title || '').toLowerCase().includes(q);
      const matchDetails = (ev.details || '').toLowerCase().includes(q);
      const matchStudent = (ev.targetStudentName || '').toLowerCase().includes(q);
      const matchCode = (ev.targetStudentCode || '').toLowerCase().includes(q);
      return matchTitle || matchDetails || matchStudent || matchCode;
    }
    return true;
  });

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'attendance':
        return <Building className="w-4 h-4 text-emerald-600" />;
      case 'payment':
        return <CreditCard className="w-4 h-4 text-amber-600" />;
      case 'exam':
        return <CheckSquare className="w-4 h-4 text-indigo-600" />;
      case 'content':
        return <BookOpen className="w-4 h-4 text-cyan-600" />;
      case 'user':
        return <User className="w-4 h-4 text-purple-600" />;
      default:
        return <Activity className="w-4 h-4 text-slate-600" />;
    }
  };

  const getBadgeClass = (type: string) => {
    switch (type) {
      case 'attendance':
        return 'bg-emerald-50 text-emerald-800 border-emerald-200';
      case 'payment':
        return 'bg-amber-50 text-amber-800 border-amber-200';
      case 'exam':
        return 'bg-indigo-50 text-indigo-800 border-indigo-200';
      case 'content':
        return 'bg-cyan-50 text-cyan-800 border-cyan-200';
      case 'user':
        return 'bg-purple-50 text-purple-800 border-purple-200';
      default:
        return 'bg-slate-50 text-slate-800 border-slate-200';
    }
  };

  const formatEventTime = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleString('ar-EG', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="space-y-6">
      {/* Executive Header */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-6 sm:p-8 rounded-3xl shadow-xl border border-indigo-900/60 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-xl text-xs font-black">
              <Shield className="w-3.5 h-3.5" />
              <span>خاص بالمدير العام الرئيسي فقط (Super Admin)</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white flex items-center gap-3">
              <Activity className="w-8 h-8 text-indigo-400" />
              <span>سجل أحداث ورقابة المنصة المباشر</span>
            </h1>
            <p className="text-slate-300 text-xs sm:text-sm font-medium max-w-2xl leading-relaxed">
              متابعة حية وفورية لجميع العمليات الحساسة: مسح الحضور بالسنتر، تحصيل المدفوعات والاشتراكات، حل الامتحانات، رفع المواد والمذكرات، وتعديلات المستخدمين.
            </p>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <button
              onClick={() => {
                setLoading(true);
                synthesizeRecentEvents();
              }}
              className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl text-xs font-black flex items-center gap-2 shadow-lg transition-all"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              <span>تحديث الأحداث</span>
            </button>
            <div className="flex items-center gap-2 px-3.5 py-2 bg-emerald-950/60 border border-emerald-500/40 rounded-2xl text-emerald-300 text-xs font-bold">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>المراقبة الحية نشطة</span>
            </div>
          </div>
        </div>

        {/* Quick KPI stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-6 border-t border-slate-800">
          <div className="bg-slate-800/60 p-3.5 rounded-2xl border border-slate-700/60">
            <span className="text-[11px] font-bold text-slate-400 block">إجمالي الأحداث المعروضة</span>
            <span className="text-xl font-black text-white">{events.length}</span>
          </div>
          <div className="bg-slate-800/60 p-3.5 rounded-2xl border border-slate-700/60">
            <span className="text-[11px] font-bold text-slate-400 block">عمليات الحضور بالسنتر</span>
            <span className="text-xl font-black text-emerald-400">{events.filter(e => e.type === 'attendance').length}</span>
          </div>
          <div className="bg-slate-800/60 p-3.5 rounded-2xl border border-slate-700/60">
            <span className="text-[11px] font-bold text-slate-400 block">المعاملات المالية</span>
            <span className="text-xl font-black text-amber-400">{events.filter(e => e.type === 'payment').length}</span>
          </div>
          <div className="bg-slate-800/60 p-3.5 rounded-2xl border border-slate-700/60">
            <span className="text-[11px] font-bold text-slate-400 block">تسليمات الامتحانات</span>
            <span className="text-xl font-black text-indigo-400">{events.filter(e => e.type === 'exam').length}</span>
          </div>
        </div>
      </div>

      {/* Filters and Search Bar */}
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        {/* Categories */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
          {[
            { id: 'all', label: 'جميع الأحداث', count: events.length },
            { id: 'attendance', label: 'حضور السنتر 🚪', count: events.filter(e => e.type === 'attendance').length },
            { id: 'payment', label: 'المالية والاشتراكات 💳', count: events.filter(e => e.type === 'payment').length },
            { id: 'exam', label: 'الامتحانات والنتائج 📝', count: events.filter(e => e.type === 'exam').length },
            { id: 'content', label: 'المحتوى والمذكرات 📚', count: events.filter(e => e.type === 'content').length },
            { id: 'user', label: 'المستخدمين والأمان 👤', count: events.filter(e => e.type === 'user').length },
          ].map(f => (
            <button
              key={f.id}
              onClick={() => setFilterType(f.id)}
              className={`px-3.5 py-2 rounded-xl text-xs font-black whitespace-nowrap transition-all flex items-center gap-1.5 ${
                filterType === f.id
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <span>{f.label}</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${filterType === f.id ? 'bg-indigo-700 text-white' : 'bg-slate-200 text-slate-700'}`}>
                {f.count}
              </span>
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative min-w-[240px]">
          <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="بحث باسم الطالب أو الكود أو الحدث..."
            className="w-full pr-9 pl-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 outline-none focus:border-indigo-500"
          />
        </div>
      </div>

      {/* Events Stream Feed */}
      <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="p-16 text-center text-slate-500 space-y-3">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto text-indigo-600" />
            <p className="font-bold text-sm">جاري جلب وفحص أحداث المنصة في الوقت الفعلي...</p>
          </div>
        ) : filteredEvents.length === 0 ? (
          <div className="p-16 text-center text-slate-400 space-y-2">
            <Activity className="w-12 h-12 mx-auto text-slate-300 mb-2" />
            <p className="font-bold text-base text-slate-600">لا توجد أحداث مطابقة للفلتر المحدد</p>
            <p className="text-xs text-slate-400">أي نشاط جديد يقوم به الطلاب أو المساعدين سيظهر هنا فورياً.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredEvents.map((ev) => (
              <div 
                key={ev.id} 
                className="p-4 sm:p-5 hover:bg-slate-50/80 transition-colors flex items-start gap-4"
              >
                {/* Type Icon Badge */}
                <div className={`w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0 border shadow-xs ${getBadgeClass(ev.type)}`}>
                  {getEventIcon(ev.type)}
                </div>

                {/* Event Content */}
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h4 className="font-black text-sm text-slate-900 flex items-center gap-2">
                      <span>{ev.title}</span>
                      {ev.targetStudentCode && (
                        <span className="font-mono text-[10px] font-black bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-md border border-indigo-200">
                          #{ev.targetStudentCode}
                        </span>
                      )}
                    </h4>
                    <span className="text-[11px] font-bold text-slate-400 flex items-center gap-1 font-mono" dir="ltr">
                      <Clock className="w-3 h-3 text-slate-400" />
                      {formatEventTime(ev.timestamp)}
                    </span>
                  </div>

                  <p className="text-xs text-slate-600 font-medium leading-relaxed">
                    {ev.details}
                  </p>

                  {/* Actor details if any */}
                  {(ev.actorName || ev.actorEmail) && (
                    <div className="text-[11px] text-slate-500 flex items-center gap-2 pt-1 font-medium">
                      <span>بواسطة:</span>
                      <span className="font-bold text-slate-700">{ev.actorName || ev.actorEmail}</span>
                      {ev.actorRole && (
                        <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded font-bold">
                          {ev.actorRole === 'admin' ? 'المدير العام' : 'مساعد'}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
