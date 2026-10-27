import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../lib/firebase';
import { collection, query, onSnapshot, doc, setDoc, updateDoc, deleteDoc, increment } from 'firebase/firestore';
import { 
  Building, 
  QrCode, 
  Search, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  CreditCard, 
  Printer, 
  BookOpen, 
  Award, 
  Calendar, 
  Plus, 
  Loader2, 
  DollarSign, 
  UserCheck, 
  Send,
  MessageCircle,
  Camera,
  ExternalLink,
  Sparkles,
  Volume2,
  X,
  Trash2,
  AlertTriangle,
  Filter,
  Users,
  FileText,
  BellRing,
  GraduationCap,
  RotateCcw,
  Video,
  Shield,
  ShieldAlert
} from 'lucide-react';
import JsBarcode from 'jsbarcode';
import { AppUser } from '../contexts/AuthContext';
import { useSettings } from '../contexts/SettingsContext';
import { buildWhatsAppUrl } from '../lib/whatsapp';
import { printHtmlDocument } from '../lib/printHelper';
import { printStudentSticker } from '../lib/stickerPrintHelper';
import { validateStudentAttendanceCycle } from '../lib/attendanceCycleHelper';
import GroupScheduleBuilderModal from './GroupScheduleBuilderModal';
import CameraBarcodeScanner, { playScannerBeep, playErrorBuzzerBeep } from './CameraBarcodeScanner';
import GateAdmissionModal from './GateAdmissionModal';
import ExtraSessionManagerModal, { MultiSlotExtraSession, ExtraSlot } from './ExtraSessionManagerModal';
import StudentCardManagerModal from './StudentCardManagerModal';

interface AttendanceRecord {
  id: string;
  studentId: string;
  studentName: string;
  studentCode?: string;
  date: string;
  time: string;
  status: 'present' | 'absent' | 'late';
  timestamp: number;
  notes?: string;
}

interface CenterPayment {
  id: string;
  studentId: string;
  studentName: string;
  studentCode?: string;
  month: string;
  amount: number;
  date: string;
  timestamp: number;
  notes?: string;
  receiptNumber: string;
  receivedBy?: string;
  createdAt?: number;
}

interface RecitationRecord {
  id: string;
  studentId: string;
  studentName: string;
  studentCode?: string;
  title: string;
  score: number;
  finalGrade: number;
  percentage: number;
  date: string;
  timestamp: number;
  notes?: string;
  status?: 'completed' | 'missed' | 'cancelled' | 'makeup_accepted' | 'makeup_expired';
  isCancelled?: boolean;
  cancelledReason?: string;
  isMakeup?: boolean;
  makeupTiming?: 'before_next' | 'after_next';
  isCounted?: boolean;
}

interface ActionAlert {
  type: 'attendance' | 'payment' | 'recitation';
  title: string;
  details: string;
  studentName: string;
  studentCode?: string;
  whatsappUrl?: string;
  paymentRecord?: CenterPayment;
  student?: AppUser;
}

interface GroupWarning {
  student: AppUser;
  reason: string;
  todayName: string;
  status: 'present' | 'absent' | 'late';
  currentSessionGroup?: string;
  currentSessionGrade?: string;
  studentGrade?: string;
  studentGroup?: string;
  isAlternativeDay?: boolean;
  isCycleDuplicate?: boolean;
}

export interface VideoProgressRecord {
  id: string;
  studentId: string;
  studentName: string;
  studentCode?: string;
  studentPhone?: string;
  parentPhone?: string;
  grade?: string;
  centerGroup?: string;
  isCenterStudent?: boolean;
  materialId: string;
  materialTitle: string;
  courseId?: string;
  percentage: number;
  watchedSeconds?: number;
  updatedAt?: number;
}

const ALL_MONTHS_OPTIONS = [
  'شهر أكتوبر',
  'شهر نوفمبر',
  'شهر ديسمبر',
  'شهر يناير',
  'شهر فبراير',
  'شهر مارس',
  'شهر أبريل',
  'شهر مايو',
  'شهر يونيو',
  'شهر يوليو',
  'شهر أغسطس',
  'شهر سبتمبر',
  'مراجعات نهائية',
  'مذكرات وكتب',
  'مخصص...'
];

