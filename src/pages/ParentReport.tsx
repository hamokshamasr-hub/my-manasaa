import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { db } from '../lib/firebase';
import { collection, query, where, getDocs, doc, getDoc, onSnapshot } from 'firebase/firestore';
import { useSettings } from '../contexts/SettingsContext';
import { buildWhatsAppUrl } from '../lib/whatsapp';
import { 
  Award, 
  Bell, 
  CheckCircle2, 
  Clock, 
  FileText, 
  GraduationCap, 
  Loader2, 
  Phone, 
  Share2, 
  ShieldCheck, 
  Star, 
  TrendingUp, 
  Trophy, 
  User, 
  AlertCircle, 
  MessageCircle,
  Calendar,
  Printer,
  BookOpen,
  Check,
  XCircle
} from 'lucide-react';
import { motion } from 'motion/react';
import { AppUser } from '../contexts/AuthContext';
import { getLevel } from '../components/Leaderboard';

interface ExamResult {
  id: string;
  examId: string;
  examTitle: string;
  score: number;
  totalScore: number;
  percentage: number;
  studentName: string;
  studentId: string;
  createdAt: number;
  passed?: boolean;
}

interface AttendanceRecord {
  id: string;
  studentId: string;
  studentName: string;
  date: string;
  status: 'present' | 'absent' | 'late';
  timestamp: number;
  notes?: string;
}

interface RecitationRecord {
  id: string;
  studentId: string;
  studentName: string;
  title: string;
  score: number;
  finalGrade: number;
  percentage: number;
  date: string;
  timestamp: number;
  notes?: string;
}

interface ParentNotification {
  id: string;
  studentId: string;
  title: string;
  message: string;
  type?: string;
  createdAt: number;
}

