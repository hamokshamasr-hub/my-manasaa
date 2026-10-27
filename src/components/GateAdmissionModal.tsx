import React, { useState } from 'react';
import { 
  Shield, 
  ShieldAlert, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  DollarSign, 
  User, 
  Phone, 
  Building, 
  GraduationCap, 
  MessageCircle, 
  AlertTriangle, 
  ExternalLink, 
  Check, 
  X,
  CreditCard,
  Video,
  Award,
  Sparkles,
  Calendar
} from 'lucide-react';
import { AppUser } from '../contexts/AuthContext';
import { buildWhatsAppUrl } from '../lib/whatsapp';

export interface CenterPayment {
  id: string;
  studentId: string;
  studentName: string;
  studentCode: string;
  amount: number;
  month: string;
  date: string;
  receiptNumber: string;
  receivedBy: string;
  notes?: string;
  createdAt: number;
}

interface GateAdmissionModalProps {
  isOpen: boolean;
  student: AppUser | null;
  onClose: () => void;
  onAdmit: (student: AppUser, status: 'present' | 'late', notes?: string) => void;
  onReject: (student: AppUser, reason: string, whatsappMessage?: string) => void;
  onQuickPayAndAdmit: (student: AppUser, amount: number, month: string) => void;
  paymentList: CenterPayment[];
  currentMonthName: string;
  effectivePaymentMonth: string;
  defaultPaymentAmount: number;
  activeSessionGrade?: string;
  activeSessionGroup?: string;
  isExtraSessionActive?: boolean;
  activeExtraSessionName?: string;
  videoWatchPct?: number;
  recitationScore?: { score: number; max: number; title: string };
  attendanceStats?: { presentCount: number; lateCount: number; absentCount: number };
  alreadyMarkedPresent?: boolean;
}

