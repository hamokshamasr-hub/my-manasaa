import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, query, onSnapshot, doc, setDoc, deleteDoc, updateDoc, orderBy, where, getDocs } from 'firebase/firestore';
import { 
  Plus, Trash2, Loader2, Save, X, Image as ImageIcon, Edit2, 
  Video, FileText, CheckSquare, Users, BookOpen, Search, 
  Layers, ArrowUpRight, Sparkles, Eye, CheckCircle2, AlertCircle, RefreshCw
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useSettings } from '../contexts/SettingsContext';

interface Course {
  id: string;
  name: string;
  price: number;
  grade: string;
  isFree?: boolean;
  coverImageBase64?: string;
  description?: string;
  status?: 'active' | 'draft';
  createdAt: number;
}

interface AdminCoursesProps {
  onNavigateTab?: (tab: any, courseId?: string) => void;
}

export default function AdminCourses({ onNavigateTab }: AdminCoursesProps) {
  const { settings } = useSettings();
  const grades = settings?.grades || [
    'الصف الأول الإعدادي',
    'الصف الثاني الإعدادي',
    'الصف الثالث الإعدادي',
    'الصف الأول الثانوي',
    'الصف الثاني الثانوي',
    'الصف الثالث الثانوي'
  ];
  
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedGradeFilter, setSelectedGradeFilter] = useState('all');
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');

  // Related data stats per course
  const [courseStats, setCourseStats] = useState<Record<string, { videos: number; pdfs: number; exams: number; students: number }>>({});

  const [form, setForm] = useState({
    name: '',
    price: 0,
    isFree: false,
    grade: grades[0] || 'الصف الأول الثانوي',
    coverImageBase64: '',
    description: '',
    status: 'active' as 'active' | 'draft'
  });
  const [saving, setSaving] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    if (grades.length > 0 && !form.grade) {
      setForm(prev => ({ ...prev, grade: grades[0] }));
    }
  }, [grades]);

  // Fetch courses
  useEffect(() => {
    const q = query(collection(db, 'courses'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Course[];
      setCourses(data);
      setLoading(false);
    }, (err) => {
      console.warn("AdminCourses onSnapshot error:", err);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Fetch metrics: count materials, exams, and subscriptions per course
  useEffect(() => {
    if (courses.length === 0) return;

    let isMounted = true;
    const loadStats = async () => {
      try {
        const stats: Record<string, { videos: number; pdfs: number; exams: number; students: number }> = {};
        courses.forEach(c => {
          stats[c.id] = { videos: 0, pdfs: 0, exams: 0, students: 0 };
        });

        // 1. Materials (videos & pdfs)
        const matSnap = await getDocs(collection(db, 'materials'));
        matSnap.forEach(d => {
          const item = d.data();
          const targetCourses: string[] = item.courseIds || (item.courseId ? [item.courseId] : []);
          targetCourses.forEach(cid => {
            if (stats[cid]) {
              if (item.type === 'video') stats[cid].videos += 1;
              else if (item.type === 'pdf') stats[cid].pdfs += 1;
            }
          });
        });

        // 2. Exams
        const examsSnap = await getDocs(collection(db, 'exams'));
        examsSnap.forEach(d => {
          const item = d.data();
          const targetCourses: string[] = item.courseIds || (item.courseId ? [item.courseId] : []);
          targetCourses.forEach(cid => {
            if (stats[cid]) {
              stats[cid].exams += 1;
            }
          });
        });

        // 3. Subscriptions
        const subsSnap = await getDocs(collection(db, 'subscriptions'));
        subsSnap.forEach(d => {
          const item = d.data();
          if (item.courseId && stats[item.courseId]) {
            stats[item.courseId].students += 1;
          }
        });

        if (isMounted) {
          setCourseStats(stats);
        }
      } catch (e) {
        console.warn("Error calculating course statistics:", e);
      }
    };

    loadStats();
    return () => { isMounted = false; };
  }, [courses]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setFeedbackMsg({ text: 'يرجى اختيار ملف صورة صالح.', type: 'error' });
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        
        // Target widescreen rectangular (16:9) HD max dimension
        const MAX_WIDTH = 1200;
        if (width > MAX_WIDTH) {
          height = Math.round((height * MAX_WIDTH) / width);
          width = MAX_WIDTH;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const compressed = canvas.toDataURL('image/jpeg', 0.82);
          setForm(prev => ({ ...prev, coverImageBase64: compressed }));
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      setFeedbackMsg({ text: 'يرجى إدخال اسم الكورس.', type: 'error' });
      return;
    }
    if (form.price < 0) {
      setFeedbackMsg({ text: 'السعر يجب أن يكون صفراً أو أكثر.', type: 'error' });
      return;
    }
    
    setSaving(true);
    setFeedbackMsg(null);
    try {
      const isFreeCourse = Boolean(form.isFree || Number(form.price) === 0);
      const finalPrice = isFreeCourse ? 0 : Number(form.price);

      if (editingId) {
        await updateDoc(doc(db, 'courses', editingId), {
          name: form.name.trim(),
          grade: form.grade,
          price: finalPrice,
          isFree: isFreeCourse,
          description: form.description?.trim() || '',
          status: form.status || 'active',
          updatedAt: Date.now(),
          ...(form.coverImageBase64 ? { coverImageBase64: form.coverImageBase64 } : {})
        });
        setFeedbackMsg({ text: 'تم تحديث بيانات الكورس بنجاح!', type: 'success' });
      } else {
        const docRef = doc(collection(db, 'courses'));
        await setDoc(docRef, {
          name: form.name.trim(),
          grade: form.grade,
          price: finalPrice,
          isFree: isFreeCourse,
          description: form.description?.trim() || '',
          coverImageBase64: form.coverImageBase64 || '',
          status: form.status || 'active',
          createdAt: Date.now()
        });
        setFeedbackMsg({ text: 'تم إنشاء الكورس الجديد بنجاح وإتاحته للطلاب!', type: 'success' });
      }
      
      setIsAdding(false);
      setEditingId(null);
      setForm({ 
        name: '', 
        price: 0, 
        isFree: false,
        grade: grades[0] || 'الصف الأول الثانوي', 
        coverImageBase64: '', 
        description: '', 
        status: 'active' 
      });

      setTimeout(() => setFeedbackMsg(null), 4000);
    } catch (error) {
      console.error(error);
      setFeedbackMsg({ text: 'حدث خطأ أثناء الحفظ. يرجى المحاولة ثانية.', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleEditClick = (course: Course) => {
    setEditingId(course.id);
    setIsAdding(true);
    setForm({
      name: course.name,
      price: course.price,
      isFree: Boolean(course.isFree || Number(course.price) === 0),
      grade: course.grade,
      description: course.description || '',
      coverImageBase64: course.coverImageBase64 || '',
      status: course.status || 'active'
    });
    window.scrollTo({ top: 100, behavior: 'smooth' });
  };

  const handleDelete = async (id: string, courseName: string) => {
    if (!confirm(`تحذير حاسم: سيتم حذف كورس "${courseName}" وكل الفيديوهات، المذكرات، والامتحانات المرتبطة به نهائياً.\n\nهل أنت متأكد تماماً وتريد الحذف؟`)) return;
    try {
      const deletePromises: Promise<void>[] = [];

      // Cascade delete Materials
      const materialsSnap = await getDocs(collection(db, 'materials'));
      materialsSnap.forEach((docSnap) => {
        const data = docSnap.data();
        if (data.courseId === id || (Array.isArray(data.courseIds) && data.courseIds.includes(id))) {
          deletePromises.push(deleteDoc(docSnap.ref));
        }
      });

      // Cascade delete Exams
      const examsQ = query(collection(db, 'exams'), where('courseId', '==', id));
      const examsSnapshot = await getDocs(examsQ);
      examsSnapshot.forEach((docSnap) => {
        deletePromises.push(deleteDoc(docSnap.ref));
      });

      // Cascade delete Payments
      const paymentsQ = query(collection(db, 'payments'), where('courseId', '==', id));
      const paymentsSnapshot = await getDocs(paymentsQ);
      paymentsSnapshot.forEach((docSnap) => {
        deletePromises.push(deleteDoc(docSnap.ref));
      });

      await Promise.all(deletePromises);

      // Delete Course doc
      await deleteDoc(doc(db, 'courses', id));
      setFeedbackMsg({ text: `تم حذف كورس "${courseName}" وملحقاته بنجاح.`, type: 'success' });
      setTimeout(() => setFeedbackMsg(null), 3000);
    } catch (error) {
      console.error(error);
      setFeedbackMsg({ text: 'حدث خطأ أثناء الحذف والتنظيف', type: 'error' });
    }
  };

  // Filtered courses
  const filteredCourses = courses.filter(c => {
    const matchesSearch = c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      (c.description || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesGrade = selectedGradeFilter === 'all' || c.grade === selectedGradeFilter;
    return matchesSearch && matchesGrade;
  });

  // Aggregate stats
  const totalCourses = courses.length;
  const statsList = Object.values(courseStats) as { videos: number; pdfs: number; exams: number; students: number }[];
  const totalStudentsEnrolled = statsList.reduce((acc, curr) => acc + (curr.students || 0), 0);
  const totalVideos = statsList.reduce((acc, curr) => acc + (curr.videos || 0), 0);
  const totalExams = statsList.reduce((acc, curr) => acc + (curr.exams || 0), 0);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-16 gap-3">
        <Loader2 className="w-10 h-10 animate-spin text-indigo-600" />
        <span className="text-slate-600 font-bold">جاري تحميل سجل الكورسات والمحتوى...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      
      {/* Header & Command Bar */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-6 rounded-3xl shadow-xl border border-indigo-900/40">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-3 py-0.5 rounded-full bg-indigo-500/30 text-indigo-300 text-xs font-black border border-indigo-400/30 flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-amber-300" /> مركز القيادة الشاملة للكورسات
            </span>
          </div>
          <h2 className="text-2xl lg:text-3xl font-black text-white flex items-center gap-2">
            إدارة الكورسات والمحتوى الأكاديمي
          </h2>
          <p className="text-slate-300 text-sm mt-1 font-medium">
            تحكم كامل في الأسعار، المواد الدراسية، المحاضرات، الامتحانات ومتابعة أعداد المشتركين في كل كورس.
          </p>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <button 
            onClick={() => {
              if (isAdding) {
                setIsAdding(false);
                setEditingId(null);
                setForm({ name: '', price: 0, grade: grades[0] || 'الصف الأول الثانوي', coverImageBase64: '', description: '', status: 'active' });
              } else {
                setIsAdding(true);
              }
            }}
            className="w-full sm:w-auto bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white px-6 py-3 rounded-2xl font-black flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-950/40 active:scale-95"
          >
            {isAdding ? <X className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
            {isAdding && !editingId ? 'إلغاء الإضافة' : isAdding && editingId ? 'إلغاء التعديل' : '➕ إنشاء كورس جديد'}
          </button>
        </div>
      </div>

      {/* Quick Metrics Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-black">
            <BookOpen className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-black text-slate-900">{totalCourses}</div>
            <div className="text-xs font-bold text-slate-500">إجمالي الكورسات</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-black">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-black text-emerald-600">{totalStudentsEnrolled}</div>
            <div className="text-xs font-bold text-slate-500">اشتراكات الطلاب</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-black">
            <Video className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-black text-blue-600">{totalVideos}</div>
            <div className="text-xs font-bold text-slate-500">فيديوهات ومحاضرات</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-black">
            <CheckSquare className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-black text-amber-600">{totalExams}</div>
            <div className="text-xs font-bold text-slate-500">امتحانات وواجبات</div>
          </div>
        </div>
      </div>

      {/* Feedback Message */}
      {feedbackMsg && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className={`p-4 rounded-2xl flex items-center gap-3 font-bold text-sm ${
            feedbackMsg.type === 'success' 
              ? 'bg-emerald-50 border border-emerald-200 text-emerald-800' 
              : 'bg-rose-50 border border-rose-200 text-rose-800'
          }`}
        >
          {feedbackMsg.type === 'success' ? <CheckCircle2 className="w-5 h-5 text-emerald-600" /> : <AlertCircle className="w-5 h-5 text-rose-600" />}
          <span>{feedbackMsg.text}</span>
        </motion.div>
      )}

      {/* Course Add / Edit Form Modal/Drawer */}
      <AnimatePresence>
        {isAdding && (
          <motion.form 
            initial={{ opacity: 0, scale: 0.98, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: -10 }}
            onSubmit={handleSave} 
            className="bg-white p-6 sm:p-8 rounded-3xl shadow-xl border-2 border-indigo-200 relative overflow-hidden"
          >
            <div className="flex items-center justify-between pb-4 mb-6 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center">
                  <BookOpen className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-xl font-black text-slate-900">
                    {editingId ? 'تعديل بيانات الكورس' : 'إضافة كورس تعليمي جديد'}
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">املأ البيانات أدناه وحدد السعر والمرحلة</p>
                </div>
              </div>
              <button 
                type="button" 
                onClick={() => { setIsAdding(false); setEditingId(null); }}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="grid md:grid-cols-3 gap-5 mb-5">
              <div className="md:col-span-2">
                <label className="block text-slate-700 text-sm font-black mb-2">
                  اسم الكورس <span className="text-rose-500">*</span>
                </label>
                <input 
                  type="text" 
                  required 
                  value={form.name}
                  onChange={e => setForm({...form, name: e.target.value})}
                  placeholder="مثال: كورس شهر أكتوبر - الوحدة الأولى كاملة مع بنك الأسئلة"
                  className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none text-slate-900 font-bold"
                />
              </div>

              <div>
                <label className="block text-slate-700 text-sm font-black mb-2">
                  سعر الكورس (ج.م) <span className="text-rose-500">*</span>
                </label>
                <div className="relative mb-2">
                  <input 
                    type="number" 
                    required 
                    min="0"
                    disabled={form.isFree}
                    value={form.price}
                    onChange={e => {
                      const val = Number(e.target.value);
                      setForm({...form, price: val, isFree: val === 0});
                    }}
                    className={`w-full p-3.5 pl-14 bg-slate-50 border rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none font-black ${
                      form.isFree ? 'opacity-60 bg-slate-100 text-slate-400 border-slate-200' : 'text-slate-900 border-slate-200'
                    }`}
                  />
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xs font-black text-slate-400">ج.م</span>
                </div>

                {/* Free Course Toggle */}
                <label className="flex items-center gap-3 p-3 bg-emerald-50 border border-emerald-200 rounded-2xl cursor-pointer hover:bg-emerald-100/70 transition-colors">
                  <input
                    type="checkbox"
                    checked={form.isFree || form.price === 0}
                    onChange={e => {
                      const checked = e.target.checked;
                      setForm(prev => ({
                        ...prev,
                        isFree: checked,
                        price: checked ? 0 : (prev.price === 0 ? 150 : prev.price)
                      }));
                    }}
                    className="w-5 h-5 text-emerald-600 rounded-lg accent-emerald-600 cursor-pointer"
                  />
                  <div className="flex-1">
                    <span className="text-xs font-black text-emerald-950 block">🎁 كورس مجاني بالكامل (0 ج.م)</span>
                    <span className="text-[11px] text-emerald-700 font-bold block">متاح لجميع الطلاب مجاناً فور التسجيل بدون انتظار مراجعة إيصالات أو دفع</span>
                  </div>
                </label>
              </div>

              <div>
                <label className="block text-slate-700 text-sm font-black mb-2">
                  المرحلة الدراسية <span className="text-rose-500">*</span>
                </label>
                <select
                  value={form.grade}
                  onChange={e => setForm({...form, grade: e.target.value})}
                  className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-slate-800"
                >
                  {grades.map(g => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-700 text-sm font-black mb-2">
                  حالة النشر
                </label>
                <select
                  value={form.status}
                  onChange={e => setForm({...form, status: e.target.value as 'active' | 'draft'})}
                  className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-slate-800"
                >
                  <option value="active">🟢 متاح ونشط للطلاب</option>
                  <option value="draft">🟡 مسودة (مخفي مؤقتاً)</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-700 text-sm font-black mb-2">صورة غلاف الكورس</label>
                <div className="relative border-2 border-dashed border-indigo-200 hover:border-indigo-400 rounded-2xl p-2 bg-indigo-50/40 transition-colors">
                  <input 
                    type="file" 
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                  />
                  <div className="flex items-center justify-center gap-2 text-indigo-600 text-sm font-bold h-full min-h-[44px]">
                    <ImageIcon className="w-5 h-5" />
                    {form.coverImageBase64 ? 'تم اختيار صورة (انقر للتغيير)' : 'اختر صورة من جهازك'}
                  </div>
                </div>
              </div>
            </div>

            {/* Preview Selected Cover */}
            {form.coverImageBase64 && (
              <div className="mb-4 flex items-center gap-3 p-3 bg-slate-50 rounded-2xl border border-slate-200 w-fit">
                <img src={form.coverImageBase64} alt="Preview" className="w-16 h-12 object-cover rounded-xl border" />
                <span className="text-xs text-slate-600 font-bold">معاينة الغلاف الحالي</span>
                <button 
                  type="button" 
                  onClick={() => setForm(p => ({ ...p, coverImageBase64: '' }))}
                  className="text-xs text-rose-600 hover:underline font-bold"
                >
                  إزالة
                </button>
              </div>
            )}
            
            <div className="mb-6">
              <label className="block text-slate-700 text-sm font-black mb-2">
                تفاصيل ووصف الكورس (تظهر للطلاب عند الاطلاع على محتوى الكورس)
              </label>
              <textarea
                value={form.description}
                onChange={e => setForm({...form, description: e.target.value})}
                placeholder="اكتب بالتفصيل ما يحتويه هذا الكورس (مثل: شرح قواعد الوحدة، حل 200 سؤال، مذكرة المراجعة، امتحان شامل نهائي مع التصحيح الفوري)..."
                rows={3}
                className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none resize-none font-medium text-slate-800"
              ></textarea>
            </div>
                      
            <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => { setIsAdding(false); setEditingId(null); }}
                className="w-full sm:w-auto px-6 py-3 rounded-xl font-bold text-slate-600 hover:bg-slate-100 transition-colors"
              >
                إلغاء
              </button>
              <button 
                type="submit" 
                disabled={saving}
                className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white px-8 py-3 rounded-xl font-black flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-600/20 active:scale-95"
              >
                {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                {editingId ? 'حفظ التعديلات' : 'إنشاء ونشر الكورس'}
              </button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3 w-full md:w-auto flex-1">
          <div className="relative flex-1 max-w-md">
            <Search className="w-5 h-5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
            <input 
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="ابحث باسم الكورس أو محتواه..."
              className="w-full pr-10 pl-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-bold"
            />
          </div>

          <select
            value={selectedGradeFilter}
            onChange={e => setSelectedGradeFilter(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="all">جميع المراحل الدراسية</option>
            {grades.map(g => (
              <option key={g} value={g}>{g}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto justify-end">
          <span className="text-xs font-bold text-slate-500">طريقة العرض:</span>
          <button
            onClick={() => setViewMode('cards')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${viewMode === 'cards' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
          >
            بطاقات تفاعلية
          </button>
          <button
            onClick={() => setViewMode('table')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${viewMode === 'table' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
          >
            جدول بيانات
          </button>
        </div>
      </div>

      {/* Courses List */}
      {filteredCourses.length === 0 ? (
        <div className="bg-white p-12 text-center rounded-3xl border border-slate-200 shadow-sm">
          <BookOpen className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-lg font-black text-slate-800 mb-1">لم يتم العثور على أي كورسات</h3>
          <p className="text-sm text-slate-500 mb-4 font-medium">جرّب تغيير عبارة البحث أو اضغط على إضافة كورس جديد.</p>
          <button
            onClick={() => setIsAdding(true)}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl font-bold text-sm inline-flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> إضافة أول كورس الآن
          </button>
        </div>
      ) : viewMode === 'cards' ? (
        /* Cards View - Rich Control Center */
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredCourses.map(course => {
            const stats = courseStats[course.id] || { videos: 0, pdfs: 0, exams: 0, students: 0 };
            return (
              <motion.div
                key={course.id}
                layout
                className="bg-white rounded-3xl border border-slate-200/90 hover:border-indigo-300 hover:shadow-xl transition-all overflow-hidden flex flex-col group"
              >
                {/* Course Header / Rectangular Banner */}
                <div className="relative w-full aspect-[16/9] bg-slate-900 overflow-hidden flex items-center justify-center">
                  {course.coverImageBase64 ? (
                    <>
                      <img 
                        src={course.coverImageBase64} 
                        alt="" 
                        aria-hidden="true"
                        className="absolute inset-0 w-full h-full object-cover blur-sm scale-110 opacity-30 pointer-events-none" 
                      />
                      <img 
                        src={course.coverImageBase64} 
                        alt={course.name} 
                        className="relative z-10 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" 
                      />
                    </>
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-indigo-900 via-slate-800 to-indigo-950 flex items-center justify-center">
                      <BookOpen className="w-16 h-16 text-indigo-300/40" />
                    </div>
                  )}

                  <div className="absolute inset-0 z-10 bg-gradient-to-t from-black/80 via-black/30 to-transparent flex flex-col justify-between p-4">
                    <div className="flex items-center justify-between">
                      <span className="bg-white/90 backdrop-blur-md text-indigo-900 px-3 py-1 rounded-full text-xs font-black shadow-sm">
                        {course.grade}
                      </span>

                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-black backdrop-blur-md ${
                        course.status === 'draft' ? 'bg-amber-500/80 text-white' : 'bg-emerald-500/80 text-white'
                      }`}>
                        {course.status === 'draft' ? 'مسودة' : 'نشط'}
                      </span>
                    </div>

                    <div>
                      {Number(course.price) === 0 || course.isFree ? (
                        <span className="inline-flex items-center gap-1 px-3 py-1 bg-emerald-500 text-white rounded-full text-xs font-black shadow-md">
                          <span>🎁 مجاني بالكامل</span>
                        </span>
                      ) : (
                        <span className="text-2xl font-black text-amber-300 font-mono">
                          {course.price} <span className="text-sm font-sans font-bold text-white">ج.م</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Course Body */}
                <div className="p-5 flex-1 flex flex-col justify-between">
                  <div>
                    <h3 className="font-black text-lg text-slate-900 mb-2 leading-snug">
                      {course.name}
                    </h3>
                    {course.description ? (
                      <p className="text-xs text-slate-500 line-clamp-2 mb-4 font-medium leading-relaxed">
                        {course.description}
                      </p>
                    ) : (
                      <p className="text-xs text-slate-400 italic mb-4">لا يوجد وصف مدخل لهذا الكورس</p>
                    )}

                    {/* Associated Assets Badges */}
                    <div className="grid grid-cols-4 gap-2 bg-slate-50 p-2.5 rounded-2xl border border-slate-100 mb-4 text-center">
                      <div className="flex flex-col items-center">
                        <span className="text-xs font-black text-blue-600">{stats.videos}</span>
                        <span className="text-[10px] font-bold text-slate-500">فيديوهات</span>
                      </div>
                      <div className="flex flex-col items-center border-r border-slate-200">
                        <span className="text-xs font-black text-emerald-600">{stats.pdfs}</span>
                        <span className="text-[10px] font-bold text-slate-500">مذكرات</span>
                      </div>
                      <div className="flex flex-col items-center border-r border-slate-200">
                        <span className="text-xs font-black text-amber-600">{stats.exams}</span>
                        <span className="text-[10px] font-bold text-slate-500">امتحانات</span>
                      </div>
                      <div className="flex flex-col items-center border-r border-slate-200">
                        <span className="text-xs font-black text-indigo-600">{stats.students}</span>
                        <span className="text-[10px] font-bold text-slate-500">مشتركين</span>
                      </div>
                    </div>
                  </div>

                  {/* Direct Quick Actions for this Course */}
                  <div className="space-y-2 pt-2 border-t border-slate-100">
                    <div className="text-[11px] font-bold text-slate-400 mb-1">الربط السريع للمحتوى:</div>
                    <div className="grid grid-cols-3 gap-1.5">
                      {onNavigateTab && (
                        <>
                          <button
                            onClick={() => onNavigateTab('videos', course.id)}
                            className="p-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl text-xs font-black flex items-center justify-center gap-1 transition-colors"
                            title="إدارة محاضرات هذا الكورس"
                          >
                            <Video className="w-3.5 h-3.5" /> +محاضرة
                          </button>
                          <button
                            onClick={() => onNavigateTab('materials', course.id)}
                            className="p-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-xl text-xs font-black flex items-center justify-center gap-1 transition-colors"
                            title="إدارة مذكرات هذا الكورس"
                          >
                            <FileText className="w-3.5 h-3.5" /> +مذكرة
                          </button>
                          <button
                            onClick={() => onNavigateTab('exams', course.id)}
                            className="p-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded-xl text-xs font-black flex items-center justify-center gap-1 transition-colors"
                            title="إدارة امتحانات هذا الكورس"
                          >
                            <CheckSquare className="w-3.5 h-3.5" /> +امتحان
                          </button>
                        </>
                      )}
                    </div>

                    <div className="flex items-center justify-between pt-2">
                      <button
                        onClick={() => handleEditClick(course)}
                        className="flex-1 py-2 px-3 bg-slate-100 hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-colors ml-2"
                      >
                        <Edit2 className="w-4 h-4" /> تعديل الكورس
                      </button>
                      <button
                        onClick={() => handleDelete(course.id, course.name)}
                        className="p-2 text-rose-500 hover:bg-rose-50 rounded-xl transition-colors"
                        title="حذف الكورس نهائياً"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      ) : (
        /* Executive Table View */
        <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-right text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-black">
                <tr>
                  <th className="px-6 py-4">الكورس</th>
                  <th className="px-6 py-4">المرحلة</th>
                  <th className="px-6 py-4">السعر</th>
                  <th className="px-6 py-4 text-center">المحاضرات</th>
                  <th className="px-6 py-4 text-center">المذكرات</th>
                  <th className="px-6 py-4 text-center">الامتحانات</th>
                  <th className="px-6 py-4 text-center">المشتركين</th>
                  <th className="px-6 py-4 text-center">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredCourses.map(course => {
                  const stats = courseStats[course.id] || { videos: 0, pdfs: 0, exams: 0, students: 0 };
                  return (
                    <tr key={course.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-6 py-4 font-bold text-slate-900">
                        <div className="flex items-center gap-3">
                          {course.coverImageBase64 ? (
                            <img src={course.coverImageBase64} alt="" className="w-12 h-12 rounded-xl object-cover border border-slate-200" />
                          ) : (
                            <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100">
                              <BookOpen className="w-6 h-6" />
                            </div>
                          )}
                          <div>
                            <div className="font-black text-slate-900">{course.name}</div>
                            <div className="text-xs text-slate-400 font-medium line-clamp-1">{course.description || 'بدون وصف'}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-slate-600 font-bold">
                        <span className="px-2.5 py-1 bg-slate-100 rounded-lg text-xs">{course.grade}</span>
                      </td>
                      <td className="px-6 py-4 font-black">
                        {Number(course.price) === 0 || course.isFree ? (
                          <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded-lg text-xs font-black">🎁 مجاني</span>
                        ) : (
                          <span className="text-emerald-600">{course.price} ج.م</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-center font-black text-blue-600">{stats.videos}</td>
                      <td className="px-6 py-4 text-center font-black text-emerald-600">{stats.pdfs}</td>
                      <td className="px-6 py-4 text-center font-black text-amber-600">{stats.exams}</td>
                      <td className="px-6 py-4 text-center font-black text-indigo-600">{stats.students}</td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex justify-center gap-2">
                          <button onClick={() => handleEditClick(course)} className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors" title="تعديل">
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button onClick={() => handleDelete(course.id, course.name)} className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors" title="حذف">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  );
}