export default function ParentReport() {
  const { id } = useParams<{ id: string }>();
  const { settings } = useSettings();

  const [student, setStudent] = useState<AppUser | null>(null);
  const [examResults, setExamResults] = useState<ExamResult[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [recitationRecords, setRecitationRecords] = useState<RecitationRecord[]>([]);
  const [parentNotifications, setParentNotifications] = useState<ParentNotification[]>([]);
  const [liveAlert, setLiveAlert] = useState<ParentNotification | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notificationStatus, setNotificationStatus] = useState<'default' | 'granted' | 'denied' | 'unsupported'>('default');
  const [notificationSuccessMsg, setNotificationSuccessMsg] = useState('');

  const initialLoadDone = useRef(false);

  // Check browser notification support & current permission
  useEffect(() => {
    if (!('Notification' in window)) {
      setNotificationStatus('unsupported');
    } else {
      setNotificationStatus(Notification.permission as any);
    }
  }, []);

  useEffect(() => {
    if (!id) {
      setError('معرف الطالب غير موجود.');
      setLoading(false);
      return;
    }

    let unsubExam: (() => void) | undefined;
    let unsubAtt: (() => void) | undefined;
    let unsubRec: (() => void) | undefined;
    let unsubNotif: (() => void) | undefined;

    const setupListeners = async () => {
      try {
        setLoading(true);
        setError('');

        // 1. Try finding by student doc ID
        let studentData: AppUser | null = null;
        const studentRef = doc(db, 'users', id);
        const studentSnap = await getDoc(studentRef);

        if (studentSnap.exists()) {
          studentData = { uid: studentSnap.id, ...studentSnap.data() } as AppUser;
        } else {
          // 2. Try finding by student code
          const qByCode = query(collection(db, 'users'), where('code', '==', id.trim()));
          const snapByCode = await getDocs(qByCode);
          if (!snapByCode.empty) {
            const d = snapByCode.docs[0];
            studentData = { uid: d.id, ...d.data() } as AppUser;
          }
        }

        if (!studentData) {
          setError('لم يتم العثور على بيانات الطالب. يرجى التأكد من مسح الرمز بشكل صحيح.');
          setLoading(false);
          return;
        }

        setStudent(studentData);
        setLoading(false);

        // Real-Time Listeners
        // 1. Exam Results
        const qResults = query(
          collection(db, 'exam_results'),
          where('studentId', '==', studentData.uid)
        );
        unsubExam = onSnapshot(qResults, (snapshot) => {
          const results = snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as ExamResult[];
          results.sort((a, b) => b.createdAt - a.createdAt);
          setExamResults(results);
        }, (e) => console.warn('Exam snapshot error:', e));

        // 2. Attendance Records
        const qAtt = query(
          collection(db, 'attendance'),
          where('studentId', '==', studentData.uid)
        );
        unsubAtt = onSnapshot(qAtt, (snapshot) => {
          const attList = snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as AttendanceRecord[];
          attList.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
          setAttendanceRecords(attList);
        }, (e) => console.warn('Attendance snapshot error:', e));

        // 3. Recitation Records with live notification trigger
        const qRec = query(
          collection(db, 'recitations'),
          where('studentId', '==', studentData.uid)
        );
        unsubRec = onSnapshot(qRec, (snapshot) => {
          const recList = snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as RecitationRecord[];
          recList.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
          setRecitationRecords(recList);

          if (initialLoadDone.current && recList.length > 0) {
            const latest = recList[0];
            const isFresh = (Date.now() - (latest.timestamp || 0)) < 15 * 60 * 1000;
            if (isFresh) {
              const alertData: ParentNotification = {
                id: latest.id,
                studentId: latest.studentId,
                title: `تسميع جديد: ${latest.title}`,
                message: `حصل الطالب على درجة ${latest.score} من ${latest.finalGrade} (${latest.percentage}%)`,
                type: 'recitation',
                createdAt: latest.timestamp || Date.now()
              };
              setLiveAlert(alertData);

              const hasNotificationSupport = typeof window !== 'undefined' && 'Notification' in window;
              if (hasNotificationSupport && window.Notification.permission === 'granted') {
                try {
                  new Notification(`🔔 تسميع جديد للطالب: ${studentData?.name || ''}`, {
                    body: alertData.message,
                    icon: settings.platformLogoBase64 || '/favicon.ico'
                  });
                } catch (err) {
                  console.warn('Native notification failed:', err);
                }
              }
            }
          }
          initialLoadDone.current = true;
        }, (e) => console.warn('Recitation snapshot error:', e));

        // 4. Parent Notifications Collection
        const qNotifs = query(
          collection(db, 'parent_notifications'),
          where('studentId', '==', studentData.uid)
        );
        unsubNotif = onSnapshot(qNotifs, (snapshot) => {
          const notifs = snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as ParentNotification[];
          notifs.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
          setParentNotifications(notifs);

          if (initialLoadDone.current && notifs.length > 0) {
            const newest = notifs[0];
            const isVeryRecent = (Date.now() - (newest.createdAt || 0)) < 10 * 60 * 1000;
            if (isVeryRecent) {
              setLiveAlert(newest);
              const hasNotificationSupport = typeof window !== 'undefined' && 'Notification' in window;
              if (hasNotificationSupport && window.Notification.permission === 'granted') {
                try {
                  new Notification(`🔔 ${newest.title}`, {
                    body: newest.message,
                    icon: settings.platformLogoBase64 || '/favicon.ico'
                  });
                } catch (err) {}
              }
            }
          }
        }, (e) => console.warn('Parent notifications snapshot error:', e));

      } catch (err: any) {
        console.error("Error loading parent report:", err);
        setError('حدث خطأ أثناء تحميل بيانات تقرير الطالب.');
        setLoading(false);
      }
    };

    setupListeners();

    return () => {
      if (unsubExam) unsubExam();
      if (unsubAtt) unsubAtt();
      if (unsubRec) unsubRec();
      if (unsubNotif) unsubNotif();
    };
  }, [id]);

  const requestNotificationPermission = async () => {
    if (!('Notification' in window)) {
      alert('المتصفح الحالي لا يدعم إشعارات سطح المكتب.');
      return;
    }

    try {
      const permission = await Notification.requestPermission();
      setNotificationStatus(permission as any);

      if (permission === 'granted') {
        setNotificationSuccessMsg('تم تفعيل إشعارات المتصفح بنجاح! ستصلك درجات الطالب فورياً.');
        try {
          new Notification('🎓 مرحباً بولي الأمر في منصة التفوق!', {
            body: `تم ربط إشعارات الدرجات للطالب ${student?.name || ''} بنجاح. ستصلك أحدث التقارير والامتحانات مباشرة.`,
            icon: settings.platformLogoBase64 || '/favicon.ico'
          });
        } catch (e) {
          console.warn("Notification trigger notice:", e);
        }
      } else if (permission === 'denied') {
        alert('تم رفض إذن الإشعارات في المتصفح. يمكنك تفعيلها من إعدادات الموقع أعلى شريط العنوان.');
      }
    } catch (e) {
      console.error("Error requesting notification permission:", e);
    }
  };

  const handlePrintReport = () => {
    // If dark mode is active, temporarily remove it for crisp printing
    const isDark = document.documentElement.classList.contains('dark');
    if (isDark) document.documentElement.classList.remove('dark');
    
    setTimeout(() => {
      window.print();
      if (isDark) {
        setTimeout(() => {
          document.documentElement.classList.add('dark');
        }, 1200);
      }
    }, 150);
  };

  if (loading) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center p-6 text-center">
        <Loader2 className="w-12 h-12 text-indigo-600 animate-spin mb-4" />
        <h2 className="text-xl font-bold text-slate-800">جاري تحميل تقرير ولي الأمر...</h2>
        <p className="text-sm text-slate-500 mt-1">يتم استرجاع بيانات الطالب وسجل الامتحانات والحضور</p>
      </div>
    );
  }

  if (error || !student) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center p-6">
        <div className="bg-white rounded-3xl p-8 max-w-md w-full text-center border border-slate-200 shadow-xl">
          <div className="w-16 h-16 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-black text-slate-900 mb-2">عذراً، لم نتمكن من الوصول لبيانات الطالب</h2>
          <p className="text-slate-600 text-sm mb-6 leading-relaxed">{error}</p>
          <Link
            to="/"
            className="inline-block bg-indigo-600 text-white font-bold px-6 py-3 rounded-xl shadow-md hover:bg-indigo-700 transition-all text-sm"
          >
            العودة للصفحة الرئيسية
          </Link>
        </div>
      </div>
    );
  }

  const level = getLevel(student.totalPoints || 0);
  const LevelIcon = level.icon;

  const totalExams = examResults.length;
  const avgScore = totalExams > 0
    ? Math.round(examResults.reduce((acc, cur) => acc + (cur.percentage || 0), 0) / totalExams)
    : 0;

  // General Level Metrics: Attendance % and Recitation %
  const totalAttendanceDays = attendanceRecords.length;
  const presentDays = attendanceRecords.filter(a => a.status === 'present').length;
  const attendancePercentage = totalAttendanceDays > 0
    ? Math.round((presentDays / totalAttendanceDays) * 100)
    : 100;

  const activeRecitations = recitationRecords.filter(r => !r.isCancelled && (r as any).status !== 'cancelled');
  const totalRecitations = activeRecitations.length;
  const avgRecitationPercentage = totalRecitations > 0
    ? Math.round(activeRecitations.reduce((acc, cur) => acc + (cur.percentage || 0), 0) / totalRecitations)
    : 100;

  const whatsappInquiryUrl = buildWhatsAppUrl(
    settings.whatsappNumber,
    `السلام عليكم، أنا ولي أمر الطالب: ${student.name}، كود الطالب: ${student.code || ''}. أود الاستفسار والمتابعة بشأن مستواه الأكاديمي والحضور.`
  );

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#070b14] py-10 px-4 sm:px-6 lg:px-8 print:p-2 print:bg-white transition-colors">
      <div className="max-w-4xl mx-auto space-y-8 print:space-y-4">

        {/* Top Header Card */}
        <div className="bg-gradient-to-br from-indigo-900 via-indigo-800 to-slate-900 text-white rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden border border-indigo-700/40 print:text-black print:bg-none print:border-slate-400 print:shadow-none print:p-4">
          <div className="absolute top-0 right-0 w-80 h-80 bg-white/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none print:hidden"></div>

          <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-5 text-center md:text-right">
              <div className="w-20 h-20 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center shadow-xl print:hidden">
                <GraduationCap className="w-10 h-10 text-amber-300" />
              </div>
              <div>
                <div className="flex items-center gap-2 justify-center md:justify-start mb-1 flex-wrap">
                  <span className="bg-amber-400 text-slate-950 text-xs font-black px-3 py-1 rounded-full shadow-sm">
                    {student.isCenterStudent ? 'طالب سنتر' : 'طالب أونلاين'}
                  </span>
                  <span className="bg-white/20 text-white print:text-slate-700 print:border print:border-slate-300 text-xs font-bold px-3 py-1 rounded-full backdrop-blur-sm">
                    {student.grade || 'غير محدد'}
                  </span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-black print:text-slate-900">{student.name}</h1>
                <p className="text-indigo-200 print:text-slate-600 text-sm mt-1">تقرير المتابعة الأكاديمي الشامل لولي الأمر</p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto justify-end">
              <div className="bg-black/30 border border-white/10 rounded-2xl p-4 text-center min-w-[180px] print:border-slate-300 print:bg-slate-100">
                <div className="text-xs text-indigo-300 print:text-slate-600 font-bold mb-1">كود الطالب الأكاديمي</div>
                <div className="font-mono text-2xl font-black text-amber-300 print:text-slate-900 tracking-wider">
                  {student.code || student.uid.substring(0, 6)}
                </div>
              </div>

              {/* Print Report Button specifically for parents */}
              <button
                onClick={handlePrintReport}
                className="bg-amber-400 hover:bg-amber-500 text-slate-950 font-black px-4 py-3.5 rounded-2xl shadow-lg transition-all active:scale-95 flex items-center gap-2 text-xs flex-shrink-0 print:hidden cursor-pointer"
                title="طباعة تقرير المتابعة الورقي لولي الأمر"
              >
                <Printer className="w-4 h-4" />
                <span>طباعة التقرير</span>
              </button>
            </div>
          </div>
        </div>

        {/* Live Alert Banner when new recitation or attendance is received in real-time */}
        {liveAlert && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            className="bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 text-white p-5 rounded-3xl shadow-xl flex items-center justify-between gap-4 border border-emerald-300 print:hidden"
          >
            <div className="flex items-center gap-3">
              <span className="text-3xl animate-bounce">🔔</span>
              <div>
                <div className="font-black text-base flex items-center gap-2">
                  <span>{liveAlert.title}</span>
                  <span className="bg-white/20 text-white text-[10px] font-black px-2 py-0.5 rounded-full">إشعار فوري جديد</span>
                </div>
                <p className="text-emerald-100 text-xs font-bold mt-0.5">{liveAlert.message}</p>
              </div>
            </div>
            <button
              onClick={() => setLiveAlert(null)}
              className="bg-white/20 hover:bg-white/30 text-white px-3.5 py-1.5 rounded-xl text-xs font-black cursor-pointer transition-colors"
            >
              إغلاق ✕
            </button>
          </motion.div>
        )}

        {/* Browser Notification Permission Banner */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border-2 border-indigo-200 dark:border-indigo-900/60 shadow-lg shadow-indigo-100/30 dark:shadow-none flex flex-col sm:flex-row items-center justify-between gap-6 print:hidden">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center flex-shrink-0 border border-indigo-100 dark:border-indigo-800/60">
              <Bell className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-black text-slate-900 dark:text-white text-lg">إشعارات المتصفح الفورية لولي الأمر 🔔</h3>
                <span className="inline-flex items-center gap-1 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 text-[10px] font-black px-2.5 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800 animate-pulse">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                  <span>متصل ومحدث فورياً</span>
                </span>
              </div>
              <p className="text-slate-600 dark:text-slate-400 text-sm mt-0.5 leading-relaxed">
                ستصلك إشعارات فورية على هاتفك بكل درجات الطالب والحضور والتسميع فور رصدها بالسنتر.
              </p>
            </div>
          </div>

          <div className="flex-shrink-0 w-full sm:w-auto">
            {notificationStatus === 'granted' ? (
              <div className="bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 px-5 py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                <span>الإشعارات مفعلة ومربوطة ✅</span>
              </div>
            ) : (
              <button
                onClick={requestNotificationPermission}
                className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-xl font-bold text-sm shadow-md shadow-indigo-200 dark:shadow-none transition-all active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
              >
                <Bell className="w-4 h-4" />
                <span>تفعيل وصول درجات التسميع والغياب</span>
              </button>
            )}
          </div>
        </div>

        {notificationSuccessMsg && (
          <div className="bg-emerald-100 dark:bg-emerald-950/80 border border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 px-5 py-3 rounded-2xl text-sm font-bold flex items-center gap-2 print:hidden">
            <CheckCircle2 className="w-5 h-5 text-emerald-700 dark:text-emerald-400 flex-shrink-0" />
            <span>{notificationSuccessMsg}</span>
          </div>
        )}

        {/* GENERAL LEVEL METRICS: Attendance % and Recitation % + Exams */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          
          {/* General Attendance Metric */}
          <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 rounded-xl flex items-center justify-center flex-shrink-0 font-black text-lg border border-emerald-100 dark:border-emerald-800/60">
              %
            </div>
            <div>
              <span className="text-xs text-slate-500 dark:text-slate-400 font-bold block">نسبة الحضور والانضباط</span>
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400">{attendancePercentage}%</span>
                <span className="text-[11px] text-slate-400 dark:text-slate-500 font-bold">({presentDays}/{totalAttendanceDays || 0} حصة)</span>
              </div>
            </div>
          </div>

          {/* General Recitation Metric */}
          <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 rounded-xl flex items-center justify-center flex-shrink-0 border border-indigo-100 dark:border-indigo-800/60">
              <BookOpen className="w-6 h-6" />
            </div>
            <div>
              <span className="text-xs text-slate-500 dark:text-slate-400 font-bold block">نسبة التسميع الشفوي</span>
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl font-black text-indigo-600 dark:text-indigo-400">{avgRecitationPercentage}%</span>
                <span className="text-[11px] text-slate-400 dark:text-slate-500 font-bold">({totalRecitations} تسميع)</span>
              </div>
            </div>
          </div>

          {/* Average Exams Score */}
          <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 rounded-xl flex items-center justify-center flex-shrink-0 border border-amber-100 dark:border-amber-800/60">
              <Trophy className="w-6 h-6" />
            </div>
            <div>
              <span className="text-xs text-slate-500 dark:text-slate-400 font-bold block">متوسط درجات الامتحانات</span>
              <span className="text-2xl font-black text-amber-600 dark:text-amber-400">{avgScore}%</span>
            </div>
          </div>

          {/* Points & Level */}
          <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-4">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${level.bg} ${level.color}`}>
              <LevelIcon className="w-6 h-6" />
            </div>
            <div>
              <span className="text-xs text-slate-500 dark:text-slate-400 font-bold block">المستوى والنقاط</span>
              <span className="text-lg font-black text-slate-900 dark:text-white">{student.totalPoints || 0} نقطة</span>
            </div>
          </div>
        </div>

        {/* SECTION: REAL-TIME NOTIFICATIONS FEED */}
        {parentNotifications.length > 0 && (
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden p-6 sm:p-8 print:hidden">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center border border-amber-100 dark:border-amber-800/60">
                  <Bell className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900 dark:text-white">سجل الإشعارات والتنبيهات المباشرة</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">كل إشعار يتم إرساله لولي الأمر فور مسح الـ QR أو رصد التسميع</p>
                </div>
              </div>
              <span className="bg-amber-100 dark:bg-amber-950/80 text-amber-900 dark:text-amber-300 text-xs font-black px-3 py-1 rounded-full border border-amber-200 dark:border-amber-800">
                {parentNotifications.length} إشعار
              </span>
            </div>

            <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
              {parentNotifications.slice(0, 10).map((n) => {
                const dateText = new Date(n.createdAt).toLocaleDateString('ar-EG', {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                });
                return (
                  <div
                    key={n.id}
                    className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200/80 dark:border-slate-700/60 flex items-start justify-between gap-3 text-right"
                  >
                    <div className="flex items-start gap-3">
                      <span className="text-xl">
                        {n.type === 'attendance' ? '📍' : n.type === 'recitation' ? '📝' : '🔔'}
                      </span>
                      <div>
                        <h4 className="text-xs font-black text-slate-900 dark:text-white">{n.title}</h4>
                        <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5 leading-relaxed">{n.message}</p>
                      </div>
                    </div>
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono whitespace-nowrap pt-1">
                      {dateText}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* SECTION: RECITATIONS LOG */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden p-6 sm:p-8">
          <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
                <BookOpen className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
                <span>سجل درجات التسميع والشفوي (Recitations)</span>
              </h2>
              <p className="text-slate-500 dark:text-slate-400 text-sm font-medium mt-1">تتبع درجات التسميع الدورية في السنتر مع المقارنة بالدرجة النهائية</p>
            </div>
            <span className="bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-bold text-xs px-3 py-1.5 rounded-lg border border-indigo-100 dark:border-indigo-800/60">
              {recitationRecords.length} تسميع
            </span>
          </div>

          {recitationRecords.length === 0 ? (
            <div className="text-center py-8 text-slate-400 dark:text-slate-500 text-sm">
              لم يتم رصد تسميعات بعد لهذا الطالب.
            </div>
          ) : (
            <div className="space-y-3">
              {recitationRecords.map((rec) => {
                const isPassed = rec.percentage >= 60;
                const isCancelled = rec.isCancelled || (rec as any).status === 'cancelled';
                const isMakeUp = (rec as any).isMakeUp || (rec as any).status === 'made_up';
                const isMissed = rec.score === 0 || (rec as any).status === 'missed';

                return (
                  <div 
                    key={rec.id}
                    className="p-4 rounded-2xl border border-slate-100 dark:border-slate-800 hover:border-indigo-200 dark:hover:border-indigo-700 transition-all bg-slate-50/50 dark:bg-slate-800/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
                  >
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-black text-sm flex-shrink-0 ${
                        isCancelled 
                          ? 'bg-slate-100 dark:bg-slate-800 text-slate-500 border border-slate-200 dark:border-slate-700'
                          : isPassed 
                          ? 'bg-indigo-100 dark:bg-indigo-950/80 text-indigo-800 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800' 
                          : 'bg-rose-100 dark:bg-rose-950/80 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                      }`}>
                        {isCancelled ? 'ملغي' : `${rec.percentage}%`}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-black text-slate-900 dark:text-white text-base">{rec.title}</h4>
                          {isMakeUp && (
                            <span className="bg-teal-100 dark:bg-teal-950 text-teal-800 dark:text-teal-300 text-[10px] font-black px-2 py-0.5 rounded-full border border-teal-200 dark:border-teal-800">
                              تسميع تعويضي معتمد قبل موعد الحصة ✓
                            </span>
                          )}
                          {isCancelled && (
                            <span className="bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 text-[10px] font-black px-2 py-0.5 rounded-full">
                              ملغي بقرار المعلم (لا يؤثر على التقييم)
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 mt-1">
                          <span className="flex items-center gap-1 font-medium">
                            <Calendar className="w-3.5 h-3.5" />
                            {rec.date}
                          </span>
                          <span>•</span>
                          <span>الدرجة: <b className="text-slate-800 dark:text-slate-200 font-mono">{rec.score}</b> من <b className="text-slate-800 dark:text-slate-200 font-mono">{rec.finalGrade}</b></span>
                          {rec.notes && (
                            <>
                              <span>•</span>
                              <span className="text-indigo-600 dark:text-indigo-400 font-medium">{rec.notes}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <span className={`px-3 py-1 rounded-full text-xs font-black ${
                      isCancelled
                        ? 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                        : isMissed
                        ? 'bg-rose-100 dark:bg-rose-950/80 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                        : isPassed 
                        ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800' 
                        : 'bg-rose-100 dark:bg-rose-950/80 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                    }`}>
                      {isCancelled ? 'ملغي' : isMissed ? 'لم يسمع (غائب)' : isPassed ? 'متقن التسميع' : 'يحتاج إعادة'}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* SECTION: ATTENDANCE LOG */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden p-6 sm:p-8">
          <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
                <CheckCircle2 className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
                <span>سجل الحضور والغياب في الحصص</span>
              </h2>
              <p className="text-slate-500 dark:text-slate-400 text-sm font-medium mt-1">سجل تفصيلي لحضور الطالب في السنتر ومواعيد الحصص</p>
            </div>
            <span className="bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-bold text-xs px-3 py-1.5 rounded-lg border border-emerald-100 dark:border-emerald-800/60">
              {attendanceRecords.length} تسجيل
            </span>
          </div>

          {attendanceRecords.length === 0 ? (
            <div className="text-center py-8 text-slate-400 dark:text-slate-500 text-sm">
              لم يتم رصد غياب أو حضور مسجل بعد لهذا الطالب.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {attendanceRecords.map((att) => (
                <div 
                  key={att.id}
                  className={`p-3.5 rounded-2xl border flex items-center justify-between gap-3 ${
                    att.status === 'present' 
                      ? 'bg-emerald-50/60 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800/80' 
                      : att.status === 'late'
                        ? 'bg-amber-50/60 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800/80'
                        : 'bg-rose-50/60 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800/80'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    {att.status === 'present' ? (
                      <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 font-bold" />
                    ) : att.status === 'late' ? (
                      <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                    ) : (
                      <XCircle className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                    )}
                    <div>
                      <span className="font-bold text-slate-900 dark:text-white text-xs block">{att.date}</span>
                      {att.notes && <span className="text-[10px] text-slate-500 dark:text-slate-400">{att.notes}</span>}
                    </div>
                  </div>

                  <span className={`text-[11px] font-black px-2 py-0.5 rounded-full ${
                    att.status === 'present'
                      ? 'bg-emerald-200/70 dark:bg-emerald-900/80 text-emerald-900 dark:text-emerald-200'
                      : att.status === 'late'
                        ? 'bg-amber-200/70 dark:bg-amber-900/80 text-amber-900 dark:text-amber-200'
                        : 'bg-rose-200/70 dark:bg-rose-900/80 text-rose-900 dark:text-rose-200'
                  }`}>
                    {att.status === 'present' ? 'حاضر' : att.status === 'late' ? 'متأخر' : 'غائب'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* SECTION: EXAMS RESULTS */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden p-6 sm:p-8">
          <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">سجل درجات الامتحانات والواجبات</h2>
              <p className="text-slate-500 dark:text-slate-400 text-sm font-medium mt-1">تفاصيل نتائج الطالب الموثقة في المنصة</p>
            </div>
            <span className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700">
              {examResults.length} امتحان
            </span>
          </div>

          {examResults.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
              <p className="text-slate-500 dark:text-slate-400 font-medium">لم يتم تسجيل أي امتحانات مكتملة للطالب حتى الآن.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {examResults.map((res) => {
                const dateStr = new Date(res.createdAt).toLocaleDateString('ar-EG', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                });
                const isPassed = res.percentage >= 60;

                return (
                  <div 
                    key={res.id}
                    className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-700 transition-all bg-slate-50/50 dark:bg-slate-800/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
                  >
                    <div className="flex items-center gap-4">
                      <div className={`w-14 h-14 rounded-2xl flex items-center justify-center font-black text-base flex-shrink-0 ${
                        isPassed ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800' : 'bg-rose-100 dark:bg-rose-950/80 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                      }`}>
                        {res.percentage}%
                      </div>
                      <div>
                        <h4 className="font-black text-slate-900 dark:text-white text-base">{res.examTitle || 'امتحان بدون عنوان'}</h4>
                        <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 mt-1">
                          <span className="flex items-center gap-1 font-medium">
                            <Calendar className="w-3.5 h-3.5" />
                            {dateStr}
                          </span>
                          <span>•</span>
                          <span>الدرجة: <b className="text-slate-700 dark:text-slate-300">{res.score} / {res.totalScore}</b></span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
                      <span className={`px-3 py-1 rounded-full text-xs font-black ${
                        isPassed ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800' : 'bg-rose-100 dark:bg-rose-950/80 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                      }`}>
                        {isPassed ? 'ناجح ومجتاز' : 'يحتاج لمراجعة وتطوير'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Contact Teacher / Secretariat Section */}
        {settings.whatsappNumber && (
          <div className="bg-emerald-50 dark:bg-emerald-950/40 rounded-3xl p-6 sm:p-8 border border-emerald-200 dark:border-emerald-800/80 flex flex-col sm:flex-row items-center justify-between gap-6 print:hidden">
            <div className="flex items-center gap-4 text-center sm:text-right">
              <div className="w-14 h-14 bg-emerald-600 text-white rounded-2xl flex items-center justify-center flex-shrink-0 shadow-lg shadow-emerald-200 dark:shadow-none">
                <MessageCircle className="w-7 h-7" />
              </div>
              <div>
                <h3 className="text-xl font-black text-slate-900 dark:text-white">هل تود مناقشة مستوى الطالب مع الأستاذ؟</h3>
                <p className="text-slate-600 dark:text-slate-300 text-sm mt-1">فريق المتابعة والسكرتارية في خدمتكم دائماً للرد على أي استفسارات تخص مستوى الطالب.</p>
              </div>
            </div>

            <a
              href={whatsappInquiryUrl}
              target="_blank"
              rel="noreferrer"
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-8 py-3.5 rounded-xl shadow-md transition-all flex items-center gap-2 flex-shrink-0 text-sm cursor-pointer"
            >
              <MessageCircle className="w-4 h-4" />
              <span>محادثة واتساب مباشرة</span>
            </a>
          </div>
        )}

      </div>
    </div>
  );
}