export default function GateAdmissionModal({
  isOpen,
  student,
  onClose,
  onAdmit,
  onReject,
  onQuickPayAndAdmit,
  paymentList,
  currentMonthName,
  effectivePaymentMonth,
  defaultPaymentAmount,
  activeSessionGrade = 'all',
  activeSessionGroup = 'all',
  isExtraSessionActive = false,
  activeExtraSessionName = '',
  videoWatchPct = 0,
  recitationScore,
  attendanceStats = { presentCount: 0, lateCount: 0, absentCount: 0 },
  alreadyMarkedPresent = false
}: GateAdmissionModalProps) {
  const [rejectReason, setRejectReason] = useState<string>('عدم سداد المصاريف المقررة لهذا الشهر');
  const [customRejectNote, setCustomRejectNote] = useState<string>('');
  const [showRejectForm, setShowRejectForm] = useState<boolean>(false);
  const [showQuickPayForm, setShowQuickPayForm] = useState<boolean>(false);
  const [customPayAmount, setCustomPayAmount] = useState<number>(defaultPaymentAmount || 200);
  const [customPayMonth, setCustomPayMonth] = useState<string>(effectivePaymentMonth || currentMonthName);

  if (!isOpen || !student) return null;

  // 1. Check student payment records
  const studentPayments = paymentList.filter(p => p.studentId === student.uid);
  
  // Did student pay this month?
  const targetMonthNormalized = (effectivePaymentMonth || currentMonthName).toLowerCase().trim();
  const currentMonthPayment = studentPayments.find(p => {
    const pMonth = (p.month || '').toLowerCase().trim();
    return pMonth.includes(targetMonthNormalized) || targetMonthNormalized.includes(pMonth);
  });

  const isPaidThisMonth = !!currentMonthPayment;

  // 2. Schedule & Group validation
  const studentGroup = (student.centerGroup || '').trim();
  const isGradeMatch = activeSessionGrade === 'all' || !student.grade || student.grade === activeSessionGrade;
  const isGroupMatch = isExtraSessionActive || activeSessionGroup === 'all' || !studentGroup || studentGroup.includes(activeSessionGroup) || activeSessionGroup.includes(studentGroup);

  // 3. Prepare Parent WhatsApp Link
  const parentWhatsAppUrl = student.parentPhone
    ? buildWhatsAppUrl(student.parentPhone, `السلام عليكم ورحمة الله، ولي أمر الطالب: ${student.name}.\nنحيطكم علماً بأن الطالب متواجد حالياً عند بوابة السنتر.`)
    : null;

  const handleConfirmReject = () => {
    const finalReason = customRejectNote.trim() ? `${rejectReason} (${customRejectNote.trim()})` : rejectReason;
    const origin = window.location.origin;
    const parentMsg = `السلام عليكم ورحمة الله، ولي أمر الطالب: ${student.name}.\nنحيط سيادتكم علماً بأنه تعذر السماح للطالب بدخول حصة السنتر اليوم نظراً لـ: [${finalReason}].\nيرجى التواصل مع إدارة السنتر هاتفياً للمتابعة.\nرابط تقرير الطالب: ${origin}/parent-report/${student.code || student.uid}`;
    onReject(student, finalReason, parentMsg);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-200">
        
        {/* Top Header */}
        <div className={`p-5 text-white flex items-center justify-between ${
          isPaidThisMonth 
            ? 'bg-gradient-to-r from-emerald-800 via-emerald-700 to-teal-800' 
            : 'bg-gradient-to-r from-rose-900 via-rose-800 to-slate-900'
        }`}>
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-xl shadow-md ${
              isPaidThisMonth ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'
            }`}>
              {isPaidThisMonth ? <CheckCircle2 className="w-7 h-7" /> : <ShieldAlert className="w-7 h-7" />}
            </div>
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-black/30 backdrop-blur-sm">
                <span>🛡️ فحص صلاحية الدخول عند البوابة</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-white">{student.name}</h2>
              <div className="text-xs font-bold opacity-90 flex items-center gap-2 mt-0.5">
                <span>كود الطالب: <b className="font-mono bg-white/20 px-2 py-0.5 rounded">#{student.code || student.uid?.substring(0, 6)}</b></span>
                {student.grade && <span>• {student.grade}</span>}
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {alreadyMarkedPresent && (
          <div className="bg-emerald-600 text-white px-5 py-2 text-xs font-black flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-200" />
              <span>تم تسجيل حضور الطالب تلقائياً عند قراءة الكود | يمكنك مراجعة موقف السداد بالأسفل أو إلغاء الدخول</span>
            </span>
            <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded font-mono">مسجل كحاضر الآن ✓</span>
          </div>
        )}

        {/* Content Body */}
        <div className="p-5 sm:p-6 space-y-4 max-h-[75vh] overflow-y-auto">
          
          {/* 1. PAYMENT STATUS CARD (Most critical check) */}
          <div className={`p-5 rounded-2xl border-2 transition-all ${
            isPaidThisMonth 
              ? 'bg-emerald-50/90 border-emerald-300 text-emerald-950' 
              : 'bg-rose-50/90 border-rose-300 text-rose-950'
          }`}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5 ${
                  isPaidThisMonth ? 'bg-emerald-200 text-emerald-800' : 'bg-rose-200 text-rose-800'
                }`}>
                  <CreditCard className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">موقف سداد السنتر:</span>
                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                      isPaidThisMonth ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'
                    }`}>
                      {isPaidThisMonth ? 'خالص المصاريف بالكامل ✅' : 'لم يسدد المصاريف ⛔'}
                    </span>
                  </div>
                  <h3 className="text-base sm:text-lg font-black mt-1">
                    {isPaidThisMonth 
                      ? `تم سداد مصاريف (${currentMonthPayment?.month || effectivePaymentMonth}) بنجاح`
                      : `مطلوب سداد مصاريف (${effectivePaymentMonth || currentMonthName})`
                    }
                  </h3>
                  {isPaidThisMonth ? (
                    <p className="text-xs font-bold text-emerald-800 mt-1 flex flex-wrap gap-x-3 gap-y-1">
                      <span>المبلغ: <b>{currentMonthPayment?.amount} ج.م</b></span>
                      <span>إيصال: <b className="font-mono">{currentMonthPayment?.receiptNumber}</b></span>
                      <span>بتاريخ: <b>{currentMonthPayment?.date}</b></span>
                    </p>
                  ) : (
                    <p className="text-xs font-bold text-rose-700 mt-1">
                      تنبيه للمشرف: الطالب عليه مستحقات شهرية لم يتم تسويتها بعد. يرجى التحصيل الآن أو اتخاذ قرار الدخول.
                    </p>
                  )}
                </div>
              </div>

              {!isPaidThisMonth && (
                <button
                  type="button"
                  onClick={() => setShowQuickPayForm(!showQuickPayForm)}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-black px-4 py-2.5 rounded-xl text-xs flex items-center justify-center gap-2 shadow-sm transition-all flex-shrink-0 cursor-pointer"
                >
                  <DollarSign className="w-4 h-4" />
                  <span>تحصيل المصاريف الآن 💵</span>
                </button>
              )}
            </div>

            {/* Quick Pay Inline Form */}
            {showQuickPayForm && !isPaidThisMonth && (
              <div className="mt-4 pt-4 border-t border-rose-200/80 bg-white/80 p-4 rounded-xl space-y-3">
                <h4 className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-emerald-600" />
                  <span>تحصيل فوري وتسجيل دفعة جديدة للسنتر:</span>
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-bold text-slate-600 block mb-1">المبلغ المحصل (ج.م):</label>
                    <input
                      type="number"
                      value={customPayAmount}
                      onChange={e => setCustomPayAmount(Number(e.target.value))}
                      className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs font-black text-slate-900 outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-600 block mb-1">عن شهر:</label>
                    <input
                      type="text"
                      value={customPayMonth}
                      onChange={e => setCustomPayMonth(e.target.value)}
                      className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-900 outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowQuickPayForm(false)}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-100"
                  >
                    إلغاء
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onQuickPayAndAdmit(student, customPayAmount, customPayMonth);
                      setShowQuickPayForm(false);
                    }}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-black px-4 py-1.5 rounded-lg text-xs flex items-center gap-1.5 shadow-sm cursor-pointer"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>تأكيد التحصيل والسماح بالدخول فوراً</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* 2. GROUP & SCHEDULE CHECK CARD */}
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-500 flex items-center gap-1.5">
                <Building className="w-3.5 h-3.5 text-indigo-600" />
                <span>مجموعة وموعد الطالب بالسنتر:</span>
              </span>
              <span className="font-black text-slate-800 bg-white px-2.5 py-0.5 rounded-md border border-slate-200">
                {student.centerGroup || 'غير محددة'}
              </span>
            </div>

            {/* Extra Session Indicator */}
            {isExtraSessionActive ? (
              <div className="flex items-center gap-2 p-2 bg-amber-50 text-amber-900 border border-amber-200 rounded-xl text-xs font-bold">
                <Sparkles className="w-4 h-4 text-amber-600 flex-shrink-0" />
                <span>القاعة تعمل حالياً في وضع <b>[الحصة الإضافية: {activeExtraSessionName}]</b> - مسموح بدخول جميع الطلاب المستهدفين.</span>
              </div>
            ) : !isGroupMatch ? (
              <div className="flex items-center gap-2 p-2 bg-rose-50 text-rose-900 border border-rose-200 rounded-xl text-xs font-bold">
                <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                <span>تنبيه: مجموعة الطالب المسجلة هي <b>[{student.centerGroup}]</b> بينما المجموعة الجارية بالقاعة الآن هي <b>[{activeSessionGroup}]</b>.</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 p-2 bg-emerald-50 text-emerald-900 border border-emerald-200 rounded-xl text-xs font-bold">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                <span>موعد مجموعة الطالب مطابق للقاعة الجارية الآن بنجاح.</span>
              </div>
            )}
          </div>

          {/* 3. ACADEMIC & PREPARATION STATS */}
          <div className="grid grid-cols-3 gap-2.5 text-center">
            {/* Video watch % */}
            <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200">
              <span className="text-[10px] font-bold text-slate-500 block">نسبة مشاهدة الشرح</span>
              <div className="flex items-center justify-center gap-1 mt-1">
                <Video className="w-3.5 h-3.5 text-indigo-600" />
                <span className={`text-base font-black ${
                  videoWatchPct >= 50 ? 'text-emerald-600' : 'text-rose-600'
                }`}>
                  {videoWatchPct}%
                </span>
              </div>
              <span className={`text-[9px] font-black block mt-0.5 ${
                videoWatchPct >= 50 ? 'text-emerald-700' : 'text-rose-700'
              }`}>
                {videoWatchPct >= 50 ? 'مستوفي الشرط' : 'أقل من 50%'}
              </span>
            </div>

            {/* Recitation */}
            <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200">
              <span className="text-[10px] font-bold text-slate-500 block">آخر تسميع بالسنتر</span>
              <div className="flex items-center justify-center gap-1 mt-1">
                <Award className="w-3.5 h-3.5 text-amber-500" />
                <span className="text-base font-black text-slate-900">
                  {recitationScore ? `${recitationScore.score} / ${recitationScore.max}` : '10 / 10'}
                </span>
              </div>
              <span className="text-[9px] font-bold text-slate-500 block mt-0.5 truncate">
                {recitationScore?.title || 'تسميع منتظم'}
              </span>
            </div>

            {/* Attendance Count */}
            <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200">
              <span className="text-[10px] font-bold text-slate-500 block">سجل الحضور والغياب</span>
              <div className="flex items-center justify-center gap-2 mt-1">
                <span className="text-xs font-black text-emerald-600">{attendanceStats.presentCount} حاضر</span>
                <span className="text-slate-300">•</span>
                <span className="text-xs font-black text-rose-600">{attendanceStats.absentCount} غائب</span>
              </div>
              <span className="text-[9px] font-bold text-slate-400 block mt-0.5">
                {attendanceStats.lateCount > 0 ? `${attendanceStats.lateCount} متأخر` : 'ملتزم'}
              </span>
            </div>
          </div>

          {/* 4. STUDENT CONTACT & WHATSAPP BUTTON */}
          <div className="flex items-center justify-between p-3 bg-indigo-50/70 border border-indigo-100 rounded-2xl text-xs">
            <div className="space-y-0.5">
              <span className="font-bold text-indigo-950 block">بيانات الاتصال وولي الأمر:</span>
              <div className="text-slate-600 font-medium flex items-center gap-3">
                {student.phone && <span>الطالب: <b className="font-mono">{student.phone}</b></span>}
                {student.parentPhone && <span>ولي الأمر: <b className="font-mono">{student.parentPhone}</b></span>}
              </div>
            </div>
            {parentWhatsAppUrl && (
              <a
                href={parentWhatsAppUrl}
                target="_blank"
                rel="noreferrer"
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-black px-3 py-1.5 rounded-xl text-xs flex items-center gap-1.5 transition-colors shadow-xs"
              >
                <MessageCircle className="w-3.5 h-3.5" />
                <span>واتساب ولي الأمر</span>
              </a>
            )}
          </div>

          {/* REJECT ENTRY ACCORDION FORM */}
          {showRejectForm && (
            <div className="p-4 bg-rose-50 border-2 border-rose-300 rounded-2xl space-y-3 animate-in fade-in duration-150">
              <h4 className="text-xs font-black text-rose-950 flex items-center gap-1.5">
                <XCircle className="w-4 h-4 text-rose-600" />
                <span>سبب منع الطالب من الدخول وإرسال إشعار لولي الأمر:</span>
              </h4>
              <div className="grid grid-cols-2 gap-2">
                {[
                  'عدم سداد المصاريف المقررة لهذا الشهر',
                  'حضور في غير موعد مجموعته المحددة',
                  'نسبة مشاهدة الشرح أقل من 50%',
                  'غياب متكرر بدون عذر مسبق'
                ].map((reason) => (
                  <button
                    key={reason}
                    type="button"
                    onClick={() => setRejectReason(reason)}
                    className={`p-2 rounded-xl text-[11px] font-bold text-right border transition-all ${
                      rejectReason === reason
                        ? 'bg-rose-600 text-white border-rose-600'
                        : 'bg-white text-slate-700 border-rose-200 hover:bg-rose-100/50'
                    }`}
                  >
                    {reason}
                  </button>
                ))}
              </div>
              <input
                type="text"
                value={customRejectNote}
                onChange={e => setCustomRejectNote(e.target.value)}
                placeholder="ملاحظة إضافية للسبب (اختياري)..."
                className="w-full p-2 bg-white border border-rose-200 rounded-xl text-xs font-bold text-slate-900 outline-none focus:border-rose-500"
              />
              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowRejectForm(false)}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  تراجع
                </button>
                <button
                  type="button"
                  onClick={handleConfirmReject}
                  className="bg-rose-600 hover:bg-rose-700 text-white font-black px-4 py-1.5 rounded-xl text-xs flex items-center gap-1.5 shadow-sm cursor-pointer"
                >
                  <XCircle className="w-4 h-4" />
                  <span>تأكيد منع الدخول وإخطار ولي الأمر</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* DECISION ACTION BAR (The door assistant's main controls) */}
        <div className="p-4 sm:p-5 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            {/* DENY ENTRY BUTTON */}
            <button
              type="button"
              onClick={() => setShowRejectForm(!showRejectForm)}
              className="flex-1 sm:flex-none px-4 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-2xl text-xs font-black flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <XCircle className="w-4 h-4 text-rose-600" />
              <span>منع الدخول ⛔</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2.5 rounded-2xl text-xs font-bold text-slate-600 hover:bg-slate-200/70 transition-colors cursor-pointer"
            >
              إغلاق
            </button>
          </div>

          {/* ADMIT BUTTONS */}
          <div className="flex items-center gap-2 w-full sm:w-auto">
            {/* LATE ADMIT */}
            <button
              type="button"
              onClick={() => onAdmit(student, 'late', 'تسجيل حضور متأخر عند البوابة')}
              className="flex-1 sm:flex-none px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-2xl text-xs font-black flex items-center justify-center gap-1.5 shadow-sm transition-all cursor-pointer"
            >
              <Clock className="w-4 h-4" />
              <span>دخول متأخر ⏳</span>
            </button>

            {/* PRESENT ADMIT */}
            <button
              type="button"
              onClick={() => onAdmit(student, 'present', isExtraSessionActive ? `حضور بالحصة الإضافية (${activeExtraSessionName})` : undefined)}
              className="flex-1 sm:flex-none px-6 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-2xl text-xs font-black flex items-center justify-center gap-2 shadow-md shadow-emerald-900/20 transition-all cursor-pointer active:scale-95"
            >
              <CheckCircle2 className="w-4 h-4 text-amber-200" />
              <span>السماح بالدخول وتأكيد الحضور ✅</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