export default function AdminCenterManager() {
  const { settings, updateSettings } = useSettings();
  const [subTab, setSubTab] = useState<'attendance' | 'payments' | 'recitations' | 'absences' | 'video_watch'>('attendance');
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);

  // Active Session Groups (supports multi-selection up to 3 groups), Grade & Group Manager Modal
  const [activeSessionGroups, setActiveSessionGroups] = useState<string[]>(['all']);
  const [activeSessionGroup, setActiveSessionGroup] = useState<string>('all');
  const [activeSessionGrade, setActiveSessionGrade] = useState<string>('all');
  const [isGroupManagerOpen, setIsGroupManagerOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');

  // Video Watch Progress Tracking
  const [videoProgressList, setVideoProgressList] = useState<VideoProgressRecord[]>([]);
  const [videoWatchSearch, setVideoWatchSearch] = useState('');
  const [videoWatchGrade, setVideoWatchGrade] = useState('all');
  const [videoWatchGroup, setVideoWatchGroup] = useState('all');
  const [videoWatchThreshold, setVideoWatchThreshold] = useState<'less50' | 'less25' | 'zero' | 'all'>('less50');
  const [editingProgress, setEditingProgress] = useState<VideoProgressRecord | null>(null);
  const [manualPctInput, setManualPctInput] = useState<number>(100);

  // Notified unpaid students state (sinks to the bottom of unpaid list)
  const [notifiedPaymentStudents, setNotifiedPaymentStudents] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('notified_unpaid_students');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const handleMarkNotified = (studentId: string) => {
    setNotifiedPaymentStudents(prev => {
      if (prev.includes(studentId)) return prev;
      const updated = [...prev, studentId];
      try {
        localStorage.setItem('notified_unpaid_students', JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  const handleResetNotifiedList = () => {
    if (confirm('هل تريد إعادة تعيين قائمة التنبيهات المرسلة لتبدأ من جديد؟')) {
      setNotifiedPaymentStudents([]);
      try {
        localStorage.removeItem('notified_unpaid_students');
      } catch {}
    }
  };

  // Search & Student selection
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<AppUser | null>(null);

  // Camera Scanner Modal
  const [isCameraOpen, setIsCameraOpen] = useState(false);

  // High-visibility action banner (with WhatsApp & Print buttons)
  const [actionAlert, setActionAlert] = useState<ActionAlert | null>(null);

  // High-contrast Warning for Wrong Group Schedule
  const [groupWarning, setGroupWarning] = useState<GroupWarning | null>(null);

  // Gate Admission & Payment Inspection Modal
  const [gateInspectionStudent, setGateInspectionStudent] = useState<AppUser | null>(null);
  const [scanInspectionMode, setScanInspectionMode] = useState<boolean>(true);
  const [autoMarkAttendanceOnScan, setAutoMarkAttendanceOnScan] = useState<boolean>(() => {
    return localStorage.getItem('saber_auto_mark_on_scan') === 'true';
  });

  // Multi-Slot Extra Session Modal & Plans
  const [isExtraSessionModalOpen, setIsExtraSessionModalOpen] = useState<boolean>(false);
  const [extraSessionPlans, setExtraSessionPlans] = useState<MultiSlotExtraSession[]>(() => {
    const saved = localStorage.getItem('saber_extra_session_plans');
    if (saved) {
      try { return JSON.parse(saved); } catch {}
    }
    const today = new Date().toISOString().split('T')[0];
    const nextWeek = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString().split('T')[0];
    return [
      {
        id: 'default_extra_1',
        title: 'مجموعة الجمعة والسبت الإضافية (مراجعة عامة وتطبيقات)',
        targetGrade: 'all',
        slots: [
          { id: 's1', day: 'الجمعة', time: '05:00 م', room: 'القاعة الكبرى' },
          { id: 's2', day: 'الجمعة', time: '07:00 م', room: 'القاعة الكبرى' },
          { id: 's3', day: 'الجمعة', time: '09:00 م', room: 'القاعة الكبرى' },
          { id: 's4', day: 'السبت', time: '09:00 ص', room: 'القاعة 2' }
        ],
        startDate: today,
        endDate: nextWeek,
        isActive: true,
        notes: 'ميعاد إضافي للطلاب لتعويض ما فاتهم وحضور المراجعات المكثفة',
        createdAt: Date.now()
      }
    ];
  });
  const [selectedExtraSlot, setSelectedExtraSlot] = useState<string>('all');

  // Attendance State
  const [scanCode, setScanCode] = useState('');
  const [attendanceList, setAttendanceList] = useState<AttendanceRecord[]>([]);
  const [attendingStatus, setAttendingStatus] = useState<'present' | 'absent' | 'late'>('present');
  const [attendingNotes, setAttendingNotes] = useState('');

  // Payment State
  const [paymentList, setPaymentList] = useState<CenterPayment[]>([]);
  const [paymentMonth, setPaymentMonth] = useState('شهر أكتوبر');
  const [customMonthInput, setCustomMonthInput] = useState('');
  const [paymentAmount, setPaymentAmount] = useState<number>(200);
  const [paymentNotes, setPaymentNotes] = useState('');
  const [paymentSearch, setPaymentSearch] = useState('');

  // Absence Tab State
  const [absenceSubTab, setAbsenceSubTab] = useState<'sat_mon' | 'tue_thu' | 'chronic' | 'extra_session'>('sat_mon');
  const [absenceSearch, setAbsenceSearch] = useState('');

  // Extra Session State (حصة إضافية / ميعاد زيادة مثل الجمعة أو مراجعة عامة)
  const [isExtraSessionMode, setIsExtraSessionMode] = useState<boolean>(false);
  const [extraSessionName, setExtraSessionName] = useState<string>('مجموعة الجمعة الإضافية (حضور عام)');
  const [extraSessionDate, setExtraSessionDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [extraSessionTargetGrade, setExtraSessionTargetGrade] = useState<string>('all');
  const [extraSessionTargetGroup, setExtraSessionTargetGroup] = useState<string>('all');
  const [bulkAbsenceLoading, setBulkAbsenceLoading] = useState<boolean>(false);

  // Card Manager Modal State (Scan External Card / Generate & Print)
  const [isCardModalOpen, setIsCardModalOpen] = useState<boolean>(false);
  const [cardModalStudent, setCardModalStudent] = useState<AppUser | null>(null);

  // Recitation State & Advanced Rules (Cancellation / Missed / Makeup)
  const [recitationList, setRecitationList] = useState<RecitationRecord[]>([]);
  const [materialsList, setMaterialsList] = useState<any[]>([]);
  const [recTitle, setRecTitle] = useState('تسميع الحصة');
  const [recScore, setRecScore] = useState<number>(10);
  const [recFinalGrade, setRecFinalGrade] = useState<number>(10);
  const [recNotes, setRecNotes] = useState('');
  const [recitationType, setRecitationType] = useState<'normal' | 'missed' | 'makeup' | 'cancel_session'>('normal');
  const [makeupTiming, setMakeupTiming] = useState<'before_next' | 'after_next'>('before_next');

  // Available Groups from global settings and existing center students
  const availableGroups = useMemo(() => {
    const groupsSet = new Set<string>();

    if (Array.isArray(settings.centerGroups)) {
      settings.centerGroups.forEach(g => {
        if (typeof g === 'string' && g.trim()) groupsSet.add(g.trim());
      });
    }

    users.forEach(u => {
      if (u.centerGroup && typeof u.centerGroup === 'string' && u.centerGroup.trim()) {
        groupsSet.add(u.centerGroup.trim());
      }
      if (Array.isArray((u as any).centerGroups)) {
        (u as any).centerGroups.forEach((g: string) => {
          if (typeof g === 'string' && g.trim()) groupsSet.add(g.trim());
        });
      }
    });

    if (groupsSet.size > 0) {
      return Array.from(groupsSet);
    }

    return [
      'مجموعة السبت والثلاثاء - 09:30 صباحاً',
      'مجموعة السبت والثلاثاء - 10:30 صباحاً',
      'مجموعة الأحد والأربعاء - 04:00 مساءً',
      'مجموعة الإثنين والخميس - 05:30 مساءً',
      'مجموعة الجمعة - 09:00 صباحاً'
    ];
  }, [settings.centerGroups, users]);

  // Available Grades from global settings
  const availableGrades = useMemo(() => {
    return Array.isArray(settings.grades) && settings.grades.length > 0
      ? settings.grades
      : [
          'الصف الأول الثانوي',
          'الصف الثاني الثانوي',
          'الصف الثالث الثانوي'
        ];
  }, [settings.grades]);

  // Memoized user map for instant O(1) lookups by uid
  const userMap = useMemo(() => new Map<string, AppUser>(users.map(u => [u.uid, u])), [users]);

  // Memoized code map for instant O(1) lookups by student code/phone/uid/promoCode/cardQrCode
  const codeMap = useMemo(() => {
    const map = new Map<string, AppUser>();
    for (const u of users) {
      if (u.code) map.set(u.code.trim().toLowerCase(), u);
      if (u.phone) map.set(u.phone.trim(), u);
      if (u.promoCode) map.set(u.promoCode.trim().toLowerCase(), u);
      if (u.cardQrCode) map.set(u.cardQrCode.trim().toLowerCase(), u);
      if (u.externalCardCode) map.set(u.externalCardCode.trim().toLowerCase(), u);
      map.set(u.uid.toLowerCase(), u);
    }
    return map;
  }, [users]);

  // Active Group Counts (Filtered by active group and active grade if selected)
  const activeGroupStudentsCount = useMemo(() => {
    return users.filter(u => {
      if (!u.isCenterStudent) return false;
      if (activeSessionGroup !== 'all' && (u.centerGroup || '').trim() !== activeSessionGroup.trim()) return false;
      if (activeSessionGrade !== 'all' && (u.grade || '').trim() !== activeSessionGrade.trim()) return false;
      return true;
    }).length;
  }, [users, activeSessionGroup, activeSessionGrade]);

  const activeGroupAttendedTodayCount = useMemo(() => {
    const todayStr = new Date().toLocaleDateString('ar-EG', { year: 'numeric', month: '2-digit', day: '2-digit' });
    const todayRecords = attendanceList.filter(a => a.date === todayStr && a.status === 'present');
    
    const matchingStudentIds = new Set(
      users.filter(u => {
        if (!u.isCenterStudent) return false;
        if (activeSessionGroup !== 'all' && (u.centerGroup || '').trim() !== activeSessionGroup.trim()) return false;
        if (activeSessionGrade !== 'all' && (u.grade || '').trim() !== activeSessionGrade.trim()) return false;
        return true;
      }).map(u => u.uid)
    );

    return todayRecords.filter(a => matchingStudentIds.has(a.studentId)).length;
  }, [attendanceList, users, activeSessionGroup, activeSessionGrade]);

  // Add Group Function
  const handleAddGroup = async (groupNameToAdd?: string) => {
    const name = (groupNameToAdd || newGroupName).trim();
    if (!name) return;
    if (availableGroups.includes(name)) {
      alert('هذه المجموعة موجودة بالفعل في القائمة!');
      return;
    }
    const updated = [...availableGroups, name];
    await updateSettings({ centerGroups: updated });
    setNewGroupName('');
  };

  // Delete Group Function
  const handleDeleteGroup = async (groupNameToDelete: string) => {
    if (!confirm(`هل أنت متأكد من حذف [${groupNameToDelete}] من قائمة المجموعات؟`)) return;
    const updated = availableGroups.filter(g => g !== groupNameToDelete);
    await updateSettings({ centerGroups: updated });
    if (activeSessionGroup === groupNameToDelete) {
      setActiveSessionGroup('all');
    }
  };

  // Clear All Groups Function
  const handleClearAllGroups = async () => {
    if (!confirm('هل أنت متأكد تماماً من تفريغ وحذف جميع مجموعات ومواعيد السنتر دفعة واحدة؟')) return;
    await updateSettings({ centerGroups: [] });
    setActiveSessionGroup('all');
  };

  useEffect(() => {
    const qUsers = query(collection(db, 'users'));
    const unsubUsers = onSnapshot(qUsers, (snap) => {
      const data = snap.docs.map(d => ({ uid: d.id, ...d.data() })) as AppUser[];
      setUsers(data);
      setLoading(false);
    }, (err) => {
      console.warn('Error listening to users:', err);
      setLoading(false);
    });

    const qAtt = query(collection(db, 'attendance'));
    const unsubAtt = onSnapshot(qAtt, (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() })) as AttendanceRecord[];
      data.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
      setAttendanceList(data);
    }, (err) => {
      console.warn('Error listening to attendance:', err);
    });

    const qPay = query(collection(db, 'center_payments'));
    const unsubPay = onSnapshot(qPay, (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() })) as CenterPayment[];
      data.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
      setPaymentList(data);
    }, (err) => {
      console.warn('Error listening to center_payments:', err);
    });

    const qRec = query(collection(db, 'recitations'));
    const unsubRec = onSnapshot(qRec, (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() })) as RecitationRecord[];
      data.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
      setRecitationList(data);
    }, (err) => {
      console.warn('Error listening to recitations:', err);
    });

    const qVid = query(collection(db, 'video_progress'));
    const unsubVid = onSnapshot(qVid, (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() })) as VideoProgressRecord[];
      data.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
      setVideoProgressList(data);
    }, (err) => {
      console.warn('Error listening to video_progress:', err);
    });

    const qMat = query(collection(db, 'materials'));
    const unsubMat = onSnapshot(qMat, (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setMaterialsList(data);
    }, (err) => {
      console.warn('Error listening to materials:', err);
    });

    const qExtra = query(collection(db, 'extra_sessions'));
    const unsubExtra = onSnapshot(qExtra, (snap) => {
      if (!snap.empty) {
        const firestorePlans = snap.docs.map(d => ({ id: d.id, ...d.data() })) as MultiSlotExtraSession[];
        firestorePlans.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        setExtraSessionPlans(firestorePlans);
        try {
          localStorage.setItem('saber_extra_session_plans', JSON.stringify(firestorePlans));
        } catch {}
      }
    }, (err) => {
      console.warn('Error listening to extra_sessions:', err);
    });

    return () => {
      unsubUsers();
      unsubAtt();
      unsubPay();
      unsubRec();
      unsubVid();
      unsubMat();
      unsubExtra();
    };
  }, []);

  // Day Name Helper
  const getDayName = (dayIndex: number): string => {
    const days = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
    return days[dayIndex] || '';
  };

  // Group Schedule Checker (Validates Educational Grade/Age and Group Timing)
  const checkGroupSchedule = (student: AppUser): { 
    isMatch: boolean; 
    reason?: string; 
    todayName: string; 
    currentSessionGroup?: string;
    currentSessionGrade?: string;
    studentGrade?: string;
    studentGroup?: string;
  } => {
    const now = new Date();
    const todayDay = now.getDay(); // 0 = Sun, 1 = Mon, 2 = Tue, 3 = Wed, 4 = Thu, 5 = Fri, 6 = Sat
    const todayName = getDayName(todayDay);

    const studentGroupsList: string[] = (
      Array.isArray((student as any).centerGroups) && (student as any).centerGroups.length > 0
        ? (student as any).centerGroups
        : (student.centerGroup ? [student.centerGroup] : [])
    ).map((g: string) => g.trim()).filter(Boolean);

    const studentGroupsDisplay = studentGroupsList.join(' • ') || 'غير محددة';
    const studentGrade = (student.grade || '').trim();

    // 0. EXTRA SESSION MODE (حصة / مجموعة إضافية عامة - حضور لجميع المجموعات دون التقيد بيوم المجموعة)
    const activeMultiPlan = extraSessionPlans.find(p => p.isActive);
    if (isExtraSessionMode || activeMultiPlan) {
      const planTitle = activeMultiPlan ? activeMultiPlan.title : extraSessionName;
      const planGrade = activeMultiPlan && activeMultiPlan.targetGrade !== 'all' ? activeMultiPlan.targetGrade : activeSessionGrade;

      if (planGrade && planGrade !== 'all') {
        const normalizeGrade = (str: string) => str.replace(/[\s\-_]/g, '').toLowerCase();
        if (!studentGrade || normalizeGrade(studentGrade) !== normalizeGrade(planGrade)) {
          return {
            isMatch: false,
            reason: `الحصة الإضافية مخصصة لطلاب [${planGrade}] بينما الطالب مقيد في مرحلة [${studentGrade || 'غير محدد'}]!`,
            todayName,
            currentSessionGroup: planTitle,
            currentSessionGrade: planGrade,
            studentGrade: studentGrade || 'غير محدد',
            studentGroup: studentGroupsDisplay
          };
        }
      }

      return {
        isMatch: true,
        todayName,
        currentSessionGroup: planTitle,
        currentSessionGrade: planGrade !== 'all' ? planGrade : undefined,
        studentGrade: studentGrade || 'غير محدد',
        studentGroup: studentGroupsDisplay
      };
    }

    // 1. GRADE / AGE MISMATCH CHECK (Prevents wrong educational grade from entering room)
    if (activeSessionGrade && activeSessionGrade !== 'all') {
      const normalizeGrade = (str: string) => str.replace(/[\s\-_]/g, '').toLowerCase();
      if (!studentGrade || normalizeGrade(studentGrade) !== normalizeGrade(activeSessionGrade)) {
        return {
          isMatch: false,
          reason: `القاعة مخصصة حالياً لطلاب [${activeSessionGrade}] بينما الطالب مقيد في مرحلة [${studentGrade || 'غير محدد'}]!`,
          todayName,
          currentSessionGroup: activeSessionGroups.filter(g => g !== 'all').join(' + ') || (activeSessionGroup !== 'all' ? activeSessionGroup : undefined),
          currentSessionGrade: activeSessionGrade,
          studentGrade: studentGrade || 'غير محدد',
          studentGroup: studentGroupsDisplay
        };
      }
    }

    // 2. SPECIFIC ACTIVE SESSION GROUP(S) VALIDATION (When supervisor selects group(s) in the scanner)
    const activeGroupsList = activeSessionGroups.filter(g => g !== 'all');
    if (activeGroupsList.length > 0 || (activeSessionGroup && activeSessionGroup !== 'all')) {
      const targetActiveGroups = activeGroupsList.length > 0 ? activeGroupsList : [activeSessionGroup];

      if (studentGroupsList.length === 0) {
        return {
          isMatch: false,
          reason: `المجموعات الجارية بالقاعة حالياً هي [${targetActiveGroups.join(' أو ')}] بينما الطالب غير مسجل في أي مجموعة!`,
          todayName,
          currentSessionGroup: targetActiveGroups.join(' + '),
          currentSessionGrade: activeSessionGrade !== 'all' ? activeSessionGrade : undefined,
          studentGrade: studentGrade || 'غير محدد',
          studentGroup: 'غير محدد'
        };
      }

      // Normalization comparison (removes "مجموعة", "صباحاً", spaces, hyphens for robust matching)
      const normalize = (str: string) => str
        .toLowerCase()
        .replace(/مجموعة/g, '')
        .replace(/صباحاً|صباحا|ص/g, '')
        .replace(/مساءً|مساء|م/g, '')
        .replace(/[\s\-_:.]/g, '');

      const isMatch = studentGroupsList.some(sg => 
        targetActiveGroups.some(ag => normalize(ag) === normalize(sg))
      );

      if (!isMatch) {
        return {
          isMatch: false,
          reason: `المجموعات الجارية بالقاعة حالياً هي [${targetActiveGroups.join(' أو ')}] بينما مجموعة الطالب المسجلة هي [${studentGroupsDisplay}]`,
          todayName,
          currentSessionGroup: targetActiveGroups.join(' + '),
          currentSessionGrade: activeSessionGrade !== 'all' ? activeSessionGrade : undefined,
          studentGrade: studentGrade || 'غير محدد',
          studentGroup: studentGroupsDisplay
        };
      }

      return { 
        isMatch: true, 
        todayName, 
        currentSessionGroup: targetActiveGroups.join(' + '),
        currentSessionGrade: activeSessionGrade !== 'all' ? activeSessionGrade : undefined,
        studentGrade,
        studentGroup: studentGroupsDisplay
      };
    }

    // 3. GENERAL DAY-BASED VALIDATION (When all groups are selected)
    if (studentGroupsList.length === 0) {
      return { 
        isMatch: true, 
        todayName,
        currentSessionGrade: activeSessionGrade !== 'all' ? activeSessionGrade : undefined,
        studentGrade,
        studentGroup: studentGroupsDisplay
      };
    }

    // Check if any of student's groups matches today
    const anyMatchesToday = studentGroupsList.some(grp => {
      const grpLower = grp.toLowerCase();
      const hasSat = grpLower.includes('سبت');
      const hasTue = grpLower.includes('تلات') || grpLower.includes('ثلاثاء');
      const hasSun = grpLower.includes('حد') || grpLower.includes('أحد') || grpLower.includes('احد');
      const hasWed = grpLower.includes('اربع') || grpLower.includes('أربع') || grpLower.includes('أربعاء') || grpLower.includes('اربعاء');
      const hasMon = grpLower.includes('اتنين') || grpLower.includes('إثنين') || grpLower.includes('اثنين');
      const hasThu = grpLower.includes('خميس');
      const hasFri = grpLower.includes('جمعة') || grpLower.includes('جمعه');

      if (hasSat && hasTue) return todayDay === 6 || todayDay === 2;
      if (hasSun && hasWed) return todayDay === 0 || todayDay === 3;
      if (hasMon && hasThu) return todayDay === 1 || todayDay === 4;
      if (hasFri) return todayDay === 5;
      if (hasSat && !hasTue) return todayDay === 6;
      if (hasSun && !hasWed) return todayDay === 0;
      if (hasMon && !hasThu) return todayDay === 1;
      if (hasTue && !hasSat) return todayDay === 2;
      if (hasWed && !hasSun) return todayDay === 3;
      if (hasThu && !hasMon) return todayDay === 4;
      return true;
    });

    if (!anyMatchesToday) {
      return {
        isMatch: false,
        reason: `مجموعات الطالب (${studentGroupsDisplay}) لا تتطابق مع مواعيد اليوم (${todayName})`,
        todayName,
        currentSessionGrade: activeSessionGrade !== 'all' ? activeSessionGrade : undefined,
        studentGrade,
        studentGroup: studentGroupsDisplay
      };
    }

    return { isMatch: true, todayName, studentGrade, studentGroup: studentGroupsDisplay };
  };

  // Filter students for search with useMemo to ensure 0ms lag
  const filteredStudents = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    return users.filter(u => {
      const nameMatch = (u.name || '').toLowerCase().includes(q);
      const codeMatch = (u.code || '').toLowerCase().includes(q);
      const phoneMatch = (u.phone || '').includes(q);
      const parentPhoneMatch = (u.parentPhone || '').includes(q);
      return nameMatch || codeMatch || phoneMatch || parentPhoneMatch;
    }).slice(0, 10);
  }, [users, searchQuery]);

  // Clean code extractor (handles raw code, barcode text, or parent-report URL)
  const extractCleanCode = (input: string): string => {
    let clean = input.trim();
    if (clean.includes('/parent-report/')) {
      const parts = clean.split('/parent-report/');
      clean = parts[parts.length - 1].split('?')[0].split('#')[0];
    }
    return clean.replace(/[^a-zA-Z0-9_\-\u0600-\u06FF]/g, '').toLowerCase();
  };

  // Find student by code, barcode, or phone
  const findStudentByInput = (raw: string): AppUser | undefined => {
    const clean = extractCleanCode(raw);
    if (!clean) return undefined;

    // Fast O(1) check
    const directMatch = codeMap.get(clean);
    if (directMatch) return directMatch;

    return users.find(u => {
      const studentCode = (u.code || '').toLowerCase();
      const studentUid = (u.uid || '').toLowerCase();
      const studentPhone = (u.phone || '').trim();
      const studentPromo = (u.promoCode || '').toLowerCase();
      const studentCardQr = (u.cardQrCode || '').toLowerCase();
      const studentExternal = (u.externalCardCode || '').toLowerCase();
      return studentCode === clean || 
             studentUid === clean || 
             studentPhone === clean || 
             studentPromo === clean ||
             studentCardQr === clean ||
             studentExternal === clean ||
             (studentCode && clean.includes(studentCode)) ||
             (studentPromo && clean.includes(studentPromo)) ||
             (studentCardQr && clean.includes(studentCardQr));
    });
  };

  // Instant Attendance Marking (Optimistic UI - No Lag)
  const handleMarkAttendance = (student: AppUser, status: 'present' | 'absent' | 'late' = 'present', extraNotes?: string) => {
    const now = new Date();
    const dateStr = now.toLocaleDateString('ar-EG', { year: 'numeric', month: '2-digit', day: '2-digit' });
    const timeStr = now.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });

    // Check duplicate scan: if student was already marked present or late today
    const alreadyAttended = attendanceList.find(a => a.studentId === student.uid && a.date === dateStr && (a.status === 'present' || a.status === 'late'));
    if (alreadyAttended && status === 'present') {
      playErrorBuzzerBeep();
      setActionAlert({
        type: 'attendance',
        title: `⛔ تم تسجيل حضور (${student.name}) مسبقاً اليوم!`,
        details: `سجل الطالب حضوره بالفعل الساعة ${alreadyAttended.time} اليوم - تم رفض المسح المكرر لمنع الازدواجية.`,
        studentName: student.name,
        studentCode: student.code,
        student
      });
      setScanCode('');
      return;
    }

    const attId = `att_${student.uid}_${Date.now()}`;

    let combinedNotes = attendingNotes;
    if (extraNotes) {
      combinedNotes = combinedNotes ? `${combinedNotes} - ${extraNotes}` : extraNotes;
    } else if (!combinedNotes) {
      if (isExtraSessionMode) {
        combinedNotes = status === 'present'
          ? `حضور بالحصة الإضافية (${extraSessionName})`
          : status === 'late'
            ? `حضور متأخر بالحصة الإضافية (${extraSessionName})`
            : `غياب عن الحصة الإضافية (${extraSessionName})`;
      } else {
        combinedNotes = status === 'present' ? 'حضور منتظم بالسنتر' : status === 'late' ? 'حضور متأخر' : 'غياب';
      }
    }

    const rec: AttendanceRecord = {
      id: attId,
      studentId: student.uid,
      studentName: student.name,
      studentCode: student.code || '',
      date: dateStr,
      time: timeStr,
      status,
      timestamp: Date.now(),
      notes: combinedNotes
    };

    // 1. Optimistic Update (Immediate 0ms local state update)
    setAttendanceList(prev => [rec, ...prev.filter(p => p.id !== attId)]);
    playScannerBeep();

    const statusText = status === 'present' ? 'حاضر ✅' : status === 'late' ? 'متأخر ⏳' : 'غائب ❌';

    // 2. Prepare WhatsApp notification link
    let whatsappUrl: string | undefined = undefined;
    if (student.parentPhone) {
      const origin = window.location.origin;
      const reportLink = `${origin}/parent-report/${student.code || student.uid}`;
      const sessionLabel = isExtraSessionMode ? `الحصة الإضافية [${extraSessionName}]` : `[${student.centerGroup || 'السنتر'}]`;
      const msg = `السلام عليكم ورحمة الله، ولي أمر الطالب: ${student.name}.\nنحيط سيادتكم علماً بأنه تم تسجيل حضور الطالب اليوم (${dateStr} الساعة ${timeStr}) بالسنتر كـ: [${statusText}].\nالمجموعة / الحصة: ${sessionLabel}\n\n📌 يمكنكم متابعة التقرير الشامل ومواعيد ودرجات الطالب عبر الرابط:\n${reportLink}`;
      whatsappUrl = buildWhatsAppUrl(student.parentPhone, msg);
    }

    // 3. Show high-visibility action alert with WhatsApp button
    setActionAlert({
      type: 'attendance',
      title: `تم تسجيل حضور (${student.name}) كـ [${statusText}] بنجاح!`,
      details: `بتاريخ ${dateStr} - ${timeStr} • ${combinedNotes}`,
      studentName: student.name,
      studentCode: student.code,
      whatsappUrl,
      student
    });

    setScanCode('');

    // 4. Background Firestore Sync
    setDoc(doc(db, 'attendance', attId), rec).catch(err => {
      console.error('Attendance sync error:', err);
    });

    // Parent & In-app Notification for attendance scan
    try {
      const parentNotifRef = doc(collection(db, 'parent_notifications'));
      setDoc(parentNotifRef, {
        studentId: student.uid,
        studentCode: student.code || '',
        studentName: student.name,
        type: 'attendance',
        title: `حضور جديد: ${statusText}`,
        message: `تم تسجيل حضور الطالب ${student.name} كـ [${statusText}] بتاريخ ${dateStr} الساعة ${timeStr} بالمجموعة ${student.centerGroup || 'السنتر'}`,
        createdAt: Date.now()
      }).catch(() => {});

      const studentNotifRef = doc(collection(db, 'notifications'));
      setDoc(studentNotifRef, {
        userId: student.uid,
        title: `تسجيل حضور: ${statusText}`,
        message: `تم تسجيل حضورك اليوم (${dateStr} - ${timeStr}) بالسنتر كـ [${statusText}]`,
        read: false,
        createdAt: Date.now()
      }).catch(() => {});
    } catch (e) {
      console.warn('Attendance notification error:', e);
    }

    if (status === 'present') {
      updateDoc(doc(db, 'users', student.uid), {
        attendanceCount: increment(1)
      }).catch(() => {});
    } else if (status === 'absent') {
      updateDoc(doc(db, 'users', student.uid), {
        absentCount: increment(1)
      }).catch(() => {});
    }
  };

  // Route attendance through Group Schedule and Weekly Cycle validation
  const checkAndMarkAttendance = (student: AppUser, status: 'present' | 'absent' | 'late' = 'present', allowOverride: boolean = false) => {
    // 1. Validate Double Scan & Weekly Cycle (Cycle 1: Sat/Sun/Mon, Cycle 2: Tue/Wed/Thu)
    const cycleValidation = validateStudentAttendanceCycle(student, attendanceList as any);

    if (cycleValidation.isDoubleScanToday && !allowOverride) {
      playErrorBuzzerBeep();
      setActionAlert({
        type: 'attendance',
        title: cycleValidation.title,
        details: cycleValidation.message,
        studentName: student.name,
        studentCode: student.code,
        student
      });
      setScanCode('');
      return;
    }

    if (cycleValidation.isCycleDuplicate && !allowOverride) {
      playErrorBuzzerBeep();
      setGroupWarning({
        student,
        reason: cycleValidation.message,
        todayName: getDayName(new Date().getDay()),
        status,
        studentGrade: student.grade,
        studentGroup: student.centerGroup,
        isCycleDuplicate: true
      });
      return;
    }

    if (!allowOverride) {
      if (cycleValidation.isAlternativeDay) {
        // Missed original group day, offering prompt for alternative day attendance
        setGroupWarning({
          student,
          reason: cycleValidation.message,
          todayName: getDayName(new Date().getDay()),
          status,
          studentGrade: student.grade,
          studentGroup: student.centerGroup,
          isAlternativeDay: true
        });
        return;
      }

      const schedule = checkGroupSchedule(student);
      if (!schedule.isMatch) {
        setGroupWarning({
          student,
          reason: schedule.reason || `اليوم ليس موعد مجموعة الطالب (${schedule.todayName})`,
          todayName: schedule.todayName,
          status,
          currentSessionGroup: schedule.currentSessionGroup,
          currentSessionGrade: schedule.currentSessionGrade,
          studentGrade: schedule.studentGrade,
          studentGroup: schedule.studentGroup
        });
        return;
      }
    }

    const overrideDetails = [
      activeSessionGrade !== 'all' ? `مرحلة: ${activeSessionGrade}` : null,
      activeSessionGroup !== 'all' ? `مجموعة: ${activeSessionGroup}` : 'في غير موعد مجموعته'
    ].filter(Boolean).join(' • ');

    handleMarkAttendance(
      student, 
      status, 
      allowOverride 
        ? `⚠️ حضور استثنائي (${overrideDetails})` 
        : undefined
    );
    setGroupWarning(null);
  };

  // Submit scan from text input or barcode gun
  const handleScanSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!scanCode.trim()) return;

    const found = findStudentByInput(scanCode);
    if (found) {
      setSelectedStudent(found);
      setScanCode('');
      if (scanInspectionMode) {
        setGateInspectionStudent(found);
        playScannerBeep();
        if (autoMarkAttendanceOnScan) {
          checkAndMarkAttendance(found, attendingStatus);
        }
      } else {
        checkAndMarkAttendance(found, attendingStatus);
      }
    } else {
      playErrorBuzzerBeep();
      alert(`لم يتم العثور على طالب بالكود: "${scanCode.trim()}". يرجى التأكد من الكود أو البحث باسم الطالب.`);
    }
  };

  // Handle detection from camera barcode scanner
  const handleCameraScan = (scannedValue: string) => {
    const found = findStudentByInput(scannedValue);
    if (found) {
      setSelectedStudent(found);
      if (scanInspectionMode) {
        setGateInspectionStudent(found);
        playScannerBeep();
        if (autoMarkAttendanceOnScan) {
          checkAndMarkAttendance(found, attendingStatus);
        }
      } else {
        checkAndMarkAttendance(found, attendingStatus);
      }
    } else {
      playErrorBuzzerBeep();
      alert(`تم قراءة الكود: "${scannedValue}" ولكن لم يتم العثور على طالب مطابق.`);
    }
  };

  // Gate Admission Callbacks
  const handleGateAdmit = (student: AppUser, status: 'present' | 'late', notes?: string) => {
    handleMarkAttendance(student, status, notes);
    setGateInspectionStudent(null);
  };

  const handleGateReject = (student: AppUser, reason: string, whatsappMsg?: string) => {
    setGateInspectionStudent(null);
    playErrorBuzzerBeep();
    // If student was already marked present today, mark as absent with reject note
    handleMarkAttendance(student, 'absent', `منع دخول عند البوابة: ${reason}`);
    setActionAlert({
      type: 'attendance',
      title: `⛔ تم منع دخول الطالب (${student.name})`,
      details: `السبب: ${reason}`,
      studentName: student.name,
      studentCode: student.code,
      student,
      whatsappUrl: whatsappMsg && student.parentPhone ? buildWhatsAppUrl(student.parentPhone, whatsappMsg) : undefined
    });
  };

  const handleQuickPayAndAdmit = async (student: AppUser, amount: number, month: string) => {
    const now = new Date();
    const receiptNumber = `REC-${Math.floor(100000 + Math.random() * 900000)}`;
    const payId = `pay_${Date.now()}`;
    const dateStr = now.toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' });

    const newPay: CenterPayment = {
      id: payId,
      studentId: student.uid,
      studentName: student.name,
      studentCode: student.code || '',
      amount: amount || 200,
      month: month || effectivePaymentMonth,
      date: dateStr,
      timestamp: Date.now(),
      receiptNumber,
      receivedBy: 'مشرف البوابة (تحصيل فوري)',
      notes: 'تم سداد المصاريف عند بوابة الدخول',
      createdAt: Date.now()
    };

    setPaymentList(prev => [newPay, ...prev]);
    try {
      await setDoc(doc(db, 'center_payments', payId), newPay);
    } catch (e) {
      console.error("Error saving quick payment:", e);
    }

    handleMarkAttendance(student, 'present', `تم سداد مصاريف (${newPay.month}) - إيصال #${receiptNumber}`);
    setGateInspectionStudent(null);
  };

  // Multi-Slot Extra Sessions Handlers
  const handleSaveExtraPlan = async (newPlan: MultiSlotExtraSession) => {
    setExtraSessionPlans(prev => {
      const filtered = prev.filter(p => p.id !== newPlan.id);
      const updated = [newPlan, ...filtered];
      try { localStorage.setItem('saber_extra_session_plans', JSON.stringify(updated)); } catch {}
      return updated;
    });
    setIsExtraSessionMode(true);
    setExtraSessionName(newPlan.title);
    setIsExtraSessionModalOpen(false);

    try {
      await setDoc(doc(db, 'extra_sessions', newPlan.id), newPlan);
    } catch (e) {
      console.warn("Failed to persist extra session to Firestore (offline fallback used):", e);
    }
  };

  const handleDeleteExtraPlan = async (planId: string) => {
    setExtraSessionPlans(prev => {
      const updated = prev.filter(p => p.id !== planId);
      try { localStorage.setItem('saber_extra_session_plans', JSON.stringify(updated)); } catch {}
      if (updated.length === 0) setIsExtraSessionMode(false);
      return updated;
    });

    try {
      await deleteDoc(doc(db, 'extra_sessions', planId));
    } catch (e) {
      console.warn("Failed to delete extra session from Firestore:", e);
    }
  };

  const handleToggleExtraPlanActive = async (planId: string, isActive: boolean) => {
    setExtraSessionPlans(prev => {
      const updated = prev.map(p => p.id === planId ? { ...p, isActive } : p);
      try { localStorage.setItem('saber_extra_session_plans', JSON.stringify(updated)); } catch {}
      return updated;
    });
    setIsExtraSessionMode(isActive);

    try {
      await updateDoc(doc(db, 'extra_sessions', planId), { isActive });
    } catch (e) {
      console.warn("Failed to update extra session status in Firestore:", e);
    }
  };

  // Effective Payment Month
  const effectivePaymentMonth = paymentMonth === 'مخصص...' 
    ? (customMonthInput.trim() || 'شهر مخصص') 
    : paymentMonth;

  // Record Payment & Prepare Receipt
  const handleRecordPayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudent) {
      alert('يرجى اختيار الطالب أولاً لتسجيل دفعة السنتر');
      return;
    }

    const now = new Date();
    const receiptNumber = `REC-${Math.floor(100000 + Math.random() * 900000)}`;
    const payId = `pay_${Date.now()}`;
    const dateStr = now.toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' });

    const newPay: CenterPayment = {
      id: payId,
      studentId: selectedStudent.uid,
      studentName: selectedStudent.name,
      studentCode: selectedStudent.code || '',
      month: effectivePaymentMonth,
      amount: Number(paymentAmount),
      date: dateStr,
      timestamp: Date.now(),
      notes: paymentNotes,
      receiptNumber
    };

    // 1. Optimistic Update (Immediate 0ms)
    setPaymentList(prev => [newPay, ...prev]);
    playScannerBeep();

    // 2. WhatsApp Notification URL
    let whatsappUrl: string | undefined = undefined;
    if (selectedStudent.parentPhone) {
      const msg = `السلام عليكم ورحمة الله، ولي أمر الطالب: ${selectedStudent.name}.\nتم استلام سداد مصاريف السنتر لشهر (${effectivePaymentMonth}) بمبلغ: ${paymentAmount} ج.م.\nرقم الإيصال: ${receiptNumber} بتاريخ ${dateStr}.\nشاكرين تعاونكم والتزامكم الدائم ✨`;
      whatsappUrl = buildWhatsAppUrl(selectedStudent.parentPhone, msg);
    }

    // 3. Set Action Alert
    setActionAlert({
      type: 'payment',
      title: `تم تسجيل سداد (${selectedStudent.name}) بمبلغ ${paymentAmount} ج.م بنجاح!`,
      details: `رقم الإيصال: ${receiptNumber} • شهر: ${effectivePaymentMonth}`,
      studentName: selectedStudent.name,
      studentCode: selectedStudent.code,
      whatsappUrl,
      paymentRecord: newPay,
      student: selectedStudent
    });

    setPaymentNotes('');

    // 4. Background Firestore write
    setDoc(doc(db, 'center_payments', payId), newPay).catch(err => {
      console.error('Payment sync error:', err);
    });
  };

  // Delete Payment Record
  const handleDeletePayment = async (pay: CenterPayment) => {
    if (!confirm(`هل أنت متأكد من حذف وإلغاء إيصال السداد رقم (${pay.receiptNumber}) الخاص بالطالب (${pay.studentName}) بمبلغ ${pay.amount} ج.م؟\nلا يمكن التراجع عن هذا الإجراء.`)) {
      return;
    }
    try {
      setPaymentList(prev => prev.filter(p => p.id !== pay.id));
      await deleteDoc(doc(db, 'center_payments', pay.id));
    } catch (err) {
      console.error('Error deleting payment:', err);
      alert('حدث خطأ أثناء حذف الإيصال');
    }
  };

  // Record Recitation Grade (Advanced rules for Cancellation, Missed, and Makeup)
  const handleRecordRecitation = (e: React.FormEvent) => {
    e.preventDefault();

    const now = new Date();
    const dateStr = now.toLocaleDateString('ar-EG', { year: 'numeric', month: '2-digit', day: '2-digit' });

    // 1. Session Cancellation Case
    if (recitationType === 'cancel_session') {
      const recId = `rec_cancel_${Date.now()}`;
      const cancelRecord: RecitationRecord = {
        id: recId,
        studentId: selectedStudent?.uid || 'all_session',
        studentName: selectedStudent ? selectedStudent.name : 'جميع طلاب الحصة',
        studentCode: selectedStudent?.code || '',
        title: recTitle || 'إلغاء التسميع للحصة',
        score: 0,
        finalGrade: recFinalGrade || 10,
        percentage: 0,
        date: dateStr,
        timestamp: Date.now(),
        notes: recNotes || 'تم إلغاء التسميع رسمياً من قبل المعلم لهذه الحصة',
        status: 'cancelled',
        isCancelled: true,
        isCounted: false
      };

      setRecitationList(prev => [cancelRecord, ...prev]);
      setDoc(doc(db, 'recitations', recId), cancelRecord).catch(() => {});

      setActionAlert({
        type: 'recitation',
        title: `✅ تم تسجيل إلغاء التسميع لهذه الحصة رسمياً!`,
        details: `لن يتم احتساب هذا التسميع في درجات أو غياب الطلاب، ولن يتم إرسال أي إشعار غياب لأولياء الأمور.`,
        studentName: selectedStudent?.name || 'الجميع',
        studentCode: selectedStudent?.code
      });
      return;
    }

    if (!selectedStudent) {
      alert('يرجى اختيار الطالب أولاً');
      return;
    }

    // 2. Missed Recitation Case (Student missed while peers recitated)
    if (recitationType === 'missed') {
      const recId = `rec_missed_${selectedStudent.uid}_${Date.now()}`;
      const missedRec: RecitationRecord = {
        id: recId,
        studentId: selectedStudent.uid,
        studentName: selectedStudent.name,
        studentCode: selectedStudent.code || '',
        title: recTitle,
        score: 0,
        finalGrade: recFinalGrade || 10,
        percentage: 0,
        date: dateStr,
        timestamp: Date.now(),
        notes: recNotes ? `غياب عن التسميع - ${recNotes}` : 'غياب عن التسميع في موعد الحصة',
        status: 'missed',
        isCounted: true
      };

      setRecitationList(prev => [missedRec, ...prev]);
      setDoc(doc(db, 'recitations', recId), missedRec).catch(() => {});

      let whatsappUrl: string | undefined = undefined;
      if (selectedStudent.parentPhone) {
        const msg = `السلام عليكم ورحمة الله، ولي أمر الطالب: ${selectedStudent.name}.\nنحيطكم علماً بأن الطالب تغيب عن تسميع اليوم بالسنتر [${recTitle}]، وتم رصد الدرجة (0) مؤقتاً.\nيمكن للطالب إجراء التسميع التعويضي قبل موعد حصته القادمة لاعتماد الدرجة.`;
        whatsappUrl = buildWhatsAppUrl(selectedStudent.parentPhone, msg);
      }

      setActionAlert({
        type: 'recitation',
        title: `⚠️ تم تسجيل غياب (${selectedStudent.name}) عن التسميع (الدرجة: 0)`,
        details: `تم إشعار ولي الأمر؛ ويمكن للطالب الحضور للتسميع التعويضي قبل موعد حصته التالية لاعتماد الدرجة.`,
        studentName: selectedStudent.name,
        studentCode: selectedStudent.code,
        whatsappUrl,
        student: selectedStudent
      });
      return;
    }

    // 3. Make-up or Normal Recitation
    const s = Number(recScore);
    const fg = Number(recFinalGrade) || 10;
    const percentage = Math.round((s / fg) * 100);
    const recId = `rec_${Date.now()}`;

    const isMakeup = recitationType === 'makeup';
    const isAcceptedMakeup = isMakeup && makeupTiming === 'before_next';
    const isExpiredMakeup = isMakeup && makeupTiming === 'after_next';

    const recStatus = isAcceptedMakeup 
      ? 'makeup_accepted' 
      : isExpiredMakeup 
      ? 'makeup_expired' 
      : 'completed';

    const isCounted = !isExpiredMakeup;

    const rec: RecitationRecord = {
      id: recId,
      studentId: selectedStudent.uid,
      studentName: selectedStudent.name,
      studentCode: selectedStudent.code || '',
      title: isMakeup ? `[تسميع تعويضي] ${recTitle}` : recTitle,
      score: s,
      finalGrade: fg,
      percentage,
      date: dateStr,
      timestamp: Date.now(),
      notes: isExpiredMakeup ? `حضر بعد انتهاء موعد الحصة التالية (لا تُحتسب بالمجموع) - ${recNotes}` : recNotes,
      status: recStatus,
      isMakeup,
      makeupTiming,
      isCounted
    };

    // Optimistic update
    setRecitationList(prev => [rec, ...prev]);
    playScannerBeep();

    // WhatsApp Notification URL
    let whatsappUrl: string | undefined = undefined;
    if (selectedStudent.parentPhone) {
      let msg = '';
      if (isAcceptedMakeup) {
        msg = `السلام عليكم ورحمة الله، ولي أمر الطالب: ${selectedStudent.name}.\nيسعدنا إبلاغكم بنتيجة التسميع التعويضي (قبل موعد الحصة التالية):\n- العنوان: ${recTitle}\n- الدرجة: ${s} من ${fg} (${percentage}%)\n- الحالة: تم اعتماد الدرجة بنجاح وإلغاء الصفر السابق ✅.`;
      } else if (isExpiredMakeup) {
        msg = `السلام عليكم ورحمة الله، ولي أمر الطالب: ${selectedStudent.name}.\nحضر الطالب للتسميع التعويضي بعد انتهاء موعد الحصة التالية؛ ووفقاً للائحة السنتر لم يتم احتساب الدرجة في المجموع، وتم رصد مستواه (${s}/${fg}) كملاحظة استرشادية فقط.`;
      } else {
        msg = `السلام عليكم ورحمة الله، ولي أمر الطالب: ${selectedStudent.name}.\nنحيطكم علماً بنتيجة التسميع والشفوي اليوم بالسنتر:\n- العنوان: ${recTitle}\n- الدرجة: ${s} من ${fg} (${percentage}%)\n- ملاحظات: ${recNotes || 'مستوى طيب'}\n\nنتمنى له دوام التفوق 🌟`;
      }
      whatsappUrl = buildWhatsAppUrl(selectedStudent.parentPhone, msg);
    }

    // Set Action Alert
    setActionAlert({
      type: 'recitation',
      title: isAcceptedMakeup 
        ? `✅ تم اعتماد التسميع التعويضي (${s}/${fg}) بنجاح!` 
        : isExpiredMakeup 
        ? `⚠️ تسميع تعويضي متأخر (${s}/${fg}) - لا يُحسب في المجموع` 
        : `تم رصد تسميع (${selectedStudent.name}) بنجاح! الدرجة: ${s}/${fg} (${percentage}%)`,
      details: `${recTitle} • ${dateStr}`,
      studentName: selectedStudent.name,
      studentCode: selectedStudent.code,
      whatsappUrl,
      student: selectedStudent
    });

    setRecNotes('');

    // Background Firestore write
    setDoc(doc(db, 'recitations', recId), rec).catch(err => {
      console.error('Recitation sync error:', err);
    });

    // Parent & In-app Notification
    try {
      const parentNotifRef = doc(collection(db, 'parent_notifications'));
      setDoc(parentNotifRef, {
        studentId: selectedStudent.uid,
        studentCode: selectedStudent.code || '',
        studentName: selectedStudent.name,
        type: 'recitation',
        title: isAcceptedMakeup ? `اعتماد تسميع تعويضي: ${s}/${fg}` : `رصد تسميع جديد: ${s}/${fg}`,
        message: isAcceptedMakeup 
          ? `تم رصد تسميع تعويضي للطالب ${selectedStudent.name} قبل موعد حصته القادمة بنجاح (${s}/${fg}) وتم اعتماده.`
          : `تم رصد تسميع للطالب ${selectedStudent.name} بعنوان [${recTitle}] وحصل على ${s} من ${fg} (${percentage}%)`,
        createdAt: Date.now()
      }).catch(() => {});
    } catch (e) {
      console.warn('Recitation notification error:', e);
    }

    // Center Points Tier
    if (isCounted) {
      let bonusPoints = 10;
      if (percentage >= 95) bonusPoints = 50;
      else if (percentage >= 90) bonusPoints = 30;
      else if (percentage >= 80) bonusPoints = 20;

      updateDoc(doc(db, 'users', selectedStudent.uid), {
        totalPoints: increment(bonusPoints),
        centerPoints: increment(bonusPoints)
      }).catch(err => console.error('Error updating points:', err));
    }
  };

  // Filtered Payments List
  const filteredPayments = useMemo(() => {
    const q = paymentSearch.trim().toLowerCase();
    if (!q) return paymentList;
    return paymentList.filter(p => {
      const nameMatch = (p.studentName || '').toLowerCase().includes(q);
      const codeMatch = (p.studentCode || '').toLowerCase().includes(q);
      const recMatch = (p.receiptNumber || '').toLowerCase().includes(q);
      const monthMatch = (p.month || '').toLowerCase().includes(q);
      return nameMatch || codeMatch || recMatch || monthMatch;
    });
  }, [paymentList, paymentSearch]);

  // Unpaid Students List (Center students who have not paid for the active month)
  const currentDayOfMonth = new Date().getDate();
  const isPast14th = currentDayOfMonth >= 14;

  const unpaidStudents = useMemo(() => {
    const paidStudentIds = new Set(
      paymentList.filter(p => p.month === effectivePaymentMonth).map(p => p.studentId)
    );
    const notifiedSet = new Set(notifiedPaymentStudents);

    const centerStudents = users.filter(u => u.isCenterStudent && u.role === 'student');
    const unpaidList = centerStudents.filter(student => !paidStudentIds.has(student.uid));

    // Sort: Students who haven't received a reminder come first!
    // Students who received a reminder (notifiedPaymentStudents) sink to the bottom!
    return unpaidList.sort((a, b) => {
      const aNotified = notifiedSet.has(a.uid) ? 1 : 0;
      const bNotified = notifiedSet.has(b.uid) ? 1 : 0;
      if (aNotified !== bNotified) return aNotified - bNotified;
      return (a.name || '').localeCompare(b.name || '', 'ar');
    });
  }, [users, paymentList, effectivePaymentMonth, notifiedPaymentStudents]);

  // Generate SVG Barcode for Thermal Receipt
  const generateThermalBarcodeSvg = (code: string) => {
    if (!code) return '';
    try {
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      JsBarcode(svg, code, {
        format: 'CODE128',
        width: 1.5,
        height: 32,
        displayValue: true,
        fontSize: 10,
        margin: 2
      });
      return svg.outerHTML;
    } catch {
      return `<div style="font-family:monospace;font-size:12px;font-weight:bold;text-align:center;">*${code}*</div>`;
    }
  };

  // Print Payment Receipt (Standard 80mm Thermal POS Receipt - Kazion / Manshawy Style)
  const printPaymentReceipt = (payment: CenterPayment, student: AppUser) => {
    const receiptCode = payment.receiptNumber || student.code || payment.id.substring(0, 10);
    const barcodeHtml = generateThermalBarcodeSvg(receiptCode);
    const nowTime = new Date(payment.timestamp || Date.now()).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
    const pDate = payment.date || new Date().toLocaleDateString('ar-EG');

    const html = `
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="utf-8">
        <title>إيصال استلام نقدية - ${student.name}</title>
        <style>
          @page {
            size: 80mm auto;
            margin: 0;
          }
          * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            font-family: 'Courier New', Courier, monospace, system-ui, -apple-system, sans-serif;
          }
          body {
            background: #ffffff;
            color: #000000;
            width: 80mm;
            padding: 4mm 4mm;
            margin: 0 auto;
            font-size: 11px;
            line-height: 1.35;
          }
          .thermal-receipt {
            width: 100%;
            display: flex;
            flex-direction: column;
            align-items: stretch;
          }
          .center-header {
            text-align: center;
            border-bottom: 2px dashed #000000;
            padding-bottom: 6px;
            margin-bottom: 6px;
          }
          .store-name {
            font-size: 15px;
            font-weight: 900;
            letter-spacing: -0.3px;
          }
          .teacher-name {
            font-size: 12px;
            font-weight: 700;
            margin-top: 1px;
          }
          .receipt-tag {
            display: inline-block;
            border: 1.5px solid #000;
            padding: 1px 8px;
            font-weight: 900;
            font-size: 11px;
            margin-top: 4px;
          }
          .meta-info {
            padding: 4px 0;
            font-size: 11px;
          }
          .info-row {
            display: flex;
            justify-content: space-between;
            align-items: baseline;
            padding: 1.5px 0;
          }
          .lbl {
            font-weight: 600;
          }
          .val {
            font-weight: 900;
            text-align: left;
            direction: ltr;
          }
          .val-rtl {
            font-weight: 900;
            text-align: left;
          }
          .divider-dashed {
            border-top: 1px dashed #000000;
            margin: 5px 0;
          }
          .divider-double {
            border-top: 2px solid #000000;
            border-bottom: 1px solid #000000;
            height: 3px;
            margin: 6px 0;
          }
          .student-box {
            border-top: 1px dashed #000;
            border-bottom: 1px dashed #000;
            padding: 4px 0;
            margin: 4px 0;
          }
          .st-name {
            font-size: 13px;
            font-weight: 900;
            margin-bottom: 2px;
          }
          .total-section {
            text-align: center;
            padding: 6px 0;
            margin: 4px 0;
          }
          .total-label {
            font-size: 12px;
            font-weight: 800;
          }
          .total-amount {
            font-size: 22px;
            font-weight: 900;
            margin-top: 2px;
          }
          .barcode-wrap {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 4px 0;
          }
          .barcode-wrap svg {
            max-width: 95%;
            height: 34px;
          }
          .signatures {
            display: flex;
            justify-content: space-between;
            font-size: 10px;
            font-weight: bold;
            margin-top: 8px;
            padding-top: 4px;
            border-top: 1px dotted #000;
          }
          .footer-text {
            text-align: center;
            font-size: 10px;
            margin-top: 6px;
            line-height: 1.3;
          }
          .cut-line {
            text-align: center;
            font-size: 9px;
            margin-top: 10px;
            padding-top: 4px;
            border-top: 1px dashed #888;
            color: #444;
          }
        </style>
      </head>
      <body>
        <div class="thermal-receipt">
          <div class="center-header">
            <div class="store-name">${settings.platformName || 'منصة التفوق التعليمية'}</div>
            <div class="teacher-name">${settings.teacherName || 'السنتر الأكاديمي'}</div>
            <div class="receipt-tag">إيصال تحصيل نقدية (POS)</div>
          </div>

          <div class="meta-info">
            <div class="info-row"><span class="lbl">رقم الإيصال:</span><span class="val">#${payment.receiptNumber}</span></div>
            <div class="info-row"><span class="lbl">التاريخ والوقت:</span><span class="val">${pDate} ${nowTime}</span></div>
            <div class="info-row"><span class="lbl">طريقة الدفع:</span><span class="val-rtl">نقداً بالسنتر (خزينة)</span></div>
          </div>

          <div class="student-box">
            <div class="st-name">الطالب: ${student.name}</div>
            <div class="info-row"><span class="lbl">كود الطالب:</span><span class="val">${student.code || student.uid.substring(0, 8)}</span></div>
            <div class="info-row"><span class="lbl">المرحلة / السن:</span><span class="val-rtl">${student.grade || 'غير محدد'}</span></div>
            <div class="info-row"><span class="lbl">المجموعة:</span><span class="val-rtl">${student.centerGroup || '-'}</span></div>
            <div class="info-row"><span class="lbl">اشتراك شهر:</span><span class="val-rtl">${payment.month}</span></div>
            ${payment.notes ? `<div class="info-row"><span class="lbl">ملاحظات:</span><span class="val-rtl">${payment.notes}</span></div>` : ''}
          </div>

          <div class="divider-double"></div>

          <div class="total-section">
            <div class="total-label">المبلغ المدفوع بالخزينة</div>
            <div class="total-amount">${payment.amount} ج.م</div>
            <div style="font-size: 10px; font-weight: bold; margin-top: 2px;">(فقط ${payment.amount} جنيهاً مصرياً لا غير)</div>
          </div>

          <div class="divider-double"></div>

          <div class="barcode-wrap">
            ${barcodeHtml}
          </div>

          <div class="signatures">
            <div>توقيع الخزينة: ________</div>
            <div>استلام الطالب: ________</div>
          </div>

          <div class="footer-text">
            <div>شكراً لالتزامكم ونتمنى للطالب دوام التفوق 🌟</div>
            ${settings.supportPhone ? `<div>خدمة أولياء الأمور: ${settings.supportPhone}</div>` : ''}
          </div>

          <div class="cut-line">
            - - - - - - - - - - - قص الإيصال هنا - - - - - - - - - - -
          </div>
        </div>
      </body>
      </html>
    `;
    printHtmlDocument(html, `إيصال_سداد_${student.name}`);
  };

  // Print Absence Sheet
  const printAbsenceSheet = (title: string, list: AppUser[]) => {
    const rows = list.map((st, idx) => `
      <tr>
        <td style="text-align: center;">${idx + 1}</td>
        <td><b>${st.name}</b></td>
        <td style="font-family: monospace; font-weight: bold;">${st.code || '-'}</td>
        <td>${st.grade || '-'}</td>
        <td>${st.centerGroup || 'مجموعة السبت والثلاثاء'}</td>
        <td style="font-family: monospace;">${st.phone || '-'}</td>
        <td style="font-family: monospace;">${st.parentPhone || '-'}</td>
        <td style="text-align: center; color: #b91c1c; font-weight: bold;">${(st.absentCount || 0)}</td>
        <td></td>
      </tr>
    `).join('');

    const html = `
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="utf-8">
        <title>${title}</title>
        <style>
          @page { size: A4 landscape; margin: 12mm; }
          * { box-sizing: border-box; font-family: system-ui, -apple-system, sans-serif; }
          body { color: #0f172a; padding: 10px; }
          .header { text-align: center; margin-bottom: 20px; border-bottom: 2px solid #334155; padding-bottom: 10px; }
          .header h1 { font-size: 20px; font-weight: 900; margin-bottom: 4px; }
          .header p { font-size: 12px; color: #64748b; }
          table { width: 100%; border-collapse: collapse; font-size: 11px; margin-top: 10px; }
          th, td { border: 1px solid #cbd5e1; padding: 6px 8px; text-align: right; }
          th { background: #f1f5f9; font-weight: bold; color: #1e293b; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>${settings.platformName || 'منصة التفوق'} - ${title}</h1>
          <p>تاريخ استخراج التقرير: ${new Date().toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })} • إجمالي الطلاب: ${list.length}</p>
        </div>
        <table>
          <thead>
            <tr>
              <th style="width: 35px; text-align: center;">#</th>
              <th>اسم الطالب</th>
              <th>الكود</th>
              <th>الصف</th>
              <th>المجموعة</th>
              <th>هاتف الطالب</th>
              <th>هاتف ولي الأمر</th>
              <th style="text-align: center;">مرات الغياب</th>
              <th style="width: 120px;">ملاحظات الإشراف</th>
            </tr>
          </thead>
          <tbody>
            ${rows || '<tr><td colspan="9" style="text-align: center; padding: 20px;">لا يوجد طلاب غائبين في هذه القائمة</td></tr>'}
          </tbody>
        </table>
      </body>
      </html>
    `;
    printHtmlDocument(html, title);
  };

  // Absence Cycle 1: Sat / Sun / Mon
  const satMonStudents = useMemo(() => {
    return users.filter(u => {
      if (!u.isCenterStudent || u.role !== 'student') return false;
      const grp = (u.centerGroup || '').toLowerCase();
      // Belongs to Sat/Tue, Sun/Wed, Mon/Thu, or specific sat/sun/mon
      return grp.includes('سبت') || grp.includes('أحد') || grp.includes('إثنين');
    }).filter(st => {
      const q = absenceSearch.trim().toLowerCase();
      if (!q) return true;
      return (st.name || '').toLowerCase().includes(q) || (st.code || '').toLowerCase().includes(q) || (st.parentPhone || '').includes(q);
    });
  }, [users, absenceSearch]);

  // Absence Cycle 2: Tue / Wed / Thu
  const tueThuStudents = useMemo(() => {
    return users.filter(u => {
      if (!u.isCenterStudent || u.role !== 'student') return false;
      const grp = (u.centerGroup || '').toLowerCase();
      return grp.includes('ثلاثاء') || grp.includes('أربعاء') || grp.includes('خميس');
    }).filter(st => {
      const q = absenceSearch.trim().toLowerCase();
      if (!q) return true;
      return (st.name || '').toLowerCase().includes(q) || (st.code || '').toLowerCase().includes(q) || (st.parentPhone || '').includes(q);
    });
  }, [users, absenceSearch]);

    // Chronic Absence Students (> 2 absences)
  const chronicAbsentStudents = useMemo(() => {
    return users.filter(u => {
      if (!u.isCenterStudent || u.role !== 'student') return false;
      const count = (u.absentCount || 0);
      return count >= 2;
    }).sort((a, b) => (b.absentCount || 0) - (a.absentCount || 0))
    .filter(st => {
      const q = absenceSearch.trim().toLowerCase();
      if (!q) return true;
      return (st.name || '').toLowerCase().includes(q) || (st.code || '').toLowerCase().includes(q) || (st.parentPhone || '').includes(q);
    });
  }, [users, absenceSearch]);

  // Helper to normalize Eastern Arabic numerals to standard digits
  const normalizeDigits = (str: string) => {
    return (str || '').replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString());
  };

  const formatIsoToArDate = (isoDate: string) => {
    if (!isoDate) return '';
    try {
      const d = new Date(isoDate + 'T12:00:00');
      return d.toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    } catch {
      return isoDate;
    }
  };

  const getArDateShort = (isoDate: string) => {
    if (!isoDate) return '';
    try {
      const d = new Date(isoDate + 'T12:00:00');
      return d.toLocaleDateString('ar-EG', { year: 'numeric', month: '2-digit', day: '2-digit' });
    } catch {
      return isoDate;
    }
  };

  // Extra Session Target Students (All students in center or filtered by grade/group)
  const extraSessionTargetStudents = useMemo(() => {
    return users.filter(u => {
      if (!u.isCenterStudent || u.role !== 'student') return false;
      if (extraSessionTargetGrade !== 'all' && (u.grade || '').trim() !== extraSessionTargetGrade.trim()) return false;
      if (extraSessionTargetGroup !== 'all' && !(u.centerGroup || '').includes(extraSessionTargetGroup.trim())) return false;
      return true;
    });
  }, [users, extraSessionTargetGrade, extraSessionTargetGroup]);

  // Students who attended the extra session on selected date
  const extraSessionAttendedIds = useMemo(() => {
    const targetArShort = getArDateShort(extraSessionDate);
    const targetDayStart = new Date(extraSessionDate + 'T00:00:00').getTime();
    const targetDayEnd = new Date(extraSessionDate + 'T23:59:59.999').getTime();
    const attendedSet = new Set<string>();

    attendanceList.forEach(rec => {
      if (rec.status !== 'present' && rec.status !== 'late') return;

      const normRecDate = normalizeDigits(rec.date);
      const normTargetDate = normalizeDigits(targetArShort);

      const matchesTimestamp = rec.timestamp && rec.timestamp >= targetDayStart && rec.timestamp <= targetDayEnd;
      const matchesDateStr = normRecDate && normTargetDate && normRecDate === normTargetDate;

      if (matchesTimestamp || matchesDateStr) {
        attendedSet.add(rec.studentId);
      }
    });

    return attendedSet;
  }, [attendanceList, extraSessionDate]);

  // Students who were absent from the extra session (Target - Attended)
  const extraSessionAbsentStudents = useMemo(() => {
    return extraSessionTargetStudents.filter(st => {
      // Exclude students who attended
      if (extraSessionAttendedIds.has(st.uid)) return false;

      // Filter by search query
      const q = absenceSearch.trim().toLowerCase();
      if (!q) return true;
      return (st.name || '').toLowerCase().includes(q) || 
             (st.code || '').toLowerCase().includes(q) || 
             (st.parentPhone || '').includes(q) || 
             (st.phone || '').includes(q) ||
             (st.grade || '').toLowerCase().includes(q) ||
             (st.centerGroup || '').toLowerCase().includes(q);
    });
  }, [extraSessionTargetStudents, extraSessionAttendedIds, absenceSearch]);

  // Bulk mark all absent students from the extra session
  const handleBulkMarkAbsentExtraSession = async () => {
    if (extraSessionAbsentStudents.length === 0) {
      alert('لا يوجد طلاب غائبين في قائمة الحصة الإضافية حالياً لتسجيلهم.');
      return;
    }

    const confirmMsg = `هل تريد بالتأكيد تسجيل وتثبيت الغياب رسمياً لعدد (${extraSessionAbsentStudents.length}) طالب غائب عن (${extraSessionName}) بتاريخ (${formatIsoToArDate(extraSessionDate)})؟\n\nسيتم حفظ سجل غياب لكل طالب وزيادة عداد مرات الغياب في ملفه وإدراجه في قائمة الغائبين.`;
    if (!confirm(confirmMsg)) return;

    setBulkAbsenceLoading(true);
    const targetArShort = getArDateShort(extraSessionDate);
    const nowTime = new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
    let count = 0;

    try {
      for (const st of extraSessionAbsentStudents) {
        const alreadyAbsent = attendanceList.some(a => a.studentId === st.uid && normalizeDigits(a.date) === normalizeDigits(targetArShort) && a.status === 'absent');
        if (!alreadyAbsent) {
          const attId = `att_extra_abs_${st.uid}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
          const rec: AttendanceRecord = {
            id: attId,
            studentId: st.uid,
            studentName: st.name,
            studentCode: st.code || '',
            date: targetArShort,
            time: nowTime,
            status: 'absent',
            timestamp: Date.now(),
            notes: `غياب عن الحصة/المجموعة الإضافية (${extraSessionName})`
          };

          // Optimistic local state
          setAttendanceList(prev => [rec, ...prev]);

          // Save to Firestore
          await setDoc(doc(db, 'attendance', attId), rec);
          await updateDoc(doc(db, 'users', st.uid), {
            absentCount: increment(1)
          });
          count++;
        }
      }

      alert(`✅ تم بنجاح رصد وتثبيت الغياب لعدد (${count}) طالب غائب عن الحصة الإضافية، وزيادة عداد غيابهم وحفظها في قاعدة البيانات.`);
    } catch (err) {
      console.error('Error in handleBulkMarkAbsentExtraSession:', err);
      alert('حدث خطأ أثناء رصد الغياب الجماعي، يرجى المحاولة ثانية.');
    } finally {
      setBulkAbsenceLoading(false);
    }
  };

  // Mark single student absent from the extra session
  const handleMarkSingleAbsentExtraSession = async (st: AppUser) => {
    const targetArShort = getArDateShort(extraSessionDate);
    const nowTime = new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
    const attId = `att_extra_abs_${st.uid}_${Date.now()}`;
    const rec: AttendanceRecord = {
      id: attId,
      studentId: st.uid,
      studentName: st.name,
      studentCode: st.code || '',
      date: targetArShort,
      time: nowTime,
      status: 'absent',
      timestamp: Date.now(),
      notes: `غياب عن الحصة/المجموعة الإضافية (${extraSessionName})`
    };

    setAttendanceList(prev => [rec, ...prev]);
    try {
      await setDoc(doc(db, 'attendance', attId), rec);
      await updateDoc(doc(db, 'users', st.uid), {
        absentCount: increment(1)
      });
      alert(`تم تسجيل وتثبيت غياب الطالب (${st.name}) عن الحصة الإضافية بنجاح.`);
    } catch (err) {
      console.error('Error marking student absent:', err);
      alert('حدث خطأ أثناء تسجيل الغياب.');
    }
  };

  // Filtered Video Watch Records (Center Students Watch Progression)
  const filteredVideoWatchRecords = useMemo(() => {
    const centerStudents = users.filter(u => u.isCenterStudent);
    const centerStudentMap = new Map<string, AppUser>(centerStudents.map(s => [s.uid, s]));
    const materialsMap = new Map<string, any>(materialsList.map(m => [m.id, m]));

    // Mandatory videos for center: 'center' only or 'all' (platform + center).
    // Online-only videos ('online') are strictly EXCLUDED from being mandatory for center students.
    const centerMandatoryVideos = materialsList.filter(m => {
      const isVideo = m.type === 'video' || (!m.type && m.url);
      const isOnlineOnly = m.targetAudience === 'online';
      return isVideo && !isOnlineOnly;
    });

    const watchedKeys = new Set<string>();
    const records: (VideoProgressRecord & { targetAudience?: string; isUnwatchedAbsent?: boolean })[] = [];

    // 1. Existing watched progress
    videoProgressList.forEach(rec => {
      if (!rec.isCenterStudent && !centerStudentMap.has(rec.studentId)) return;
      const mat = materialsMap.get(rec.materialId);
      // Skip if this material is marked online-only
      if (mat && mat.targetAudience === 'online') return;

      const student = centerStudentMap.get(rec.studentId);
      watchedKeys.add(`${rec.studentId}_${rec.materialId}`);

      records.push({
        ...rec,
        studentName: rec.studentName || student?.name || 'طالب غير معروف',
        studentCode: rec.studentCode || student?.code || '-',
        studentPhone: rec.studentPhone || student?.phone || '',
        parentPhone: rec.parentPhone || student?.parentPhone || (student as any)?.fatherPhone || '',
        grade: rec.grade || student?.grade || 'غير محدد',
        centerGroup: rec.centerGroup || (Array.isArray((student as any)?.centerGroups) ? (student as any)?.centerGroups.join('، ') : student?.centerGroup) || 'غير محدد',
        targetAudience: mat?.targetAudience || 'all',
        isUnwatchedAbsent: false
      });
    });

    // 2. Center students who have NOT watched mandatory center videos (0% / Absent)
    centerStudents.forEach(student => {
      centerMandatoryVideos.forEach(mat => {
        // Match grade if specified
        if (mat.grade && student.grade && mat.grade.trim() !== student.grade.trim()) {
          return;
        }

        const key = `${student.uid}_${mat.id}`;
        if (!watchedKeys.has(key)) {
          records.push({
            id: `unwatched_${student.uid}_${mat.id}`,
            studentId: student.uid,
            materialId: mat.id,
            materialTitle: mat.title || 'حصة فيديو إلزامية',
            studentName: student.name,
            studentCode: student.code || '-',
            studentPhone: student.phone || '',
            parentPhone: student.parentPhone || (student as any)?.fatherPhone || '',
            grade: student.grade || 'غير محدد',
            centerGroup: (Array.isArray((student as any)?.centerGroups) ? (student as any)?.centerGroups.join('، ') : student?.centerGroup) || 'غير محدد',
            percentage: 0,
            isCenterStudent: true,
            targetAudience: mat.targetAudience || 'all',
            isUnwatchedAbsent: true,
            updatedAt: mat.createdAt || 0
          });
        }
      });
    });

    let filtered = records;

    // Apply Threshold Filter
    if (videoWatchThreshold === 'less50') {
      filtered = filtered.filter(r => (r.percentage || 0) < 50);
    } else if (videoWatchThreshold === 'less25') {
      filtered = filtered.filter(r => (r.percentage || 0) < 25);
    } else if (videoWatchThreshold === 'zero') {
      filtered = filtered.filter(r => (r.percentage || 0) === 0);
    }

    // Apply Grade Filter
    if (videoWatchGrade !== 'all') {
      filtered = filtered.filter(r => (r.grade || '').trim() === videoWatchGrade.trim());
    }

    // Apply Group Filter
    if (videoWatchGroup !== 'all') {
      filtered = filtered.filter(r => (r.centerGroup || '').includes(videoWatchGroup.trim()));
    }

    // Apply Search Filter
    if (videoWatchSearch.trim()) {
      const s = videoWatchSearch.toLowerCase().trim();
      filtered = filtered.filter(r => 
        (r.studentName || '').toLowerCase().includes(s) ||
        (r.studentCode || '').toLowerCase().includes(s) ||
        (r.materialTitle || '').toLowerCase().includes(s) ||
        (r.studentPhone || '').includes(s) ||
        (r.parentPhone || '').includes(s)
      );
    }

    return filtered;
  }, [users, videoProgressList, materialsList, videoWatchThreshold, videoWatchGrade, videoWatchGroup, videoWatchSearch]);

  const handlePrintVideoWatchReport = () => {
    const list = filteredVideoWatchRecords;
    const title = videoWatchThreshold === 'less50' 
      ? 'كشف طلاب السنتر المشاهدين لأقل من 50% من الفيديوهات' 
      : 'كشف متابعة مشاهدات الفيديوهات لطلاب السنتر';

    const rows = list.map((item, idx) => {
      return `
        <tr>
          <td style="text-align: center; font-weight: bold;">${idx + 1}</td>
          <td style="font-weight: bold;">${item.studentName}</td>
          <td style="text-align: center; font-family: monospace;">${item.studentCode || '-'}</td>
          <td>${item.grade}</td>
          <td>${item.centerGroup}</td>
          <td style="font-weight: 600;">${item.materialTitle}</td>
          <td style="text-align: center; font-weight: bold; color: ${item.percentage < 50 ? '#dc2626' : '#16a34a'};">
            ${item.percentage}% ${item.percentage < 50 ? '⚠️ (أقل من 50%)' : '✅'}
          </td>
          <td style="direction: ltr; text-align: center;">${item.parentPhone || item.studentPhone || '-'}</td>
          <td style="text-align: center;">${item.updatedAt ? new Date(item.updatedAt).toLocaleDateString('ar-EG') : '-'}</td>
        </tr>
      `;
    }).join('');

    const html = `
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="utf-8" />
        <title>${title}</title>
        <style>
          body { font-family: system-ui, -apple-system, sans-serif; padding: 24px; color: #0f172a; margin: 0; }
          .header { text-align: center; margin-bottom: 20px; border-bottom: 2px solid #334155; padding-bottom: 12px; }
          .header h1 { font-size: 20px; font-weight: 900; margin-bottom: 4px; }
          .header p { font-size: 12px; color: #64748b; }
          .alert-box { background: #fee2e2; border: 1px solid #ef4444; color: #991b1b; padding: 10px; border-radius: 8px; font-size: 11px; font-weight: bold; margin-bottom: 15px; }
          table { width: 100%; border-collapse: collapse; font-size: 11px; margin-top: 10px; }
          th, td { border: 1px solid #cbd5e1; padding: 6px 8px; text-align: right; }
          th { background: #f1f5f9; font-weight: bold; color: #1e293b; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>${settings.platformName || 'منصة التفوق الأكاديمية'} - ${title}</h1>
          <p>تاريخ الاستخراج: ${new Date().toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })} • إجمالي السجلات: ${list.length}</p>
        </div>
        <div class="alert-box">
          ⚠️ تنبيه الإشراف: هؤلاء الطلاب مسجلون بالسنتر وحققوا نسب مشاهدة تقل عن 50% من مدة الشرح المقررة. يتطلب الأمر التواصل الفوري مع ولي الأمر.
        </div>
        <table>
          <thead>
            <tr>
              <th style="width: 35px; text-align: center;">#</th>
              <th>اسم الطالب</th>
              <th style="text-align: center;">الكود</th>
              <th>الصف</th>
              <th>المجموعة</th>
              <th>اسم المحاضرة / الفيديو</th>
              <th style="text-align: center;">نسبة المشاهدة</th>
              <th style="text-align: center;">هاتف ولي الأمر</th>
              <th style="text-align: center;">آخر مشاهدة</th>
            </tr>
          </thead>
          <tbody>
            ${rows || '<tr><td colspan="9" style="text-align: center; padding: 25px; font-weight: bold; color: #15803d;">ممتاز! لا يوجد أي طالب سنتر لديه نسبة مشاهدة أقل من 50% حالياً 🎉</td></tr>'}
          </tbody>
        </table>
      </body>
      </html>
    `;
    printHtmlDocument(html, title);
  };

  const handleUpdateVideoProgress = async (record: VideoProgressRecord, newPercentage: number) => {
    try {
      const docRef = doc(db, 'video_progress', record.id);
      await updateDoc(docRef, {
        percentage: newPercentage,
        updatedAt: Date.now()
      });
      setEditingProgress(null);
    } catch (err) {
      console.error('Error updating video progress:', err);
      alert('حدث خطأ أثناء تعديل النسبة');
    }
  };

  return (
    <div className="space-y-6">
      {/* HEADER WITH INTEGRATED TABS */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-black">
            <Building className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-black text-slate-900">نظام إدارة السنتر الأكاديمي الشامل</h2>
            <p className="text-slate-500 text-xs font-medium">تسجيل الحضور بالباركود والكاميرا، تتبع مدفوعات السنتر، وإشعار أولياء الأمور عبر واتساب</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 bg-slate-100 p-1.5 rounded-2xl border border-slate-200 flex-wrap justify-center">
          <button
            onClick={() => setSubTab('attendance')}
            className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${
              subTab === 'attendance' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-600 hover:bg-white'
            }`}
          >
            <QrCode className="w-4 h-4" />
            <span>الحضور والغياب</span>
          </button>

          <button
            onClick={() => setSubTab('payments')}
            className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${
              subTab === 'payments' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-600 hover:bg-white'
            }`}
          >
            <CreditCard className="w-4 h-4" />
            <span>مدفوعات واشتراكات</span>
          </button>

          <button
            onClick={() => setSubTab('absences')}
            className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${
              subTab === 'absences' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-600 hover:bg-white'
            }`}
          >
            <Calendar className="w-4 h-4" />
            <span>قوائم وتقارير الغياب</span>
          </button>

          <button
            onClick={() => setSubTab('recitations')}
            className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${
              subTab === 'recitations' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-600 hover:bg-white'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>درجات التسميع والشفوي</span>
          </button>

          <button
            onClick={() => setSubTab('video_watch')}
            className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${
              subTab === 'video_watch' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-600 hover:bg-white'
            }`}
          >
            <Video className="w-4 h-4" />
            <span>مشاهدات الفيديوهات (أقل من 50%)</span>
          </button>

          <button
            onClick={() => setIsGroupManagerOpen(true)}
            className="px-3.5 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer bg-white text-indigo-700 hover:bg-indigo-50 border border-indigo-200 shadow-xs"
            title="إضافة وتعديل وحذف مجاميع ومواعيد السنتر"
          >
            <Users className="w-4 h-4 text-indigo-600" />
            <span>إدارة المجموعات والمواعيد ⚙️</span>
          </button>
        </div>
      </div>

      {/* PROMINENT LOUD WARNING: WRONG GROUP / GRADE SCHEDULE */}
      {groupWarning && (
        <div className="bg-rose-600 text-white rounded-3xl p-6 sm:p-7 shadow-2xl border-4 border-rose-300 animate-in fade-in slide-in-from-top-4 space-y-4">
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 rounded-2xl bg-white text-rose-600 flex items-center justify-center font-black flex-shrink-0 shadow-xl">
              <AlertTriangle className="w-10 h-10 animate-bounce text-rose-600" />
            </div>
            <div className="flex-1 space-y-2">
              <div className="inline-block bg-rose-950/80 px-3.5 py-1 rounded-full text-xs font-black tracking-wide uppercase shadow-inner border border-rose-400/40">
                {groupWarning.isAlternativeDay 
                  ? '✨ تنبيه حضور استثنائي تعويضي (بديل لحصة المجموعة)' 
                  : groupWarning.isCycleDuplicate 
                    ? '⛔ إنذار منع: الطالب حضر بالفعل في هذه الدورة الأسبوعية' 
                    : '🚨 إنذار إداري بارز للمشرف على الاسكانر'}
              </div>
              <h3 className="text-2xl sm:text-3xl font-black text-yellow-200 leading-tight">
                {groupWarning.isAlternativeDay
                  ? `✨ الطالب مسجل بمجموعة أخرى ويمكن تسجيله كبديل تعويضي اليوم (${groupWarning.todayName})`
                  : groupWarning.isCycleDuplicate
                    ? `⛔ تم رفض المسح: الطالب حضر حصته بالفعل في هذه الدورة الأسبوعية!`
                    : groupWarning.currentSessionGrade && groupWarning.studentGrade !== groupWarning.currentSessionGrade
                      ? `🚨 خطأ في المرحلة الدراسية / السن! الطالب ليس في مرحلة هذه القاعة!`
                      : groupWarning.currentSessionGroup 
                        ? `هذه ليست مجموعة الطالب! (المجموعة الجارية بالقاعة: ${groupWarning.currentSessionGroup})` 
                        : 'هذه ليست مجموعة الطالب! اليوم ليس موعد حضوره!'}
              </h3>
              
              <div className="bg-rose-900/60 p-4 rounded-2xl border border-rose-400/30 text-sm sm:text-base font-bold text-rose-100 space-y-2.5 shadow-inner">
                <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-rose-500/40">
                  <span>الطالب: <strong className="text-white text-lg underline font-black">{groupWarning.student.name}</strong></span>
                  <span>كود الطالب: <strong className="font-mono text-yellow-300 bg-black/40 px-2 py-0.5 rounded-lg border border-yellow-400/40 text-lg font-black">{groupWarning.student.code || '-'}</strong></span>
                </div>

                {/* Grade Mismatch Details */}
                {groupWarning.currentSessionGrade && (
                  <div className="grid sm:grid-cols-2 gap-2 bg-rose-950/40 p-2.5 rounded-xl border border-rose-400/20">
                    <div>
                      <span className="text-rose-200 text-xs block">المرحلة / السن الجاري بالقاعة حالياً:</span>
                      <span className="bg-amber-400 text-slate-950 px-2.5 py-0.5 rounded-lg font-black text-xs inline-block mt-0.5">
                        {groupWarning.currentSessionGrade}
                      </span>
                    </div>
                    <div>
                      <span className="text-rose-200 text-xs block">مرحلة الطالب المسجلة:</span>
                      <span className="bg-white/20 text-yellow-200 px-2.5 py-0.5 rounded-lg font-black text-xs inline-block mt-0.5">
                        {groupWarning.studentGrade || 'غير محددة'}
                      </span>
                    </div>
                  </div>
                )}

                {/* Group Mismatch Details */}
                {groupWarning.currentSessionGroup && (
                  <div className="grid sm:grid-cols-2 gap-2 bg-rose-950/40 p-2.5 rounded-xl border border-rose-400/20">
                    <div>
                      <span className="text-rose-200 text-xs block">المجموعة الجارية بالقاعة حالياً:</span>
                      <span className="bg-amber-400 text-slate-950 px-2.5 py-0.5 rounded-lg font-black text-xs inline-block mt-0.5">
                        {groupWarning.currentSessionGroup}
                      </span>
                    </div>
                    <div>
                      <span className="text-rose-200 text-xs block">مجموعة الطالب المسجلة:</span>
                      <span className="bg-white/20 text-yellow-200 px-2.5 py-0.5 rounded-lg font-black text-xs inline-block mt-0.5">
                        {groupWarning.studentGroup || 'غير محددة'}
                      </span>
                    </div>
                  </div>
                )}

                <div className="text-xs text-yellow-200 pt-1 border-t border-rose-500/40 flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-yellow-300 flex-shrink-0" />
                  <p className="font-black">تفاصيل اللائحة: {groupWarning.reason}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2 border-t border-rose-400/40 flex-wrap">
            {groupWarning.isAlternativeDay ? (
              <button
                type="button"
                onClick={() => {
                  checkAndMarkAttendance(groupWarning.student, groupWarning.status, true);
                }}
                className="bg-emerald-500 hover:bg-emerald-600 text-white font-black px-6 py-3.5 rounded-2xl text-sm shadow-xl transition-all flex items-center gap-2 cursor-pointer"
              >
                <CheckCircle2 className="w-5 h-5" />
                <span>✅ تسجيل كحضور استثنائي تعويضي (بديل لحصة المجموعة الرسمية)</span>
              </button>
            ) : groupWarning.isCycleDuplicate ? (
              <button
                type="button"
                onClick={() => {
                  if (confirm(`تأكيد: الطالب ${groupWarning.student.name} حضر بالفعل هذه الحصة في نفس الأسبوع.\nهل المستر وافق صراحة على دخوله مرة ثانية؟`)) {
                    checkAndMarkAttendance(groupWarning.student, groupWarning.status, true);
                  }
                }}
                className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-black px-5 py-3 rounded-2xl text-xs shadow-xl transition-all flex items-center gap-2 cursor-pointer"
              >
                <AlertTriangle className="w-4 h-4" />
                <span>تجاوز استثنائي بموافقة المستر صراحة</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  checkAndMarkAttendance(groupWarning.student, groupWarning.status, true);
                }}
                className="bg-emerald-500 hover:bg-emerald-600 text-white font-black px-6 py-3.5 rounded-2xl text-sm shadow-xl transition-all flex items-center gap-2 cursor-pointer"
              >
                <CheckCircle2 className="w-5 h-5" />
                <span>السماح بالدخول والحضور استثنائياً (تسجيل الحضور الآن)</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                if (groupWarning.isCycleDuplicate) {
                  setGroupWarning(null);
                  setScanCode('');
                  return;
                }
                handleMarkAttendance(
                  groupWarning.student, 
                  'absent', 
                  `عدم السماح بالدخول لعدم تطابق المجموعة (${groupWarning.reason}) - تسجيل غياب تلقائي`
                );
                setGroupWarning(null);
                setScanCode('');
              }}
              className="bg-white hover:bg-slate-100 text-rose-700 font-black px-6 py-3.5 rounded-2xl text-sm shadow-xl transition-all flex items-center gap-2 cursor-pointer"
            >
              <X className="w-5 h-5" />
              <span>{groupWarning.isCycleDuplicate ? 'رفض المسح وإلغاء العملية ✕' : 'عدم السماح (تسجيل الطالب غياباً فوراً وإشعار ولي الأمر) ❌'}</span>
            </button>
          </div>
        </div>
      )}

      {/* HIGH-VISIBILITY ACTION ALERT (WHATSAPP & PRINT SHORTCUTS) */}
      {actionAlert && (
        <div className="bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-2xl p-4 sm:p-5 shadow-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 animate-in fade-in slide-in-from-top-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
              <CheckCircle2 className="w-6 h-6 text-white" />
            </div>
            <div>
              <h4 className="font-black text-sm sm:text-base leading-tight">{actionAlert.title}</h4>
              <p className="text-xs text-emerald-100 font-medium mt-0.5">{actionAlert.details}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto justify-end">
            {/* WHATSAPP BUTTON */}
            {actionAlert.whatsappUrl && (
              <a
                href={actionAlert.whatsappUrl}
                target="_blank"
                rel="noreferrer"
                className="px-4 py-2.5 bg-white hover:bg-emerald-50 text-emerald-800 font-black rounded-xl text-xs shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <MessageCircle className="w-4 h-4 text-emerald-600" />
                <span>إرسال إشعار فوري لولي الأمر عبر واتساب</span>
              </a>
            )}

            {/* STICKER PRINT BUTTON (QR + PROMO CODE) */}
            {actionAlert.student && (
              <button
                type="button"
                onClick={() => printStudentSticker(actionAlert.student!)}
                className="px-4 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-black rounded-xl text-xs shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
                title="طباعة استيكر حراري لاصق للكارت يحتوي على البرومو كود جنبه كود الكيو آر"
              >
                <Printer className="w-4 h-4 text-emerald-200" />
                <span>🖨️ طباعة استيكر (QR + برومو كود)</span>
              </button>
            )}

            {/* PRINT RECEIPT BUTTON */}
            {actionAlert.paymentRecord && actionAlert.student && (
              <button
                type="button"
                onClick={() => printPaymentReceipt(actionAlert.paymentRecord!, actionAlert.student!)}
                className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-black rounded-xl text-xs shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Printer className="w-4 h-4 text-amber-300" />
                <span>طباعة إيصال السداد</span>
              </button>
            )}

            {/* Close Button */}
            <button
              onClick={() => setActionAlert(null)}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
              title="إغلاق التنبيه"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* SEARCH AND SELECT STUDENT PANEL */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Search className="w-5 h-5 text-indigo-600" />
            <h3 className="font-black text-slate-900 text-sm">البحث السريع عن الطالب (للتسجيل اليدوي أو اختيار الطالب)</h3>
          </div>
          {selectedStudent && (
            <button
              onClick={() => { setSelectedStudent(null); setSearchQuery(''); }}
              className="text-xs text-rose-600 font-bold hover:underline cursor-pointer"
            >
              إلغاء التحديد ✕
            </button>
          )}
        </div>

        <div className="relative">
          <input
            type="text"
            placeholder="ابحث باسم الطالب، كوده، رقم هاتفه، أو هاتف ولي الأمر..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pr-10 pl-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
          />
          <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-3.5" />
        </div>

        {/* Search Results Dropdown */}
        {filteredStudents.length > 0 && !selectedStudent && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-56 overflow-y-auto p-1">
            {filteredStudents.map(st => (
              <button
                key={st.uid}
                type="button"
                onClick={() => { setSelectedStudent(st); setSearchQuery(''); }}
                className="text-right p-3 bg-slate-50 hover:bg-indigo-50/80 border border-slate-200 hover:border-indigo-300 rounded-2xl transition-all flex items-center justify-between gap-2 cursor-pointer"
              >
                <div>
                  <div className="font-black text-slate-900 text-xs">{st.name}</div>
                  <div className="text-[11px] text-slate-500 font-medium">
                    {st.grade} • كود: <span className="font-mono text-indigo-600 font-bold">{st.code || st.uid.substring(0,6)}</span> • مجموعة: <span className="text-amber-700 font-bold">{st.centerGroup || 'السبت والثلاثاء'}</span>
                  </div>
                </div>
                <span className="text-[10px] bg-indigo-100 text-indigo-800 font-bold px-2 py-0.5 rounded-full">
                  اختيار
                </span>
              </button>
            ))}
          </div>
        )}

        {/* Selected Student Banner */}
        {selectedStudent && (
          <div className="bg-indigo-50 border-2 border-indigo-200 p-4 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-black">
                <UserCheck className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h4 className="font-black text-slate-900 text-sm">{selectedStudent.name}</h4>
                  <span className="text-[10px] bg-indigo-200 text-indigo-900 px-2 py-0.5 rounded-full font-bold">
                    {selectedStudent.grade}
                  </span>
                  <span className="text-[10px] bg-amber-100 text-amber-900 border border-amber-200 px-2 py-0.5 rounded-full font-bold">
                    {selectedStudent.centerGroup || 'مجموعة السبت والثلاثاء'}
                  </span>
                </div>
                <div className="text-xs text-slate-600 mt-0.5">
                  كود: <b className="font-mono text-indigo-700">{selectedStudent.code || selectedStudent.uid.substring(0,6)}</b> • هاتف: <b className="font-mono">{selectedStudent.phone || '-'}</b> • ولي أمر: <b className="font-mono">{selectedStudent.parentPhone || '-'}</b>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => checkAndMarkAttendance(selectedStudent, 'present')}
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-3 py-2 rounded-xl transition-all flex items-center gap-1 cursor-pointer"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>حضور فوراً</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setCardModalStudent(selectedStudent);
                  setIsCardModalOpen(true);
                }}
                className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-3 py-2 rounded-xl transition-all flex items-center gap-1 cursor-pointer shadow-xs"
                title="ربط كارت خارجي مطبوع بمسح QR أو طباعة كارت جديد"
              >
                <CreditCard className="w-3.5 h-3.5 text-amber-300" />
                <span>إدارة الكارت (مسح / طباعة)</span>
              </button>
              <a
                href={`/parent-report/${selectedStudent.code || selectedStudent.uid}`}
                target="_blank"
                rel="noreferrer"
                className="bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 text-xs font-bold px-3 py-2 rounded-xl transition-all flex items-center gap-1 cursor-pointer"
              >
                <span>تقرير ولي الأمر</span>
                <ExternalLink className="w-3 h-3 text-slate-400" />
              </a>
            </div>
          </div>
        )}
      </div>

      {/* SUB-TAB 1: ATTENDANCE SCANNER & LOG */}
      {subTab === 'attendance' && (
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Scanner Box */}
          <div className="lg:col-span-1 bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <QrCode className="w-5 h-5 text-indigo-600" />
                <h3 className="font-black text-slate-900 text-base">مسح باركود / كود الطالب</h3>
              </div>
              <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full">
                جهاز الباركود أو الكاميرا
              </span>
            </div>

            {/* GATE ADMISSION & PAYMENT INSPECTION TOGGLE */}
            <div className="p-3.5 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl shadow-md border border-indigo-900/60 space-y-2.5">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2.5">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                    scanInspectionMode ? 'bg-emerald-500/20 text-emerald-400' : 'bg-white/10 text-slate-400'
                  }`}>
                    <Shield className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-xs font-black block">فحص بيانات الدفع والقبول عند البوابة</span>
                    <span className="text-[10px] text-slate-300 font-medium">إظهار بطاقة السداد والاسم والمجموعة عند قراءة الكود</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setScanInspectionMode(!scanInspectionMode)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer whitespace-nowrap ${
                    scanInspectionMode 
                      ? 'bg-emerald-500 text-slate-950 font-black shadow-md ring-2 ring-emerald-300' 
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  {scanInspectionMode ? '🛡️ بطاقة فحص الدفع مفعلة' : '⚡ تسجيل مباشر بدون بطاقة'}
                </button>
              </div>

              {scanInspectionMode && (
                <div className="pt-2 border-t border-indigo-900/80 flex items-center justify-between flex-wrap gap-2 text-xs">
                  <span className="text-[11px] text-slate-300 font-bold">طريقة تسجيل الحضور عند ظهور بطاقة الفحص:</span>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <button
                      type="button"
                      onClick={() => {
                        setAutoMarkAttendanceOnScan(true);
                        localStorage.setItem('saber_auto_mark_on_scan', 'true');
                      }}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-black transition-all cursor-pointer ${
                        autoMarkAttendanceOnScan
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'bg-slate-800/80 text-slate-400 hover:text-white'
                      }`}
                    >
                      ⚡ تسجيل الحضور تلقائياً فور المسح
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setAutoMarkAttendanceOnScan(false);
                        localStorage.setItem('saber_auto_mark_on_scan', 'false');
                      }}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-black transition-all cursor-pointer ${
                        !autoMarkAttendanceOnScan
                          ? 'bg-amber-500 text-slate-950 shadow-xs'
                          : 'bg-slate-800/80 text-slate-400 hover:text-white'
                      }`}
                    >
                      🛡️ قرار يدوي (أنا اللي أحدد أدخله أو لا)
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* ACTIVE SESSION GROUP & GRADE SELECTOR & QUICK MANAGEMENT */}
            <div className="bg-indigo-50/90 border-2 border-indigo-200 p-3.5 rounded-2xl space-y-3 shadow-xs">
              {/* EXTRA SESSION MODE TOGGLE (حصة / مجموعة إضافية عامة) */}
              <div className={`p-3 rounded-2xl border-2 transition-all ${
                isExtraSessionMode || extraSessionPlans.some(p => p.isActive)
                  ? 'bg-gradient-to-r from-amber-500/15 via-indigo-500/10 to-amber-500/15 border-amber-400 shadow-sm'
                  : 'bg-white border-indigo-100'
              }`}>
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <span className="text-base">⭐</span>
                    <div>
                      <span className="text-xs font-black text-slate-900 block">وضع الحصة / المواعيد الإضافية (Multi-Slots)</span>
                      <span className="text-[10px] text-slate-500">حضور متاح لجميع الطلاب في مواعيد متعددة (الجمعة والسبت)</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setIsExtraSessionModalOpen(true)}
                      className="bg-amber-600 hover:bg-amber-700 text-white font-black px-3 py-1.5 rounded-xl text-xs flex items-center gap-1 shadow-xs cursor-pointer"
                    >
                      <Calendar className="w-3.5 h-3.5" />
                      <span>إدارة المواعيد الإضافية ⚡</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsExtraSessionMode(!isExtraSessionMode)}
                      className={`text-xs font-black px-3 py-1.5 rounded-xl transition-all cursor-pointer whitespace-nowrap ${
                        isExtraSessionMode || extraSessionPlans.some(p => p.isActive)
                          ? 'bg-amber-500 text-slate-950 font-black shadow-xs ring-2 ring-amber-300'
                          : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300'
                      }`}
                    >
                      {isExtraSessionMode || extraSessionPlans.some(p => p.isActive) ? '✓ مفعل' : 'تفعيل'}
                    </button>
                  </div>
                </div>

                {/* Multi-slot breakdown if active */}
                {extraSessionPlans.find(p => p.isActive) && (
                  <div className="mt-2 pt-2 border-t border-amber-200/80 space-y-1.5">
                    <div className="flex items-center justify-between text-[11px] font-bold text-amber-950">
                      <span>الفترات المتاحة بالميعاد الإضافي النشط:</span>
                      <span className="text-amber-800 text-[10px]">{extraSessionPlans.find(p => p.isActive)?.title}</span>
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {extraSessionPlans.find(p => p.isActive)?.slots.map(s => (
                        <span key={s.id} className="bg-white border border-amber-300 text-amber-950 px-2 py-0.5 rounded-md text-[10px] font-black shadow-2xs">
                          {s.day} ({s.time})
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {isExtraSessionMode && (
                  <div className="mt-3 pt-3 border-t border-amber-200/70 space-y-2">
                    <div className="flex items-center gap-2">
                      <label className="text-[11px] font-black text-amber-950 flex-shrink-0">اسم الحصة الإضافية:</label>
                      <input
                        type="text"
                        value={extraSessionName}
                        onChange={e => setExtraSessionName(e.target.value)}
                        placeholder="مثال: مجموعة الجمعة الإضافية - مراجعة عامة"
                        className="flex-1 p-2 bg-white border border-amber-300 rounded-xl text-xs font-bold text-slate-900 outline-none focus:border-amber-500"
                      />
                    </div>

                    <div className="bg-amber-100/70 p-2.5 rounded-xl text-xs text-amber-950 flex items-center justify-between font-bold flex-wrap gap-2">
                      <div className="flex items-center gap-3">
                        <span>مستهدفين: <b>{extraSessionTargetStudents.length}</b></span>
                        <span>حضروا: <b className="text-emerald-700">{extraSessionAttendedIds.size}</b></span>
                        <span>غائبين: <b className="text-rose-700">{extraSessionAbsentStudents.length}</b></span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setSubTab('absences');
                          setAbsenceSubTab('extra_session');
                        }}
                        className="bg-slate-900 hover:bg-slate-800 text-amber-300 text-[10px] font-black px-2.5 py-1 rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                      >
                        <span>حصر الغائبين 📋</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* GRADE / STAGE SELECTOR */}
              <div className="space-y-1">
                <label className="text-xs font-black text-indigo-950 flex items-center gap-1.5">
                  <GraduationCap className="w-3.5 h-3.5 text-indigo-600" />
                  <span>المرحلة / السن بالقاعة حالياً (منع تداخل الصفوف):</span>
                </label>
                <select
                  value={activeSessionGrade}
                  onChange={e => setActiveSessionGrade(e.target.value)}
                  className="w-full p-2.5 bg-white border-2 border-indigo-300 focus:border-indigo-600 rounded-xl text-xs font-black text-indigo-950 outline-none shadow-sm cursor-pointer"
                >
                  <option value="all">🌐 جميع المراحل (عام دون تقييد بمرحلة محددة)</option>
                  {availableGrades.map((grd, idx) => (
                    <option key={idx} value={grd}>{grd}</option>
                  ))}
                </select>
              </div>

              {/* GROUP / SCHEDULE SELECTOR (SUPPORTS UP TO 3 GROUPS AT ONCE) */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-black text-indigo-950 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-indigo-600" />
                    <span>المجموعات الجارية بالقاعة (اختر حتى 3 مجموعات معاً):</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsGroupManagerOpen(true)}
                    className="text-[11px] font-bold text-indigo-700 hover:text-indigo-950 bg-white hover:bg-indigo-100 px-2 py-0.5 rounded-lg border border-indigo-200 shadow-xs flex items-center gap-1 cursor-pointer transition-colors"
                    title="إضافة أو حذف مجموعات ومواعيد السنتر"
                  >
                    <Plus className="w-3 h-3" />
                    <span>إدارة المواعيد</span>
                  </button>
                </div>

                {/* Multi-Group Quick Chips */}
                <div className="flex flex-wrap gap-1.5 bg-white p-2 rounded-xl border-2 border-indigo-200">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveSessionGroups(['all']);
                      setActiveSessionGroup('all');
                    }}
                    className={`text-[11px] font-bold px-3 py-1.5 rounded-lg border transition-all cursor-pointer ${
                      activeSessionGroups.includes('all')
                        ? 'bg-indigo-600 text-white border-indigo-700 shadow-xs font-black'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-indigo-50'
                    }`}
                  >
                    🌐 جميع المجموعات (عام)
                  </button>

                  {availableGroups.map((grp, idx) => {
                    const isSelected = activeSessionGroups.includes(grp);
                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          if (isSelected) {
                            const updated = activeSessionGroups.filter(g => g !== grp);
                            const next = updated.length === 0 ? ['all'] : updated;
                            setActiveSessionGroups(next);
                            setActiveSessionGroup(next[0] || 'all');
                          } else {
                            const current = activeSessionGroups.filter(g => g !== 'all');
                            if (current.length >= 3) {
                              alert('تنبيه: يمكنك اختيار حتى 3 مجموعات كحد أقصى مدمجة في القاعة في نفس الوقت.');
                              return;
                            }
                            const updated = [...current, grp];
                            setActiveSessionGroups(updated);
                            setActiveSessionGroup(updated[0] || 'all');
                          }
                        }}
                        className={`text-[11px] font-bold px-2.5 py-1.5 rounded-lg border transition-all cursor-pointer flex items-center gap-1.5 ${
                          isSelected
                            ? 'bg-amber-400 text-slate-950 border-amber-500 font-black shadow-xs ring-2 ring-amber-300'
                            : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-amber-50'
                        }`}
                      >
                        <span>{grp}</span>
                        {isSelected && <span className="text-[10px] bg-slate-950 text-amber-300 rounded-full w-4 h-4 flex items-center justify-center font-black">✓</span>}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Active Session Status & Live Counts */}
              {(activeSessionGroups.some(g => g !== 'all') || activeSessionGrade !== 'all') ? (
                <div className="space-y-1 bg-white/95 p-2.5 rounded-xl border border-indigo-200 text-xs">
                  <div className="flex items-center justify-between font-bold text-indigo-950">
                    <span>مجموعات القاعة النشطة:</span>
                    <strong className="text-amber-700 font-black text-xs">
                      {activeSessionGroups.filter(g => g !== 'all').join(' + ') || 'جميع المجموعات'}
                    </strong>
                  </div>
                  <div className="flex items-center justify-between font-bold text-indigo-950">
                    <span>طلاب القاعة المستهدفين:</span>
                    <strong className="text-indigo-600 font-black text-sm">{activeGroupStudentsCount} طالب</strong>
                  </div>
                  <div className="flex items-center justify-between font-bold text-indigo-950">
                    <span>حضر منهم اليوم:</span>
                    <strong className="text-emerald-700 font-black text-sm">{activeGroupAttendedTodayCount} طالب</strong>
                  </div>
                  {activeSessionGrade !== 'all' && (
                    <div className="text-[10px] text-amber-800 font-bold bg-amber-50 px-2 py-0.5 rounded-md mt-1">
                      🛡️ حماية مشددة: سيتم منع أي طالب خارج مرحلة ({activeSessionGrade}).
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-[10px] font-bold text-slate-500">
                  * سيتم التحقق من مطابقة يوم الحضور مع أيام مجموعة كل طالب تلقائياً.
                </div>
              )}
            </div>

            {/* CAMERA SCANNER BUTTON */}
            <button
              type="button"
              onClick={() => setIsCameraOpen(true)}
              className="w-full bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white font-black py-3.5 px-4 rounded-2xl shadow-lg transition-all text-xs flex items-center justify-center gap-2 cursor-pointer"
            >
              <Camera className="w-4 h-4 text-amber-300" />
              <span>فتح الكاميرا لمسح الباركود وQR فوراً</span>
            </button>

            <div className="relative text-center my-2">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-200"></div></div>
              <span className="relative bg-white px-3 text-[11px] text-slate-400 font-bold">أو مسح بجهاز الباركود (Barcode Gun) / كتابة الكود</span>
            </div>

            <form onSubmit={handleScanSubmit} className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">كود الطالب أو مسح الباركود:</label>
                <input
                  type="text"
                  placeholder="امسح بالباركود أو اكتب الكود..."
                  value={scanCode}
                  onChange={e => setScanCode(e.target.value)}
                  autoFocus
                  className="w-full p-3 bg-slate-50 border-2 border-indigo-200 rounded-2xl text-center font-mono font-black text-lg outline-none focus:border-indigo-600"
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setAttendingStatus('present')}
                  className={`py-2 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                    attendingStatus === 'present' ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-slate-50 text-slate-700 border-slate-200'
                  }`}
                >
                  حاضر
                </button>
                <button
                  type="button"
                  onClick={() => setAttendingStatus('late')}
                  className={`py-2 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                    attendingStatus === 'late' ? 'bg-amber-500 text-white border-amber-500' : 'bg-slate-50 text-slate-700 border-slate-200'
                  }`}
                >
                  متأخر
                </button>
                <button
                  type="button"
                  onClick={() => setAttendingStatus('absent')}
                  className={`py-2 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                    attendingStatus === 'absent' ? 'bg-rose-600 text-white border-rose-600' : 'bg-slate-50 text-slate-700 border-slate-200'
                  }`}
                >
                  غائب
                </button>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">ملاحظة حضور إضافية (اختياري):</label>
                <input
                  type="text"
                  placeholder="مثال: استئذان مبكر / عذر مرضي"
                  value={attendingNotes}
                  onChange={e => setAttendingNotes(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                />
              </div>

              <button
                type="submit"
                className="w-full bg-slate-900 hover:bg-slate-800 text-white font-black py-3 rounded-2xl shadow-md transition-all text-xs flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>تسجيل الحضور بالكود</span>
              </button>
            </form>
          </div>

          {/* Attendance Log Table */}
          <div className="lg:col-span-2 bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="font-black text-slate-900 text-base">سجل حضور السنتر الأخير</h3>
                <p className="text-xs text-slate-400">تحديث فوري بالثانية لجميع الطلاب الحاضرين</p>
              </div>
              <span className="bg-indigo-50 text-indigo-700 text-xs font-bold px-3 py-1 rounded-full">
                {attendanceList.length} تسجيل
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                  <tr>
                    <th className="p-3">الطالب</th>
                    <th className="p-3">الكود</th>
                    <th className="p-3">التاريخ والوقت</th>
                    <th className="p-3 text-center">الحالة</th>
                    <th className="p-3 text-center">إشعار ولي الأمر</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {attendanceList.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-6 text-center text-slate-400">لا يوجد تسجيلات حضور حتى الآن.</td>
                    </tr>
                  ) : (
                    attendanceList.slice(0, 15).map(att => {
                      const studentObj = userMap.get(att.studentId);
                      const parentPhone = studentObj?.parentPhone;
                      const parentUrl = parentPhone 
                        ? buildWhatsAppUrl(parentPhone, `السلام عليكم ورحمة الله، ولي أمر الطالب: ${att.studentName}.\nنحيطكم علماً بتسجيل حضور الطالب بتاريخ ${att.date} الساعة ${att.time || ''} بالسنتر كـ: ${att.status === 'present' ? 'حاضر ✅' : att.status === 'late' ? 'متأخر ⏳' : 'غائب ❌'}.\nتقرير الطالب: ${window.location.origin}/parent-report/${att.studentCode || att.studentId}`)
                        : null;

                      return (
                        <tr key={att.id} className="hover:bg-slate-50/70">
                          <td className="p-3">
                            <div className="font-bold text-slate-900">{att.studentName}</div>
                            {att.notes && <div className="text-[10px] text-slate-400">{att.notes}</div>}
                          </td>
                          <td className="p-3 font-mono text-slate-600">{att.studentCode || '-'}</td>
                          <td className="p-3 text-slate-500">{att.date} {att.time ? `• ${att.time}` : ''}</td>
                          <td className="p-3 text-center">
                            <span className={`px-2.5 py-1 rounded-full text-[10px] font-black ${
                              att.status === 'present' 
                                ? 'bg-emerald-100 text-emerald-800' 
                                : att.status === 'late'
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-rose-100 text-rose-800'
                            }`}>
                              {att.status === 'present' ? 'حاضر' : att.status === 'late' ? 'متأخر' : 'غائب'}
                            </span>
                          </td>
                          <td className="p-3 text-center">
                            {parentUrl ? (
                              <a
                                href={parentUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 px-2.5 py-1 rounded-lg font-bold text-[10px] inline-flex items-center gap-1 cursor-pointer"
                              >
                                <MessageCircle className="w-3 h-3" />
                                <span>واتساب</span>
                              </a>
                            ) : (
                              <span className="text-slate-300">-</span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB 2: CENTER PAYMENTS & SUBSCRIPTIONS */}
      {subTab === 'payments' && (
        <div className="space-y-6">
          <div className="grid lg:grid-cols-3 gap-6">
            {/* Add Payment Form */}
            <div className="lg:col-span-1 bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
              <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
                <CreditCard className="w-5 h-5 text-indigo-600" />
                <h3 className="font-black text-slate-900 text-base">تسجيل دفعة واشتراك سنتر</h3>
              </div>

              <p className="text-xs text-slate-500 leading-relaxed">
                اختر الطالب من شريط البحث بالأعلى، ثم حدد الشهر والمبلغ لإصدار إيصال السداد وإشعار ولي الأمر.
              </p>

              <form onSubmit={handleRecordPayment} className="space-y-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">الشهر المستحق:</label>
                  <select
                    value={paymentMonth}
                    onChange={e => setPaymentMonth(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    {ALL_MONTHS_OPTIONS.map((m, idx) => (
                      <option key={idx} value={m}>{m}</option>
                    ))}
                  </select>
                </div>

                {paymentMonth === 'مخصص...' && (
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">اكتب الشهر أو البند المخصص:</label>
                    <input
                      type="text"
                      required
                      value={customMonthInput}
                      onChange={e => setCustomMonthInput(e.target.value)}
                      placeholder="مثال: شهر أكتوبر 2024 / مذكرات الفصل الثاني"
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                )}

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">المبلغ (ج.م):</label>
                  <input
                    type="number"
                    value={paymentAmount}
                    onChange={e => setPaymentAmount(Number(e.target.value))}
                    min={1}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-base font-black text-indigo-600 outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">ملاحظات الإيصال (اختياري):</label>
                  <input
                    type="text"
                    value={paymentNotes}
                    onChange={e => setPaymentNotes(e.target.value)}
                    placeholder="سداد كامل / قسط أول / نقدي"
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <button
                  type="submit"
                  disabled={!selectedStudent}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white font-black py-3 rounded-2xl shadow-md transition-all text-xs flex items-center justify-center gap-2 cursor-pointer"
                >
                  <DollarSign className="w-4 h-4" />
                  <span>تسجيل الدفع وإصدار الإيصال</span>
                </button>
              </form>
            </div>

            {/* Payments Table with Search & Delete */}
            <div className="lg:col-span-2 bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                <div>
                  <h3 className="font-black text-slate-900 text-base">سجل مقبوضات السنتر</h3>
                  <p className="text-xs text-slate-400">إدارة الإيصالات والطباعة والإلغاء السريع في حال الخطأ</p>
                </div>

                <div className="relative min-w-[220px]">
                  <input
                    type="text"
                    placeholder="بحث في المقبوضات (كود / اسم / إيصال)..."
                    value={paymentSearch}
                    onChange={e => setPaymentSearch(e.target.value)}
                    className="w-full pr-8 pl-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-2.5" />
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                    <tr>
                      <th className="p-3">رقم الإيصال</th>
                      <th className="p-3">الطالب</th>
                      <th className="p-3">الشهر</th>
                      <th className="p-3 text-center">المبلغ</th>
                      <th className="p-3">التاريخ</th>
                      <th className="p-3 text-center">الإجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredPayments.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-6 text-center text-slate-400">لا يوجد مدفوعات مسجلة للسنتر بعد.</td>
                      </tr>
                    ) : (
                      filteredPayments.slice(0, 20).map(pay => {
                        const st = users.find(u => u.uid === pay.studentId);
                        const parentPhone = st?.parentPhone;
                        const whatsappReceiptUrl = parentPhone 
                          ? buildWhatsAppUrl(parentPhone, `السلام عليكم، ولي أمر الطالب: ${pay.studentName}.\nتم استلام سداد رسوم السنتر (${pay.month}) بمبلغ ${pay.amount} ج.م.\nرقم الإيصال: ${pay.receiptNumber} بتاريخ ${pay.date}.\nشكراً لكم ✨`)
                          : null;

                        return (
                          <tr key={pay.id} className="hover:bg-slate-50/70">
                            <td className="p-3 font-mono font-bold text-indigo-700">{pay.receiptNumber}</td>
                            <td className="p-3 font-bold text-slate-900">{pay.studentName}</td>
                            <td className="p-3 text-slate-600">{pay.month}</td>
                            <td className="p-3 text-center font-black text-emerald-600">{pay.amount} ج.م</td>
                            <td className="p-3 text-slate-500">{pay.date}</td>
                            <td className="p-3 text-center">
                              <div className="flex items-center justify-center gap-1.5">
                                <button
                                  onClick={() => st && printPaymentReceipt(pay, st)}
                                  className="bg-slate-100 hover:bg-indigo-50 text-slate-700 hover:text-indigo-600 p-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer"
                                  title="طباعة الإيصال"
                                >
                                  <Printer className="w-3.5 h-3.5" />
                                </button>
                                {whatsappReceiptUrl && (
                                  <a
                                    href={whatsappReceiptUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 p-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer"
                                    title="إرسال الإيصال على واتساب"
                                  >
                                    <MessageCircle className="w-3.5 h-3.5" />
                                  </a>
                                )}
                                <button
                                  onClick={() => handleDeletePayment(pay)}
                                  className="bg-rose-50 hover:bg-rose-100 text-rose-600 p-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer"
                                  title="حذف وإلغاء هذا الإيصال"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* UNPAID STUDENTS SECTION (AFTER 14TH OF MONTH) */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
                  <BellRing className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-slate-900 text-base">
                    قائمة الطلاب غير المسددين لشهر ({effectivePaymentMonth})
                  </h3>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    <span className="text-xs text-slate-500 font-medium">
                      إجمالي غير المسددين: {unpaidStudents.length} طالب
                    </span>
                    <span className="text-xs text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                      متبقي للتنبيه: {unpaidStudents.filter(s => !notifiedPaymentStudents.includes(s.uid)).length}
                    </span>
                    {notifiedPaymentStudents.length > 0 && (
                      <span className="text-xs text-slate-600 font-bold bg-slate-100 px-2 py-0.5 rounded-md">
                        تم تنبيههم (أسفل القائمة): {unpaidStudents.filter(s => notifiedPaymentStudents.includes(s.uid)).length}
                      </span>
                    )}
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      isPast14th ? 'bg-rose-100 text-rose-800 animate-pulse' : 'bg-amber-100 text-amber-800'
                    }`}>
                      {isPast14th ? '⚠️ بعد يوم 14 في الشهر: موعد إرسال إنذارات السداد' : 'قبل يوم 14 في الشهر'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap self-start sm:self-auto">
                {notifiedPaymentStudents.length > 0 && (
                  <button
                    type="button"
                    onClick={handleResetNotifiedList}
                    className="text-[11px] font-bold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-3 py-2 rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
                    title="إعادة ضبط قائمة المنبهين وإرجاعهم للترتيب العادي"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>إعادة ضبط المنبهين</span>
                  </button>
                )}

                <button
                  onClick={() => printAbsenceSheet(`قائمة_الطلاب_غير_المسددين_${effectivePaymentMonth}`, unpaidStudents)}
                  className="bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-xl text-xs font-black shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5 text-amber-300" />
                  <span>طباعة القائمة</span>
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                  <tr>
                    <th className="p-3">الطالب</th>
                    <th className="p-3">الكود</th>
                    <th className="p-3">المجموعة</th>
                    <th className="p-3">المرحلة</th>
                    <th className="p-3">هاتف ولي الأمر</th>
                    <th className="p-3 text-center">إنذار سداد واتساب / ترتيب القائمة</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {unpaidStudents.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-6 text-center text-emerald-600 font-bold">
                        🎉 ممتاز! جميع طلاب السنتر قاموا بسداد اشتراك شهر ({effectivePaymentMonth}).
                      </td>
                    </tr>
                  ) : (
                    unpaidStudents.map(st => {
                      const isNotified = notifiedPaymentStudents.includes(st.uid);
                      const msg = `السلام عليكم ورحمة الله، ولي أمر الطالب: ${st.name}.\nنحيط سيادتكم علماً بتأخر سداد اشتراك السنتر لشهر (${effectivePaymentMonth}).\nنرجو التكرم بالسداد في أقرب وقت لضمان استمرار الطالب في الحصص بانتظام.\nشاكرين تعاونكم معنا ✨`;
                      const whatsappReminderUrl = st.parentPhone ? buildWhatsAppUrl(st.parentPhone, msg) : null;

                      return (
                        <tr 
                          key={st.uid} 
                          className={isNotified ? 'bg-slate-50/80 opacity-70 hover:opacity-100 transition-opacity' : 'hover:bg-slate-50/70'}
                        >
                          <td className="p-3 font-bold text-slate-900">
                            <div className="flex items-center gap-2">
                              <span>{st.name}</span>
                              {isNotified && (
                                <span className="text-[10px] bg-slate-200 text-slate-700 px-2 py-0.5 rounded-md font-bold">
                                  تم إرسال التنبيه ✓ (نزل لأسفل)
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="p-3 font-mono text-slate-600">{st.code || '-'}</td>
                          <td className="p-3 text-amber-700 font-bold">{st.centerGroup || 'السبت والثلاثاء'}</td>
                          <td className="p-3 text-slate-500">{st.grade}</td>
                          <td className="p-3 font-mono text-slate-600">{st.parentPhone || '-'}</td>
                          <td className="p-3 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              {whatsappReminderUrl ? (
                                <a
                                  href={whatsappReminderUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  onClick={() => handleMarkNotified(st.uid)}
                                  className={`px-3 py-1.5 rounded-lg font-bold text-[10px] inline-flex items-center gap-1.5 cursor-pointer transition-all ${
                                    isNotified
                                      ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300'
                                      : 'bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 shadow-xs'
                                  }`}
                                  title="إرسال عبر واتساب ونقل الطالب لأسفل القائمة تلقائياً"
                                >
                                  <MessageCircle className="w-3 h-3 text-rose-600" />
                                  <span>{isNotified ? 'إعادة الإرسال' : 'إرسال تنبيه سداد'}</span>
                                </a>
                              ) : (
                                <span className="text-slate-300 text-[11px]">لا يوجد رقم</span>
                              )}

                              <button
                                type="button"
                                onClick={() => handleMarkNotified(st.uid)}
                                className={`px-2 py-1 rounded-lg border text-[10px] font-bold cursor-pointer transition-colors ${
                                  isNotified
                                    ? 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
                                    : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                                }`}
                                title={isNotified ? 'إلغاء التنبيه وإرجاعه لأعلى القائمة' : 'تحديد كتم تنبيهه وتنزيله لأسفل القائمة'}
                              >
                                {isNotified ? 'إلغاء' : 'تم تنبيهه'}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB 3: ABSENCE LISTS & REPORTS */}
      {subTab === 'absences' && (
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
            <div>
              <h3 className="font-black text-slate-900 text-lg">قوائم وتقارير الغياب الدورية</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                متابعة غياب دورات نصف الأسبوع وإشعار أولياء الأمور وحصر متكرري الغياب
              </p>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative min-w-[200px]">
                <input
                  type="text"
                  placeholder="بحث في قائمة الغياب..."
                  value={absenceSearch}
                  onChange={e => setAbsenceSearch(e.target.value)}
                  className="w-full pr-8 pl-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <Search className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-3" />
              </div>

              <button
                onClick={() => {
                  const title = absenceSubTab === 'sat_mon'
                    ? 'تقرير_غياب_نصف_الأسبوع_الأول_السبت_الاثنين'
                    : absenceSubTab === 'tue_thu'
                      ? 'تقرير_غياب_نصف_الأسبوع_الثاني_الثلاثاء_الخميس'
                      : absenceSubTab === 'chronic'
                        ? 'تقرير_الطلاب_متكرري_الغياب'
                        : `تقرير_غياب_الحصة_الإضافية_${extraSessionName.replace(/\s+/g, '_')}_${extraSessionDate}`;
                  const list = absenceSubTab === 'sat_mon' 
                    ? satMonStudents 
                    : absenceSubTab === 'tue_thu' 
                      ? tueThuStudents 
                      : absenceSubTab === 'chronic' 
                        ? chronicAbsentStudents 
                        : extraSessionAbsentStudents;
                  printAbsenceSheet(title, list);
                }}
                className="bg-slate-900 hover:bg-slate-800 text-white px-4 py-2.5 rounded-xl text-xs font-black shadow-sm transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
              >
                <Printer className="w-3.5 h-3.5 text-amber-300" />
                <span>طباعة التقرير الحالي</span>
              </button>
            </div>
          </div>

          {/* ABSENCE SUB-TABS */}
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3 flex-wrap">
            <button
              onClick={() => setAbsenceSubTab('sat_mon')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                absenceSubTab === 'sat_mon' 
                  ? 'bg-indigo-600 text-white shadow-sm font-black' 
                  : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
              }`}
            >
              <span>دورة (السبت - الأحد - الإثنين)</span>
              <span className="bg-white/20 text-white text-[10px] px-1.5 py-0.2 rounded-full">
                {satMonStudents.length}
              </span>
            </button>

            <button
              onClick={() => setAbsenceSubTab('tue_thu')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                absenceSubTab === 'tue_thu' 
                  ? 'bg-indigo-600 text-white shadow-sm font-black' 
                  : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
              }`}
            >
              <span>دورة (الثلاثاء - الأربعاء - الخميس)</span>
              <span className="bg-white/20 text-white text-[10px] px-1.5 py-0.2 rounded-full">
                {tueThuStudents.length}
              </span>
            </button>

            <button
              onClick={() => setAbsenceSubTab('chronic')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                absenceSubTab === 'chronic' 
                  ? 'bg-rose-600 text-white shadow-sm font-black' 
                  : 'bg-rose-50 text-rose-700 hover:bg-rose-100'
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>الطلاب متكررو الغياب (&gt; مرتين)</span>
              <span className="bg-white/20 text-white text-[10px] px-1.5 py-0.2 rounded-full">
                {chronicAbsentStudents.length}
              </span>
            </button>

            <button
              onClick={() => setAbsenceSubTab('extra_session')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                absenceSubTab === 'extra_session' 
                  ? 'bg-amber-500 text-slate-950 shadow-sm font-black ring-2 ring-amber-300' 
                  : 'bg-amber-50 text-amber-900 hover:bg-amber-100 border border-amber-200'
              }`}
            >
              <span>⭐ غياب الحصة / المجموعة الإضافية (ميعاد زيادة)</span>
              <span className="bg-slate-950 text-amber-300 text-[10px] px-2 py-0.5 rounded-full font-black">
                {extraSessionAbsentStudents.length} غائب
              </span>
            </button>
          </div>

          {/* EXTRA SESSION MANAGER PANEL */}
          {absenceSubTab === 'extra_session' && (
            <div className="bg-gradient-to-br from-amber-50/90 via-amber-50/40 to-indigo-50/60 p-5 rounded-3xl border-2 border-amber-300 space-y-4 shadow-sm">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-amber-200/80">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-amber-500 text-slate-950 flex items-center justify-center font-black text-lg shadow-sm">
                    ⭐
                  </div>
                  <div>
                    <h4 className="font-black text-slate-900 text-base">
                      حصر غياب الحصة / المجموعة الإضافية (المواعيد الزيادة مثل ميعاد الجمعة أو المراجعات)
                    </h4>
                    <p className="text-xs text-slate-600 font-medium mt-0.5">
                      يتم فحص حضور جميع طلاب السنتر في هذا التاريخ، والطلاب الذين لم يسجلوا حضوراً يظهرون تلقائياً كغائبين في هذا الكشف.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap self-start md:self-auto">
                  <button
                    type="button"
                    onClick={handleBulkMarkAbsentExtraSession}
                    disabled={bulkAbsenceLoading || extraSessionAbsentStudents.length === 0}
                    className="bg-rose-600 hover:bg-rose-700 disabled:bg-slate-300 text-white px-4 py-2.5 rounded-xl text-xs font-black shadow-md transition-all flex items-center gap-2 cursor-pointer"
                  >
                    {bulkAbsenceLoading ? (
                      <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-amber-300" />
                    )}
                    <span>تسجيل وتثبيت الغياب رسمياً للجميع ({extraSessionAbsentStudents.length})</span>
                  </button>
                </div>
              </div>

              {/* Filters & Session Parameters */}
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 bg-white/90 p-4 rounded-2xl border border-amber-200">
                <div className="space-y-1">
                  <label className="text-[11px] font-black text-slate-700 block">عنوان الحصة / المجموعة الزيادة:</label>
                  <input
                    type="text"
                    value={extraSessionName}
                    onChange={e => setExtraSessionName(e.target.value)}
                    placeholder="مثال: مجموعة الجمعة الإضافية"
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 outline-none focus:border-amber-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-black text-slate-700 block">تاريخ الحصة الإضافية:</label>
                  <input
                    type="date"
                    value={extraSessionDate}
                    onChange={e => setExtraSessionDate(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 outline-none focus:border-amber-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-black text-slate-700 block">المرحلة الدراسية المستهدفة:</label>
                  <select
                    value={extraSessionTargetGrade}
                    onChange={e => setExtraSessionTargetGrade(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 outline-none focus:border-amber-500 cursor-pointer"
                  >
                    <option value="all">🌐 جميع المراحل (عام لجميع الطلاب)</option>
                    {availableGrades.map((grd, idx) => (
                      <option key={idx} value={grd}>{grd}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-black text-slate-700 block">المجموعات الأصلية المستهدفة:</label>
                  <select
                    value={extraSessionTargetGroup}
                    onChange={e => setExtraSessionTargetGroup(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 outline-none focus:border-amber-500 cursor-pointer"
                  >
                    <option value="all">🌐 جميع المجموعات المسجلة</option>
                    {availableGroups.map((grp, idx) => (
                      <option key={idx} value={grp}>{grp}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* KPI Bar */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="bg-white p-3.5 rounded-2xl border border-amber-200 flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-600">إجمالي الطلاب المطلوب حضورهم:</span>
                  <strong className="text-sm font-black text-indigo-700">{extraSessionTargetStudents.length} طالب</strong>
                </div>
                <div className="bg-white p-3.5 rounded-2xl border border-amber-200 flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-600">حضروا الحصة في هذا التاريخ:</span>
                  <strong className="text-sm font-black text-emerald-700">{extraSessionAttendedIds.size} طالب</strong>
                </div>
                <div className="bg-amber-100 p-3.5 rounded-2xl border-2 border-amber-400 flex items-center justify-between">
                  <span className="text-xs font-black text-amber-950">المتغيبين عن الحصة الإضافية:</span>
                  <strong className="text-base font-black text-rose-700">{extraSessionAbsentStudents.length} غائب</strong>
                </div>
              </div>
            </div>
          )}

          {/* ABSENCE TABLE */}
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                <tr>
                  <th className="p-3">اسم الطالب</th>
                  <th className="p-3">الكود</th>
                  <th className="p-3">المجموعة الأصلية</th>
                  <th className="p-3">الصف</th>
                  <th className="p-3">رقم هاتف الطالب</th>
                  <th className="p-3">رقم ولي الأمر</th>
                  <th className="p-3 text-center">مرات الغياب الكلية</th>
                  {absenceSubTab === 'extra_session' && (
                    <th className="p-3 text-center">حالة الغياب بالحصة</th>
                  )}
                  <th className="p-3 text-center">إشعار ولي الأمر</th>
                  {absenceSubTab === 'extra_session' && (
                    <th className="p-3 text-center">إجراء سريع</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(absenceSubTab === 'extra_session' ? extraSessionAbsentStudents : (absenceSubTab === 'sat_mon' ? satMonStudents : absenceSubTab === 'tue_thu' ? tueThuStudents : chronicAbsentStudents)).length === 0 ? (
                  <tr>
                    <td colSpan={absenceSubTab === 'extra_session' ? 10 : 8} className="p-8 text-center text-slate-400">
                      {absenceSubTab === 'extra_session' 
                        ? '🎉 رائع جداً! لا يوجد أي غائب عن الحصة الإضافية في التاريخ والمحددات المختارة.'
                        : 'لا يوجد طلاب مسجلين في هذه القائمة حالياً.'}
                    </td>
                  </tr>
                ) : (
                  (absenceSubTab === 'extra_session' ? extraSessionAbsentStudents : (absenceSubTab === 'sat_mon' ? satMonStudents : absenceSubTab === 'tue_thu' ? tueThuStudents : chronicAbsentStudents)).map(st => {
                    const absenceCount = (st.absentCount || 0);

                    // Extra session specific status
                    const targetArShort = getArDateShort(extraSessionDate);
                    const isAlreadyMarkedAbsent = attendanceList.some(
                      a => a.studentId === st.uid && 
                           normalizeDigits(a.date) === normalizeDigits(targetArShort) && 
                           a.status === 'absent'
                    );

                    const sessionDateFormatted = formatIsoToArDate(extraSessionDate);
                    const msg = absenceSubTab === 'extra_session'
                      ? `السلام عليكم ورحمة الله، ولي أمر الطالب: ${st.name}.\nنحيط سيادتكم علماً بغياب الطالب عن الحصة الإضافية المقررة بالسنتر (${extraSessionName}) بتاريخ (${sessionDateFormatted}).\nيرجى التواصل مع إدارة السنتر لمعرفة سبب الغياب ومتابعة الدروس.`
                      : absenceSubTab === 'chronic'
                        ? `السلام عليكم ورحمة الله، ولي أمر الطالب: ${st.name}.\nنحيط سيادتكم علماً بتكرار غياب الطالب عن حصص السنتر (${absenceCount} مرات غياب).\nيرجى التواصل مع إدارة السنتر لضمان عدم تأخر الطالب دراسياً.`
                        : `السلام عليكم ورحمة الله، ولي أمر الطالب: ${st.name}.\nنحيط سيادتكم علماً بغياب الطالب عن موعد حصته المقررة بالسنتر (${st.centerGroup || 'المجموعة'}).\nيرجى التواصل معنا لمعرفة أسباب الغياب ومتابعة الدروس.`;
                    
                    const whatsappUrl = st.parentPhone ? buildWhatsAppUrl(st.parentPhone, msg) : null;

                    return (
                      <tr key={st.uid} className="hover:bg-slate-50/70">
                        <td className="p-3 font-bold text-slate-900">{st.name}</td>
                        <td className="p-3 font-mono text-slate-600">{st.code || '-'}</td>
                        <td className="p-3 text-amber-700 font-bold">{st.centerGroup || 'مجموعة السبت والثلاثاء'}</td>
                        <td className="p-3 text-slate-500">{st.grade}</td>
                        <td className="p-3 font-mono text-slate-600">{st.phone || '-'}</td>
                        <td className="p-3 font-mono text-slate-600">{st.parentPhone || '-'}</td>
                        <td className="p-3 text-center">
                          <span className={`px-2.5 py-0.5 rounded-full text-xs font-black ${
                            absenceCount >= 3 
                              ? 'bg-rose-600 text-white' 
                              : absenceCount >= 1 
                                ? 'bg-rose-100 text-rose-800' 
                                : 'bg-slate-100 text-slate-700'
                          }`}>
                            {absenceCount}
                          </span>
                        </td>
                        {absenceSubTab === 'extra_session' && (
                          <td className="p-3 text-center">
                            {isAlreadyMarkedAbsent ? (
                              <span className="bg-rose-100 text-rose-800 text-[10px] font-black px-2 py-0.5 rounded-full inline-flex items-center gap-1 border border-rose-200">
                                <span>✓</span>
                                <span>مسجل غائب رسمياً</span>
                              </span>
                            ) : (
                              <span className="bg-amber-100 text-amber-900 text-[10px] font-bold px-2 py-0.5 rounded-full border border-amber-300">
                                لم يحضر بالحصة
                              </span>
                            )}
                          </td>
                        )}
                        <td className="p-3 text-center">
                          {whatsappUrl ? (
                            <a
                              href={whatsappUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 px-3 py-1 rounded-lg font-bold text-[10px] inline-flex items-center gap-1.5 cursor-pointer"
                              title="إرسال رسالة إنذار غياب عبر واتساب لولي الأمر"
                            >
                              <MessageCircle className="w-3.5 h-3.5 text-emerald-600" />
                              <span>إنذار واتساب</span>
                            </a>
                          ) : (
                            <span className="text-slate-300">-</span>
                          )}
                        </td>
                        {absenceSubTab === 'extra_session' && (
                          <td className="p-3 text-center">
                            {isAlreadyMarkedAbsent ? (
                              <span className="text-slate-400 text-[11px] font-bold">تم الرصد</span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleMarkSingleAbsentExtraSession(st)}
                                className="bg-rose-50 hover:bg-rose-600 text-rose-700 hover:text-white border border-rose-200 px-2.5 py-1 rounded-lg text-[10px] font-black transition-colors cursor-pointer"
                                title="تسجيل غياب الطالب رسمياً وزيادة عداد الغياب في ملفه"
                              >
                                🔴 تثبيت غيابه
                              </button>
                            )}
                          </td>
                        )}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SUB-TAB 4: RECITATIONS & ORAL GRADES */}
      {subTab === 'recitations' && (
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Add Recitation Form */}
          <div className="lg:col-span-1 bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
              <Award className="w-5 h-5 text-indigo-600" />
              <h3 className="font-black text-slate-900 text-base">رصد درجة تسميع شفوي</h3>
            </div>

            <p className="text-xs text-slate-500 leading-relaxed">
              إدخال درجة التسميع الفورية للطالب مع نقاط تفوق فورية تُضاف لرصيد الطالب في ترتيب الأوائل.
            </p>

            {/* Recitation Mode Selector */}
            <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100 rounded-2xl text-[11px] font-black">
              <button
                type="button"
                onClick={() => setRecitationType('normal')}
                className={`p-2 rounded-xl transition-all cursor-pointer ${
                  recitationType === 'normal' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                تسميع الحصة العادي
              </button>
              <button
                type="button"
                onClick={() => setRecitationType('makeup')}
                className={`p-2 rounded-xl transition-all cursor-pointer ${
                  recitationType === 'makeup' ? 'bg-white text-emerald-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                تسميع تعويضي 🔄
              </button>
              <button
                type="button"
                onClick={() => setRecitationType('missed')}
                className={`p-2 rounded-xl transition-all cursor-pointer ${
                  recitationType === 'missed' ? 'bg-white text-rose-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                رصد غياب (درجة 0) ❌
              </button>
              <button
                type="button"
                onClick={() => setRecitationType('cancel_session')}
                className={`p-2 rounded-xl transition-all cursor-pointer ${
                  recitationType === 'cancel_session' ? 'bg-white text-amber-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                إلغاء التسميع للحصة 🚫
              </button>
            </div>

            {/* Makeup Recitation Timing Option */}
            {recitationType === 'makeup' && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs space-y-2">
                <span className="font-bold text-emerald-900 block">موعد حضور الطالب للتسميع التعويضي:</span>
                <div className="space-y-1.5">
                  <label className="flex items-center gap-2 cursor-pointer text-slate-800 font-medium">
                    <input
                      type="radio"
                      name="makeupTiming"
                      value="before_next"
                      checked={makeupTiming === 'before_next'}
                      onChange={() => setMakeupTiming('before_next')}
                      className="text-emerald-600 focus:ring-emerald-500"
                    />
                    <span>قبل موعد الحصة التالية (تُحسب وتُعتمد الدرجة وتُرسل لولي الأمر ✅)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer text-slate-800 font-medium">
                    <input
                      type="radio"
                      name="makeupTiming"
                      value="after_next"
                      checked={makeupTiming === 'after_next'}
                      onChange={() => setMakeupTiming('after_next')}
                      className="text-rose-600 focus:ring-rose-500"
                    />
                    <span>بعد موعد الحصة التالية (لا تُحسب بالمجموع وفقاً للائحة ⚠️)</span>
                  </label>
                </div>
              </div>
            )}

            {/* Session Cancellation Notice */}
            {recitationType === 'cancel_session' && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-900 leading-relaxed font-medium">
                💡 <b>تنبيه المعلم:</b> عند إلغاء التسميع للحصة، لن يُحسب في تقييم الطلاب ولن يُرسل أي إشعار غياب لولي الأمر.
              </div>
            )}

            <form onSubmit={handleRecordRecitation} className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">عنوان التسميع / الدرس:</label>
                <input
                  type="text"
                  value={recTitle}
                  onChange={e => setRecTitle(e.target.value)}
                  placeholder="مثال: تسميع كلمات الوحدة الأولى"
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">درجة الطالب:</label>
                  <input
                    type="number"
                    value={recScore}
                    onChange={e => setRecScore(Number(e.target.value))}
                    min={0}
                    max={recFinalGrade}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-base font-black text-indigo-600 outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">الدرجة النهائية:</label>
                  <input
                    type="number"
                    value={recFinalGrade}
                    onChange={e => setRecFinalGrade(Number(e.target.value))}
                    min={1}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-base font-black text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">ملاحظات المعلم / المساعد:</label>
                <input
                  type="text"
                  value={recNotes}
                  onChange={e => setRecNotes(e.target.value)}
                  placeholder="ممتاز، يحتاج مراجعة، إلخ..."
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <button
                type="submit"
                disabled={recitationType !== 'cancel_session' && !selectedStudent}
                className={`w-full py-3 rounded-2xl shadow-md transition-all text-xs font-black flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed ${
                  recitationType === 'cancel_session'
                    ? 'bg-amber-600 hover:bg-amber-700 text-white'
                    : recitationType === 'missed'
                    ? 'bg-rose-600 hover:bg-rose-700 text-white'
                    : recitationType === 'makeup'
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                    : 'bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white'
                }`}
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>
                  {recitationType === 'cancel_session'
                    ? 'إلغاء التسميع للحصة رسمياً (بدون إشعار غياب) 🚫'
                    : recitationType === 'missed'
                    ? 'رصد غياب الطالب عن التسميع (الدرجة: 0) ❌'
                    : recitationType === 'makeup'
                    ? `اعتماد التسميع التعويضي (${makeupTiming === 'before_next' ? 'مقبول ومحسوب ✅' : 'متأخر وغير محسوب ⚠️'})`
                    : 'رصد درجة التسميع للطالب (+ نقاط تفوق)'}
                </span>
              </button>
            </form>
          </div>

          {/* Recitations Table */}
          <div className="lg:col-span-2 bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-black text-slate-900 text-base">سجل درجات التسميع والشفوي</h3>
              <span className="bg-indigo-50 text-indigo-800 text-xs font-bold px-3 py-1 rounded-full">
                {recitationList.length} تسميع
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                  <tr>
                    <th className="p-3">الطالب</th>
                    <th className="p-3">التسميع</th>
                    <th className="p-3 text-center">الدرجة</th>
                    <th className="p-3 text-center">النسبة</th>
                    <th className="p-3">التاريخ</th>
                    <th className="p-3 text-center">إشعار ولي الأمر</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {recitationList.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-6 text-center text-slate-400">لم يتم تسجيل أي تسميعات بعد.</td>
                    </tr>
                  ) : (
                    recitationList.slice(0, 15).map(rec => {
                      const st = users.find(u => u.uid === rec.studentId);
                      const parentPhone = st?.parentPhone;
                      const whatsappUrl = parentPhone 
                        ? buildWhatsAppUrl(parentPhone, `السلام عليكم، ولي أمر الطالب: ${rec.studentName}.\nنتيجة تسميع (${rec.title}): ${rec.score} من ${rec.finalGrade} (${rec.percentage}%).\nملاحظات: ${rec.notes || 'جيد جداً'}.`)
                        : null;

                      return (
                        <tr key={rec.id} className="hover:bg-slate-50/70">
                          <td className="p-3 font-bold text-slate-900">
                            <div>{rec.studentName}</div>
                            {rec.status === 'cancelled' && (
                              <span className="text-[10px] text-amber-700 font-bold bg-amber-50 px-2 py-0.5 rounded-full inline-block mt-0.5">
                                🚫 ملغي رسمياً
                              </span>
                            )}
                            {rec.status === 'missed' && (
                              <span className="text-[10px] text-rose-700 font-bold bg-rose-50 px-2 py-0.5 rounded-full inline-block mt-0.5">
                                ❌ غياب عن التسميع (0)
                              </span>
                            )}
                            {rec.status === 'makeup_accepted' && (
                              <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded-full inline-block mt-0.5">
                                ✅ تعويضي مقبول (قبل الحصة)
                              </span>
                            )}
                            {rec.status === 'makeup_expired' && (
                              <span className="text-[10px] text-slate-600 font-bold bg-slate-100 px-2 py-0.5 rounded-full inline-block mt-0.5">
                                ⚠️ تعويضي متأخر (لا يُحسب)
                              </span>
                            )}
                          </td>
                          <td className="p-3 font-medium text-slate-800">{rec.title}</td>
                          <td className="p-3 text-center font-bold font-mono text-indigo-700">
                            {rec.score} / {rec.finalGrade}
                          </td>
                          <td className="p-3 text-center">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                              rec.percentage >= 60 ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                            }`}>
                              {rec.percentage}%
                            </span>
                          </td>
                          <td className="p-3 text-slate-500">{rec.date}</td>
                          <td className="p-3 text-center">
                            {whatsappUrl ? (
                              <a
                                href={whatsappUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 px-2.5 py-1 rounded-lg font-bold text-[10px] inline-flex items-center gap-1 cursor-pointer"
                              >
                                <MessageCircle className="w-3 h-3" />
                                <span>واتساب</span>
                              </a>
                            ) : (
                              <span className="text-slate-300">-</span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB 5: VIDEO WATCH PROGRESS REPORT (< 50% WATCH TIME) */}
      {subTab === 'video_watch' && (
        <div className="space-y-6">
          {/* Top KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center font-black">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-500">مشاهدات أقل من 50% (مطلوب متابعتهم)</p>
                <h3 className="text-2xl font-black text-rose-600 mt-0.5">
                  {videoProgressList.filter(r => (r.percentage || 0) < 50).length}
                </h3>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-black">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-500">مشاهدات مكتملة (50% فأكثر)</p>
                <h3 className="text-2xl font-black text-emerald-600 mt-0.5">
                  {videoProgressList.filter(r => (r.percentage || 0) >= 50).length}
                </h3>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-black">
                <Users className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-500">إجمالي طلاب السنتر المقيدين</p>
                <h3 className="text-2xl font-black text-indigo-600 mt-0.5">
                  {users.filter(u => u.isCenterStudent).length} طالب
                </h3>
              </div>
            </div>
          </div>

          {/* Filter Bar & Print Header */}
          <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                  <Video className="w-5 h-5 text-indigo-600" />
                  <span>قائمة متابعة نسب مشاهدة محاضرات السنتر والمنصة</span>
                </h3>
                <p className="text-xs text-slate-500 font-medium">
                  حصر فوري لطلاب السنتر الذين شاهدوا أقل من 50% من مدة الفيديو للتنبيه وإرسال واتساب لولي الأمر
                </p>
              </div>

              <button
                type="button"
                onClick={handlePrintVideoWatchReport}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-xs font-black flex items-center gap-2 shadow-xs transition-colors cursor-pointer self-start sm:self-auto"
              >
                <Printer className="w-4 h-4" />
                <span>🖨️ طباعة كشف المتابعة (A4)</span>
              </button>
            </div>

            {/* Filter Inputs Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {/* Search */}
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
                <input
                  type="text"
                  placeholder="بحث باسم الطالب، الكود، المحاضرة..."
                  value={videoWatchSearch}
                  onChange={e => setVideoWatchSearch(e.target.value)}
                  className="w-full pl-3 pr-9 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-indigo-500 focus:bg-white"
                />
              </div>

              {/* Grade Filter */}
              <div>
                <select
                  value={videoWatchGrade}
                  onChange={e => setVideoWatchGrade(e.target.value)}
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-indigo-500 focus:bg-white cursor-pointer"
                >
                  <option value="all">🌐 جميع المراحل والصفوف</option>
                  {availableGrades.map((grd, idx) => (
                    <option key={idx} value={grd}>{grd}</option>
                  ))}
                </select>
              </div>

              {/* Group Filter */}
              <div>
                <select
                  value={videoWatchGroup}
                  onChange={e => setVideoWatchGroup(e.target.value)}
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-indigo-500 focus:bg-white cursor-pointer"
                >
                  <option value="all">👥 جميع مجموعات السنتر</option>
                  {availableGroups.map((grp, idx) => (
                    <option key={idx} value={grp}>{grp}</option>
                  ))}
                </select>
              </div>

              {/* Threshold Filter */}
              <div>
                <select
                  value={videoWatchThreshold}
                  onChange={e => setVideoWatchThreshold(e.target.value as any)}
                  className="w-full p-2 bg-rose-50 border border-rose-200 text-rose-950 font-black rounded-xl text-xs outline-none focus:border-rose-500 cursor-pointer"
                >
                  <option value="less50">🚨 أقل من 50% فقط (المطلوب متابعتهم)</option>
                  <option value="less25">⚠️ حرجة جداً: أقل من 25%</option>
                  <option value="zero">❌ لم يشاهد إطلاقاً (0%)</option>
                  <option value="all">📊 إظهار جميع النسب</option>
                </select>
              </div>
            </div>
          </div>

          {/* Records Table */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead>
                  <tr className="bg-slate-50 text-slate-700 font-black border-b border-slate-200">
                    <th className="p-3.5">الطالب</th>
                    <th className="p-3.5">الكود والصف</th>
                    <th className="p-3.5">مجموعة السنتر</th>
                    <th className="p-3.5">اسم المحاضرة / الفيديو</th>
                    <th className="p-3.5 text-center">نسبة المشاهدة</th>
                    <th className="p-3.5 text-center">آخر مشاهدة</th>
                    <th className="p-3.5 text-center">إجراءات المتابعة</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredVideoWatchRecords.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-10 text-center">
                        <div className="flex flex-col items-center justify-center gap-2">
                          <CheckCircle2 className="w-10 h-10 text-emerald-500" />
                          <p className="font-black text-slate-700 text-sm">
                            {videoWatchThreshold === 'less50'
                              ? 'لا يوجد أي طالب سنتر لديه نسبة مشاهدة أقل من 50% مطابقة لهذا البحث! 🎉'
                              : 'لا توجد سجلات مشاهدة مطابقة للبحث المحدد.'}
                          </p>
                          <p className="text-slate-400 text-xs">
                            يتم تسجيل وتحديث نسبة مشاهدة كل طالب تلقائياً أثناء تشغيله للفيديو على المنصة.
                          </p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredVideoWatchRecords.map((rec) => {
                      const isLow = (rec.percentage || 0) < 50;
                      const parentPhone = rec.parentPhone || rec.studentPhone;
                      
                      const whatsappText = `السلام عليكم ورحمة الله، ولي أمر الطالب: *${rec.studentName}*.\nنحيط سيادتكم علماً بأن نسبة مشاهدة الطالب لمحاضرة *${rec.materialTitle}* على المنصة بلغت *${rec.percentage}%* فقط (وهي أقل من الحد الأدنى 50% المطلوب لحضور السنتر).\nيرجى التنبيه عليه باستكمال المحاضرة قبل موعد الحصة القادمة.\nمع تحيات إدارة الأستاذ محمد صابر.`;
                      const whatsappUrl = parentPhone ? buildWhatsAppUrl(parentPhone, whatsappText) : undefined;

                      return (
                        <tr key={rec.id} className={`hover:bg-slate-50/80 transition-colors ${isLow ? 'bg-rose-50/20' : ''}`}>
                          <td className="p-3.5">
                            <div className="font-black text-slate-900">{rec.studentName}</div>
                            {rec.studentPhone && (
                              <div className="text-[10px] text-slate-400 font-mono" dir="ltr">{rec.studentPhone}</div>
                            )}
                          </td>
                          <td className="p-3.5">
                            <span className="font-mono font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md text-[11px]">
                              {rec.studentCode || '-'}
                            </span>
                            <div className="text-[11px] text-slate-500 mt-0.5">{rec.grade || 'غير محدد'}</div>
                          </td>
                          <td className="p-3.5">
                            <span className="text-[11px] font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-lg inline-block">
                              {rec.centerGroup || 'غير محددة'}
                            </span>
                          </td>
                          <td className="p-3.5 max-w-xs">
                            <div className="font-bold text-slate-900 truncate" title={rec.materialTitle}>
                              {rec.materialTitle}
                            </div>
                            {rec.watchedSeconds !== undefined && rec.watchedSeconds > 0 && (
                              <div className="text-[10px] text-slate-400 mt-0.5 font-mono">
                                شاهد: {Math.floor(rec.watchedSeconds / 60)} دقيقة
                              </div>
                            )}
                          </td>
                          <td className="p-3.5 text-center min-w-[130px]">
                            <div className="flex flex-col items-center gap-1">
                              <span className={`px-2.5 py-0.5 rounded-full text-xs font-black flex items-center gap-1 ${
                                isLow ? 'bg-rose-100 text-rose-800 border border-rose-200' : 'bg-emerald-100 text-emerald-800'
                              }`}>
                                {isLow && <AlertTriangle className="w-3 h-3 text-rose-600" />}
                                <span>{rec.percentage}%</span>
                              </span>
                              <div className="w-24 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-all duration-300 ${
                                    isLow ? 'bg-rose-500' : (rec.percentage < 80 ? 'bg-amber-500' : 'bg-emerald-500')
                                  }`}
                                  style={{ width: `${Math.min(rec.percentage || 0, 100)}%` }}
                                />
                              </div>
                            </div>
                          </td>
                          <td className="p-3.5 text-center text-[11px] text-slate-500">
                            {rec.updatedAt ? new Date(rec.updatedAt).toLocaleDateString('ar-EG', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-'}
                          </td>
                          <td className="p-3.5 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              {whatsappUrl ? (
                                <a
                                  href={whatsappUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="bg-emerald-600 hover:bg-emerald-700 text-white px-2.5 py-1 rounded-lg font-black text-[11px] inline-flex items-center gap-1 shadow-xs transition-colors cursor-pointer"
                                  title="إرسال تنبيه واتساب فوري لولي الأمر"
                                >
                                  <MessageCircle className="w-3 h-3" />
                                  <span>واتساب ولي الأمر</span>
                                </a>
                              ) : (
                                <span className="text-[10px] text-slate-400 italic">لا يوجد هاتف</span>
                              )}

                              <button
                                type="button"
                                onClick={() => {
                                  setEditingProgress(rec);
                                  setManualPctInput(rec.percentage || 100);
                                }}
                                className="bg-slate-100 hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 p-1 rounded-lg border border-slate-200 transition-colors cursor-pointer text-[10px] font-bold"
                                title="تعديل نسبة المشاهدة يدوياً"
                              >
                                ✏️ تعديل
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* MANUAL VIDEO PROGRESS ADJUSTMENT MODAL */}
      {editingProgress && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-black text-slate-900">تعديل نسبة مشاهدة الفيديو يدوياً</h3>
              <button
                type="button"
                onClick={() => setEditingProgress(null)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-slate-50 p-3 rounded-2xl space-y-1 text-xs font-bold text-slate-700">
              <p>الطالب: <strong className="text-slate-950">{editingProgress.studentName}</strong></p>
              <p>المحاضرة: <strong className="text-indigo-700">{editingProgress.materialTitle}</strong></p>
              <p>النسبة الحالية المسجلة: <span className="text-rose-600 font-black">{editingProgress.percentage}%</span></p>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-black text-slate-800">حدد النسبة الجديدة (%):</label>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  value={manualPctInput}
                  onChange={e => setManualPctInput(Number(e.target.value))}
                  className="flex-1 cursor-pointer"
                />
                <span className="font-mono font-black text-lg text-indigo-600 w-12 text-center">
                  {manualPctInput}%
                </span>
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setManualPctInput(100)}
                  className="bg-emerald-50 text-emerald-800 font-black text-[11px] px-2.5 py-1 rounded-lg border border-emerald-200 hover:bg-emerald-100 cursor-pointer"
                >
                  احتساب كامل (100%)
                </button>
                <button
                  type="button"
                  onClick={() => setManualPctInput(50)}
                  className="bg-amber-50 text-amber-800 font-black text-[11px] px-2.5 py-1 rounded-lg border border-amber-200 hover:bg-amber-100 cursor-pointer"
                >
                  الحد الأدنى (50%)
                </button>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setEditingProgress(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={() => handleUpdateVideoProgress(editingProgress, manualPctInput)}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2 rounded-xl text-xs font-black cursor-pointer shadow-xs"
              >
                حفظ التعديل الآن
              </button>
            </div>
          </div>
        </div>
      )}
      {/* CAMERA SCANNER MODAL */}
      <CameraBarcodeScanner
        isOpen={isCameraOpen}
        onClose={() => setIsCameraOpen(false)}
        onScan={handleCameraScan}
        title="مسح باركود الطالب بكاميرا الموبايل أو الويب كام"
      />

      {/* GATE ADMISSION & PAYMENT INSPECTION MODAL */}
      <GateAdmissionModal
        isOpen={!!gateInspectionStudent}
        student={gateInspectionStudent}
        onClose={() => setGateInspectionStudent(null)}
        onAdmit={handleGateAdmit}
        onReject={handleGateReject}
        onQuickPayAndAdmit={handleQuickPayAndAdmit}
        paymentList={paymentList}
        currentMonthName={new Date().toLocaleDateString('ar-EG', { month: 'long' })}
        effectivePaymentMonth={effectivePaymentMonth}
        defaultPaymentAmount={paymentAmount || 200}
        alreadyMarkedPresent={autoMarkAttendanceOnScan}
        activeSessionGrade={activeSessionGrade}
        activeSessionGroup={activeSessionGroup}
        isExtraSessionActive={isExtraSessionMode || extraSessionPlans.some(p => p.isActive)}
        activeExtraSessionName={extraSessionPlans.find(p => p.isActive)?.title || extraSessionName}
        videoWatchPct={gateInspectionStudent ? (videoProgressList.find(v => v.studentId === gateInspectionStudent.uid)?.percentage || 0) : 0}
        recitationScore={gateInspectionStudent ? (() => {
          const rec = recitationList.find(r => r.studentId === gateInspectionStudent.uid);
          return rec ? { score: rec.score, max: rec.finalGrade || 10, title: rec.title } : undefined;
        })() : undefined}
        attendanceStats={gateInspectionStudent ? {
          presentCount: attendanceList.filter(a => a.studentId === gateInspectionStudent.uid && a.status === 'present').length,
          lateCount: attendanceList.filter(a => a.studentId === gateInspectionStudent.uid && a.status === 'late').length,
          absentCount: attendanceList.filter(a => a.studentId === gateInspectionStudent.uid && a.status === 'absent').length
        } : undefined}
      />

      {/* MULTI-SLOT EXTRA SESSIONS MANAGER MODAL */}
      <ExtraSessionManagerModal
        isOpen={isExtraSessionModalOpen}
        onClose={() => setIsExtraSessionModalOpen(false)}
        plans={extraSessionPlans}
        onSavePlan={handleSaveExtraPlan}
        onDeletePlan={handleDeleteExtraPlan}
        onToggleActive={handleToggleExtraPlanActive}
        availableGrades={availableGrades}
      />

      {/* CENTER GROUPS SCHEDULE BUILDER MODAL (Visual 2-Days + Time Table Selector) */}
      <GroupScheduleBuilderModal
        isOpen={isGroupManagerOpen}
        onClose={() => setIsGroupManagerOpen(false)}
        availableGroups={availableGroups}
        onSelectGroup={(grp) => {
          setActiveSessionGroup(grp);
          setIsGroupManagerOpen(false);
        }}
      />

      {/* STUDENT CARD MANAGER MODAL (Scan External Card / Generate & Print) */}
      <StudentCardManagerModal
        isOpen={isCardModalOpen}
        onClose={() => {
          setIsCardModalOpen(false);
          setCardModalStudent(null);
        }}
        student={cardModalStudent}
        onStudentUpdated={(updated) => {
          setUsers(prev => prev.map(u => u.uid === updated.uid ? updated : u));
          if (selectedStudent && selectedStudent.uid === updated.uid) {
            setSelectedStudent(updated);
          }
        }}
      />
    </div>
  );
}
