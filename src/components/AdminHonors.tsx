import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../lib/firebase';
import { collection, query, onSnapshot, orderBy, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { 
  Trophy, Plus, Trash2, Edit3, Award, Star, 
  Upload, X, CheckCircle2, Loader2, Sparkles, DownloadCloud, Calendar, Eye, EyeOff
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { HonorStudent } from './HonorsBoard';
import { useSettings } from '../contexts/SettingsContext';

export default function AdminHonors() {
  const { settings, updateSettings } = useSettings();
  const [honors, setHonors] = useState<HonorStudent[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [activeYearFilter, setActiveYearFilter] = useState<string>('all');
  const [seeding, setSeeding] = useState(false);

  // Available grades from settings or fallback
  const availableGrades = settings.grades && settings.grades.length > 0 
    ? settings.grades 
    : ['الصف الأول الثانوي', 'الصف الثاني الثانوي', 'الصف الثالث الثانوي', 'الصف الأول بكالوريا', 'الصف الثاني بكالوريا', 'الصف الثالث بكالوريا'];

  // Form fields
  const [name, setName] = useState('');
  const [grade, setGrade] = useState(availableGrades[0] || 'الصف الثالث الثانوي');
  const [rankTitle, setRankTitle] = useState('المركز الأول على المحافظة');
  const [percentage, setPercentage] = useState<number>(100);
  const [school, setSchool] = useState('');
  const [governorate, setGovernorate] = useState('القاهرة');
  const [year, setYear] = useState('دفعة 2025');
  const [notes, setNotes] = useState('');
  const [avatarBase64, setAvatarBase64] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const q = query(collection(db, 'honors'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as HonorStudent[];
      setHonors(list);
      setLoading(false);
    }, (err) => {
      console.warn("Error fetching honors:", err);
      setLoading(false);
    });

    return () => unsub();
  }, []);

  const resetForm = () => {
    setName('');
    setGrade(availableGrades[0] || 'الصف الثالث الثانوي');
    setRankTitle('المركز الأول على المحافظة');
    setPercentage(100);
    setSchool('');
    setGovernorate('القاهرة');
    setYear('دفعة 2025');
    setNotes('');
    setAvatarBase64('');
    setEditingId(null);
    setIsAdding(false);
  };

  const handleEdit = (item: HonorStudent) => {
    setEditingId(item.id);
    setName(item.name || '');
    setGrade(item.grade || availableGrades[0]);
    setRankTitle(item.rankTitle || 'المركز الأول');
    setPercentage(Number(item.percentage) || 100);
    setSchool(item.school || '');
    setGovernorate(item.governorate || 'القاهرة');
    setYear(item.year || 'دفعة 2025');
    setNotes(item.notes || '');
    setAvatarBase64(item.avatarBase64 || '');
    setIsAdding(true);
    window.scrollTo({ top: 120, behavior: 'smooth' });
  };

  const handleDelete = async (id: string) => {
    if (!confirm('هل أنت متأكد من حذف هذا الطالب من لوحة الشرف والأوائل؟')) return;
    try {
      await deleteDoc(doc(db, 'honors', id));
    } catch (err) {
      console.error(err);
      alert('حدث خطأ أثناء الحذف.');
    }
  };

  // Seed default past years students into Firestore so admin can edit them immediately
  const handleSeedPastYears = async () => {
    if (!confirm('هل تود استيراد نماذج أوائل السنوات السابقة إلى قاعدة البيانات لتتمكن من تعديل أسمائهم وصورهم وسنواتهم فوراً؟')) return;
    setSeeding(true);
    try {
      const defaultHonorsToSeed = [
        {
          name: 'أحمد محمود العوضي',
          grade: 'الصف الثالث الثانوي',
          rankTitle: 'المركز الأول على المحافظة - 100%',
          percentage: 100,
          school: 'مدرسة المتفوقين الثانوية',
          governorate: 'القاهرة',
          year: 'دفعة 2025',
          notes: 'الدرجة النهائية في اللغة الإنجليزية طوال العام',
          createdAt: Date.now() - 1000
        },
        {
          name: 'سارة طارق المنشاوي',
          grade: 'الصف الثالث بكالوريا',
          rankTitle: 'المركز الأول بكالوريا - 99.8%',
          percentage: 99.8,
          school: 'مدرسة اللغات التجريبية',
          governorate: 'الجيزة',
          year: 'دفعة 2025',
          notes: 'تفوق باهر في اللغة الإنجليزية للغات والبكالوريا',
          createdAt: Date.now() - 2000
        },
        {
          name: 'مريم شريف عبد الرحمن',
          grade: 'الصف الثاني الثانوي',
          rankTitle: 'المركز الثاني جمهورية - 99.5%',
          percentage: 99.5,
          school: 'مدرسة النور الثانوية',
          governorate: 'الإسكندرية',
          year: 'دفعة 2024',
          notes: 'درجة شرفية بالامتحان النهائي',
          createdAt: Date.now() - 3000
        },
        {
          name: 'يوسف كريم الشناوي',
          grade: 'الصف الأول بكالوريا',
          rankTitle: 'الأول على الإدارة - 100%',
          percentage: 100,
          school: 'مدرسة الرواد الرسمية',
          governorate: 'الدقهلية',
          year: 'دفعة 2024',
          notes: 'الدرجة النهائية طوال العام الدراسي',
          createdAt: Date.now() - 4000
        },
        {
          name: 'كريم وائل الدسوقي',
          grade: 'الصف الثالث الثانوي',
          rankTitle: 'المركز الأول على الجمهورية - 99.7%',
          percentage: 99.7,
          school: 'مدرسة الأوائل الثانوية',
          governorate: 'الشرقية',
          year: 'دفعة 2023',
          notes: 'طالب متميز في مادة اللغة الإنجليزية ومسابقات التفوق',
          createdAt: Date.now() - 5000
        }
      ];

      for (const st of defaultHonorsToSeed) {
        await addDoc(collection(db, 'honors'), st);
      }

      alert('تم استيراد أوائل السنوات السابقة بنجاح! يمكنك الآن تعديل بيانات أي طالب أو تغيير صورته وسنته بكل سهولة.');
    } catch (e: any) {
      console.error(e);
      alert('حدث خطأ أثناء الاستيراد: ' + e.message);
    } finally {
      setSeeding(false);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_DIM = 400;
        let w = img.width;
        let h = img.height;
        if (w > MAX_DIM || h > MAX_DIM) {
          if (w > h) {
            h = Math.round((h * MAX_DIM) / w);
            w = MAX_DIM;
          } else {
            w = Math.round((w * MAX_DIM) / h);
            h = MAX_DIM;
          }
        }
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, w, h);
          setAvatarBase64(canvas.toDataURL('image/jpeg', 0.8));
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      alert('يرجى إدخال اسم الطالب المتفوق.');
      return;
    }

    setSaving(true);
    try {
      const payload: any = {
        name: name.trim(),
        grade,
        rankTitle: rankTitle.trim(),
        percentage: Number(percentage) || 100,
        school: school.trim(),
        governorate: governorate.trim(),
        year: year.trim(),
        notes: notes.trim(),
        avatarBase64: avatarBase64 || '',
        updatedAt: Date.now()
      };

      if (editingId) {
        await updateDoc(doc(db, 'honors', editingId), payload);
      } else {
        payload.createdAt = Date.now();
        await addDoc(collection(db, 'honors'), payload);
      }

      resetForm();
    } catch (err) {
      console.error(err);
      alert('حدث خطأ أثناء حفظ بيانات الطالب.');
    } finally {
      setSaving(false);
    }
  };

  // Distinct Years List
  const availableYears = useMemo(() => {
    const setYears = new Set<string>();
    honors.forEach(h => {
      if (h.year) setYears.add(h.year.trim());
    });
    return Array.from(setYears).sort().reverse();
  }, [honors]);

  // Filtered honors by year
  const filteredHonors = useMemo(() => {
    if (activeYearFilter === 'all') return honors;
    return honors.filter(h => (h.year || '').trim() === activeYearFilter);
  }, [honors, activeYearFilter]);

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-amber-900 via-slate-900 to-indigo-950 text-white p-6 rounded-3xl shadow-xl border border-amber-500/20 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <span className="px-3 py-0.5 rounded-full bg-amber-400/20 text-amber-300 text-xs font-black border border-amber-400/30 flex items-center gap-1 w-fit mb-2">
            <Trophy className="w-3.5 h-3.5 text-amber-400" /> إدارة وتعديل لوحة شرف أوائل السنوات الحالية والماضية
          </span>
          <h2 className="text-2xl lg:text-3xl font-black text-white">تكريم المتفوقين والأوائل</h2>
          <p className="text-slate-300 text-xs sm:text-sm mt-1 font-medium">
            يمكنك هنا إضافة وتعديل كافة بيانات وصور وسنوات ونسب أوائل الدفعات السابقة والحالية بكل سهولة.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={async () => {
              const newVal = settings.showHonorsBoard === false;
              await updateSettings({ showHonorsBoard: newVal });
            }}
            className={`px-4 py-2.5 font-bold rounded-xl text-xs flex items-center gap-2 shadow-md transition-all cursor-pointer ${
              settings.showHonorsBoard !== false 
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white' 
                : 'bg-rose-600 hover:bg-rose-500 text-white'
            }`}
            title="إظهار أو إخفاء لوحة الأوائل من المنصة كلياً"
          >
            {settings.showHonorsBoard !== false ? (
              <>
                <Eye className="w-4 h-4 text-emerald-200" />
                <span>لوحة الأوائل: مفعّلة وظاهرة (انقر للإخفاء)</span>
              </>
            ) : (
              <>
                <EyeOff className="w-4 h-4 text-rose-200" />
                <span>لوحة الأوائل: مخفية حالياً (انقر للإظهار)</span>
              </>
            )}
          </button>

          {honors.length === 0 && (
            <button
              onClick={handleSeedPastYears}
              disabled={seeding}
              className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs flex items-center gap-2 shadow-md transition-all cursor-pointer"
              title="استيراد نماذج أوائل الدفعات السابقة للبدء في تعديلها"
            >
              {seeding ? <Loader2 className="w-4 h-4 animate-spin" /> : <DownloadCloud className="w-4 h-4 text-amber-300" />}
              <span>استيراد أوائل السنوات السابقة للتعديل</span>
            </button>
          )}

          <button
            onClick={() => {
              if (isAdding) resetForm();
              else setIsAdding(true);
            }}
            className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-black rounded-xl text-xs flex items-center gap-2 shadow-lg transition-all cursor-pointer"
          >
            {isAdding ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            <span>{isAdding ? 'إلغاء' : 'إضافة طالب متفوق جديد'}</span>
          </button>
        </div>
      </div>

      {/* Add / Edit Form */}
      <AnimatePresence>
        {isAdding && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-white p-6 sm:p-8 rounded-3xl border-2 border-amber-300 shadow-xl"
          >
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                  <Award className="w-5 h-5 text-amber-500" />
                  {editingId ? 'تعديل كافة بيانات الطالب المتفوق' : 'إضافة طالب متفوق جديد للوحة الشرف'}
                </h3>
                {editingId && (
                  <span className="text-xs bg-amber-100 text-amber-800 font-bold px-3 py-1 rounded-full border border-amber-200">
                    وضع التعديل النشط ✏️
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-black text-slate-700 mb-1.5">اسم الطالب <span className="text-rose-500">*</span></label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="مثال: أحمد محمود العوضي"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:ring-2 focus:ring-amber-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-black text-slate-700 mb-1.5">المرحلة الدراسية</label>
                  <select
                    value={grade}
                    onChange={e => setGrade(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:ring-2 focus:ring-amber-500 outline-none"
                  >
                    {availableGrades.map((g, idx) => (
                      <option key={idx} value={g}>{g}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-black text-slate-700 mb-1.5">لقب التكريم / المركز <span className="text-rose-500">*</span></label>
                  <input
                    type="text"
                    required
                    value={rankTitle}
                    onChange={e => setRankTitle(e.target.value)}
                    placeholder="مثال: المركز الأول على المحافظة - 100%"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:ring-2 focus:ring-amber-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-black text-slate-700 mb-1.5">النسبة المئوية (%)</label>
                  <input
                    type="number"
                    step="0.1"
                    min="50"
                    max="100"
                    value={percentage}
                    onChange={e => setPercentage(parseFloat(e.target.value) || 100)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:ring-2 focus:ring-amber-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-black text-slate-700 mb-1.5">المدرسة (اختياري)</label>
                  <input
                    type="text"
                    value={school}
                    onChange={e => setSchool(e.target.value)}
                    placeholder="مثال: مدرسة المتفوقين الثانوية"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:ring-2 focus:ring-amber-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-black text-slate-700 mb-1.5">المحافظة</label>
                  <input
                    type="text"
                    value={governorate}
                    onChange={e => setGovernorate(e.target.value)}
                    placeholder="مثال: القاهرة / الإسكندرية / الدقهلية"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:ring-2 focus:ring-amber-500 outline-none"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-black text-slate-700">العام الدراسي / الدفعة</label>
                    <div className="flex items-center gap-1">
                      {['دفعة 2026', 'دفعة 2025', 'دفعة 2024', 'دفعة 2023', 'دفعة 2022'].map((batch) => (
                        <button
                          key={batch}
                          type="button"
                          onClick={() => setYear(batch)}
                          className={`text-[10px] px-1.5 py-0.5 rounded font-bold transition-colors cursor-pointer ${
                            year === batch ? 'bg-amber-500 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          }`}
                        >
                          {batch.replace('دفعة ', '')}
                        </button>
                      ))}
                    </div>
                  </div>
                  <input
                    type="text"
                    value={year}
                    onChange={e => setYear(e.target.value)}
                    placeholder="مثال: دفعة 2024"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:ring-2 focus:ring-amber-500 outline-none"
                  />
                </div>
              </div>

              {/* Photo & Notes */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div>
                  <label className="block text-xs font-black text-slate-700 mb-1.5">صورة الطالب الشخصية (اختياري)</label>
                  <div className="flex items-center gap-3">
                    <label className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-black cursor-pointer flex items-center gap-2 border border-slate-200 transition-colors">
                      <Upload className="w-4 h-4 text-slate-500" />
                      <span>{avatarBase64 ? 'تغيير الصورة' : 'اختر صورة'}</span>
                      <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                    </label>
                    {avatarBase64 && (
                      <div className="relative">
                        <img src={avatarBase64} alt="Avatar Preview" className="w-11 h-11 rounded-xl object-cover border border-amber-300" />
                        <button
                          type="button"
                          onClick={() => setAvatarBase64('')}
                          className="absolute -top-1.5 -right-1.5 bg-rose-500 text-white rounded-full p-0.5 hover:bg-rose-600 cursor-pointer"
                          title="حذف الصورة"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-black text-slate-700 mb-1.5">ملاحظة شرفية أو كلمة تشجيعية</label>
                  <input
                    type="text"
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    placeholder="مثال: الدرجة النهائية في الإنجليزي طوال العام الدراسي"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:ring-2 focus:ring-amber-500 outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-black rounded-xl transition-all cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-6 py-2.5 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 text-xs font-black rounded-xl shadow-md transition-all flex items-center gap-2 cursor-pointer"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  <span>{editingId ? 'حفظ كافة التعديلات' : 'إضافة للوحة الشرف'}</span>
                </button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Honors List & Year Filters */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-5 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Star className="w-5 h-5 text-amber-500 fill-amber-500" />
            <h3 className="text-base font-black text-slate-900">
              قائمة أوائل ومتفوقي الدفعات ({filteredHonors.length} من إجمالي {honors.length})
            </h3>
          </div>

          {/* Year Filter Tabs */}
          {availableYears.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs font-bold text-slate-500 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" /> تصفية حسب الدفعة:
              </span>
              <button
                type="button"
                onClick={() => setActiveYearFilter('all')}
                className={`px-3 py-1 rounded-lg text-xs font-black transition-all cursor-pointer ${
                  activeYearFilter === 'all' 
                    ? 'bg-amber-500 text-slate-950 shadow-sm' 
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                الكل ({honors.length})
              </button>
              {availableYears.map(yr => (
                <button
                  key={yr}
                  type="button"
                  onClick={() => setActiveYearFilter(yr)}
                  className={`px-3 py-1 rounded-lg text-xs font-black transition-all cursor-pointer ${
                    activeYearFilter === yr 
                      ? 'bg-amber-500 text-slate-950 shadow-sm' 
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {yr} ({honors.filter(h => (h.year || '').trim() === yr).length})
                </button>
              ))}
            </div>
          )}
        </div>

        {loading ? (
          <div className="p-8 text-center text-slate-500 font-bold flex items-center justify-center gap-2">
            <Loader2 className="w-5 h-5 animate-spin text-amber-500" />
            <span>جاري تحميل الأوائل...</span>
          </div>
        ) : filteredHonors.length === 0 ? (
          <div className="p-8 text-center text-slate-400 font-bold space-y-3">
            <p>لا توجد بيانات أوائل مسجلة لهذه الدفعة.</p>
            {honors.length === 0 && (
              <button
                onClick={handleSeedPastYears}
                disabled={seeding}
                className="inline-flex items-center gap-2 px-4 py-2 bg-amber-400 hover:bg-amber-500 text-slate-950 text-xs font-black rounded-xl cursor-pointer"
              >
                <DownloadCloud className="w-4 h-4" />
                <span>استيراد نماذج أوائل السنوات السابقة للتعديل المباشر عليها</span>
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredHonors.map((item) => (
              <div 
                key={item.id}
                className="p-4 rounded-2xl border border-slate-200 hover:border-amber-300 hover:shadow-md transition-all bg-slate-50 flex items-start justify-between gap-3 relative"
              >
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  {item.avatarBase64 ? (
                    <img src={item.avatarBase64} alt={item.name} className="w-12 h-12 rounded-xl object-cover border border-amber-300 flex-shrink-0" />
                  ) : (
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-amber-500 to-indigo-600 text-white flex items-center justify-center font-black text-base flex-shrink-0">
                      {item.name.charAt(0)}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap mb-1">
                      <span className="text-[10px] bg-amber-200 text-amber-900 font-black px-1.5 py-0.2 rounded">
                        {item.year || 'دفعة سابقة'}
                      </span>
                      <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.2 rounded">
                        {item.percentage}%
                      </span>
                    </div>
                    <h4 className="font-black text-slate-900 text-sm truncate">{item.name}</h4>
                    <p className="text-[11px] font-bold text-amber-800 truncate">{item.rankTitle}</p>
                    <p className="text-[10px] text-slate-500 truncate">{item.grade} • {item.governorate} {item.school ? `• ${item.school}` : ''}</p>
                    {item.notes && (
                      <p className="text-[10px] text-slate-400 italic mt-1 truncate">"{item.notes}"</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={() => handleEdit(item)}
                    className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-white rounded-lg transition-colors cursor-pointer border border-transparent hover:border-indigo-200"
                    title="تعديل كافة بيانات هذا الطالب"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(item.id)}
                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                    title="حذف الطالب من لوحة الشرف"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

