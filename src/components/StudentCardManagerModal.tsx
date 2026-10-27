import React, { useState, useEffect, useRef } from 'react';
import { db } from '../lib/firebase';
import { doc, updateDoc, collection, getDocs, query, where } from 'firebase/firestore';
import { AppUser, useAuth } from '../contexts/AuthContext';
import { useSettings } from '../contexts/SettingsContext';
import { useToast } from '../contexts/ToastContext';
import { 
  CreditCard, 
  QrCode, 
  Scan, 
  Camera, 
  Printer, 
  Sparkles, 
  CheckCircle2, 
  AlertCircle, 
  X, 
  Copy, 
  Check, 
  Search, 
  RefreshCw, 
  Tag, 
  UserCheck 
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import Barcode from './Barcode';
import CameraBarcodeScanner, { playScannerBeep } from './CameraBarcodeScanner';
import { printStudentSticker } from '../lib/stickerPrintHelper';
import { printHtmlDocument } from '../lib/printHelper';
import { generateBarcodeSvg } from '../lib/stickerPrintHelper';

interface StudentCardManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  student?: AppUser | null;
  onStudentUpdated?: (updated: AppUser) => void;
}

export default function StudentCardManagerModal({
  isOpen,
  onClose,
  student: initialStudent = null,
  onStudentUpdated
}: StudentCardManagerModalProps) {
  const { settings } = useSettings();
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState<'scan_external' | 'generate_print'>('scan_external');
  const [selectedStudent, setSelectedStudent] = useState<AppUser | null>(initialStudent || null);
  const [allStudents, setAllStudents] = useState<AppUser[]>([]);
  const [studentSearch, setStudentSearch] = useState('');
  
  // External card scanning/linking states
  const [externalCodeInput, setExternalCodeInput] = useState('');
  const [isCameraScannerOpen, setIsCameraScannerOpen] = useState(false);
  const [isLinking, setIsLinking] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  // Sync initial student
  useEffect(() => {
    setSelectedStudent(initialStudent || null);
  }, [initialStudent, isOpen]);

  // Fetch students list for selector if none provided
  useEffect(() => {
    if (!isOpen) return;
    const fetchStudents = async () => {
      try {
        const q = query(collection(db, 'users'), where('role', 'in', ['student', 'user']));
        const snap = await getDocs(q);
        const list = snap.docs.map(d => ({ uid: d.id, ...d.data() } as AppUser));
        setAllStudents(list);
      } catch (e) {
        console.warn('Error fetching students:', e);
      }
    };
    fetchStudents();
  }, [isOpen]);

  if (!isOpen) return null;

  // Handle Scanning or Submitting External Card
  const handleLinkExternalCard = async (scannedCodeValue?: string) => {
    const codeToBind = (scannedCodeValue || externalCodeInput).trim();
    if (!codeToBind) {
      showToast('يرجى مسح كود الـ QR أو كتابة البرومو كود أولاً', 'error');
      return;
    }
    if (!selectedStudent) {
      showToast('يرجى اختيار الطالب المراد ربط الكارت به أولاً', 'warning');
      return;
    }

    setIsLinking(true);
    try {
      // Check if this card code is already linked to another student
      const duplicateStudent = allStudents.find(
        s => s.uid !== selectedStudent.uid && (
          (s.code || '').toLowerCase() === codeToBind.toLowerCase() ||
          (s.cardQrCode || '').toLowerCase() === codeToBind.toLowerCase() ||
          (s.promoCode || '').toLowerCase() === codeToBind.toLowerCase() ||
          (s.externalCardCode || '').toLowerCase() === codeToBind.toLowerCase()
        )
      );

      if (duplicateStudent) {
        const confirmTransfer = window.confirm(
          `⚠️ هذا الكود أو الكارت مرتبط بالفعل بالطالب (${duplicateStudent.name} - كود: ${duplicateStudent.code}).\nهل ترغب بنقله وربطه بالطالب الجديد (${selectedStudent.name})؟`
        );
        if (!confirmTransfer) {
          setIsLinking(false);
          return;
        }
      }

      const updateData: Partial<AppUser> & Record<string, any> = {
        cardQrCode: codeToBind,
        promoCode: codeToBind,
        externalCardCode: codeToBind,
        cardBoundAt: Date.now(),
        cardBoundMethod: 'external_print'
      };

      await updateDoc(doc(db, 'users', selectedStudent.uid), updateData);
      playScannerBeep();

      const updated = {
        ...selectedStudent,
        ...updateData
      };
      setSelectedStudent(updated);
      setExternalCodeInput('');
      setIsCameraScannerOpen(false);

      if (onStudentUpdated) {
        onStudentUpdated(updated);
      }

      showToast(`تم ربط الكارت الخارجي (${codeToBind}) بالطالب (${selectedStudent.name}) بنجاح! يمكنه الحضور به الآن.`, 'success');
    } catch (err: any) {
      console.error(err);
      showToast('حدث خطأ أثناء حفظ بيانات الكارت في قاعدة البيانات', 'error');
    } finally {
      setIsLinking(false);
    }
  };

  // Generate a brand new unique Promo Code
  const handleGenerateNewPromoCode = async () => {
    if (!selectedStudent) return;
    const randomChars = Math.random().toString(36).substring(2, 8).toUpperCase();
    const newPromo = `PR-${randomChars}`;

    try {
      await updateDoc(doc(db, 'users', selectedStudent.uid), {
        promoCode: newPromo,
        cardQrCode: newPromo,
        updatedAt: Date.now()
      });
      playScannerBeep();

      const updated = {
        ...selectedStudent,
        promoCode: newPromo,
        cardQrCode: newPromo
      };
      setSelectedStudent(updated);
      if (onStudentUpdated) onStudentUpdated(updated);
      showToast(`تم إنشاء برومو كود جديد للطالب بنجاح: ${newPromo}`, 'success');
    } catch (e) {
      console.error(e);
      showToast('حدث خطأ أثناء توليد البرومو كود', 'error');
    }
  };

  // Print Full Page Card (A4)
  const handlePrintFullPage = (student: AppUser) => {
    const studentCode = student.promoCode || student.code || student.uid.substring(0, 8);
    const barcodeSvg = generateBarcodeSvg(studentCode, 2.2, 55, 12);
    const parentReportUrl = `${window.location.origin}/parent-report/${student.code || student.uid}`;
    
    const html = `
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="utf-8">
        <title>كارت الطالب الرسمي - ${student.name || ''}</title>
        <style>
          @page { size: A4 portrait; margin: 10mm; }
          * { box-sizing: border-box; font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif; }
          body { margin: 0; padding: 20px; background: white; text-align: center; }
          .card-box { border: 3px solid #1e1b4b; border-radius: 24px; padding: 30px; background: #faf5ff; }
          .header { font-size: 26px; font-weight: 900; color: #1e1b4b; margin-bottom: 8px; }
          .sub { font-size: 16px; color: #4338ca; font-weight: bold; margin-bottom: 25px; }
          .info { font-size: 20px; font-weight: bold; margin: 10px 0; color: #0f172a; }
          .code-box { font-size: 28px; font-family: monospace; font-weight: 900; background: #e0e7ff; padding: 12px; border-radius: 14px; margin: 20px 0; display: inline-block; }
          .footer-note { margin-top: 30px; font-size: 13px; color: #64748b; font-weight: bold; }
        </style>
      </head>
      <body>
        <div class="card-box">
          <div class="header">${settings.platformName || 'منصة مستر محمد صابر'}</div>
          <div class="sub">كارت الحضور الرسمي والمتابعة الشاملة</div>
          <div class="info">اسم الطالب: <b>${student.name}</b></div>
          <div class="info">الصف الدراسي: <b>${student.grade || 'غير محدد'}</b></div>
          <div class="info">مجموعة السنتر: <b>${student.centerGroup || 'المجموعة الأساسية'}</b></div>
          <div class="code-box">كود الطالب / البرومو: ${studentCode}</div>
          <div style="margin: 20px 0;">${barcodeSvg}</div>
          <div style="margin-top: 20px;">
            <p style="font-size: 14px; font-weight: bold; color: #4338ca; margin-bottom: 8px;">كود تقرير ولي الأمر والمتابعة (QR)</p>
            <img src="https://api.qrserver.com/v1/create-qr-code/?size=130x130&data=${encodeURIComponent(parentReportUrl)}" width="130" height="130" alt="QR" />
          </div>
          <div class="footer-note">يُحفظ هذا الكارت مع الطالب لحضور حصص وتسميع السنتر</div>
        </div>
      </body>
      </html>
    `;
    printHtmlDocument(html, `كارت_طالب_${student.name}`);
  };

  // Print Visa Sized ID Card (85.6mm x 54mm)
  const handlePrintVisa = (student: AppUser) => {
    const studentCode = student.promoCode || student.code || student.uid.substring(0, 8);
    const barcodeSvg = generateBarcodeSvg(studentCode, 1.4, 22, 9);
    const parentReportUrl = `${window.location.origin}/parent-report/${student.code || student.uid}`;

    const html = `
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="utf-8">
        <title>كارت فيزا - ${student.name || ''}</title>
        <style>
          @page { size: 85.6mm 54mm; margin: 0; }
          * { box-sizing: border-box; margin: 0; padding: 0; font-family: system-ui, sans-serif; -webkit-print-color-adjust: exact; }
          html, body { width: 85.6mm; height: 54mm; display: flex; align-items: center; justify-content: center; }
          .card { width: 85.6mm; height: 54mm; padding: 4mm 5mm; background: linear-gradient(135deg, #1e1b4b 0%, #312e81 100%); color: white; border-radius: 4mm; display: flex; flex-direction: column; justify-content: space-between; overflow: hidden; position: relative; }
          .top-row { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.2); padding-bottom: 2mm; }
          .title { font-size: 9pt; font-weight: 900; color: #fbbf24; }
          .name { font-size: 10pt; font-weight: 900; margin-top: 1mm; }
          .grade { font-size: 7.5pt; color: #cbd5e1; }
          .middle-row { display: flex; align-items: center; justify-content: space-between; gap: 3mm; margin: 1.5mm 0; }
          .qr-img { background: white; padding: 1.5mm; border-radius: 2mm; }
          .code-badge { background: #fbbf24; color: #0f172a; font-family: monospace; font-size: 9pt; font-weight: 900; padding: 1mm 3mm; border-radius: 2mm; text-align: center; }
          .footer-text { font-size: 6.5pt; color: #94a3b8; display: flex; justify-content: space-between; }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="top-row">
            <div>
              <div class="title">${settings.platformName || 'منصة مستر محمد صابر'}</div>
              <div class="grade">${student.grade || 'طالب المنصة'} • ${student.centerGroup || 'السنتر'}</div>
            </div>
            <div class="code-badge">${studentCode}</div>
          </div>
          <div class="middle-row">
            <div>
              <div class="name">${student.name}</div>
              <div style="margin-top: 1mm;">${barcodeSvg}</div>
            </div>
            <div class="qr-img">
              <img src="https://api.qrserver.com/v1/create-qr-code/?size=60x60&data=${encodeURIComponent(parentReportUrl)}" width="45" height="45" alt="QR" />
            </div>
          </div>
          <div class="footer-text">
            <span>هاتف: ${student.phone || '-'}</span>
            <span>كارت حضور ومتابعة رسمي</span>
          </div>
        </div>
      </body>
      </html>
    `;
    printHtmlDocument(html, `كارت_فيزا_${student.name}`);
  };

  const currentDisplayCode = selectedStudent?.promoCode || selectedStudent?.code || '';

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-2xl overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="p-5 bg-gradient-to-r from-indigo-950 via-indigo-900 to-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-400 text-slate-950 flex items-center justify-center font-black shadow-md">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-lg">إدارة وربط كروت الطلاب (الماسح + الطباعة)</h3>
              <p className="text-xs text-indigo-200">
                ربط كروت مطبوعة من الخارج، أو توليد وطباعة كروت رسمية من المنصة فوراً
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Student Selector / Current Student Card */}
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-850">
          {selectedStudent ? (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-white dark:bg-slate-800 rounded-2xl border border-indigo-200 dark:border-indigo-900 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-black text-base border border-indigo-100 dark:border-indigo-800">
                  <UserCheck className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-black text-slate-900 dark:text-white text-sm">{selectedStudent.name}</span>
                    <span className="text-[11px] bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-bold px-2 py-0.5 rounded-full">
                      {selectedStudent.grade || 'غير محدد'}
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-3 mt-0.5">
                    <span>الكود الأساسي: <b className="font-mono text-slate-700 dark:text-slate-200">{selectedStudent.code || '-'}</b></span>
                    {selectedStudent.promoCode && (
                      <span>البرومو / الكارت: <b className="font-mono text-emerald-600 dark:text-emerald-400">{selectedStudent.promoCode}</b></span>
                    )}
                  </div>
                </div>
              </div>

              {!initialStudent && (
                <button
                  type="button"
                  onClick={() => setSelectedStudent(null)}
                  className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline font-bold self-end sm:self-center"
                >
                  تغيير الطالب
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                اختر أو ابحث عن الطالب لربط الكارت به:
              </label>
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute right-3 top-3.5" />
                <input
                  type="text"
                  value={studentSearch}
                  onChange={e => setStudentSearch(e.target.value)}
                  placeholder="ابحث باسم الطالب، كوده، أو هاتفه..."
                  className="w-full p-2.5 pr-9 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white"
                />
              </div>

              {studentSearch && (
                <div className="max-h-40 overflow-y-auto bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl divide-y divide-slate-100 dark:divide-slate-700 text-xs shadow-md">
                  {allStudents
                    .filter(s => 
                      (s.name || '').toLowerCase().includes(studentSearch.toLowerCase()) ||
                      (s.code || '').toLowerCase().includes(studentSearch.toLowerCase()) ||
                      (s.phone || '').includes(studentSearch)
                    )
                    .slice(0, 8)
                    .map(st => (
                      <div
                        key={st.uid}
                        onClick={() => { setSelectedStudent(st); setStudentSearch(''); }}
                        className="p-2.5 hover:bg-indigo-50 dark:hover:bg-slate-700/60 cursor-pointer flex items-center justify-between"
                      >
                        <span className="font-bold text-slate-900 dark:text-white">{st.name}</span>
                        <div className="text-slate-500 font-mono text-[11px] flex gap-2">
                          <span>كود: {st.code || '-'}</span>
                          <span>هاتف: {st.phone || '-'}</span>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Action Tabs */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800/50 p-1.5 gap-1.5">
          <button
            type="button"
            onClick={() => setActiveTab('scan_external')}
            className={`flex-1 py-2.5 px-3 rounded-2xl text-xs font-black transition-all flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === 'scan_external'
                ? 'bg-white dark:bg-slate-900 text-indigo-700 dark:text-indigo-400 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            <Scan className="w-4 h-4" />
            <span>الخيار 1: مسح وربط كارت خارجي مطبوع 📲</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('generate_print')}
            className={`flex-1 py-2.5 px-3 rounded-2xl text-xs font-black transition-all flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === 'generate_print'
                ? 'bg-white dark:bg-slate-900 text-indigo-700 dark:text-indigo-400 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            <Printer className="w-4 h-4" />
            <span>الخيار 2: إنشاء وطباعة كارت من المنصة 🖨️</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6">
          
          {/* TAB 1: SCAN & LINK EXTERNAL PRINTED CARD */}
          {activeTab === 'scan_external' && (
            <div className="space-y-5">
              <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 rounded-2xl p-4 text-xs text-amber-900 dark:text-amber-200 leading-relaxed">
                <h4 className="font-black text-sm mb-1 flex items-center gap-1.5">
                  <Tag className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  <span>ربط كارت جاهز من المطبعة بكود QR أو برومو كود</span>
                </h4>
                <p>
                  إذا قمت بطباعة كروت خارجية في مطبعة تحتوي على QR أو برومو كود خاص، قم بمسح الكارت بكاميرا الهاتف أو بقارئ الباركود، أو اكتب الكود يدوياً وسيتم حفظه فوراً في حساب الطالب ليحضر به في السنتر.
                </p>
              </div>

              {/* Input & Camera Options */}
              <div className="space-y-3">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                  كود الكارت أو البرومو كود المطبوع:
                </label>

                <div className="flex gap-2">
                  <input
                    type="text"
                    value={externalCodeInput}
                    onChange={e => setExternalCodeInput(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleLinkExternalCard();
                      }
                    }}
                    placeholder="امسح بمسدس الباركود أو اكتب الكود مثل: PR-89201"
                    className="flex-grow p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-mono font-bold outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white"
                    dir="ltr"
                    autoFocus
                  />

                  <button
                    type="button"
                    onClick={() => setIsCameraScannerOpen(true)}
                    className="px-4 py-3 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 rounded-2xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer"
                    title="فتح كاميرا الموبايل أو اللابتوب لمسح كود QR الكارت"
                  >
                    <Camera className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                    <span>الكاميرا</span>
                  </button>
                </div>
              </div>

              {/* Submit Linking Button */}
              <button
                type="button"
                onClick={() => handleLinkExternalCard()}
                disabled={!selectedStudent || !externalCodeInput.trim() || isLinking}
                className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 dark:disabled:bg-slate-800 text-white rounded-2xl text-xs font-black transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed"
              >
                {isLinking ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>جاري حفظ الكارت وربطه بالطالب...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>تأكيد ربط الكارت والـ QR بالطالب فوراً ✓</span>
                  </>
                )}
              </button>

              {/* Current Bound Status */}
              {selectedStudent?.cardQrCode && (
                <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 rounded-2xl flex items-center justify-between text-xs text-emerald-900 dark:text-emerald-200">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <span>
                      الكارت الحالي المربوط: <b className="font-mono text-emerald-700 dark:text-emerald-300">{selectedStudent.cardQrCode}</b>
                    </span>
                  </div>
                  <span className="text-[10px] text-emerald-600 font-bold">جاهز للمسح عند الحضور</span>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: GENERATE & PRINT PLATFORM CARDS */}
          {activeTab === 'generate_print' && (
            <div className="space-y-6">
              <div className="bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-900/60 rounded-2xl p-4 text-xs text-indigo-900 dark:text-indigo-200 leading-relaxed flex items-center justify-between gap-3">
                <div>
                  <h4 className="font-black text-sm mb-1 flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-amber-500" />
                    <span>توليد كروت وطباعتها بأعلى دقة (بدون مطبعة)</span>
                  </h4>
                  <p>
                    تتيح المنصة طباعة كروت فورية بباركود حضور السنتر وكود QR لتقرير ولي الأمر وبرومو كود مخصص للطالب.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleGenerateNewPromoCode}
                  disabled={!selectedStudent}
                  className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-sm shrink-0 flex items-center gap-1 cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>توليد برومو جديد</span>
                </button>
              </div>

              {/* Live Preview Card */}
              {selectedStudent && (
                <div className="p-4 bg-slate-900 text-white rounded-2xl border border-slate-800 shadow-inner space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <div>
                      <div className="text-[10px] text-amber-400 font-bold">{settings.platformName || 'منصة مستر محمد صابر'}</div>
                      <div className="font-black text-sm text-white">{selectedStudent.name}</div>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-slate-400 block">كود / برومو:</span>
                      <span className="font-mono font-black text-amber-300 text-xs">{currentDisplayCode}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 items-center pt-1">
                    <div className="bg-white p-2 rounded-xl flex flex-col items-center justify-center text-slate-900">
                      <span className="text-[9px] font-bold text-slate-600 mb-0.5">🏷️ باركود حضور السنتر</span>
                      <Barcode value={currentDisplayCode || '00000'} width={1.2} height={26} fontSize={8} className="max-w-full" />
                    </div>

                    <div className="bg-white p-2 rounded-xl flex flex-col items-center justify-center text-slate-900">
                      <span className="text-[9px] font-bold text-slate-600 mb-0.5">📱 كود QR تقرير ولي الأمر</span>
                      <QRCodeSVG value={`${window.location.origin}/parent-report/${selectedStudent.code || selectedStudent.uid}`} size={46} />
                    </div>
                  </div>
                </div>
              )}

              {/* Print Action Buttons */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <button
                  type="button"
                  onClick={() => selectedStudent && handlePrintVisa(selectedStudent)}
                  disabled={!selectedStudent}
                  className="p-3 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 disabled:opacity-50 text-white rounded-2xl text-xs font-black transition-all shadow-md flex flex-col items-center justify-center gap-1.5 cursor-pointer"
                >
                  <CreditCard className="w-5 h-5 text-amber-300" />
                  <span>طباعة كارت فيزا (85mm)</span>
                  <span className="text-[10px] text-indigo-200 font-normal">كارت بلاستيكي راقي</span>
                </button>

                <button
                  type="button"
                  onClick={() => selectedStudent && printStudentSticker(selectedStudent)}
                  disabled={!selectedStudent}
                  className="p-3 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-500 hover:to-teal-600 disabled:opacity-50 text-white rounded-2xl text-xs font-black transition-all shadow-md flex flex-col items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Printer className="w-5 h-5 text-emerald-200" />
                  <span>طباعة استيكر حراري لاصق</span>
                  <span className="text-[10px] text-emerald-200 font-normal">QR + البرومو كود</span>
                </button>

                <button
                  type="button"
                  onClick={() => selectedStudent && handlePrintFullPage(selectedStudent)}
                  disabled={!selectedStudent}
                  className="p-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 disabled:opacity-50 text-slate-950 rounded-2xl text-xs font-black transition-all shadow-md flex flex-col items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Printer className="w-5 h-5 text-slate-900" />
                  <span>طباعة كارت ملء الصفحة (A4)</span>
                  <span className="text-[10px] text-slate-800 font-normal">واضح وكبير للطابعات العادية</span>
                </button>
              </div>

            </div>
          )}

        </div>

      </div>

      {/* Built-in Camera Scanner Modal */}
      <CameraBarcodeScanner
        isOpen={isCameraScannerOpen}
        onClose={() => setIsCameraScannerOpen(false)}
        onScan={(scanned) => {
          handleLinkExternalCard(scanned);
        }}
        title="وجّه الكاميرا نحو كود QR أو باركود الكارت الخارجي"
      />
    </div>
  );
}
