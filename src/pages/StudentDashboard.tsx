import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useSettings } from '../contexts/SettingsContext';
import { db } from '../lib/firebase';
import { collection, query, where, onSnapshot, getDocs, doc, updateDoc, getDoc, setDoc, increment } from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Video, 
  FileText, 
  Loader2, 
  PlayCircle, 
  Download, 
  MessageCircle, 
  X, 
  CheckSquare, 
  BookOpen, 
  Clock, 
  ChevronLeft, 
  ChevronRight,
  Star, 
  Award,
  Bell,
  CheckCircle2,
  Share2,
  Copy,
  Check,
  GraduationCap,
  Sparkles,
  ArrowRight,
  UserCheck,
  ShieldCheck,
  AlertCircle,
  ExternalLink,
  ShieldAlert,
  CreditCard,
  Lock
} from 'lucide-react';
import { Navigate, Link, useLocation } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { Material } from '../components/AdminContentManager';
import StudentSupport from '../components/StudentSupport';
import StudentExams from '../components/StudentExams';
import Leaderboard, { getLevel, levels } from '../components/Leaderboard';
import StudentPerformance from '../components/StudentPerformance';
import { openPdfInNewTab, downloadPdfFile } from '../lib/pdfHelper';
import { resolvePdfToViewUrl } from '../lib/pdfStorage';
import BunnyPlayer from '../components/BunnyPlayer';
import { useToast } from '../contexts/ToastContext';

type OuterTabType = 'courses' | 'parent_report' | 'support' | 'leaderboard';
type InnerCourseTabType = 'videos' | 'materials' | 'exams' | 'homework';

