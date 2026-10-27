import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../lib/firebase';
import { collection, query, onSnapshot, doc, updateDoc, setDoc, deleteDoc } from 'firebase/firestore';
import { Shield, ShieldAlert, Loader2, UserCheck, Search, UserPlus, Key, Printer, Copy, Check, Trash2, Award, Building, BookOpen, Edit2, User, ArrowUpRight, GraduationCap, Sparkles, CreditCard } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { AppUser, useAuth } from '../contexts/AuthContext';
import { useSettings } from '../contexts/SettingsContext';
import { getNextGrade, canPromoteGrade } from '../lib/gradeProgression';
import Barcode from './Barcode';
import JsBarcode from 'jsbarcode';
import { printHtmlDocument } from '../lib/printHelper';
import { printStudentSticker, printBatchStickers } from '../lib/stickerPrintHelper';
import GroupScheduleBuilderModal from './GroupScheduleBuilderModal';
import StudentCardManagerModal from './StudentCardManagerModal';

interface CourseItem {
  id: string;
  name: string;
  grade: string;
}

export default function AdminAssistants() {
  const { appUser } = useAuth();
  const { settings, updateSettings } = useSettings();
  const [users, setUsers] = useState<AppUser[]>([]);
  const [courses, setCourses] = useState<CourseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategory, setActiveCategory] = useState<'google' | 'online' | 'center' | 'assistants'>('center');
  const [printStatusFilter, setPrintStatusFilter] = useState<'all' | 'unprinted' | 'printed'>('all');
  const [isGroupBuilderOpen, setIsGroupBuilderOpen] = useState(false);

  // Course Assignment Modal / State
  const [editingCoursesStudent, setEditingCoursesStudent] = useState<AppUser | null>(null);

  // Center Group Modal / State
  const [groupModalStudent, setGroupModalStudent] = useState<AppUser | null>(null);
  const [customGroupInput, setCustomGroupInput] = useState('');

  // Student Card Management (Scan External Card / Print)
  const [cardManagerStudent, setCardManagerStudent] = useState<AppUser | null>(null);
  const [isCardManagerOpen, setIsCardManagerOpen] = useState(false);

  // Available Groups derived from settings AND all actual existing students in the system
  const availableGroups = useMemo(() => {
    const groupsSet = new Set<string>();

    // 1. Groups defined in settings
    if (Array.isArray(settings.centerGroups)) {
      settings.centerGroups.forEach(g => {
        if (typeof g === 'string' && g.trim()) groupsSet.add(g.trim());
      });
    }

    // 2. Groups found on existing students in the database
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

  // Center Student Add Form
  const [centerName, setCenterName] = useState('');
  const [centerGrade, setCenterGrade] = useState('');
  const [centerGroup, setCenterGroup] = useState(availableGroups[0] || 'مجموعة السبت والثلاثاء');
  const [centerPhone, setCenterPhone] = useState('');
  const [centerParentPhone, setCenterParentPhone] = useState('');
  const [centerCode, setCenterCode] = useState('');
  const [centerPassword, setCenterPassword] = useState('');
  const [addingCenterStudent, setAddingCenterStudent] = useState(false);
  const [addSuccess, setAddSuccess] = useState('');

  useEffect(() => {
    if (availableGroups.length > 0 && (!centerGroup || centerGroup === 'مجموعة السبت والثلاثاء')) {
      setCenterGroup(availableGroups[0]);
    }
  }, [availableGroups]);

  // Search by Code State
  const [codeQuery, setCodeQuery] = useState('');
  const [foundStudent, setFoundStudent] = useState<AppUser | null>(null);

  // Copy Feedback
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const q = query(collection(db, 'users'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() }) as AppUser);
      setUsers(data);
      setLoading(false);
    }, (err) => {
      console.warn("Error fetching users in AdminAssistants:", err);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const qCourses = query(collection(db, 'courses'));
    const unsub = onSnapshot(qCourses, (snapshot) => {
      const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as CourseItem[];
      setCourses(data);
    }, (err) => {
      console.warn("Error fetching courses in AdminAssistants:", err);
    });
    return () => unsub();
  }, []);

  const generateRandomCode = () => {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    setCenterCode(code);
  };

  const generateRandomPassword = () => {
    const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
    let pass = '';
    for (let i = 0; i < 6; i++) {
      pass += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setCenterPassword(pass);
  };

  const handleAddCenterStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!centerName || !centerCode || !centerPassword) {
      alert('يرجى كتابة اسم الطالب، الكود، وكلمة المرور.');
      return;
    }

    setAddingCenterStudent(true);
    setAddSuccess('');

    try {
      const cleanCode = centerCode.trim();
      const cleanPass = centerPassword.trim();

      // Check if code already exists
      const existing = users.find(u => u.code && u.code.toString().trim() === cleanCode);
      if (existing) {
        alert(`الكود (${cleanCode}) مستخدم بالفعل للطالب: ${existing.name}`);
        setAddingCenterStudent(false);
        return;
      }

      const uid = `center_${cleanCode}`;
      const newStudent: AppUser = {
        uid,
        email: `center_${cleanCode}@platform.local`,
        name: centerName.trim(),
        grade: centerGrade || (settings.grades?.[0] || 'غير محدد'),
        phone: centerPhone.trim(),
        parentPhone: centerParentPhone.trim(),
        role: 'student',
        code: cleanCode,
        password: cleanPass,
        isCenterStudent: true,
        centerGroup: centerGroup || 'مجموعة السبت والثلاثاء',
        registrationMethod: 'center',
        createdAt: Date.now()
      };

      await setDoc(doc(db, 'users', uid), newStudent);

      setAddSuccess(`تمت إضافة طالب السنتر بنجاح! الكود: ${cleanCode}`);
      setFoundStudent(newStudent);
      setCodeQuery(cleanCode);

      // Reset Form
      setCenterName('');
      setCenterPhone('');
      setCenterParentPhone('');
      setCenterCode('');
      setCenterPassword('');
    } catch (err: any) {
      console.error(err);
      alert('حدث خطأ أثناء إضافة طالب السنتر: ' + (err.message || ''));
    } finally {
      setAddingCenterStudent(false);
    }
  };

  const normalizeSearch = (text: string | number | undefined | null) => {
    if (!text) return '';
    return text
      .toString()
      .toLowerCase()
      .replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString())
      .replace(/[أإآ]/g, 'ا')
      .replace(/ة/g, 'ه')
      .replace(/ى/g, 'ي')
      .replace(/[\s\-_]+/g, ' ')
      .trim();
  };

  // Keep foundStudent synchronized with users updates in real time
  useEffect(() => {
    if (foundStudent) {
      const updated = users.find(u => u.uid === foundStudent.uid);
      if (updated) {
        setFoundStudent(updated);
      }
    }
  }, [users]);

  // Live matching suggestions for the search box
  const searchSuggestions = useMemo(() => {
    const q = normalizeSearch(codeQuery);
    if (!q || q.length < 1) return [];
    return users.filter(u => {
      const nName = normalizeSearch(u.name);
      const nCode = normalizeSearch(u.code);
      const nPhone = normalizeSearch(u.phone);
      const nParentPhone = normalizeSearch(u.parentPhone);
      const nEmail = normalizeSearch(u.email);

      return (
        nName.includes(q) ||
        nCode.includes(q) ||
        nPhone.includes(q) ||
        nParentPhone.includes(q) ||
        nEmail.includes(q)
      );
    }).slice(0, 8);
  }, [codeQuery, users]);

  const handleSearchByCode = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const q = normalizeSearch(codeQuery);
    if (!q) {
      setFoundStudent(null);
      return;
    }

    // First try exact match on code, name, phone, email, or uid
    const exactMatch = users.find(u => 
      normalizeSearch(u.code) === q || 
      normalizeSearch(u.name) === q || 
      normalizeSearch(u.phone) === q || 
      normalizeSearch(u.parentPhone) === q || 
      normalizeSearch(u.email) === q ||
      u.uid.toLowerCase() === q
    );

    if (exactMatch) {
      setFoundStudent(exactMatch);
      return;
    }

    // Otherwise partial match
    const partialMatch = users.find(u => 
      normalizeSearch(u.name).includes(q) || 
      normalizeSearch(u.code).includes(q) || 
      normalizeSearch(u.phone).includes(q) ||
      normalizeSearch(u.parentPhone).includes(q) ||
      normalizeSearch(u.email).includes(q)
    );

    if (partialMatch) {
      setFoundStudent(partialMatch);
    } else {
      setFoundStudent(null);
      alert('لم يتم العثور على طالب بهذا الاسم أو الكود أو رقم الهاتف.');
    }
  };

  const handleUpdateRole = async (userId: string, newRole: 'student' | 'assistant') => {
    const targetUser = users.find(u => u.uid === userId);
    if (targetUser?.role === 'admin' || targetUser?.email === 'adam.albalshi.4@gmail.com') {
      alert('لا يمكن تعديل أو سلب صلاحيات حساب المدير العام الرئيسي!');
      return;
    }
    if (appUser?.role !== 'admin') {
      alert('فقط المدير العام (Admin) يملك صلاحية ترقية أو سحب صلاحيات المساعدين.');
      return;
    }
    if (!confirm(`هل أنت متأكد من تغيير صلاحية (${targetUser?.name || 'المستخدم'}) إلى ${newRole === 'assistant' ? 'مساعد' : 'طالب'}؟`)) return;
    try {
      await updateDoc(doc(db, 'users', userId), { role: newRole });
      alert(`تم تعديل صلاحية المستخدم بنجاح إلى: ${newRole === 'assistant' ? 'مساعد 🎖️' : 'طالب 🎓'}`);
    } catch (error) {
      console.error(error);
      alert('حدث خطأ أثناء تحديث الصلاحية');
    }
  };

  const handleBanUser = async (userId: string, isBanned: boolean) => {
    const targetUser = users.find(u => u.uid === userId);
    if (targetUser?.role === 'admin' || targetUser?.email === 'adam.albalshi.4@gmail.com') {
      alert('لا يمكن حظر حساب المدير العام الرئيسي!');
      return;
    }
    if (appUser?.role !== 'admin') {
      alert('فقط المدير العام (Admin) يملك صلاحية حظر وفك حظر الحسابات.');
      return;
    }
    if (!confirm(`هل أنت متأكد من ${isBanned ? 'حظر' : 'فك حظر'} هذا المستخدم؟`)) return;
    try {
      await updateDoc(doc(db, 'users', userId), { banned: isBanned });
    } catch (error) {
      console.error(error);
      alert('حدث خطأ أثناء التحديث');
    }
  };

  const handlePromoteStudentGrade = async (studentId: string, currentGrade?: string) => {
    if (!currentGrade) return;
    const nextGrade = getNextGrade(currentGrade);
    if (!nextGrade) {
      alert('الطالب بالفعل في أعلى مرحلة دراسية (الصف الثالث الثانوي)');
      return;
    }
    if (confirm(`هل أنت متأكد من ترقية الطالب إلى "${nextGrade}" تلقائياً؟`)) {
      try {
        await updateDoc(doc(db, 'users', studentId), {
          grade: nextGrade
        });
        if (foundStudent && foundStudent.uid === studentId) {
          setFoundStudent({ ...foundStudent, grade: nextGrade });
        }
        alert(`تمت ترقية الطالب بنجاح إلى "${nextGrade}"`);
      } catch (err) {
        console.error("Error promoting student:", err);
        alert('حدث خطأ أثناء ترقية الطالب.');
      }
    }
  };

  const handleDeleteUser = async (userId: string, userName: string) => {
    if (!confirm(`تحذير نهائي: هل أنت متأكد من حذف الحساب الخاص بـ (${userName})؟`)) return;
    try {
      await deleteDoc(doc(db, 'users', userId));
      if (foundStudent?.uid === userId) {
        setFoundStudent(null);
      }
    } catch (error) {
      console.error(error);
      alert('حدث خطأ أثناء حذف الطالب.');
    }
  };

  const handleUpdateCode = async (userId: string, currentCode?: string) => {
    const newCode = prompt('أدخل كود الطالب الجديد:', currentCode || '');
    if (newCode === null) return;
    try {
      await updateDoc(doc(db, 'users', userId), { code: newCode.trim() });
    } catch (error) {
      console.error(error);
      alert('حدث خطأ أثناء التحديث');
    }
  };

  const handleUpdatePassword = async (userId: string, currentPass?: string) => {
    const newPass = prompt('أدخل كلمة المرور الجديدة للطالب:', currentPass || '');
    if (newPass === null) return;
    try {
      await updateDoc(doc(db, 'users', userId), { password: newPass.trim() });
    } catch (error) {
      console.error(error);
      alert('حدث خطأ أثناء التحديث');
    }
  };

  const handleToggleCoursePermission = async (studentId: string, courseId: string, currentAllowed: string[] = []) => {
    let newAllowed: string[] = [];
    if (currentAllowed.includes(courseId)) {
      newAllowed = currentAllowed.filter(id => id !== courseId);
    } else {
      newAllowed = [...currentAllowed, courseId];
    }
    try {
      await updateDoc(doc(db, 'users', studentId), { allowedCourseIds: newAllowed });
      if (editingCoursesStudent?.uid === studentId) {
        setEditingCoursesStudent(prev => prev ? { ...prev, allowedCourseIds: newAllowed } : null);
      }
    } catch (error) {
      console.error(error);
      alert('حدث خطأ أثناء تحديث صلاحية الكورس.');
    }
  };

  // Filter Categories
  const assistantsList = users.filter(u => u.role === 'assistant');
  const googleStudents = users.filter(u => u.role !== 'admin' && u.role !== 'assistant' && (u.registrationMethod === 'google' || u.email?.endsWith('@gmail.com')));
  const onlineStudents = users.filter(u => u.role !== 'admin' && u.role !== 'assistant' && !u.isCenterStudent && u.registrationMethod !== 'google' && !u.email?.endsWith('@gmail.com'));
  const centerStudents = users.filter(u => u.role !== 'admin' && u.role !== 'assistant' && (u.isCenterStudent || u.registrationMethod === 'center'));

  const markAsPrinted = async (studentId: string) => {
    try {
      await updateDoc(doc(db, 'users', studentId), {
        cardPrinted: true,
        cardPrintedAt: Date.now()
      });
    } catch (err) {
      console.error("Error updating print status:", err);
    }
  };

  const markAsUnprinted = async (studentId: string) => {
    try {
      await updateDoc(doc(db, 'users', studentId), {
        cardPrinted: false
      });
    } catch (err) {
      console.error("Error resetting print status:", err);
    }
  };

  const getFilteredList = () => {
    let list: AppUser[] = [];
    if (activeCategory === 'assistants') list = assistantsList;
    if (activeCategory === 'google') list = googleStudents;
    if (activeCategory === 'online') list = onlineStudents;
    if (activeCategory === 'center') list = centerStudents;

    if (printStatusFilter === 'unprinted') {
      list = list.filter(u => !u.cardPrinted);
    } else if (printStatusFilter === 'printed') {
      list = list.filter(u => !!u.cardPrinted);
    }

    if (searchTerm.trim()) {
      const term = normalizeSearch(searchTerm);
      list = list.filter(u => 
        normalizeSearch(u.name).includes(term) || 
        normalizeSearch(u.email).includes(term) || 
        normalizeSearch(u.phone).includes(term) || 
        normalizeSearch(u.code).includes(term) ||
        normalizeSearch(u.parentPhone).includes(term) ||
        normalizeSearch(u.centerGroup).includes(term)
      );
    }

    // Sort: unprinted cards at top (0), printed cards at bottom (1)
    return [...list].sort((a, b) => {
      const aPrinted = a.cardPrinted ? 1 : 0;
      const bPrinted = b.cardPrinted ? 1 : 0;
      if (aPrinted !== bPrinted) {
        return aPrinted - bPrinted;
      }
      return (b.createdAt || 0) - (a.createdAt || 0);
    });
  };

  const activeList = getFilteredList();

  const copyCardDetails = (s: AppUser) => {
    const text = `منصة ${settings.platformName || 'التعليمية'} - ${settings.teacherName || ''}\nاسم الطالب: ${s.name}\nالكود: ${s.code || 'غير محدد'}\nكلمة المرور: ${s.password || 'غير محددة'}\nالمرحلة: ${s.grade || 'غير محددة'}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const generateBarcodeSvg = (code: string, width = 1.2, height = 22, fontSize = 8) => {
    if (!code) return '';
    try {
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      JsBarcode(svg, code, {
        format: 'CODE128',
        width,
        height,
        displayValue: true,
        fontSize,
        margin: 2
      });
      return svg.outerHTML;
    } catch (e) {
      return `<div style="font-family:monospace;font-size:12px;font-weight:bold;color:#1e1b4b;padding:4px 8px;background:#f1f5f9;border-radius:6px;text-align:center;">${code}</div>`;
    }
  };

  const handlePrintCard = (student: AppUser, mode: 'full_page' | 'visa_size' = 'full_page') => {
    const origin = window.location.origin;
    const parentReportUrl = `${origin}/parent-report/${student.code || student.uid}`;
    const studentCode = student.code || student.uid.substring(0, 8);
    const studentPassword = student.password || '-';

    if (mode === 'full_page') {
      // FULL-PAGE PRINT: Beautifully scales to fill the paper without empty blank wasted space
      const barcodeSvg = generateBarcodeSvg(studentCode, 2.3, 50, 14);
      const html = `
        <!DOCTYPE html>
        <html dir="rtl" lang="ar">
        <head>
          <meta charset="utf-8">
          <title>كارت الطالب الرسمي - ${student.name || ''}</title>
          <style>
            @page {
              size: A4 portrait;
              margin: 10mm;
            }
            * {
              box-sizing: border-box;
              margin: 0;
              padding: 0;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
              font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
            }
            body {
              width: 100%;
              min-height: 100vh;
              display: flex;
              flex-direction: column;
              justify-content: center;
              align-items: center;
              background: #ffffff;
              padding: 5mm;
            }
            .full-card {
              width: 100%;
              max-width: 190mm;
              background: linear-gradient(145deg, #090d16 0%, #1e1b4b 45%, #312e81 100%) !important;
              color: #ffffff !important;
              border-radius: 26px;
              padding: 24px 30px;
              border: 3.5px solid #4f46e5;
              box-shadow: 0 10px 25px rgba(0,0,0,0.15);
              display: flex;
              flex-direction: column;
              gap: 16px;
            }
            .card-header {
              display: flex;
              justify-content: space-between;
              align-items: center;
              border-bottom: 2px solid rgba(255,255,255,0.2);
              padding-bottom: 12px;
            }
            .brand-title {
              font-size: 22px;
              font-weight: 900;
              color: #fcd34d;
              line-height: 1.2;
            }
            .teacher-sub {
              font-size: 16px;
              color: #c7d2fe;
              font-weight: 700;
              margin-top: 2px;
            }
            .badge-type {
              background: #f59e0b;
              color: #0f172a;
              font-size: 14px;
              font-weight: 900;
              padding: 6px 16px;
              border-radius: 9999px;
            }
            .student-header {
              text-align: right;
              padding: 4px 0;
            }
            .st-name {
              font-size: 28px;
              font-weight: 900;
              color: #ffffff;
              line-height: 1.2;
            }
            .st-meta {
              font-size: 16px;
              font-weight: 700;
              color: #fde68a;
              margin-top: 4px;
            }
            /* CREDENTIALS BOX - DISCREET & SECURE */
            .credentials-box {
              background: rgba(0, 0, 0, 0.45);
              border: 1.5px solid rgba(255, 255, 255, 0.2);
              border-radius: 14px;
              padding: 10px 18px;
              display: flex;
              justify-content: space-around;
              align-items: center;
              flex-wrap: wrap;
              gap: 12px;
            }
            .cred-item {
              display: flex;
              align-items: center;
              gap: 8px;
              font-size: 14px;
            }
            .cred-lbl {
              color: #cbd5e1;
              font-weight: 700;
            }
            .cred-val {
              font-family: monospace;
              font-size: 18px;
              font-weight: 900;
              color: #fde047;
              background: #0f172a;
              padding: 3px 12px;
              border-radius: 8px;
              border: 1px solid #facc15;
              letter-spacing: 1px;
            }
            .cred-pass {
              font-family: monospace;
              font-size: 16px;
              font-weight: 900;
              color: #34d399;
              background: #064e3b;
              padding: 3px 12px;
              border-radius: 8px;
              border: 1px solid #10b981;
            }
            .codes-split {
              display: grid;
              grid-template-columns: 1fr 140px;
              gap: 16px;
              align-items: center;
              background: rgba(255,255,255,0.05);
              padding: 12px 16px;
              border-radius: 16px;
              border: 1px solid rgba(255,255,255,0.15);
            }
            .barcode-section {
              background: #ffffff;
              border-radius: 14px;
              padding: 8px 12px;
              text-align: center;
            }
            .barcode-section .lbl {
              font-size: 11px;
              font-weight: 900;
              color: #1e1b4b;
              margin-bottom: 4px;
            }
            .qr-section {
              background: #ffffff;
              border-radius: 14px;
              padding: 8px;
              text-align: center;
              display: flex;
              flex-direction: column;
              align-items: center;
            }
            .qr-section .lbl {
              font-size: 10px;
              font-weight: 900;
              color: #1e1b4b;
              margin-top: 4px;
            }
            .card-footer {
              border-top: 2px solid rgba(255,255,255,0.2);
              padding-top: 10px;
              display: flex;
              justify-content: space-between;
              font-size: 14px;
              color: #cbd5e1;
              font-weight: 700;
            }
            .notice-banner {
              text-align: center;
              font-size: 12px;
              color: #94a3b8;
              font-weight: 600;
              margin-top: 8px;
            }
          </style>
        </head>
        <body>
          <div class="full-card">
            <div class="card-header">
              <div>
                <div class="brand-title">${settings.platformName || 'منصة التفوق التعليمية'}</div>
                <div class="teacher-sub">${settings.teacherName || 'كارت الطالب الرسمي'}</div>
              </div>
              <span class="badge-type">${student.isCenterStudent ? 'طالب سنتر وحضور رسمي' : 'طالب المنصة الأونلاين'}</span>
            </div>

            <div class="student-header">
              <div class="st-name">${student.name}</div>
              <div class="st-meta">${student.grade || 'المرحلة الدراسية غير محددة'}${student.centerGroup ? ` • ${student.centerGroup}` : ''}</div>
            </div>

            <!-- DISCREET CREDENTIALS ROW (PROTECTED VIEW) -->
            <div class="credentials-box">
              <div class="cred-item">
                <span class="cred-lbl">كود الطالب:</span>
                <span class="cred-val">${studentCode}</span>
              </div>
              <div class="cred-item">
                <span class="cred-lbl">كلمة المرور:</span>
                <span class="cred-pass">${studentPassword}</span>
              </div>
            </div>

            <!-- BARCODE & QR CODE ROW -->
            <div class="codes-split">
              <div class="barcode-section">
                <div class="lbl">🏷️ باركود الحضور بالسنتر (يُمسح بجهاز الباركود أو الكاميرا)</div>
                <div style="display:flex; justify-content:center;">${barcodeSvg}</div>
              </div>

              <div class="qr-section">
                <img src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(parentReportUrl)}" alt="QR" width="100" height="100" />
                <div class="lbl">📱 تقرير ولي الأمر</div>
              </div>
            </div>

            <div class="card-footer">
              <div>📞 هاتف الطالب: <span dir="ltr">${student.phone || '-'}</span></div>
              <div>👨‍👩‍👧 هاتف ولي الأمر: <span dir="ltr">${student.parentPhone || '-'}</span></div>
            </div>
          </div>
          <div class="notice-banner">
            يُحفظ هذا الكارت مع الطالب طوال العام الدراسي للدخول على المنصة وحضور حصص وتسميع السنتر
          </div>
        </body>
        </html>
      `;
      printHtmlDocument(html, `كارت_طالب_${student.name || ''}`);
    } else {
      // VISA SIZE (85.6mm x 54mm) - PROMINENT QR CODE IN LEFT SPACE & ENLARGED PROMO CODE & CLEAR BARCODE
      markAsPrinted(student.uid);
      const barcodeSvg = generateBarcodeSvg(studentCode, 1.8, 20, 8.5);
      const html = `
        <!DOCTYPE html>
        <html dir="rtl" lang="ar">
        <head>
          <meta charset="utf-8">
          <title>كارت فيزا - ${student.name || ''}</title>
          <style>
            @page {
              size: 85.6mm 54mm;
              margin: 0;
            }
            * {
              box-sizing: border-box;
              margin: 0;
              padding: 0;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
              font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
            }
            html, body {
              width: 85.6mm;
              height: 54mm;
              margin: 0;
              padding: 0;
              display: flex;
              justify-content: center;
              align-items: center;
              background: #ffffff;
              overflow: hidden;
            }
            .visa-card {
              width: 85.6mm;
              height: 54mm;
              border-radius: 6px;
              background: linear-gradient(135deg, #090d16 0%, #1e1b4b 55%, #312e81 100%) !important;
              color: #ffffff !important;
              padding: 2.5mm 3.5mm;
              display: flex;
              flex-direction: column;
              justify-content: space-between;
              border: 1px solid #4338ca;
              box-sizing: border-box;
              overflow: hidden;
            }
            .card-header {
              display: flex;
              justify-content: space-between;
              align-items: center;
              border-bottom: 0.5px solid rgba(255,255,255,0.25);
              padding-bottom: 1.5px;
            }
            .brand-title {
              font-size: 9.5px;
              font-weight: 900;
              color: #fcd34d;
              line-height: 1.1;
            }
            .teacher-sub {
              font-size: 7.5px;
              color: #c7d2fe;
              line-height: 1;
            }
            .badge-type {
              background: #fbbf24;
              color: #0f172a;
              font-size: 7.5px;
              font-weight: 900;
              padding: 1px 5px;
              border-radius: 9999px;
            }
            .visa-body {
              display: flex;
              gap: 3mm;
              align-items: center;
              flex: 1;
              margin: 1.5mm 0;
            }
            .visa-details {
              flex: 1;
              display: flex;
              flex-direction: column;
              gap: 1.5px;
              overflow: hidden;
            }
            .st-name {
              font-size: 11.5px;
              font-weight: 900;
              color: #ffffff;
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
              line-height: 1.15;
            }
            .st-grade {
              font-size: 7.5px;
              font-weight: 700;
              color: #fbbf24;
              line-height: 1;
            }
            .promo-box {
              display: flex;
              gap: 5px;
              align-items: center;
              background: rgba(0, 0, 0, 0.45);
              border: 1px solid rgba(253, 224, 71, 0.35);
              padding: 1.5px 4px;
              border-radius: 4px;
              margin: 1px 0;
            }
            .promo-item {
              display: flex;
              align-items: center;
              gap: 2.5px;
            }
            .promo-lbl {
              font-size: 7px;
              color: #cbd5e1;
              font-weight: bold;
            }
            .promo-val {
              font-family: monospace;
              font-size: 11.5px;
              font-weight: 900;
              color: #fde047;
              letter-spacing: 0.6px;
            }
            .promo-pass {
              font-family: monospace;
              font-size: 9px;
              font-weight: 800;
              color: #34d399;
            }
            .barcode-box {
              background: #ffffff;
              border-radius: 4px;
              padding: 1px 3px;
              display: flex;
              justify-content: center;
              align-items: center;
              width: 100%;
              height: 18px;
              overflow: hidden;
            }
            .barcode-box svg {
              width: 100%;
              max-height: 17px;
            }
            .visa-qr-box {
              width: 25mm;
              display: flex;
              flex-direction: column;
              justify-content: center;
              align-items: center;
              flex-shrink: 0;
              background: #ffffff;
              border-radius: 5px;
              padding: 2px;
              box-shadow: 0 1px 3px rgba(0,0,0,0.3);
            }
            .visa-qr-box img {
              width: 22mm;
              height: 22mm;
              display: block;
            }
            .visa-qr-lbl {
              font-size: 6px;
              font-weight: 900;
              color: #1e1b4b;
              margin-top: 1px;
              text-align: center;
              line-height: 1;
            }
            .card-footer {
              border-top: 0.5px solid rgba(255,255,255,0.2);
              padding-top: 1.5px;
              display: flex;
              justify-content: space-between;
              font-size: 6.5px;
              color: #cbd5e1;
              font-family: monospace;
              line-height: 1;
            }
          </style>
        </head>
        <body>
          <div class="visa-card">
            <div class="card-header">
              <div>
                <div class="brand-title">${settings.platformName || 'منصة مستر محمد صابر'}</div>
                <div class="teacher-sub">${settings.teacherName || 'كارت الطالب الرسمي'}</div>
              </div>
              <span class="badge-type">${student.isCenterStudent ? 'طالب سنتر' : 'طالب أونلاين'}</span>
            </div>

            <div class="visa-body">
              <div class="visa-details">
                <div class="st-name">${student.name}</div>
                <div class="st-grade">${student.grade || 'غير محدد'}${student.centerGroup ? ` • ${student.centerGroup}` : ''}</div>
                <div class="promo-box">
                  <div class="promo-item">
                    <span class="promo-lbl">كود:</span>
                    <span class="promo-val">${studentCode}</span>
                  </div>
                  <div class="promo-item">
                    <span class="promo-lbl">سر:</span>
                    <span class="promo-pass">${studentPassword}</span>
                  </div>
                </div>
                <div class="barcode-box">
                  ${barcodeSvg}
                </div>
              </div>

              <!-- Dedicated large QR code on the left side -->
              <div class="visa-qr-box">
                <img src="https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(parentReportUrl)}" alt="QR" />
                <div class="visa-qr-lbl">مسح الكود / التقرير</div>
              </div>
            </div>

            <div class="card-footer">
              <div>📞 طالب: <span dir="ltr">${student.phone || '-'}</span></div>
              <div>👨‍👩‍👧 ولي أمر: <span dir="ltr">${student.parentPhone || '-'}</span></div>
            </div>
          </div>
        </body>
        </html>
      `;
      printHtmlDocument(html, `كارت_فيزا_${student.name || ''}`);
    }
  };

  // 6 CARDS PER A4 PAGE (FULL SCREEN, PROMINENT BARCODE AND QR CODE)
  const handlePrint6CardsPerPage = (studentsToPrint: AppUser[]) => {
    if (!studentsToPrint || studentsToPrint.length === 0) {
      alert('لا يوجد طلاب محددون للطباعة');
      return;
    }

    // Mark all as printed in Firestore so they automatically sink to the bottom
    studentsToPrint.forEach(st => markAsPrinted(st.uid));

    // 6 cards per A4 page (2 columns x 3 rows)
    const chunkSize = 6;
    const pages: AppUser[][] = [];
    for (let i = 0; i < studentsToPrint.length; i += chunkSize) {
      pages.push(studentsToPrint.slice(i, i + chunkSize));
    }

    const origin = window.location.origin;

    const pagesHtml = pages.map((pageStudents, pageIdx) => `
      <div class="a4-page ${pageIdx > 0 ? 'page-break' : ''}">
        <div class="cards-grid">
          ${pageStudents.map(st => {
            const stCode = st.code || st.uid.substring(0, 8);
            const parentReport = `${origin}/parent-report/${stCode}`;
            const barcode = generateBarcodeSvg(stCode, 1.8, 26, 9.5);
            return `
            <div class="card-item">
              <div class="card-header">
                <div>
                  <div class="brand-title">${settings.platformName || 'منصة مستر محمد صابر'}</div>
                  <div class="teacher-sub">${settings.teacherName || 'كارت الطالب الرسمي'}</div>
                </div>
                <span class="badge-type">${st.isCenterStudent ? 'طالب سنتر' : 'طالب أونلاين'}</span>
              </div>

              <div class="card-body">
                <div class="student-info">
                  <div class="st-name">${st.name}</div>
                  <div class="st-grade">${st.grade || 'غير محدد'}${st.centerGroup ? ` • ${st.centerGroup}` : ''}</div>
                  
                  <div class="promo-box">
                    <div>كود: <b class="code-val">${stCode}</b></div>
                    <div>السر: <b class="pass-val">${st.password || '-'}</b></div>
                  </div>

                  <div class="st-phones">
                    <div>📞 طالب: <span dir="ltr">${st.phone || '-'}</span></div>
                    <div>👨‍👩‍👧 ولي أمر: <span dir="ltr">${st.parentPhone || '-'}</span></div>
                  </div>
                </div>

                <!-- Prominent QR Code in dedicated crisp container -->
                <div class="qr-col">
                  <div class="qr-card">
                    <img src="https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(parentReport)}" alt="QR" class="qr-img" />
                    <div class="qr-lbl">تقرير ولي الأمر</div>
                  </div>
                </div>
              </div>

              <!-- Prominent Full-Width Barcode -->
              <div class="barcode-box">
                ${barcode}
              </div>
            </div>
            `;
          }).join('')}
        </div>
      </div>
    `).join('');

    const html = `
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="utf-8">
        <title>طباعة كروت الطلاب (6 كروت في الصفحة A4 - واضحة وممتلئة)</title>
        <style>
          @page {
            size: A4 portrait;
            margin: 6mm 8mm;
          }
          * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            font-family: system-ui, -apple-system, sans-serif;
          }
          body {
            background: #ffffff;
            color: #0f172a;
          }
          .a4-page {
            width: 100%;
            display: flex;
            flex-direction: column;
            justify-content: flex-start;
          }
          .page-break {
            page-break-before: always;
            break-before: page;
          }
          .cards-grid {
            display: grid;
            grid-template-columns: repeat(2, 94mm);
            grid-template-rows: repeat(3, 86mm);
            gap: 5mm 6mm;
            justify-content: center;
            align-content: center;
          }
          .card-item {
            width: 94mm;
            height: 86mm;
            border: 1px dashed #6366f1;
            border-radius: 10px;
            background: linear-gradient(135deg, #0f172a 0%, #1e1b4b 55%, #312e81 100%);
            color: #ffffff;
            padding: 4mm 5mm;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            page-break-inside: avoid;
            break-inside: avoid;
            overflow: hidden;
            box-sizing: border-box;
          }
          .card-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 0.5px solid rgba(255,255,255,0.25);
            padding-bottom: 2px;
          }
          .brand-title {
            font-size: 11px;
            font-weight: 900;
            color: #fcd34d;
            line-height: 1.1;
          }
          .teacher-sub {
            font-size: 8px;
            color: #c7d2fe;
            line-height: 1;
            margin-top: 1px;
          }
          .badge-type {
            background: #fbbf24;
            color: #0f172a;
            font-size: 7.5px;
            font-weight: 900;
            padding: 1.5px 6px;
            border-radius: 9999px;
          }
          .card-body {
            display: flex;
            gap: 3mm;
            align-items: center;
            justify-content: space-between;
            flex: 1;
            margin: 2mm 0;
          }
          .student-info {
            flex: 1;
            display: flex;
            flex-direction: column;
            gap: 2px;
            overflow: hidden;
          }
          .st-name {
            font-size: 13px;
            font-weight: 900;
            color: #ffffff;
            line-height: 1.15;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }
          .st-grade {
            font-size: 9px;
            font-weight: 700;
            color: #fbbf24;
          }
          .promo-box {
            background: rgba(0, 0, 0, 0.45);
            border: 1px solid rgba(253, 224, 71, 0.35);
            border-radius: 6px;
            padding: 2.5px 5px;
            display: flex;
            flex-direction: column;
            gap: 1.5px;
            font-size: 8.5px;
            color: #cbd5e1;
            margin: 1.5px 0;
          }
          .promo-box .code-val {
            font-family: monospace;
            font-size: 12px;
            color: #fde047;
            letter-spacing: 0.5px;
          }
          .promo-box .pass-val {
            font-family: monospace;
            font-size: 9.5px;
            color: #34d399;
          }
          .st-phones {
            font-size: 7.5px;
            color: #cbd5e1;
            font-family: monospace;
            line-height: 1.2;
          }
          .qr-col {
            width: 30mm;
            flex-shrink: 0;
            display: flex;
            justify-content: center;
            align-items: center;
          }
          .qr-card {
            background: #ffffff;
            padding: 3px;
            border-radius: 6px;
            display: flex;
            flex-direction: column;
            align-items: center;
            box-shadow: 0 2px 4px rgba(0,0,0,0.3);
          }
          .qr-img {
            width: 26mm;
            height: 26mm;
            display: block;
          }
          .qr-lbl {
            font-size: 7px;
            font-weight: 900;
            color: #1e1b4b;
            margin-top: 1.5px;
            text-align: center;
            line-height: 1;
          }
          .barcode-box {
            background: #ffffff;
            border-radius: 5px;
            padding: 2px 4px;
            display: flex;
            justify-content: center;
            align-items: center;
            width: 100%;
            height: 24px;
            overflow: hidden;
          }
          .barcode-box svg {
            width: 100%;
            height: 22px;
          }
        </style>
      </head>
      <body>
        ${pagesHtml}
      </body>
      </html>
    `;
    printHtmlDocument(html, 'كروت_الطلاب_6_بالورقة_A4');
  };

  if (loading) {
    return <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-indigo-600" /></div>;
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900">إدارة الطلاب والمساعدين وطلاب السنتر</h2>
          <p className="text-slate-500 font-medium">إضافة طلاب السنتر، الاستعلام بالكود، وتخصيص المجموعات وطباعة الكروت</p>
        </div>

        {/* GOOGLE AUTH TOGGLE (ACCESSIBLE TO ADMIN AND ALL ASSISTANTS) */}
        <div className={`p-3.5 px-4 rounded-2xl border flex items-center gap-3 transition-all ${
          settings.enableGoogleAuth !== false 
            ? 'bg-emerald-50 border-emerald-200 text-emerald-950' 
            : 'bg-amber-50 border-amber-200 text-amber-950'
        }`}>
          <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-black text-sm shadow-xs ${
            settings.enableGoogleAuth !== false ? 'bg-emerald-600 text-white' : 'bg-amber-600 text-white'
          }`}>
            G
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-black">تسجيل ودخول Google:</span>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                settings.enableGoogleAuth !== false ? 'bg-emerald-200 text-emerald-900' : 'bg-amber-200 text-amber-900'
              }`}>
                {settings.enableGoogleAuth !== false ? 'مفعل ومتاح ✅' : 'معطل ومغلق ⛔'}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">
              {settings.enableGoogleAuth !== false ? 'يمكن للطلاب الدخول بـ Google' : 'التسجيل مقتصر على الأكواد والهاتف'}
            </p>
          </div>
          <button
            type="button"
            onClick={async () => {
              const nextVal = settings.enableGoogleAuth === false ? true : false;
              await updateSettings({ enableGoogleAuth: nextVal });
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer shadow-xs whitespace-nowrap mr-2 ${
              settings.enableGoogleAuth !== false 
                ? 'bg-rose-600 hover:bg-rose-700 text-white' 
                : 'bg-emerald-600 hover:bg-emerald-700 text-white'
            }`}
          >
            {settings.enableGoogleAuth !== false ? 'إلغاء التفعيل ⛔' : 'تفعيل الآن ✅'}
          </button>
        </div>
      </div>

      {/* SECTION 1: CENTER STUDENT CREATION & CARD SEARCH */}
      <div className="grid lg:grid-cols-2 gap-8">
        
        {/* ADD CENTER STUDENT FORM */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-5">
          <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-lg">إضافة طالب سنتر جديد</h3>
              <p className="text-xs text-slate-500">إنشاء حساب بكود وكلمة مرور ودخول مجاني للطالب</p>
            </div>
          </div>

          {addSuccess && (
            <div className="bg-emerald-50 text-emerald-700 p-3 rounded-xl text-sm font-bold border border-emerald-200 flex items-center justify-between">
              <span>{addSuccess}</span>
              <button onClick={() => setAddSuccess('')} className="text-emerald-500 font-bold">&times;</button>
            </div>
          )}

          <form onSubmit={handleAddCenterStudent} className="space-y-4">
            <div>
              <label className="block text-slate-700 text-xs font-bold mb-1">اسم الطالب رباعي *</label>
              <input 
                type="text" 
                required
                value={centerName}
                onChange={e => setCenterName(e.target.value)}
                placeholder="اسم الطالب الكامل"
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-700 text-xs font-bold mb-1">الصف / المرحلة الدراسية</label>
                <select 
                  value={centerGrade}
                  onChange={e => setCenterGrade(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">اختر المرحلة</option>
                  {(settings.grades || []).map((g, idx) => (
                    <option key={idx} value={g}>{g}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-700 text-xs font-bold mb-1">هاتف الطالب</label>
                <input 
                  type="text" 
                  value={centerPhone}
                  onChange={e => setCenterPhone(e.target.value)}
                  placeholder="010..."
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                  dir="ltr"
                />
              </div>
            </div>

            <div>
              <label className="block text-slate-700 text-xs font-bold mb-1">رقم ولي الأمر</label>
              <input 
                type="text" 
                value={centerParentPhone}
                onChange={e => setCenterParentPhone(e.target.value)}
                placeholder="011..."
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                dir="ltr"
              />
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-slate-700 text-xs font-bold">مجموعة السنتر ومواعيد الحضور *</label>
                <button
                  type="button"
                  onClick={() => setIsGroupBuilderOpen(true)}
                  className="text-[11px] text-indigo-600 hover:text-indigo-800 font-black flex items-center gap-1 cursor-pointer"
                  title="إنشاء أو اختيار مجموعة عبر جدول اليومين والميعاد بدقة لتجنب أخطاء الكتابة"
                >
                  <span>📅 جدول المواعيد / اختيار بالجدول</span>
                </button>
              </div>
              <select
                value={centerGroup}
                onChange={e => setCenterGroup(e.target.value)}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-indigo-700 outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {availableGroups.map((grp, idx) => (
                  <option key={idx} value={grp}>{grp}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-slate-700 text-xs font-bold">كود الطالب *</label>
                  <button 
                    type="button" 
                    onClick={generateRandomCode}
                    className="text-[11px] text-indigo-600 font-bold hover:underline"
                  >
                    توليد تلقائي
                  </button>
                </div>
                <input 
                  type="text" 
                  required
                  value={centerCode}
                  onChange={e => setCenterCode(e.target.value)}
                  placeholder="104592"
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono outline-none focus:ring-2 focus:ring-indigo-500"
                  dir="ltr"
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-slate-700 text-xs font-bold">كلمة المرور *</label>
                  <button 
                    type="button" 
                    onClick={generateRandomPassword}
                    className="text-[11px] text-indigo-600 font-bold hover:underline"
                  >
                    توليد تلقائي
                  </button>
                </div>
                <input 
                  type="text" 
                  required
                  value={centerPassword}
                  onChange={e => setCenterPassword(e.target.value)}
                  placeholder="X79K2L"
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono outline-none focus:ring-2 focus:ring-indigo-500"
                  dir="ltr"
                />
              </div>
            </div>

            <button 
              type="submit" 
              disabled={addingCenterStudent}
              className="w-full mt-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-md"
            >
              {addingCenterStudent ? <Loader2 className="w-5 h-5 animate-spin" /> : <UserPlus className="w-5 h-5" />}
              إضافة الطالب للسنتر
            </button>
          </form>
        </div>

        {/* CODE SEARCH & STUDENT CARD */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex flex-col justify-between space-y-5">
          <div className="space-y-4">
            <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                <Search className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-lg">الاستعلام عن الطالب (بالاسم، الكود، أو الهاتف)</h3>
                <p className="text-xs text-slate-500">ابحث باسم الطالب أو كوده أو رقمه لعرض بطاقته والتحكم في كورساته فوراً</p>
              </div>
            </div>

            <div className="relative">
              <form onSubmit={handleSearchByCode} className="flex gap-2">
                <div className="relative flex-1">
                  <input 
                    type="text" 
                    placeholder="اكتب اسم الطالب، كوده، أو رقم هاتفه..."
                    value={codeQuery}
                    onChange={e => setCodeQuery(e.target.value)}
                    className="w-full p-2.5 pr-9 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
                <button 
                  type="submit"
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 rounded-xl font-bold text-sm transition-colors shadow-sm"
                >
                  بحث
                </button>
              </form>

              {/* LIVE SUGGESTIONS DROPDOWN */}
              {codeQuery.trim().length > 0 && searchSuggestions.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1.5 bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden z-30 divide-y divide-slate-100 max-h-60 overflow-y-auto">
                  <div className="px-3 py-2 bg-slate-50 text-[11px] font-bold text-slate-500 flex justify-between items-center">
                    <span>نتائج البحث المباشر ({searchSuggestions.length})</span>
                    <span className="text-[10px] text-slate-400">اختر الطالب لعرض بطاقته</span>
                  </div>
                  {searchSuggestions.map(student => (
                    <button
                      key={student.uid}
                      type="button"
                      onClick={() => {
                        setFoundStudent(student);
                        setCodeQuery(student.name || student.code || '');
                      }}
                      className="w-full text-right p-3 hover:bg-indigo-50/80 transition-colors flex items-center justify-between gap-3 group"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-slate-100 group-hover:bg-indigo-100 text-slate-700 group-hover:text-indigo-700 flex items-center justify-center font-bold text-xs">
                          {student.name ? student.name.charAt(0) : <User className="w-4 h-4" />}
                        </div>
                        <div>
                          <div className="text-sm font-bold text-slate-900 group-hover:text-indigo-900">{student.name}</div>
                          <div className="text-xs text-slate-500 flex items-center gap-2">
                            {student.phone && <span className="font-mono">{student.phone}</span>}
                            <span>•</span>
                            <span>{student.grade || 'غير محدد'}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {student.code && (
                          <span className="font-mono text-xs font-black bg-yellow-100 text-amber-900 px-2 py-0.5 rounded border border-yellow-200">
                            كود: {student.code}
                          </span>
                        )}
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          student.isCenterStudent ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'
                        }`}>
                          {student.isCenterStudent ? 'سنتر' : 'أونلاين'}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* CARD DISPLAY */}
          <div className="flex-1 flex flex-col justify-center">
            {foundStudent ? (
              <div id="printable-student-card" className="bg-gradient-to-br from-indigo-900 via-indigo-800 to-slate-900 text-white p-6 rounded-2xl shadow-xl relative overflow-hidden border border-indigo-700/50 space-y-4">

                <div className="flex justify-between items-start border-b border-indigo-700/60 pb-3">
                  <div>
                    <div className="text-[10px] text-indigo-300 font-bold uppercase tracking-wider">{settings.platformName || 'منصة التعليم'}</div>
                    <div className="text-sm font-black text-white">{settings.teacherName || 'بطاقة الطالب'}</div>
                  </div>
                  <div className="flex items-center gap-1 flex-wrap justify-end">
                    <span className="bg-amber-400 text-slate-900 px-2 py-0.5 rounded-full text-[10px] font-black shadow-sm">
                      {foundStudent.isCenterStudent ? 'سنتر' : 'أونلاين'}
                    </span>
                    {foundStudent.banned && (
                      <span className="bg-rose-500 text-white px-2 py-0.5 rounded-full text-[10px] font-bold">
                        محظور
                      </span>
                    )}
                  </div>
                </div>

                {/* DISCREET & SECURE CREDENTIALS (RESTORED SAFE READING SIZE) */}
                <div className="grid grid-cols-2 gap-3 my-2">
                  <div className="bg-slate-950/80 border border-amber-400/40 rounded-xl p-3 flex flex-col justify-between">
                    <div className="flex items-center justify-between text-[11px] text-slate-300 font-bold mb-1">
                      <span>كود الطالب:</span>
                      <button 
                        onClick={() => {
                          navigator.clipboard.writeText(foundStudent.code || '');
                          setCopied(true);
                          setTimeout(() => setCopied(false), 2000);
                        }}
                        className="text-[10px] text-amber-300 hover:text-amber-200 flex items-center gap-1 cursor-pointer"
                      >
                        <Copy className="w-3 h-3" />
                        <span>{copied ? 'تم' : 'نسخ'}</span>
                      </button>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-base text-yellow-300 select-all">
                        {foundStudent.code || '-'}
                      </span>
                      <button 
                        onClick={() => handleUpdateCode(foundStudent.uid, foundStudent.code)}
                        className="text-[10px] text-slate-400 hover:text-white underline cursor-pointer"
                      >
                        تعديل
                      </button>
                    </div>
                  </div>

                  <div className="bg-slate-950/80 border border-emerald-400/40 rounded-xl p-3 flex flex-col justify-between">
                    <div className="flex items-center justify-between text-[11px] text-slate-300 font-bold mb-1">
                      <span>كلمة المرور:</span>
                      <button 
                        onClick={() => handleUpdatePassword(foundStudent.uid, foundStudent.password)}
                        className="text-[10px] text-slate-400 hover:text-white underline cursor-pointer"
                      >
                        تعديل
                      </button>
                    </div>
                    <span className="font-mono font-bold text-base text-emerald-400 select-all">
                      {foundStudent.password || '-'}
                    </span>
                  </div>
                </div>

                <div className="col-span-2 bg-black/25 p-2.5 rounded-xl flex items-center justify-between border border-indigo-400/20">
                  <div>
                    <span className="text-[10px] text-indigo-200 block mb-0.5">مجموعة السنتر ومواعيد الحضور</span>
                    <span className="font-bold text-amber-300 text-xs">{foundStudent.centerGroup || 'مجموعة السبت والثلاثاء'}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setGroupModalStudent(foundStudent)}
                    className="text-[11px] bg-white/20 hover:bg-white/30 text-white px-3 py-1.5 rounded-lg font-bold transition-colors cursor-pointer flex items-center gap-1 shadow-xs"
                  >
                    تغيير المجموعة ✏️
                  </button>
                </div>

                {/* DUAL BARCODE & QR CODE SECTION */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-indigo-700/50">
                  {/* 1. Barcode for Center Attendance */}
                  <div className="bg-white p-2.5 rounded-xl shadow-inner flex flex-col items-center justify-center text-slate-900 text-center">
                    <div className="text-[10px] font-black text-indigo-900 mb-1">
                      🏷️ باركود حضور السنتر
                    </div>
                    <div className="w-full flex justify-center overflow-hidden">
                      <Barcode 
                        value={foundStudent.code || foundStudent.uid.substring(0, 8)} 
                        width={1.3} 
                        height={32} 
                        fontSize={9} 
                        className="max-w-full"
                      />
                    </div>
                    <div className="text-[9px] text-slate-500 font-bold mt-1">يُمسح بجهاز الباركود أو الكاميرا</div>
                  </div>

                  {/* 2. QR Code for Parent Report */}
                  <div className="bg-white p-2.5 rounded-xl shadow-inner flex flex-col items-center justify-center text-slate-900 text-center">
                    <div className="text-[10px] font-black text-indigo-900 mb-1">
                      📱 كود تقرير ولي الأمر (QR)
                    </div>
                    <div className="p-1 bg-slate-50 rounded-lg border border-slate-200">
                      <QRCodeSVG 
                        value={`${window.location.origin}/parent-report/${foundStudent.code || foundStudent.uid}`} 
                        size={56} 
                        level="M"
                      />
                    </div>
                    <div className="text-[9px] text-slate-500 font-bold mt-1">يفتحه ولي الأمر بكاميرا الهاتف</div>
                  </div>
                </div>

                <div className="pt-2 border-t border-indigo-700/60 grid grid-cols-2 gap-2 text-[10px] text-indigo-200">
                  <div>طالب: <span className="text-white font-mono" dir="ltr">{foundStudent.phone || '-'}</span></div>
                  <div>ولي أمر: <span className="text-white font-mono" dir="ltr">{foundStudent.parentPhone || '-'}</span></div>
                </div>

                {/* FAST COURSE ACCESS & PROMOTION BUTTONS */}
                <div className="pt-2 border-t border-indigo-700/60 flex flex-wrap items-center justify-between gap-2 print:hidden">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setEditingCoursesStudent(foundStudent)}
                      className="bg-emerald-500 hover:bg-emerald-600 text-white px-3.5 py-2 rounded-xl text-xs font-black flex items-center gap-2 transition-all shadow-md shadow-emerald-950/30 cursor-pointer"
                    >
                      <BookOpen className="w-4 h-4" />
                      فتح وإدارة الكورسات ({foundStudent.allowedCourseIds?.length || 0} مفعل)
                    </button>

                    {canPromoteGrade(foundStudent.grade) && (
                      <button
                        onClick={() => handlePromoteStudentGrade(foundStudent.uid, foundStudent.grade)}
                        className="bg-indigo-500 hover:bg-indigo-600 text-white px-3 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all shadow-md cursor-pointer"
                        title={`ترقية الطالب إلى ${getNextGrade(foundStudent.grade)}`}
                      >
                        <GraduationCap className="w-4 h-4 text-amber-300" />
                        <span>ترقية إلى {getNextGrade(foundStudent.grade)}</span>
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <button 
                      onClick={() => { setCardManagerStudent(foundStudent); setIsCardManagerOpen(true); }}
                      className="bg-indigo-700 hover:bg-indigo-800 text-white px-4 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all shadow-md cursor-pointer border border-indigo-500/50"
                      title="ربط كارت خارجي مطبوع بمسح الـ QR أو البرومو كود، أو توليد وطباعة كارت جديد"
                    >
                      <CreditCard className="w-4 h-4 text-amber-300" />
                      <span>💳 إدارة الكارت (مسح خارجي / طباعة)</span>
                    </button>

                    <button 
                      onClick={() => printStudentSticker(foundStudent)}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all shadow-md cursor-pointer"
                      title="طباعة استيكر حراري لاصق للكارت (البرومو كود + الكيو آر كود)"
                    >
                      <Printer className="w-3.5 h-3.5 text-emerald-200" />
                      <span>🖨️ طباعة استيكر (QR + برومو)</span>
                    </button>

                    <button 
                      onClick={() => handlePrintCard(foundStudent, 'full_page')}
                      className="bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-500 hover:to-amber-600 text-slate-950 px-4 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all shadow-lg cursor-pointer"
                      title="طباعة كارت يملأ الورقة بالكامل بدون صفحات أو أطراف بيضاء فارغة وبكود بارز وكبير"
                    >
                      <Printer className="w-4 h-4" />
                      <span>طباعة كارت ملء الورقة (A4 واضح وكبير)</span>
                    </button>

                    <button 
                      onClick={() => handlePrintCard(foundStudent, 'visa_size')}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                      title="طباعة بحجم فيزا 85.6mm للطابعات الحرارية وبطاقات ID"
                    >
                      <CreditCard className="w-3.5 h-3.5 text-amber-300" />
                      <span>حجم فيزا (85mm)</span>
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="border-2 border-dashed border-slate-200 rounded-2xl p-8 text-center text-slate-400 text-sm flex flex-col items-center">
                <Key className="w-10 h-10 mb-2 opacity-30 text-slate-500" />
                <p>ابحث باسم الطالب أو كوده أو رقمه أعلاه لعرض بطاقته والتحكم في كورساته.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* SECTION 2: CATEGORIZED STUDENT MANAGEMENT */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden space-y-6">
        
        {/* CATEGORY TABS & SEARCH */}
        <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-slate-50/50">
          <div>
            <h3 className="font-black text-slate-900 text-lg">قوائم المستخدمين والطلاب</h3>
            <p className="text-slate-500 text-xs font-medium">تصنيف الطلاب حسب طريقة التسجيل لتسهيل المتابعة</p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200 shadow-xs flex-wrap">
              <button
                onClick={() => setActiveCategory('center')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                  activeCategory === 'center' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Building className="w-3.5 h-3.5" />
                طلاب السنتر ({centerStudents.length})
              </button>

              <button
                onClick={() => setActiveCategory('online')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                  activeCategory === 'online' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <UserCheck className="w-3.5 h-3.5" />
                طلاب المنصة ({onlineStudents.length})
              </button>

              <button
                onClick={() => setActiveCategory('google')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                  activeCategory === 'google' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Award className="w-3.5 h-3.5" />
                تسجيل Google ({googleStudents.length})
              </button>

              <button
                onClick={() => setActiveCategory('assistants')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                  activeCategory === 'assistants' ? 'bg-amber-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Shield className="w-3.5 h-3.5 text-amber-500" />
                فريق المساعدين 🎖️ ({assistantsList.length})
              </button>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => printBatchStickers(activeList)}
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 shadow-md cursor-pointer"
                title="طباعة استيكرات حرارية لاصقة (QR + برومو كود) لجميع طلاب القائمة المحددة"
              >
                <Printer className="w-4 h-4" />
                <span>🖨️ طباعة استيكرات القائمة (QR + برومو)</span>
              </button>

              <button
                onClick={() => handlePrint6CardsPerPage(activeList)}
                className="bg-amber-400 hover:bg-amber-500 text-slate-950 px-3.5 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 shadow-md cursor-pointer"
                title="طباعة 6 كروت في كل صفحة A4 ممتلئة وواضحة جداً بالكود والباركود والكيو آر"
              >
                <Printer className="w-4 h-4" />
                <span>طباعة كروت القائمة (6 كروت / ورقة A4)</span>
              </button>
            </div>
          </div>
        </div>

        {/* SEARCH AND PRINT STATUS FILTER BAR */}
        <div className="px-6 flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
          <div className="relative flex-1">
            <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="ابحث بالاسم، الكود، البريد، الهاتف، أو مجموعة السنتر..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pr-10 pl-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-bold text-slate-600">
            <span className="px-2 text-[11px] text-slate-400">حالة الطباعة:</span>
            <button
              onClick={() => setPrintStatusFilter('all')}
              className={`px-2.5 py-1 rounded-lg transition-all ${printStatusFilter === 'all' ? 'bg-white text-indigo-700 shadow-xs' : 'hover:text-slate-900'}`}
            >
              الكل
            </button>
            <button
              onClick={() => setPrintStatusFilter('unprinted')}
              className={`px-2.5 py-1 rounded-lg transition-all flex items-center gap-1 ${printStatusFilter === 'unprinted' ? 'bg-emerald-600 text-white shadow-xs' : 'text-emerald-700 hover:text-emerald-900'}`}
            >
              <span>✨ جاهز للطباعة</span>
            </button>
            <button
              onClick={() => setPrintStatusFilter('printed')}
              className={`px-2.5 py-1 rounded-lg transition-all flex items-center gap-1 ${printStatusFilter === 'printed' ? 'bg-slate-700 text-white shadow-xs' : 'text-slate-500 hover:text-slate-800'}`}
            >
              <span>🖨️ طُبع سابقاً (بالأسفل)</span>
            </button>
          </div>
        </div>

        {/* STUDENTS TABLE */}
        <div className="overflow-x-auto">
          {activeList.length === 0 ? (
            <div className="p-12 text-center text-slate-400 text-sm">
              لا يوجد طلاب مطابقين للبحث أو الفلتر المختار.
            </div>
          ) : (
            <table className="w-full text-right text-sm text-slate-600">
              <thead className="bg-slate-50 border-y border-slate-200 text-slate-700 font-bold text-xs">
                <tr>
                  <th className="px-5 py-3.5">اسم الطالب</th>
                  <th className="px-4 py-3.5">الصف الدراسي</th>
                  {activeCategory === 'center' && <th className="px-4 py-3.5">مجموعة السنتر</th>}
                  <th className="px-4 py-3.5 text-center">كود الطالب</th>
                  <th className="px-4 py-3.5 text-center">كلمة المرور</th>
                  <th className="px-4 py-3.5">الهاتف / ولي الأمر</th>
                  <th className="px-4 py-3.5 text-center">حالة الكارت</th>
                  <th className="px-4 py-3.5 text-center">الصلاحية</th>
                  <th className="px-5 py-3.5 text-center">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {activeList.map((user) => (
                  <tr key={user.uid} className={`hover:bg-slate-50/80 transition-colors ${user.cardPrinted ? 'bg-slate-50/40 opacity-90' : ''}`}>
                    <td className="px-5 py-3.5">
                      <div className="font-bold text-slate-900 flex items-center gap-1.5">
                        {user.name} 
                        {user.banned && <span className="bg-rose-100 text-rose-700 text-[10px] px-2 py-0.5 rounded-full font-bold">محظور</span>}
                      </div>
                      <div className="text-xs text-slate-400 font-mono">{user.email}</div>
                    </td>

                    <td className="px-4 py-3.5 font-medium text-slate-700 text-xs">
                      {user.grade || 'غير محدد'}
                    </td>

                    {activeCategory === 'center' && (
                      <td className="px-4 py-3.5 text-xs">
                        <button
                          onClick={() => setGroupModalStudent(user)}
                          className="font-bold text-indigo-700 hover:text-indigo-900 bg-indigo-50 hover:bg-indigo-100 px-2 py-1 rounded-lg transition-colors flex items-center gap-1 max-w-[200px] truncate"
                          title="انقر لتغيير مجموعة الطالب"
                        >
                          <span className="truncate">{user.centerGroup || 'تحديد مجموعة'}</span>
                          <span className="text-[10px] text-indigo-400">✏️</span>
                        </button>
                      </td>
                    )}

                    <td className="px-4 py-3.5 text-center">
                      <span className="font-mono font-black bg-slate-100 text-slate-900 px-2.5 py-1 rounded-md text-xs tracking-wider">
                        {user.code || 'بدون كود'}
                      </span>
                    </td>

                    <td className="px-4 py-3.5 text-center">
                      <span className="font-mono font-bold bg-slate-100 text-emerald-800 px-2 py-1 rounded-md text-xs">
                        {user.password || '-'}
                      </span>
                    </td>

                    <td className="px-4 py-3.5 text-xs font-mono">
                      <div>طالب: <span className="text-slate-800" dir="ltr">{user.phone || '-'}</span></div>
                      <div>ولي أمر: <span className="text-slate-800" dir="ltr">{user.parentPhone || '-'}</span></div>
                    </td>

                    <td className="px-4 py-3.5 text-center">
                      {user.cardPrinted ? (
                        <div className="inline-flex items-center gap-1">
                          <span className="bg-slate-200 text-slate-600 text-[10px] px-2 py-0.5 rounded-full font-bold">
                            🖨️ طُبع
                          </span>
                          <button
                            onClick={() => markAsUnprinted(user.uid)}
                            className="text-[10px] text-slate-400 hover:text-indigo-600 font-bold"
                            title="إلغاء حالة الطباعة لإعادة طباعته لاحقاً"
                          >
                            إعادة
                          </button>
                        </div>
                      ) : (
                        <span className="bg-emerald-100 text-emerald-800 text-[10px] px-2 py-0.5 rounded-full font-bold">
                          ✨ جاهز
                        </span>
                      )}
                    </td>

                    <td className="px-4 py-3.5 text-center">
                      {user.role === 'assistant' ? (
                        <span className="bg-indigo-100 text-indigo-800 px-2.5 py-1 rounded-full text-xs font-bold inline-flex items-center gap-1">
                          <Shield className="w-3.5 h-3.5 text-indigo-600" /> مساعد
                        </span>
                      ) : (
                        <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full text-xs font-bold">
                          طالب
                        </span>
                      )}
                    </td>

                    <td className="px-5 py-3.5 text-center">
                      <div className="flex items-center justify-center gap-1.5 flex-wrap">
                        <button 
                          onClick={() => { setFoundStudent(user); setCodeQuery(user.code || ''); }}
                          className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 px-2.5 py-1 rounded-lg text-xs font-bold transition-colors"
                          title="عرض بطاقة الطالب والباركود"
                        >
                          البطاقة
                        </button>

                        {/* Card Manager Button (Link external / Print) */}
                        <button 
                          onClick={() => { setCardManagerStudent(user); setIsCardManagerOpen(true); }}
                          className="bg-purple-50 hover:bg-purple-100 text-purple-700 px-2.5 py-1 rounded-lg text-xs font-bold transition-colors flex items-center gap-1"
                          title="إدارة وربط كارت الطالب (مسح كارت خارجي / طباعة)"
                        >
                          <CreditCard className="w-3 h-3 text-purple-600" />
                          <span>الكارت</span>
                        </button>

                        {/* Direct Visa print */}
                        <button
                          onClick={() => handlePrintCard(user, 'visa_size')}
                          className="bg-indigo-600 hover:bg-indigo-700 text-white px-2 py-1 rounded-lg text-xs font-bold transition-colors"
                          title="طباعة كارت بحجم فيزا ومسح الكود"
                        >
                          فيزا
                        </button>

                        {/* Direct Thermal Sticker Print */}
                        <button
                          onClick={() => printStudentSticker(user)}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white px-2 py-1 rounded-lg text-xs font-bold transition-colors flex items-center gap-0.5"
                          title="طباعة استيكر حراري لاصق للكارت (البرومو كود + الكيو آر كود)"
                        >
                          <Printer className="w-3 h-3" />
                          <span>استيكر</span>
                        </button>

                        {/* Direct Group change */}
                        <button
                          onClick={() => setGroupModalStudent(user)}
                          className="bg-amber-50 hover:bg-amber-100 text-amber-800 px-2 py-1 rounded-lg text-xs font-bold transition-colors"
                          title="تغيير مجموعة السنتر"
                        >
                          المجموعة
                        </button>

                        <button 
                          onClick={() => handleUpdateCode(user.uid, user.code)}
                          className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-2 py-1 rounded-lg text-xs font-bold transition-colors"
                          title="تغيير الكود"
                        >
                          الكود
                        </button>

                        <button 
                          onClick={() => handleUpdatePassword(user.uid, user.password)}
                          className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-2 py-1 rounded-lg text-xs font-bold transition-colors"
                          title="تغيير كلمة السر"
                        >
                          السر
                        </button>

                        {user.role === 'student' ? (
                          <button 
                            onClick={() => handleUpdateRole(user.uid, 'assistant')}
                            className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 px-2 py-1 rounded-lg text-xs font-bold transition-colors"
                          >
                            مساعد
                          </button>
                        ) : (
                          <button 
                            onClick={() => handleUpdateRole(user.uid, 'student')}
                            className="bg-amber-50 hover:bg-amber-100 text-amber-700 px-2 py-1 rounded-lg text-xs font-bold transition-colors"
                          >
                            طالب
                          </button>
                        )}

                        <button 
                          onClick={() => setEditingCoursesStudent(user)}
                          className="bg-purple-50 hover:bg-purple-100 text-purple-700 px-2 py-1 rounded-lg text-xs font-bold transition-colors"
                          title="تخصيص الكورسات المتاحة للطالب"
                        >
                          الكورسات ({user.allowedCourseIds?.length || 0})
                        </button>

                        <button 
                          onClick={() => handleBanUser(user.uid, !user.banned)}
                          className={`${user.banned ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'} px-2 py-1 rounded-lg text-xs font-bold transition-colors`}
                        >
                          {user.banned ? 'فك الحظر' : 'حظر'}
                        </button>

                        <button 
                          onClick={() => handleDeleteUser(user.uid, user.name)}
                          className="bg-rose-50 hover:bg-rose-100 text-rose-700 p-1.5 rounded-lg text-xs font-bold transition-colors"
                          title="حذف الحساب"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* COURSE PERMISSIONS MODAL */}
      {editingCoursesStudent && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 space-y-5">
            <div className="flex justify-between items-center border-b border-slate-100 pb-4">
              <div>
                <h3 className="font-black text-slate-900 text-lg">تحديد الكورسات المتاحة للطالب</h3>
                <p className="text-xs text-slate-500 font-medium">الطالب: <span className="font-bold text-indigo-600">{editingCoursesStudent.name}</span></p>
              </div>
              <button 
                onClick={() => setEditingCoursesStudent(null)}
                className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center hover:bg-slate-200 font-bold"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-600 bg-indigo-50 p-3 rounded-xl border border-indigo-100">
              اختر الكورسات التي ترغب بتوفير الوصول إليها لهذا الطالب مباشرة (تتيح له الدخول بدون إيصال دفع أونلاين).
            </p>

            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {courses.length === 0 ? (
                <div className="text-xs text-slate-400 text-center py-4">لا توجد كورسات مضافة بالمنصة حالياً.</div>
              ) : (
                courses.map(c => {
                  const isAllowed = (editingCoursesStudent.allowedCourseIds || []).includes(c.id);
                  return (
                    <div 
                      key={c.id} 
                      onClick={() => handleToggleCoursePermission(editingCoursesStudent.uid, c.id, editingCoursesStudent.allowedCourseIds)}
                      className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${
                        isAllowed 
                          ? 'bg-indigo-50 border-indigo-300 text-indigo-900 font-bold' 
                          : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <div>
                        <div className="text-sm font-bold">{c.name}</div>
                        <div className="text-xs text-slate-400">{c.grade}</div>
                      </div>
                      <div className={`w-6 h-6 rounded-lg flex items-center justify-center border ${
                        isAllowed ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-300 bg-white'
                      }`}>
                        {isAllowed && <Check className="w-4 h-4" />}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <button 
              onClick={() => setEditingCoursesStudent(null)}
              className="w-full bg-slate-900 text-white font-bold py-3 rounded-xl hover:bg-slate-800 transition-colors"
            >
              تم الحفظ والإغلاق
            </button>
          </div>
        </div>
      )}

      {/* CENTER GROUP SELECTION MODAL */}
      {groupModalStudent && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 space-y-5 animate-in fade-in zoom-in duration-150">
            <div className="flex justify-between items-center border-b border-slate-100 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xl">👥</span>
                  <h3 className="font-black text-slate-900 text-lg">تحديد مجموعة السنتر للطالب</h3>
                </div>
                <p className="text-xs text-slate-500 font-medium mt-1">
                  الطالب: <span className="font-bold text-indigo-600">{groupModalStudent.name}</span> (كود: <span className="font-mono font-bold text-slate-700">{groupModalStudent.code || '-'}</span>)
                </p>
              </div>
              <button 
                onClick={() => { setGroupModalStudent(null); setCustomGroupInput(''); }}
                className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center hover:bg-slate-200 font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="bg-indigo-50/60 p-3 rounded-2xl border border-indigo-100 text-xs text-indigo-950 flex items-center justify-between">
              <div>
                <span className="text-slate-500 block text-[11px]">المجموعة الحالية المسجل بها:</span>
                <span className="font-black text-indigo-700 text-sm">
                  {groupModalStudent.centerGroup || 'لم تُحدد بعد'}
                </span>
              </div>
              <span className="text-[10px] bg-indigo-200/60 text-indigo-800 px-2 py-0.5 rounded-full font-bold">
                مجموعات السنتر المعتمدة
              </span>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-slate-700 text-xs font-bold">
                  اختر من مجموعات السنتر المتاحة:
                </label>
                <button
                  type="button"
                  onClick={() => setIsGroupBuilderOpen(true)}
                  className="text-[11px] text-indigo-600 hover:text-indigo-800 font-black flex items-center gap-1 cursor-pointer"
                  title="إنشاء أو اختيار مجموعة عبر جدول اليومين والميعاد بدقة لتجنب أخطاء الكتابة"
                >
                  <span>📅 جدول المواعيد / اختيار بالجدول</span>
                </button>
              </div>
              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {availableGroups.map((grp, idx) => {
                  const isCurrent = (groupModalStudent.centerGroup || '') === grp;
                  return (
                    <div
                      key={idx}
                      onClick={async () => {
                        try {
                          await updateDoc(doc(db, 'users', groupModalStudent.uid), { centerGroup: grp });
                          setUsers(prev => prev.map(u => u.uid === groupModalStudent.uid ? { ...u, centerGroup: grp } : u));
                          if (foundStudent && foundStudent.uid === groupModalStudent.uid) {
                            setFoundStudent({ ...foundStudent, centerGroup: grp });
                          }
                          setGroupModalStudent(null);
                        } catch (err) {
                          console.error('Failed to update student center group:', err);
                        }
                      }}
                      className={`flex items-center justify-between p-3.5 rounded-2xl border cursor-pointer transition-all ${
                        isCurrent 
                          ? 'bg-indigo-50 border-indigo-300 text-indigo-900 font-black shadow-xs ring-1 ring-indigo-400' 
                          : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100 hover:border-slate-300 font-bold'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="text-base">{isCurrent ? '✅' : '🏢'}</span>
                        <span className="text-xs sm:text-sm">{grp}</span>
                      </div>
                      <span className={`text-[11px] font-bold px-2.5 py-1 rounded-lg ${
                        isCurrent ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-600'
                      }`}>
                        {isCurrent ? 'محدد حالياً' : 'اختيار'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ADD CUSTOM GROUP OR NEW GROUP NAME */}
            <div className="pt-2 border-t border-slate-100">
              <label className="block text-slate-700 text-xs font-bold mb-1.5">
                أو اكتب اسم / موعد مجموعة جديدة:
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={customGroupInput}
                  onChange={e => setCustomGroupInput(e.target.value)}
                  placeholder="مثال: مجموعة الأحد والأربعاء - 02:00 ظهراً"
                  className="flex-1 p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                />
                <button
                  type="button"
                  disabled={!customGroupInput.trim()}
                  onClick={async () => {
                    const newGrp = customGroupInput.trim();
                    if (!newGrp) return;
                    try {
                      await updateDoc(doc(db, 'users', groupModalStudent.uid), { centerGroup: newGrp });
                      setUsers(prev => prev.map(u => u.uid === groupModalStudent.uid ? { ...u, centerGroup: newGrp } : u));
                      if (foundStudent && foundStudent.uid === groupModalStudent.uid) {
                        setFoundStudent({ ...foundStudent, centerGroup: newGrp });
                      }
                      // If not present in settings.centerGroups, append it so it's available for all students
                      if (!availableGroups.includes(newGrp)) {
                        const updated = [...availableGroups, newGrp];
                        await updateSettings({ centerGroups: updated });
                      }
                      setGroupModalStudent(null);
                      setCustomGroupInput('');
                    } catch (err) {
                      console.error('Failed to set custom group:', err);
                    }
                  }}
                  className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-4 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer whitespace-nowrap shadow-sm"
                >
                  حفظ وتطبيق
                </button>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button 
                type="button"
                onClick={() => { setGroupModalStudent(null); setCustomGroupInput(''); }}
                className="w-full bg-slate-100 text-slate-700 font-bold py-2.5 rounded-xl hover:bg-slate-200 transition-colors text-xs cursor-pointer"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CENTER GROUP SCHEDULE BUILDER MODAL */}
      <GroupScheduleBuilderModal
        isOpen={isGroupBuilderOpen}
        onClose={() => setIsGroupBuilderOpen(false)}
        availableGroups={availableGroups}
        onSelectGroup={async (grp) => {
          setCenterGroup(grp);
          if (groupModalStudent) {
            try {
              await updateDoc(doc(db, 'users', groupModalStudent.uid), { centerGroup: grp });
              setUsers(prev => prev.map(u => u.uid === groupModalStudent.uid ? { ...u, centerGroup: grp } : u));
              if (foundStudent && foundStudent.uid === groupModalStudent.uid) {
                setFoundStudent({ ...foundStudent, centerGroup: grp });
              }
              setGroupModalStudent(null);
            } catch (err) {
              console.error('Failed to update group for student:', err);
            }
          }
          setIsGroupBuilderOpen(false);
        }}
      />

      {/* Student Card Manager Modal (Scan External Card / Generate & Print) */}
      <StudentCardManagerModal
        isOpen={isCardManagerOpen}
        onClose={() => {
          setIsCardManagerOpen(false);
          setCardManagerStudent(null);
        }}
        student={cardManagerStudent}
        onStudentUpdated={(updated) => {
          setUsers(prev => prev.map(u => u.uid === updated.uid ? updated : u));
          if (foundStudent && foundStudent.uid === updated.uid) {
            setFoundStudent(updated);
          }
        }}
      />
    </div>
  );
}