export default function StudentDashboard() {
  const { user, appUser, loading: authLoading } = useAuth();
  const { settings } = useSettings();
  const { showToast } = useToast();
  const location = useLocation();

  // Navigation State
  const [outerTab, setOuterTab] = useState<OuterTabType>('courses');
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [innerTab, setInnerTab] = useState<InnerCourseTabType>('videos');

  // Subscriptions & Data
  const [subscribedCourses, setSubscribedCourses] = useState<string[]>([]);
  const [checkingSub, setCheckingSub] = useState(true);
  const [coursesData, setCoursesData] = useState<any[]>([]);

  // Course Materials
  const [materials, setMaterials] = useState<Material[]>([]);
  const [materialsLoading, setMaterialsLoading] = useState(false);

  // Video & PDF Modal
  const [playingVideo, setPlayingVideo] = useState<Material | null>(null);
  const [videoWatchPct, setVideoWatchPct] = useState<number>(0);
  const [watchSeconds, setWatchSeconds] = useState<number>(0);
  const [resolvedPdfUrl, setResolvedPdfUrl] = useState<string>('');
  const [pdfResolving, setPdfResolving] = useState<boolean>(false);

  // Security barrier: prevent opening material if course is locked
  const handleOpenMaterial = (item: Material) => {
    if (selectedCourseId && !subscribedCourses.includes(selectedCourseId)) {
      showToast("عذراً، محتوى هذا الكورس مقفل! يرجى سداد الاشتراك أولاً من صفحة السداد.", "warning");
      return;
    }
    setPlayingVideo(item);
  };

  // Automatically resolve cloud / direct / Drive PDF url
  useEffect(() => {
    if (!playingVideo || playingVideo.type !== 'pdf' || !playingVideo.url) {
      setResolvedPdfUrl('');
      setPdfResolving(false);
      return;
    }

    let isMounted = true;
    setPdfResolving(true);
    resolvePdfToViewUrl(playingVideo.url)
      .then(url => {
        if (isMounted) {
          setResolvedPdfUrl(url);
          setPdfResolving(false);
        }
      })
      .catch(err => {
        console.error("Error resolving PDF:", err);
        if (isMounted) setPdfResolving(false);
      });

    return () => {
      isMounted = false;
    };
  }, [playingVideo]);

  // Track video watch progress in Firestore
  useEffect(() => {
    if (!playingVideo || playingVideo.type !== 'video' || !appUser) {
      setVideoWatchPct(0);
      setWatchSeconds(0);
      return;
    }

    const docId = `${appUser.uid}_${playingVideo.id}`;
    const docRef = doc(db, 'video_progress', docId);

    getDoc(docRef).then(snap => {
      if (snap.exists()) {
        const data = snap.data();
        setVideoWatchPct(data.percentage || 0);
        setWatchSeconds(data.watchedSeconds || 0);
      } else {
        setDoc(docRef, {
          id: docId,
          studentId: appUser.uid,
          studentName: appUser.name,
          studentCode: appUser.code || '',
          studentPhone: appUser.phone || '',
          parentPhone: appUser.parentPhone || '',
          grade: appUser.grade || '',
          centerGroup: appUser.centerGroup || '',
          isCenterStudent: Boolean(appUser.isCenterStudent || appUser.registrationMethod === 'center' || (appUser.centerGroup && appUser.centerGroup.trim().length > 0)),
          materialId: playingVideo.id,
          materialTitle: playingVideo.title,
          courseId: playingVideo.courseId || selectedCourseId || '',
          percentage: 0,
          watchedSeconds: 0,
          updatedAt: Date.now()
        }, { merge: true }).catch(() => {});
      }
    }).catch(err => console.warn("Error loading video progress:", err));

    // Listen to Bunny Stream Player iframe postMessage events
    const handleBunnyMessage = (event: MessageEvent) => {
      try {
        let data = event.data;
        if (typeof data === 'string' && (data.includes('timeupdate') || data.includes('currentTime') || data.includes('ended'))) {
          try { data = JSON.parse(data); } catch (_) {}
        }
        if (data && typeof data === 'object') {
          if (data.event === 'ended' || data.type === 'ended') {
            setVideoWatchPct(100);
            setDoc(docRef, { percentage: 100, updatedAt: Date.now() }, { merge: true }).catch(() => {});
            return;
          }
          const currentTime = Number(data.currentTime || data.time || data.seconds || 0);
          const duration = Number(data.duration || data.totalDuration || 0);
          if (duration > 0 && currentTime > 0) {
            const calcPct = Math.min(100, Math.round((currentTime / duration) * 100));
            setVideoWatchPct(prev => Math.max(prev, calcPct));
            setWatchSeconds(prev => Math.max(prev, Math.round(currentTime)));
            setDoc(docRef, {
              percentage: calcPct,
              watchedSeconds: Math.round(currentTime),
              updatedAt: Date.now()
            }, { merge: true }).catch(() => {});
          }
        }
      } catch (_) {}
    };

    window.addEventListener('message', handleBunnyMessage);

    // Increment watch time while modal is open (every 10 seconds)
    const interval = setInterval(() => {
      setWatchSeconds(prevSec => {
        const newSec = prevSec + 10;
        setVideoWatchPct(currentPct => {
          // Progress accumulates up to 95% automatically over watch time (benchmark: 20 min lecture)
          const estimatedPct = Math.min(95, Math.max(currentPct, Math.round((newSec / 1200) * 100)));
          setDoc(docRef, {
            percentage: estimatedPct,
            watchedSeconds: newSec,
            updatedAt: Date.now()
          }, { merge: true }).catch(() => {});
          return estimatedPct;
        });
        return newSec;
      });
    }, 10000);

    return () => {
      clearInterval(interval);
      window.removeEventListener('message', handleBunnyMessage);
    };
  }, [playingVideo, appUser, selectedCourseId]);

  const isCenterStudent = Boolean(
    appUser?.isCenterStudent ||
    appUser?.registrationMethod === 'center' ||
    (appUser?.centerGroup && appUser.centerGroup.trim().length > 0)
  );
  // Require at least 85% real watch duration before completion button appears
  const minRequiredWatchPct = 85;

  const handleMarkVideoCompleted = async () => {
    if (!playingVideo || !appUser) return;
    const docId = `${appUser.uid}_${playingVideo.id}`;
    setVideoWatchPct(100);
    try {
      await setDoc(doc(db, 'video_progress', docId), {
        id: docId,
        studentId: appUser.uid,
        studentName: appUser.name,
        studentCode: appUser.code || '',
        studentPhone: appUser.phone || '',
        parentPhone: appUser.parentPhone || '',
        grade: appUser.grade || '',
        centerGroup: appUser.centerGroup || '',
        isCenterStudent: isCenterStudent,
        materialId: playingVideo.id,
        materialTitle: playingVideo.title,
        courseId: playingVideo.courseId || selectedCourseId || '',
        percentage: 100,
        watchedSeconds: Math.max(watchSeconds, 1800),
        updatedAt: Date.now()
      }, { merge: true });

      // Bonus points for completing lecture
      updateDoc(doc(db, 'users', appUser.uid), {
        totalPoints: increment(30)
      }).catch(() => {});

      showToast("تم تسجيل إتمام مشاهدة المحاضرة بنسبة 100% بنجاح واحتسابها في تقدمك! ✅ (+30 نقطة)", "success");
    } catch (err) {
      console.error(err);
      showToast("حدث خطأ أثناء حفظ تقدم المشاهدة", "error");
    }
  };

  // Card details copy feedback
  const [copiedLink, setCopiedLink] = useState(false);

  // Browser Notification Status
  const [notificationPerm, setNotificationPerm] = useState<'default' | 'granted' | 'denied' | 'unsupported'>('default');
  const [permSuccess, setPermSuccess] = useState('');

  // Auto-promotion state
  const [promoting, setPromoting] = useState(false);
  const [promotionSuccess, setPromotionSuccess] = useState('');

  // Levels & Gamification modal
  const [showLevelsModal, setShowLevelsModal] = useState(false);

  // Check browser notification support
  useEffect(() => {
    if (!('Notification' in window)) {
      setNotificationPerm('unsupported');
    } else {
      setNotificationPerm(Notification.permission as any);
    }
  }, []);

  // Request browser notification permission
  const handleRequestNotification = async () => {
    if (!('Notification' in window)) {
      alert('المتصفح الحالي لا يدعم إشعارات النظام.');
      return;
    }
    try {
      const permission = await Notification.requestPermission();
      setNotificationPerm(permission as any);
      if (permission === 'granted') {
        setPermSuccess('تم تفعيل إشعارات المتصفح بنجاح! ستصلك إشعارات بالدرجات والامتحانات فور رصدها.');
        try {
          new Notification('🎓 إشعارات منصة التفوق مفعلة', {
            body: `مرحباً ${appUser?.name || 'بك'}! ستصلك نتائج الامتحانات والتقارير الأكاديمية فورياً.`,
            icon: settings.platformLogoBase64 || '/favicon.ico'
          });
        } catch (e) {
          console.warn("Notification error:", e);
        }
      } else if (permission === 'denied') {
        alert('تم حظر الإشعارات في متصفحك. يمكنك تفعيلها يدويًا من إعدادات الموقع.');
      }
    } catch (e) {
      console.error("Error requesting permission:", e);
    }
  };

  // Helper to convert YouTube / Drive URLs into embeddable iframe source
  const getEmbedUrl = (url: string) => {
    if (!url) return '';
    if (url.includes('youtube.com/watch')) {
      try {
        const videoId = new URL(url).searchParams.get('v');
        return `https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0`;
      } catch (e) {
        return url;
      }
    }
    if (url.includes('youtu.be/')) {
      const parts = url.split('youtu.be/');
      const videoId = parts[1]?.split('?')[0];
      return `https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0`;
    }
    if (url.includes('youtube.com/shorts/')) {
      const parts = url.split('youtube.com/shorts/');
      const videoId = parts[1]?.split('?')[0];
      return `https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0`;
    }
    if (url.includes('drive.google.com/file/d/')) {
      const match = url.match(/\/file\/d\/([^\/\?]+)/);
      if (match && match[1]) {
        return `https://drive.google.com/file/d/${match[1]}/preview`;
      }
      return url.replace('/view', '/preview').replace('/edit', '/preview');
    }
    return url;
  };

  // Handle URL query tabs if specified
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const tabParam = params.get('tab');
    if (tabParam === 'parent_report' || tabParam === 'support' || tabParam === 'leaderboard' || tabParam === 'courses') {
      setOuterTab(tabParam as OuterTabType);
      setSelectedCourseId(null);
    }
    const courseParam = params.get('course');
    if (courseParam) {
      setSelectedCourseId(courseParam);
    }
  }, [location.search]);

  // Fetch course title for guests trying to enter a specific course
  const [guestCourseTitle, setGuestCourseTitle] = useState('');
  useEffect(() => {
    if (!user && !appUser && selectedCourseId) {
      getDoc(doc(db, 'courses', selectedCourseId)).then(snap => {
        if (snap.exists()) {
          setGuestCourseTitle(snap.data()?.name || '');
        }
      }).catch(() => {});
    }
  }, [user, appUser, selectedCourseId]);

  // Check Subscription Status & allowed courses
  useEffect(() => {
    if (!user && !appUser) {
      setCheckingSub(false);
      return;
    }

    const qCourses = query(collection(db, 'courses'));
    const unsubscribeAllCourses = onSnapshot(qCourses, (snapshot) => {
      const allCourseDocs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const allCourseIds = allCourseDocs.map(c => c.id);

      // Admin or assistant gets all courses
      if (appUser?.role === 'admin' || appUser?.role === 'assistant') {
        setSubscribedCourses(allCourseIds);
        setCheckingSub(false);
        return;
      }

      // Normal students check approved payments + allowedCourseIds
      const targetUid = user?.uid || appUser?.uid;
      const qPayments = query(
        collection(db, 'payments'), 
        where('userId', '==', targetUid)
      );

      const unsubscribePayments = onSnapshot(qPayments, (paySnapshot) => {
        const coursesFromPayments = paySnapshot.docs
          .map(doc => doc.data())
          .filter(data => data.status === 'approved')
          .map(data => data.courseId)
          .filter(Boolean);

        const studentGrade = appUser?.grade;
        // Automatically unlock any free courses matching student's grade
        const freeCourseIds = allCourseDocs
          .filter((c: any) => (Number(c.price) === 0 || c.isFree === true) && (!studentGrade || !c.grade || c.grade === studentGrade))
          .map(c => c.id);

        const allowed = appUser?.allowedCourseIds || [];
        const combined = Array.from(new Set([...coursesFromPayments, ...allowed, ...freeCourseIds]));

        setSubscribedCourses(combined);
        setCheckingSub(false);
      }, (error) => {
        console.warn("Notice checking subscription:", error?.message || error);
        const studentGrade = appUser?.grade;
        const freeCourseIds = allCourseDocs
          .filter((c: any) => (Number(c.price) === 0 || c.isFree === true) && (!studentGrade || !c.grade || c.grade === studentGrade))
          .map(c => c.id);
        const allowed = appUser?.allowedCourseIds || [];
        setSubscribedCourses(Array.from(new Set([...allowed, ...freeCourseIds])));
        setCheckingSub(false);
      });

      const qSubs = query(collection(db, 'subscriptions'), where('userId', '==', targetUid));
      const unsubscribeSubs = onSnapshot(qSubs, (subSnapshot) => {
        const directSubs = subSnapshot.docs.map(d => d.data().courseId).filter(Boolean);
        if (directSubs.length > 0) {
          setSubscribedCourses(prev => Array.from(new Set([...prev, ...directSubs])));
        }
      }, () => {});

      return () => {
        unsubscribePayments();
        unsubscribeSubs();
      };
    }, (error) => {
      console.warn("All courses listener notice:", error?.message || error);
      setCheckingSub(false);
    });

    return () => unsubscribeAllCourses();
  }, [user, appUser]);

  // Load course details for student strictly by their academic grade
  useEffect(() => {
    const q = query(collection(db, 'courses'));
    const unsub = onSnapshot(q, (snapshot) => {
      const allCourses = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as any[];
      const studentGrade = appUser?.grade;
      const isAdminOrStaff = appUser?.role === 'admin' || appUser?.role === 'assistant';

      if (isAdminOrStaff) {
        setCoursesData(allCourses);
        return;
      }

      // Filter courses strictly matching the student's academic year
      const relevant = allCourses.filter(c => {
        if (!studentGrade) return true;
        if (!c.grade) return true;
        return c.grade === studentGrade;
      });

      setCoursesData(relevant);
    }, (error) => {
      console.warn("Courses details listener notice:", error?.message || error);
    });
    return () => unsub();
  }, [subscribedCourses, appUser?.grade, appUser?.role]);

  // Fetch materials for selected course
  useEffect(() => {
    if (!selectedCourseId) {
      setMaterials([]);
      return;
    }

    // Security check
    if (!subscribedCourses.includes(selectedCourseId)) {
      setMaterials([]);
      return;
    }

    if (innerTab === 'exams' || innerTab === 'homework') {
      return;
    }

    setMaterialsLoading(true);
    const q1 = query(collection(db, 'materials'), where('courseId', '==', selectedCourseId));
    const q2 = query(collection(db, 'materials'), where('courseIds', 'array-contains', selectedCourseId));

    const fetchCourseMaterials = async () => {
      try {
        const [snap1, snap2] = await Promise.all([getDocs(q1), getDocs(q2)]);
        const allMap = new Map();
        snap1.docs.forEach(d => allMap.set(d.id, { id: d.id, ...d.data() }));
        snap2.docs.forEach(d => allMap.set(d.id, { id: d.id, ...d.data() }));

        const data = Array.from(allMap.values()) as Material[];
        data.sort((a, b) => {
          if (a.createdAt && b.createdAt) return b.createdAt - a.createdAt;
          return (a.order || 0) - (b.order || 0);
        });

        const filterType = innerTab === 'videos' ? 'video' : 'pdf';
        const filtered = data.filter(m => {
          if (m.type !== filterType) return false;
          // Audience filtering:
          if (m.targetAudience === 'center' && !appUser?.isCenterStudent) return false;
          if (m.targetAudience === 'online' && appUser?.isCenterStudent && !appUser?.isOnlineAccessGranted) return false;
          return true;
        });
        setMaterials(filtered);
      } catch (err) {
        console.error("Error fetching course materials:", err);
      } finally {
        setMaterialsLoading(false);
      }
    };

    fetchCourseMaterials();
  }, [selectedCourseId, innerTab, subscribedCourses]);

  // Seamless automatic grade switcher (instant, no popups or questioning)
  const handleSwitchGrade = async (newGrade: string) => {
    if (!appUser || !newGrade || newGrade === appUser.grade) return;
    setPromoting(true);
    try {
      await updateDoc(doc(db, 'users', appUser.uid), {
        grade: newGrade
      });
      const localCenter = localStorage.getItem('center_student_user');
      if (localCenter) {
        try {
          const parsed = JSON.parse(localCenter);
          parsed.grade = newGrade;
          localStorage.setItem('center_student_user', JSON.stringify(parsed));
        } catch (_) {}
      }
      setPromotionSuccess(`تم تحويل صفك الدراسي إلى "${newGrade}" بنجاح!`);
      setTimeout(() => setPromotionSuccess(''), 3000);
    } catch (err) {
      console.error("Error updating grade:", err);
    } finally {
      setPromoting(false);
    }
  };

  // Copy Parent Report Link
  const copyParentReportLink = () => {
    const link = `${window.location.origin}/parent-report/${appUser?.code || appUser?.uid}`;
    navigator.clipboard.writeText(link);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  if (authLoading || checkingSub) {
    return (
      <div className="flex-grow flex flex-col items-center justify-center min-h-[60vh]">
        <Loader2 className="w-12 h-12 text-indigo-600 animate-spin mb-4" />
        <p className="text-slate-600 font-bold text-sm">جاري تحميل منصتك التعليمية...</p>
      </div>
    );
  }

  if (!user && !appUser) {
    return (
      <div className="flex-grow min-h-[75vh] flex items-center justify-center p-4 bg-slate-50 dark:bg-slate-950">
        <div className="bg-white dark:bg-slate-900 border-2 border-indigo-200 dark:border-indigo-900/60 rounded-3xl p-8 sm:p-10 max-w-lg w-full text-center shadow-2xl space-y-6 animate-in fade-in zoom-in-95 duration-200">
          <div className="w-20 h-20 rounded-3xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto shadow-inner">
            <Lock className="w-10 h-10" />
          </div>

          <div className="space-y-3">
            <span className="inline-block bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 text-xs font-black px-4 py-1.5 rounded-full border border-amber-300 dark:border-amber-800 shadow-xs">
              🔒 محتوى تعليمي محمي
            </span>
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white leading-tight">
              يجب تسجيل الدخول أولاً للدخول إلى الكورس
            </h2>
            {guestCourseTitle && (
              <div className="inline-block bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-800 px-4 py-1.5 rounded-xl text-indigo-700 dark:text-indigo-300 font-bold text-sm">
                📚 {guestCourseTitle}
              </div>
            )}
            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed font-medium">
              عزيزي الطالب، لمتابعة محاضرات هذا الكورس وأداء الامتحانات وتحميل المذكرات وحفظ تقدمك الدراسي، يتوجب عليك تسجيل الدخول بحسابك أولاً أو إنشاء حساب طالب جديد.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
            <Link
              to={`/login?redirect=${encodeURIComponent(location.pathname + location.search)}`}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-black px-6 py-3.5 rounded-2xl text-sm transition-all shadow-md hover:shadow-indigo-500/25 flex items-center justify-center gap-2"
            >
              <span>تسجيل الدخول بحسابك 🔑</span>
            </Link>

            <Link
              to={`/login?signup=true&redirect=${encodeURIComponent(location.pathname + location.search)}`}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-black px-6 py-3.5 rounded-2xl text-sm transition-all shadow-md hover:shadow-emerald-500/25 flex items-center justify-center gap-2"
            >
              <span>إنشاء حساب طالب جديد 📝</span>
            </Link>
          </div>

          <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
            <Link
              to="/"
              className="text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 font-bold inline-flex items-center gap-1"
            >
              ← العودة إلى الصفحة الرئيسية للمنصة
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const currentCourse = coursesData.find(c => c.id === selectedCourseId);
  const userLevel = getLevel(appUser?.totalPoints || 0);
  const LevelIcon = userLevel.icon;
  const parentReportUrl = `${window.location.origin}/parent-report/${appUser?.code || appUser?.uid}`;

  const isAdminOrAssistant = appUser?.role === 'admin' || appUser?.role === 'assistant';
  const currentPoints = appUser?.totalPoints || 0;
  const nextLevel = levels.find(l => l.threshold > currentPoints);
  const currentThreshold = userLevel.threshold;
  const nextTarget = nextLevel ? nextLevel.threshold : userLevel.nextThreshold;
  const pointsInLevel = Math.max(0, currentPoints - currentThreshold);
  const span = Math.max(1, nextTarget - currentThreshold);
  const progressPercent = Math.min(100, Math.max(8, Math.round((pointsInLevel / span) * 100)));
  const remainingPoints = nextLevel ? Math.max(0, nextLevel.threshold - currentPoints) : 0;

  return (
    <div className="flex-grow py-8 px-4 sm:px-6 lg:px-8 bg-slate-50 dark:bg-[#070b14] min-h-[calc(100vh-80px)] transition-colors">
      <div className="max-w-7xl mx-auto space-y-8">

        {/* ------------------------------------------------------------- */}
        {/* VIEW 1: OUTSIDE DASHBOARD (!selectedCourseId)                 */}
        {/* Strictly restricted: Only Courses, Parent Report, Support,   */}
        {/* and Leaderboard. No direct lectures/exams outside!           */}
        {/* ------------------------------------------------------------- */}
        {!selectedCourseId ? (
          <>
            {/* Header Greeting */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-3">
                  <span>{isAdminOrAssistant ? 'معاينة المنصة التعليمية' : 'منصتي التعليمية'}</span>
                  {isAdminOrAssistant ? (
                    <span className="text-xs bg-amber-400 text-slate-950 font-black px-3.5 py-1 rounded-full shadow-sm flex items-center gap-1">
                      <span>👑</span>
                      <span>لوحة المدير (Admin)</span>
                    </span>
                  ) : (
                    <div className="flex items-center gap-1.5 bg-indigo-50 dark:bg-indigo-950/70 border border-indigo-200 dark:border-indigo-800 px-3 py-1 rounded-full text-xs font-bold text-indigo-900 dark:text-indigo-200 shadow-xs">
                      <GraduationCap className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 flex-shrink-0" />
                      <select
                        value={appUser?.grade || ''}
                        onChange={(e) => handleSwitchGrade(e.target.value)}
                        disabled={promoting}
                        className="bg-transparent border-0 text-indigo-900 dark:text-indigo-200 font-bold text-xs outline-none cursor-pointer"
                        title="تغيير سنتك الدراسية لعرض كورساتها تلقائياً"
                      >
                        {(settings?.grades && settings.grades.length > 0 ? settings.grades : ['الصف الأول الثانوي', 'الصف الثاني الثانوي', 'الصف الثالث الثانوي']).map((g: string) => (
                          <option key={g} value={g} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">{g}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </h1>
                <p className="text-slate-500 dark:text-slate-400 font-medium text-sm mt-1">
                  {isAdminOrAssistant
                    ? `مرحباً بك يا أستاذ ${appUser?.name}. هذه شاشة معاينة تجربة الطالب.`
                    : `أهلاً بك يا بطل (${appUser?.name}). تابع مستواك ودرجاتك وكورساتك من هنا.`}
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-3">
                {isAdminOrAssistant && (
                  <Link
                    to="/admin"
                    className="bg-amber-400 hover:bg-amber-500 text-slate-950 px-5 py-2.5 rounded-xl font-black text-xs flex items-center gap-2 shadow-sm transition-all"
                  >
                    <span>الانتقال للوحة تحكم الأدمن</span>
                    <ChevronLeft className="w-4 h-4" />
                  </Link>
                )}

                {/* Quick WhatsApp Support Link */}
                {settings.whatsappNumber && (
                  <a
                    href={`https://wa.me/${settings.whatsappNumber}`}
                    target="_blank"
                    rel="noreferrer"
                    className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 shadow-sm transition-all"
                  >
                    <MessageCircle className="w-4 h-4 text-emerald-600" />
                    <span>مساعدة سريعة</span>
                  </a>
                )}
              </div>
            </div>

            {promotionSuccess && (
              <div className="bg-emerald-100 border border-emerald-300 text-emerald-900 px-6 py-4 rounded-2xl font-bold text-sm flex items-center gap-3 animate-fade-in">
                <CheckCircle2 className="w-5 h-5 text-emerald-700 flex-shrink-0" />
                <span>{promotionSuccess}</span>
              </div>
            )}

            {/* -------------------------------------------------------- */}
            {/* ROLE-AWARE IDENTITY CARD                                  */}
            {/* If Admin: Prestigious Admin Card with no student tags     */}
            {/* If Student: Smart Student ID Card + Gamification Progress */}
            {/* -------------------------------------------------------- */}
            {isAdminOrAssistant ? (
              <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden border border-amber-500/30">
                <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none"></div>

                <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
                  <div className="flex flex-col sm:flex-row items-center gap-6 text-center sm:text-right w-full md:w-auto">
                    <div className="w-20 h-20 rounded-3xl flex items-center justify-center shadow-2xl border-2 border-amber-400/40 bg-amber-500/20 text-amber-300 flex-shrink-0">
                      <ShieldCheck className="w-10 h-10" />
                    </div>

                    <div>
                      <div className="flex items-center gap-2 justify-center sm:justify-start mb-2 flex-wrap">
                        <span className="bg-amber-400 text-slate-950 text-xs font-black px-3.5 py-1 rounded-full shadow flex items-center gap-1.5">
                          <span>👑</span>
                          <span>{appUser?.role === 'admin' ? 'مدير المنصة العام (Admin)' : 'مساعد معتمد (Assistant)'}</span>
                        </span>
                        <span className="bg-white/10 text-amber-200 text-xs font-bold px-3 py-1 rounded-full backdrop-blur-sm border border-amber-400/20">
                          صلاحيات تحكم كاملة
                        </span>
                      </div>

                      <h2 className="text-2xl sm:text-3xl font-black tracking-tight">{appUser?.name}</h2>
                      <div className="flex items-center gap-4 text-xs text-indigo-200 mt-2 justify-center sm:justify-start flex-wrap">
                        <span>البريد الإلكتروني: <b className="font-mono text-white">{appUser?.email}</b></span>
                        {appUser?.phone && (
                          <>
                            <span>•</span>
                            <span>الهاتف: <b className="font-mono text-white" dir="ltr">{appUser.phone}</b></span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
                    <Link
                      to="/admin"
                      className="w-full sm:w-auto bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-500 hover:to-amber-600 text-slate-950 font-black px-6 py-3.5 rounded-2xl shadow-xl shadow-amber-500/20 transition-all flex items-center justify-center gap-2 text-sm"
                    >
                      <span>الانتقال للوحة التحكم الرئيسية</span>
                      <ChevronLeft className="w-4 h-4" />
                    </Link>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-gradient-to-br from-indigo-900 via-indigo-800 to-slate-900 text-white rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden border border-indigo-700/50">
                <div className="absolute top-0 right-0 w-96 h-96 bg-white/5 rounded-full blur-3xl pointer-events-none"></div>

                <div className="relative z-10 flex flex-col lg:flex-row items-center justify-between gap-8">
                  {/* Info Column */}
                  <div className="flex flex-col sm:flex-row items-center gap-6 text-center sm:text-right w-full lg:w-auto">
                    <div className={`w-20 h-20 rounded-3xl flex items-center justify-center shadow-2xl border-2 border-white/20 flex-shrink-0 ${userLevel.bg} ${userLevel.color}`}>
                      <LevelIcon className="w-10 h-10" />
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center gap-2 justify-center sm:justify-start flex-wrap">
                        <span className="bg-amber-400 text-slate-950 text-xs font-black px-3 py-1 rounded-full shadow">
                          {appUser?.isCenterStudent ? 'طالب سنتر 🏢' : 'طالب أونلاين 💻'}
                        </span>
                        <span className="bg-white/20 text-white text-xs font-bold px-3 py-1 rounded-full backdrop-blur-sm">
                          {appUser?.grade || 'غير محدد'}
                        </span>
                        <button
                          onClick={() => setShowLevelsModal(true)}
                          className="bg-indigo-500/50 hover:bg-indigo-500 text-indigo-100 text-xs font-bold px-3 py-1 rounded-full transition-all flex items-center gap-1"
                        >
                          <span>{userLevel.name}</span>
                          <span className="text-amber-300">({currentPoints} نقطة)</span>
                          <Sparkles className="w-3 h-3 text-amber-300" />
                        </button>
                      </div>

                      <h2 className="text-2xl sm:text-3xl font-black tracking-tight">{appUser?.name}</h2>
                      
                      <div className="flex items-center gap-4 text-xs text-indigo-200 justify-center sm:justify-start flex-wrap">
                        <span>كود الطالب: <b className="font-mono text-amber-300 text-sm">{appUser?.code || appUser?.uid.substring(0, 6)}</b></span>
                        <span>•</span>
                        <span>هاتف الطالب: <b className="font-mono text-white" dir="ltr">{appUser?.phone || '-'}</b></span>
                        <span>•</span>
                        <span>هاتف ولي الأمر: <b className="font-mono text-white" dir="ltr">{appUser?.parentPhone || '-'}</b></span>
                      </div>

                      {/* Gamification Level Progress Bar */}
                      <div className="bg-black/30 backdrop-blur-md rounded-2xl p-3 border border-white/10 max-w-lg mt-2 text-right">
                        <div className="flex items-center justify-between text-xs font-bold mb-1.5">
                          <span className="text-amber-300 flex items-center gap-1">
                            <Star className="w-3.5 h-3.5 fill-amber-300" />
                            <span>المستوى: {userLevel.name}</span>
                          </span>
                          <span className="text-indigo-200">
                            {nextLevel ? `المتبقي للترقية: ${remainingPoints} نقطة` : 'أعلى مستوى تفوق 👑'}
                          </span>
                        </div>
                        
                        {/* Track */}
                        <div className="w-full bg-white/20 h-2.5 rounded-full overflow-hidden p-0.5">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${progressPercent}%` }}
                            transition={{ duration: 1, ease: 'easeOut' }}
                            className="bg-gradient-to-r from-amber-400 via-amber-300 to-yellow-200 h-full rounded-full shadow"
                          />
                        </div>

                        <div className="flex items-center justify-between text-[11px] text-slate-300 mt-1">
                          <span>{currentPoints} نقطة</span>
                          <button
                            onClick={() => setShowLevelsModal(true)}
                            className="text-amber-300 hover:text-white underline font-bold transition-colors"
                          >
                            عرض درجات ورتب الطلاب 🏅
                          </button>
                          <span>{nextTarget} نقطة ({nextLevel ? nextLevel.name : 'القمة'})</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* QR Code Column for Parent Scanning */}
                  <div className="qr-code-clean-card bg-white p-4 rounded-3xl shadow-xl flex flex-col items-center text-center flex-shrink-0 text-slate-900 max-w-[210px] w-full">
                    <div className="p-2 bg-slate-50 rounded-2xl border border-slate-100 mb-2">
                      <QRCodeSVG 
                        value={parentReportUrl}
                        size={130}
                        level="M"
                        includeMargin={false}
                      />
                    </div>
                    <span className="text-[11px] font-black text-indigo-900 leading-tight">
                      مسح الرمز لولي الأمر 📱
                    </span>
                    <span className="text-[10px] text-slate-500 mt-0.5">
                      متابعة الدرجات والنتائج فورياً
                    </span>

                    <button
                      onClick={copyParentReportLink}
                      className="mt-2.5 w-full bg-slate-100 hover:bg-slate-200 text-slate-700 py-1.5 px-2 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1 transition-colors cursor-pointer"
                    >
                      {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedLink ? 'تم نسخ الرابط' : 'نسخ رابط التقرير'}</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* -------------------------------------------------------- */}
            {/* STRICT OUTER NAVIGATION TABS                             */}
            {/* Restricted strictly to: Courses, Parent Report, Support, */}
            {/* and Leaderboard. No lectures/exams/homework outside!     */}
            {/* -------------------------------------------------------- */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-2 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-wrap gap-2">
              <button
                onClick={() => setOuterTab('courses')}
                className={`flex-1 min-w-[140px] py-3 px-4 rounded-xl font-black text-sm flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  outerTab === 'courses'
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200 dark:shadow-none'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-indigo-600 dark:hover:text-indigo-400'
                }`}
              >
                <BookOpen className="w-4 h-4" />
                <span>كورساتي المشترك بها ({coursesData.length})</span>
              </button>

              <button
                onClick={() => setOuterTab('parent_report')}
                className={`flex-1 min-w-[140px] py-3 px-4 rounded-xl font-black text-sm flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  outerTab === 'parent_report'
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200 dark:shadow-none'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-indigo-600 dark:hover:text-indigo-400'
                }`}
              >
                <Award className="w-4 h-4" />
                <span>تقارير ومتابعة ولي الأمر 📊</span>
              </button>

              <button
                onClick={() => setOuterTab('support')}
                className={`flex-1 min-w-[140px] py-3 px-4 rounded-xl font-black text-sm flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  outerTab === 'support'
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200 dark:shadow-none'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-indigo-600 dark:hover:text-indigo-400'
                }`}
              >
                <MessageCircle className="w-4 h-4" />
                <span>الدعم الفني والعلمي 💬</span>
              </button>

              <button
                onClick={() => setOuterTab('leaderboard')}
                className={`flex-1 min-w-[140px] py-3 px-4 rounded-xl font-black text-sm flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  outerTab === 'leaderboard'
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200 dark:shadow-none'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-indigo-600 dark:hover:text-indigo-400'
                }`}
              >
                <Star className="w-4 h-4" />
                <span>لوحة الشرف والتصنيف 🏆</span>
              </button>
            </div>

            {/* TAB CONTENT 1: COURSES */}
            {outerTab === 'courses' && (
              <div className="space-y-6">
                {coursesData.length === 0 ? (
                  <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 sm:p-12 text-center max-w-2xl mx-auto border border-slate-200 dark:border-slate-800 shadow-sm transition-colors">
                    <div className="w-20 h-20 bg-indigo-50 dark:bg-indigo-950/70 text-indigo-600 dark:text-indigo-400 rounded-3xl flex items-center justify-center mx-auto mb-4">
                      <BookOpen className="w-10 h-10" />
                    </div>
                    <h3 className="text-2xl font-black text-slate-900 dark:text-white mb-2">لم يتم تفعيل أي كورسات لحسابك بعد</h3>
                    <p className="text-slate-600 dark:text-slate-300 text-sm mb-6 leading-relaxed">
                      {appUser?.isCenterStudent 
                        ? 'حسابك مسجل كطالب سنتر وفي انتظار تفعيل الكورسات من قبل السكرتارية. تواصل معهم للمراجعة.'
                        : 'يمكنك تصفح الكورسات المتاحة والاشتراك فيها لبدء مذاكرة المحاضرات والامتحانات.'}
                    </p>

                    <div className="flex flex-wrap gap-4 justify-center">
                      <Link
                        to="/payment"
                        className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-3 rounded-xl font-bold shadow-lg shadow-indigo-200 dark:shadow-none transition-all text-sm"
                      >
                        الاشتراك وتفعيل الكورسات
                      </Link>

                      {settings.whatsappNumber && (
                        <a
                          href={`https://wa.me/${settings.whatsappNumber}?text=${encodeURIComponent(`السلام عليكم، أنا الطالب ${appUser?.name}، كود ${appUser?.code}، أود تفعيل كورساتي.`)}`}
                          target="_blank"
                          rel="noreferrer"
                          className="bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 px-6 py-3 rounded-xl font-bold transition-all text-sm flex items-center gap-2"
                        >
                          <MessageCircle className="w-4 h-4 text-emerald-600" />
                          <span>تواصل مع السكرتارية</span>
                        </a>
                      )}
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="mb-4 flex items-center justify-between">
                      <h3 className="text-xl font-black text-slate-900 dark:text-white">الكورسات المتاحة لدراستك:</h3>
                      <span className="text-xs text-slate-500 dark:text-slate-400 font-bold">اضغط على الكورس للدخول للمحاضرات والامتحانات</span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-7">
                      {coursesData.map(course => (
                        <motion.div
                          key={course.id}
                          initial={{ opacity: 0, y: 15 }}
                          animate={{ opacity: 1, y: 0 }}
                          onClick={() => {
                            setSelectedCourseId(course.id);
                            setInnerTab('videos');
                          }}
                          className="bg-white dark:bg-slate-900 rounded-3xl shadow-md hover:shadow-2xl border border-slate-200/90 dark:border-slate-800 overflow-hidden cursor-pointer hover:-translate-y-1.5 transition-all duration-300 group flex flex-col"
                        >
                          {/* Widescreen Rectangular Course Banner */}
                          <div className="w-full aspect-[16/9] bg-slate-900 relative overflow-hidden flex items-center justify-center">
                            {course.coverImageBase64 ? (
                              <>
                                <img
                                  src={course.coverImageBase64}
                                  alt=""
                                  aria-hidden="true"
                                  className="absolute inset-0 w-full h-full object-cover blur-sm scale-110 opacity-35 pointer-events-none"
                                />
                                <img 
                                  src={course.coverImageBase64} 
                                  alt={course.name} 
                                  className="relative z-10 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" 
                                />
                              </>
                            ) : (
                              <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-indigo-950 via-slate-900 to-indigo-900 text-white p-6">
                                <BookOpen className="w-16 h-16 text-indigo-300/60 mb-2" />
                                <span className="font-bold text-sm text-indigo-200/80">كورس تعليمي معتمد</span>
                              </div>
                            )}
                            <div className="absolute inset-0 z-10 bg-gradient-to-t from-black/85 via-black/30 to-transparent"></div>
                            
                            {/* Floating Badges */}
                            <div className="absolute top-4 right-4 z-20 flex items-center gap-1.5 flex-wrap">
                              <span className="bg-indigo-600/95 backdrop-blur-sm text-white text-xs font-black px-3.5 py-1.5 rounded-xl shadow-md inline-block">
                                {course.grade}
                              </span>
                              {subscribedCourses.includes(course.id) ? (
                                <span className="bg-emerald-600/95 backdrop-blur-sm text-white text-xs font-black px-3 py-1 rounded-xl shadow-md flex items-center gap-1">
                                  <Check className="w-3 h-3" />
                                  <span>مفعل وخالص الدفع ✅</span>
                                </span>
                              ) : (Number(course.price) === 0 || (course as any).isFree) ? (
                                <span className="bg-teal-600/95 backdrop-blur-sm text-white text-xs font-black px-3 py-1 rounded-xl shadow-md flex items-center gap-1">
                                  <span>🎁 مجاني بالكامل</span>
                                </span>
                              ) : (
                                <span className="bg-rose-600/95 backdrop-blur-sm text-white text-xs font-black px-3 py-1 rounded-xl shadow-md flex items-center gap-1">
                                  <Lock className="w-3 h-3" />
                                  <span>غير مسدد ({course.price} ج.م)</span>
                                </span>
                              )}
                            </div>

                            <div className="absolute bottom-4 right-4 left-4 z-20">
                              <h3 className="text-xl sm:text-2xl font-black text-white line-clamp-1 drop-shadow-md">{course.name}</h3>
                            </div>
                          </div>

                          <div className="p-6 flex-grow flex flex-col justify-between">
                            <p className="text-slate-600 dark:text-slate-300 text-sm line-clamp-2 mb-4 font-medium leading-relaxed">
                              {course.description || 'كورس تعليمي متكامل يشمل محاضرات الشرح، مذكرات المراجعة، والامتحانات الدورية.'}
                            </p>

                            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-sm font-black">
                              {subscribedCourses.includes(course.id) || Number(course.price) === 0 || (course as any).isFree ? (
                                <>
                                  <span className="text-indigo-600 dark:text-indigo-400">دخول الكورس ومتابعة المحاضرات</span>
                                  <div className="w-9 h-9 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-300 group-hover:bg-indigo-600 group-hover:text-white flex items-center justify-center transition-all shadow-sm">
                                    <ChevronLeft className="w-5 h-5" />
                                  </div>
                                </>
                              ) : (
                                <>
                                  <span className="text-rose-600 dark:text-rose-400 flex items-center gap-1">
                                    <Lock className="w-4 h-4" />
                                    <span>المحتوى مقفل - اضغط للاشتراك وتفعيل الروابط</span>
                                  </span>
                                  <div className="w-9 h-9 rounded-2xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-300 group-hover:bg-rose-600 group-hover:text-white flex items-center justify-center transition-all shadow-sm">
                                    <ChevronLeft className="w-5 h-5" />
                                  </div>
                                </>
                              )}
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB CONTENT 2: PARENT REPORT & BROWSER NOTIFICATIONS */}
            {outerTab === 'parent_report' && (
              <div className="space-y-6">
                {/* Browser Notification Permission Banner */}
                <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 border-2 border-indigo-200 dark:border-indigo-900/60 shadow-xl flex flex-col sm:flex-row items-center justify-between gap-6 transition-colors">
                  <div className="flex items-center gap-5 text-center sm:text-right">
                    <div className="w-16 h-16 bg-indigo-50 dark:bg-indigo-950/70 text-indigo-600 dark:text-indigo-400 rounded-3xl flex items-center justify-center flex-shrink-0">
                      <Bell className="w-8 h-8" />
                    </div>
                    <div>
                      <h3 className="text-xl font-black text-slate-900 dark:text-white">إذن إشعارات المتصفح لولي الأمر 🔔</h3>
                      <p className="text-slate-600 dark:text-slate-300 text-sm mt-1 leading-relaxed">
                        اضغط لتفعيل استلام نتائج امتحانات الطالب ودرجاته وإشعارات الحضور فورياً على متصفحك أو هاتفك.
                      </p>
                    </div>
                  </div>

                  <div className="flex-shrink-0 w-full sm:w-auto">
                    {notificationPerm === 'granted' ? (
                      <div className="bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 font-bold text-sm px-6 py-3 rounded-2xl flex items-center justify-center gap-2">
                        <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                        <span>الإشعارات مفعلة بنجاح ✅</span>
                      </div>
                    ) : (
                      <button
                        onClick={handleRequestNotification}
                        className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm px-6 py-3.5 rounded-2xl shadow-lg shadow-indigo-200 dark:shadow-none transition-all active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <Bell className="w-4 h-4" />
                        <span>تفعيل إرسال الدرجات للمتصفح</span>
                      </button>
                    )}
                  </div>
                </div>

                {permSuccess && (
                  <div className="bg-emerald-100 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-300 px-6 py-3.5 rounded-2xl text-sm font-bold flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-emerald-700 dark:text-emerald-400 flex-shrink-0" />
                    <span>{permSuccess}</span>
                  </div>
                )}

                {/* Detailed Student Performance Component */}
                <StudentPerformance studentId={appUser?.uid} />

                {/* Direct WhatsApp Contact for Parents */}
                {settings.whatsappNumber && (
                  <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/60 rounded-3xl p-6 sm:p-8 flex flex-col sm:flex-row items-center justify-between gap-6 transition-colors">
                    <div className="flex items-center gap-4 text-center sm:text-right">
                      <div className="w-14 h-14 bg-emerald-600 text-white rounded-2xl flex items-center justify-center flex-shrink-0 shadow-md">
                        <MessageCircle className="w-7 h-7" />
                      </div>
                      <div>
                        <h4 className="text-xl font-black text-slate-900 dark:text-white">تواصل مباشر لولي الأمر مع المعلم</h4>
                        <p className="text-slate-600 dark:text-slate-300 text-sm mt-0.5 font-medium">
                          يسعدنا الإجابة على أي تساؤلات ومناقشة تقرير درجات الطالب عبر محادثة مباشرة.
                        </p>
                      </div>
                    </div>

                    <a
                      href={`https://wa.me/${settings.whatsappNumber}?text=${encodeURIComponent(`السلام عليكم، أنا ولي أمر الطالب: ${appUser?.name}، كود الطالب: ${appUser?.code}، أود الاستفسار عن مستواه الدراسي.`)}`}
                      target="_blank"
                      rel="noreferrer"
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-8 py-3.5 rounded-2xl shadow-md transition-all text-sm flex items-center gap-2 flex-shrink-0"
                    >
                      <MessageCircle className="w-4 h-4" />
                      <span>محادثة واتساب لولي الأمر</span>
                    </a>
                  </div>
                )}
              </div>
            )}

            {/* TAB CONTENT 3: SUPPORT */}
            {outerTab === 'support' && (
              <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden min-h-[500px] transition-colors">
                <StudentSupport />
              </div>
            )}

            {/* TAB CONTENT 4: LEADERBOARD */}
            {outerTab === 'leaderboard' && (
              <Leaderboard />
            )}
          </>
        ) : (
          /* ------------------------------------------------------------- */
          /* VIEW 2: INSIDE A SELECTED COURSE (selectedCourseId !== null)  */
          /* Inside the course: Lectures, Materials, Exams, and Homework!  */
          /* ------------------------------------------------------------- */
          <div className="space-y-6">
            {/* Breadcrumb & Navigation Back */}
            <div className="flex items-center justify-between gap-4">
              <button
                onClick={() => setSelectedCourseId(null)}
                className="inline-flex items-center gap-2 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 px-5 py-2.5 rounded-2xl font-bold text-sm border border-slate-200 dark:border-slate-800 shadow-sm transition-colors cursor-pointer"
              >
                <ChevronRight className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                <span>العودة إلى منصتي الرئيسية</span>
              </button>

              <span className="text-xs font-bold text-slate-400 dark:text-slate-500">
                أنت الآن داخل الكورس
              </span>
            </div>

            {/* Course Header Banner */}
            <div className="bg-indigo-600 rounded-3xl p-6 sm:p-8 text-white shadow-xl shadow-indigo-200 dark:shadow-none relative overflow-hidden">
              <div className="absolute top-0 right-0 w-80 h-80 bg-white/5 rounded-full blur-3xl pointer-events-none"></div>

              <div className="relative z-10 flex flex-col sm:flex-row items-center justify-between gap-6">
                <div>
                  <div className="inline-block bg-white/20 backdrop-blur-sm text-white text-xs font-black px-3 py-1 rounded-full mb-2">
                    {currentCourse?.grade || appUser?.grade}
                  </div>
                  <h2 className="text-2xl sm:text-3xl font-black">{currentCourse?.name || 'الكورس التعليمي'}</h2>
                  <p className="text-indigo-100 text-sm mt-1">تصفح المحاضرات، المذكرات، الامتحانات والواجبات الخاصة بهذا الكورس.</p>
                </div>

                <button
                  onClick={() => setSelectedCourseId(null)}
                  className="bg-white text-indigo-900 font-bold px-5 py-2.5 rounded-xl shadow text-xs flex items-center gap-1.5 hover:bg-indigo-50 transition-colors shrink-0 cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4" />
                  <span>تغيير الكورس</span>
                </button>
              </div>
            </div>

            {/* Inside Course Navigation Tabs or Payment Barrier */}
            {!subscribedCourses.includes(selectedCourseId) ? (
              <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 sm:p-12 text-center max-w-2xl mx-auto border-2 border-rose-300 dark:border-rose-900/60 shadow-xl space-y-6">
                <div className="w-20 h-20 bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 rounded-3xl flex items-center justify-center mx-auto shadow-inner">
                  <ShieldAlert className="w-10 h-10" />
                </div>
                <div>
                  <span className="inline-block px-4 py-1.5 bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 rounded-full text-xs font-black mb-3 border border-rose-200 dark:border-rose-800">
                    ⛔ حالة الدفع: غير مسدد لهذا الكورس
                  </span>
                  <h3 className="text-2xl font-black text-slate-900 dark:text-white">روابط ومحاضرات الكورس مقفلة</h3>
                  <p className="text-slate-600 dark:text-slate-300 text-sm mt-3 leading-relaxed max-w-lg mx-auto font-medium">
                    عزيزي الطالب ({appUser?.name})، كود: <b className="font-mono bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">#{appUser?.code || appUser?.uid?.substring(0, 6)}</b>.<br />
                    أنت لست مشتركاً حالياً في كورس <b>"{currentCourse?.name}"</b>.<br />
                    يرجى سداد قيمة الاشتراك المقررة ({currentCourse?.price} ج.م) لتتمكن من فتح روابط المحاضرات، تحميل المذكرات PDF، ودخول الامتحانات الدورية.
                  </p>
                </div>

                <div className="flex flex-wrap gap-3 justify-center pt-2">
                  <Link
                    to={`/payment?courseId=${selectedCourseId}`}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-black px-8 py-3.5 rounded-2xl shadow-lg shadow-emerald-200 dark:shadow-none transition-all text-sm flex items-center gap-2 cursor-pointer"
                  >
                    <CreditCard className="w-4 h-4" />
                    <span>سداد الاشتراك وتفعيل الكورس الآن 💳</span>
                  </Link>

                  {settings.whatsappNumber && (
                    <a
                      href={`https://wa.me/${settings.whatsappNumber}?text=${encodeURIComponent(`السلام عليكم، أنا الطالب: ${appUser?.name}، كود الطالب: ${appUser?.code}، أود الاستفسار عن تفعيل كورس: ${currentCourse?.name}.`)}`}
                      target="_blank"
                      rel="noreferrer"
                      className="bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 px-6 py-3.5 rounded-2xl font-bold transition-all text-sm flex items-center gap-2"
                    >
                      <MessageCircle className="w-4 h-4 text-emerald-600" />
                      <span>تواصل مع السكرتارية</span>
                    </a>
                  )}

                  <button
                    type="button"
                    onClick={() => setSelectedCourseId(null)}
                    className="bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-200 px-6 py-3.5 rounded-2xl font-bold transition-all text-sm cursor-pointer"
                  >
                    العودة لمنصتي الرئيسية
                  </button>
                </div>
              </div>
            ) : (
            <div className="flex flex-col lg:flex-row gap-8">
              {/* Sidebar */}
              <div className="w-full lg:w-72 flex-shrink-0">
                <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800 p-4 sticky top-24 space-y-2">
                  <div className="text-xs font-black text-slate-400 dark:text-slate-500 px-3 py-1 uppercase tracking-wider">
                    محتويات الكورس
                  </div>

                  <button
                    onClick={() => setInnerTab('videos')}
                    className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl font-bold text-sm transition-all cursor-pointer ${
                      innerTab === 'videos'
                        ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200 dark:shadow-none'
                        : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-indigo-600 dark:hover:text-indigo-400'
                    }`}
                  >
                    <Video className="w-5 h-5" />
                    <span>محاضرات وشروحات الفيديو</span>
                  </button>

                  <button
                    onClick={() => setInnerTab('materials')}
                    className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl font-bold text-sm transition-all cursor-pointer ${
                      innerTab === 'materials'
                        ? 'bg-emerald-600 text-white shadow-md shadow-emerald-200 dark:shadow-none'
                        : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-emerald-600 dark:hover:text-emerald-400'
                    }`}
                  >
                    <FileText className="w-5 h-5" />
                    <span>المذكرات والكتب PDF</span>
                  </button>

                  <button
                    onClick={() => setInnerTab('exams')}
                    className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl font-bold text-sm transition-all cursor-pointer ${
                      innerTab === 'exams'
                        ? 'bg-amber-500 text-white shadow-md shadow-amber-200 dark:shadow-none'
                        : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-amber-500 dark:hover:text-amber-400'
                    }`}
                  >
                    <CheckSquare className="w-5 h-5" />
                    <span>امتحانات الكورس الدورية</span>
                  </button>

                  <button
                    onClick={() => setInnerTab('homework')}
                    className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl font-bold text-sm transition-all cursor-pointer ${
                      innerTab === 'homework'
                        ? 'bg-teal-600 text-white shadow-md shadow-teal-200 dark:shadow-none'
                        : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-teal-600 dark:hover:text-teal-400'
                    }`}
                  >
                    <BookOpen className="w-5 h-5" />
                    <span>واجبات وتدريبات الكورس</span>
                  </button>
                </div>
              </div>

              {/* Main Content Area inside course */}
              <div className="flex-1 min-w-0">
                {innerTab === 'exams' || innerTab === 'homework' ? (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                    <StudentExams 
                      subscribedCourses={[selectedCourseId]} 
                      activeTab={innerTab === 'homework' ? 'homework' : 'exams'} 
                    />
                  </motion.div>
                ) : (
                  <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden min-h-[400px]">
                    {materialsLoading ? (
                      <div className="flex justify-center p-20">
                        <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
                      </div>
                    ) : materials.length === 0 ? (
                      <div className="p-20 text-center flex flex-col items-center">
                        <div className="text-6xl mb-4">
                          {innerTab === 'videos' ? '🎬' : '📚'}
                        </div>
                        <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-2">لا توجد محتويات في هذا القسم حالياً</h3>
                        <p className="text-slate-500 dark:text-slate-400 text-sm">سيتم إضافة المحاضرات والمذكرات قريباً من قبل الأستاذ.</p>
                      </div>
                    ) : (
                      <div className="p-6">
                        {Array.from(new Set(materials.map(m => m.lessonName || 'محتوى عام'))).map(lesson => (
                          <div key={lesson} className="mb-8 last:mb-0">
                            <h3 className="text-lg font-black text-slate-800 dark:text-white mb-4 pb-2 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2">
                              <BookOpen className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                              <span>{lesson}</span>
                            </h3>

                            <div className="grid md:grid-cols-2 gap-4">
                              {materials.filter(m => (m.lessonName || 'محتوى عام') === lesson).map((item) => (
                                <motion.div
                                  initial={{ opacity: 0, scale: 0.96 }}
                                  animate={{ opacity: 1, scale: 1 }}
                                  key={item.id}
                                  className="group bg-slate-50 dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden hover:shadow-xl transition-all hover:border-indigo-200 dark:hover:border-indigo-500 flex flex-col justify-between"
                                >
                                  {item.thumbnailBase64 && (
                                    <div className="h-40 overflow-hidden relative bg-black">
                                      <img 
                                        src={item.thumbnailBase64} 
                                        alt={item.title} 
                                        className="w-full h-full object-cover opacity-80 group-hover:scale-105 transition-transform duration-500" 
                                      />
                                      {innerTab === 'videos' && (
                                        <div className="absolute inset-0 flex items-center justify-center">
                                          <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center group-hover:bg-indigo-600 transition-colors duration-300">
                                            <PlayCircle className="w-6 h-6 text-white" />
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  )}

                                  <div className="p-5 flex-1 flex flex-col justify-between">
                                    <div>
                                      <h4 className="font-bold text-slate-800 dark:text-white mb-2 text-base line-clamp-2">{item.title}</h4>
                                      {item.description && (
                                        <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mb-4">{item.description}</p>
                                      )}
                                    </div>

                                    {innerTab === 'videos' ? (
                                      <button 
                                        onClick={() => handleOpenMaterial(item)}
                                        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm transition-all bg-indigo-100 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-600 hover:text-white dark:hover:bg-indigo-600 dark:hover:text-white cursor-pointer"
                                      >
                                        <PlayCircle className="w-5 h-5" />
                                        <span>مشاهدة المحاضرة</span>
                                      </button>
                                    ) : (
                                      <button 
                                        onClick={() => handleOpenMaterial(item)}
                                        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm transition-all bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-600 hover:text-white dark:hover:bg-emerald-600 dark:hover:text-white cursor-pointer"
                                      >
                                        <Download className="w-5 h-5" />
                                        <span>عرض وتحميل المذكرة</span>
                                      </button>
                                    )}
                                  </div>
                                </motion.div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
            )}
          </div>
        )}
      </div>

      {/* ------------------------------------------------------------- */}
      {/* VIDEO / PDF VIEWER MODAL WITH DYNAMIC MOVING WATERMARK        */}
      {/* ------------------------------------------------------------- */}
      <AnimatePresence>
        {playingVideo && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/90 backdrop-blur-sm"
          >
            <div
              className="bg-black rounded-3xl overflow-hidden w-full max-w-5xl shadow-2xl relative border border-slate-800"
            >
              <div className="p-4 bg-slate-900 border-b border-slate-800 z-10 flex flex-col gap-2">
                <div className="flex justify-between items-center">
                  <h3 className="text-white font-bold text-sm sm:text-base">{playingVideo.title}</h3>
                  <button 
                    onClick={() => setPlayingVideo(null)}
                    className="text-white hover:text-rose-400 transition-colors bg-white/10 hover:bg-white/20 p-2 rounded-full cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {playingVideo.type === 'video' ? (
                  <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-800 text-xs">
                    <div className="flex items-center gap-3">
                      <span className="text-slate-400 font-bold">نسبة المشاهدة:</span>
                      <div className="w-28 sm:w-36 bg-slate-800 rounded-full h-2 overflow-hidden border border-slate-700">
                        <div 
                          className="h-full transition-all duration-500 bg-emerald-500" 
                          style={{ width: `${Math.min(100, videoWatchPct)}%` }}
                        />
                      </div>
                      <span className="font-bold font-mono text-xs text-slate-300">
                        {videoWatchPct}%
                      </span>
                    </div>

                    {videoWatchPct >= 100 ? (
                      <span className="text-emerald-400 font-bold text-xs bg-emerald-950/70 border border-emerald-500/40 px-3.5 py-1.5 rounded-xl flex items-center gap-1.5 shadow-sm">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        <span>تمت مشاهدة المحاضرة بنجاح (100%) ✓</span>
                      </span>
                    ) : videoWatchPct >= minRequiredWatchPct ? (
                      <button
                        type="button"
                        onClick={handleMarkVideoCompleted}
                        className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-3.5 py-1.5 rounded-xl text-xs transition-all flex items-center gap-1.5 cursor-pointer shadow-md hover:scale-105 active:scale-95"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>تأكيد إتمام المحاضرة ✓</span>
                      </button>
                    ) : null}
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-800 text-xs">
                    <span className="text-slate-300 font-bold flex items-center gap-1.5">
                      <FileText className="w-4 h-4 text-emerald-400" />
                      <span>مذكرة دراسية بصيغة PDF</span>
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => openPdfInNewTab(playingVideo.url || '', playingVideo.title)}
                        className="bg-indigo-600 hover:bg-indigo-500 text-white font-black px-3.5 py-1.5 rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>تصفح ملء الشاشة ↗</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => downloadPdfFile(playingVideo.url || '', playingVideo.title)}
                        className="bg-emerald-600 hover:bg-emerald-500 text-white font-black px-3.5 py-1.5 rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>تحميل المذكرة</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
                
              {/* Dynamic Animated Watermarks */}
              <div className="absolute inset-0 pointer-events-none overflow-hidden z-20 flex items-center justify-center">
                <motion.div
                  animate={{ 
                    x: [0, 250, -250, 250, 0], 
                    y: [0, 150, -150, -150, 0],
                    rotate: [0, 15, -15, 10, 0]
                  }}
                  transition={{ duration: 25, ease: "linear", repeat: Infinity }}
                  className="text-white font-black text-3xl sm:text-5xl opacity-20 drop-shadow-2xl select-none whitespace-nowrap"
                  dir="ltr"
                  style={{ textShadow: '2px 2px 4px rgba(0,0,0,0.8), -2px -2px 4px rgba(0,0,0,0.8)' }}
                >
                  {appUser?.phone || appUser?.email}
                </motion.div>
                <motion.div
                  animate={{ 
                    x: [250, -250, 250, 0, 250], 
                    y: [150, -150, 150, -150, 150],
                    rotate: [15, -15, 10, 0, 15]
                  }}
                  transition={{ duration: 28, ease: "linear", repeat: Infinity }}
                  className="text-white font-black text-3xl sm:text-5xl opacity-20 drop-shadow-2xl select-none whitespace-nowrap absolute"
                  dir="ltr"
                  style={{ textShadow: '2px 2px 4px rgba(0,0,0,0.8), -2px -2px 4px rgba(0,0,0,0.8)' }}
                >
                  {appUser?.phone || appUser?.email}
                </motion.div>
              </div>

              {playingVideo.url ? (
                playingVideo.type === 'pdf' ? (
                  <div className="relative w-full h-[82vh] bg-slate-900 rounded-b-3xl overflow-hidden flex items-center justify-center">
                    {pdfResolving ? (
                      <div className="flex flex-col items-center justify-center gap-3 text-white">
                        <Loader2 className="w-10 h-10 animate-spin text-emerald-400" />
                        <span className="font-bold text-sm">جاري تحميل وتجهيز المذكرة من السحابة...</span>
                      </div>
                    ) : resolvedPdfUrl ? (
                      <iframe 
                        src={resolvedPdfUrl} 
                        className="w-full h-full bg-white border-0"
                        title={playingVideo.title}
                      />
                    ) : (
                      <div className="text-white text-center p-6 space-y-3">
                        <p className="font-bold">جاري فتح المذكرة مباشرة...</p>
                        <button
                          type="button"
                          onClick={() => openPdfInNewTab(playingVideo.url || '', playingVideo.title)}
                          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-sm shadow-md"
                        >
                          فتح وتصفح المذكرة ↗
                        </button>
                      </div>
                    )}
                    <div className="sm:hidden absolute bottom-3 left-3 right-3 bg-slate-900/90 backdrop-blur-md p-2.5 rounded-2xl border border-slate-700 text-center flex items-center justify-between gap-2 shadow-xl z-30">
                      <span className="text-[11px] text-white font-medium">لتصفح أسهل وتكبير الخط:</span>
                      <button
                        type="button"
                        onClick={() => openPdfInNewTab(playingVideo.url || '', playingVideo.title)}
                        className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black rounded-lg"
                      >
                        ملء الشاشة ↗
                      </button>
                    </div>
                  </div>
                ) : (
                  (() => {
                    const isBunny = Boolean(
                      (playingVideo as any).bunnyVideoId ||
                      (playingVideo.url && (
                        playingVideo.url.includes('mediadelivery.net/embed/') || 
                        playingVideo.url.includes('mediadelivery.net/play/') ||
                        playingVideo.url.includes('b-cdn.net')
                      ))
                    );

                    let libId = (playingVideo as any).bunnyLibraryId || '';
                    let vidId = (playingVideo as any).bunnyVideoId || '';

                    if (!vidId && playingVideo.url && playingVideo.url.includes('mediadelivery.net/embed/')) {
                      const parts = playingVideo.url.split('mediadelivery.net/embed/')[1]?.split('?')[0]?.split('/');
                      libId = libId || parts?.[0] || '';
                      vidId = parts?.[1] || '';
                    } else if (!vidId && playingVideo.url && playingVideo.url.includes('mediadelivery.net/play/')) {
                      const parts = playingVideo.url.split('mediadelivery.net/play/')[1]?.split('?')[0]?.split('/');
                      libId = libId || parts?.[0] || '';
                      vidId = parts?.[1] || '';
                    }

                    if (isBunny && vidId) {
                      return (
                        <div className="w-full bg-black rounded-b-3xl overflow-hidden p-1">
                          <BunnyPlayer
                            libraryId={libId || '767125'}
                            videoId={vidId}
                            studentName={appUser?.name || user?.displayName || 'طالب المنصة'}
                            studentId={appUser?.code || appUser?.phone || appUser?.uid || ''}
                            title={playingVideo.title}
                            autoPlay
                            className="w-full !rounded-2xl"
                            aspectRatio="16/9"
                          />
                        </div>
                      );
                    }
                    return (
                      <iframe
                        src={getEmbedUrl(playingVideo.url)}
                        className="w-full h-[75vh] bg-black border-0 rounded-b-3xl"
                        allowFullScreen
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      ></iframe>
                    );
                  })()
                )
              ) : (
                <div className="relative w-full h-[75vh] bg-black rounded-b-3xl overflow-hidden flex items-center justify-center">
                  <video 
                    src={playingVideo.videoBase64} 
                    controls 
                    autoPlay
                    controlsList="nodownload"
                    onContextMenu={e => e.preventDefault()}
                    onTimeUpdate={(e) => {
                      const v = e.currentTarget;
                      if (v.duration > 0) {
                        const pct = Math.min(100, Math.round((v.currentTime / v.duration) * 100));
                        setVideoWatchPct(prev => Math.max(prev, pct));
                        setWatchSeconds(Math.round(v.currentTime));
                      }
                    }}
                    onEnded={() => {
                      setVideoWatchPct(100);
                    }}
                    className="w-full h-full object-contain"
                  >
                    متصفحك لا يدعم تشغيل هذا الفيديو.
                  </video>

                  {/* Watermark badge on HTML5 video */}
                  <div className="absolute pointer-events-none select-none z-30 top-1/3 left-1/4 bg-slate-950/40 backdrop-blur-[2px] border border-white/10 px-3 py-1 rounded-full text-white/70 text-xs font-medium tracking-wide shadow-sm flex items-center gap-1.5">
                    <span>{appUser?.name || user?.displayName || 'طالب المنصة'} • {appUser?.phone || appUser?.code || appUser?.uid || ''}</span>
                  </div>
                </div>
              )}

              {/* Dedicated Video Progress & Completion Confirmation Bar under Player */}
              {playingVideo.type === 'video' && (
                <div className="p-4 bg-slate-950 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="flex items-center gap-3 w-full sm:w-auto">
                    <div className="flex flex-col gap-1 w-full sm:w-64">
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-slate-400 font-bold">شريط تقدم المشاهدة:</span>
                        <span className="font-mono font-black text-emerald-400">{videoWatchPct}%</span>
                      </div>
                      <div className="w-full bg-slate-800 rounded-full h-2.5 overflow-hidden border border-slate-700">
                        <div 
                          className="h-full transition-all duration-300 bg-gradient-to-r from-indigo-500 to-emerald-400" 
                          style={{ width: `${Math.min(100, Math.max(videoWatchPct, 0))}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
                    {videoWatchPct >= 100 ? (
                      <div className="px-5 py-2.5 bg-emerald-950/80 border border-emerald-500/50 rounded-2xl flex items-center gap-2 text-emerald-300 text-xs font-black shadow-sm">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        <span>تم إتمام مشاهدة الفيديو ومحسوب في تقدمك (100%) ✓</span>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={handleMarkVideoCompleted}
                        className="w-full sm:w-auto px-6 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-xs rounded-2xl transition-all shadow-lg hover:shadow-emerald-900/40 flex items-center justify-center gap-2 cursor-pointer active:scale-95"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>إتمام مشاهدة الفيديو (لحساب تقدمك) ✓</span>
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
        {/* GAMIFICATION LEVELS MODAL */}
        {showLevelsModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-slate-900 rounded-3xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl border border-slate-100 dark:border-slate-800 my-8 space-y-6 text-right transition-colors"
            >
              <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-amber-100 dark:bg-amber-950/70 text-amber-700 dark:text-amber-300 flex items-center justify-center font-black">
                    <Award className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-slate-900 dark:text-white">نظام المستويات ومكافآت التميز 🏅</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">كلما حللت امتحانات وحصلت على درجات أعلى، ارتقى مستواك في لوحة الشرف</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowLevelsModal(false)}
                  className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Levels list */}
              <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-1">
                {levels.map((lvl) => {
                  const isCurrent = userLevel.name === lvl.name;
                  const IconComp = lvl.icon;
                  return (
                    <div
                      key={lvl.name}
                      className={`p-4 rounded-2xl border transition-all flex items-center justify-between gap-4 ${
                        isCurrent
                          ? 'border-indigo-500 bg-indigo-50/60 dark:bg-indigo-950/50 ring-2 ring-indigo-200 dark:ring-indigo-800'
                          : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 hover:bg-slate-50 dark:hover:bg-slate-800/70'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-sm flex-shrink-0 ${lvl.bg} ${lvl.color}`}>
                          <IconComp className="w-6 h-6" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-black text-slate-900 dark:text-white text-sm">{lvl.name}</span>
                            {isCurrent && (
                              <span className="bg-indigo-600 text-white text-[10px] font-black px-2 py-0.5 rounded-full">
                                مستواك الحالي ⭐
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{lvl.perks}</p>
                        </div>
                      </div>

                      <div className="text-left flex-shrink-0">
                        <span className="text-xs font-black text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-1 rounded-xl block">
                          من {lvl.threshold.toLocaleString()} نقطة
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* How to earn points info */}
              <div className="bg-gradient-to-r from-amber-50 to-indigo-50 dark:from-amber-950/30 dark:to-indigo-950/30 p-4 rounded-2xl border border-amber-200/60 dark:border-amber-900/50 text-xs text-slate-700 dark:text-slate-300 space-y-2">
                <div className="font-bold text-slate-900 dark:text-amber-200 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  <span>كيف تكتسب النقاط وترتقي بالمستويات؟</span>
                </div>
                <ul className="space-y-1 list-disc list-inside text-slate-600 dark:text-slate-300 font-medium">
                  <li>الحصول على الدرجات النهائية أو العالية في الامتحانات (+100 نقطة)</li>
                  <li>تسليم الواجبات الدورية في مواعيدها ومراجعتها مع المعلم (+50 نقطة)</li>
                  <li>المثابرة والمتابعة المستمرة لكافة محاضرات الكورس (+30 نقطة)</li>
                </ul>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  onClick={() => setShowLevelsModal(false)}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm px-6 py-2.5 rounded-xl transition-all cursor-pointer"
                >
                  حسناً، فهمت
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
