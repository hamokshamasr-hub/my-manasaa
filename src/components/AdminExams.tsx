import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, query, onSnapshot, addDoc, deleteDoc, doc, orderBy, where, updateDoc } from 'firebase/firestore';
import { Plus, Trash2, Loader2, Image as ImageIcon, X, BookOpen, Edit, CheckCircle2, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useSettings } from '../contexts/SettingsContext';

interface Question {
  id: string;
  text?: string;
  imageBase64?: string;
  choices: string[];
  correctIndices: number[];
}

interface Exam {
  id: string;
  title: string;
  courseId?: string;
  courseIds?: string[];
  lessonName?: string;
  questions: Question[];
  showAnswers?: boolean;
  endTime?: number;
  type?: 'exam' | 'homework' | 'recitation';
  targetAudience?: 'all' | 'center' | 'online';
  durationMinutes?: number;
  createdAt: number;
}

interface Course {
  id: string;
  name: string;
  grade: string;
}

export default function AdminExams() {
  const [exams, setExams] = useState<Exam[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [selectedCourseIds, setSelectedCourseIds] = useState<string[]>([]);
  const [lessonName, setLessonName] = useState('');
  const [endTime, setEndTime] = useState<string>(''); // yyyy-MM-ddThh:mm format
  const [type, setType] = useState<'exam' | 'homework'>('exam');
  const [targetAudience, setTargetAudience] = useState<'all' | 'center' | 'online'>('all');
  const [durationMinutes, setDurationMinutes] = useState<number>(30);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [showAnswers, setShowAnswers] = useState(true);
  
  const [saving, setSaving] = useState(false);
  const [filterType, setFilterType] = useState<'all' | 'exam' | 'homework'>('all');
  const [formError, setFormError] = useState<string | null>(null);
  const [feedbackMsg, setFeedbackMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    const qCourses = query(collection(db, 'courses'), orderBy('createdAt', 'desc'));
    const unsubCourses = onSnapshot(qCourses, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Course[];
      setCourses(data);
      if (data.length > 0 && selectedCourseIds.length === 0) {
        setSelectedCourseIds([data[0].id]);
      }
    }, (err) => {
      console.warn("Error fetching courses in AdminExams:", err);
    });
    return () => unsubCourses();
  }, []);

  useEffect(() => {
    const q = query(collection(db, 'exams')); 
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Exam[];
      
      data.sort((a, b) => b.createdAt - a.createdAt);
      setExams(data);
      setLoading(false);
    }, (err) => {
      console.warn("Error fetching exams in AdminExams:", err);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleAddQuestion = () => {
    setQuestions([
      ...questions,
      { id: Date.now().toString(), text: '', imageBase64: '', choices: ['', '', '', ''], correctIndices: [0] }
    ]);
  };

  const handleRemoveQuestion = (id: string) => {
    setQuestions(questions.filter(q => q.id !== id));
  };

  const handleImageUpload = (id: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 600;
        let width = img.width;
        let height = img.height;

        if (width > MAX_WIDTH) {
          height = Math.round((height * MAX_WIDTH) / width);
          width = MAX_WIDTH;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const compressedBase64 = canvas.toDataURL('image/jpeg', 0.5);
          setQuestions(questions.map(q => 
            q.id === id ? { ...q, imageBase64: compressedBase64 } : q
          ));
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleChoiceChange = (qId: string, index: number, value: string) => {
    setQuestions(questions.map(q => {
      if (q.id === qId) {
        const newChoices = [...q.choices];
        newChoices[index] = value;
        return { ...q, choices: newChoices };
      }
      return q;
    }));
  };

  const handleCorrectIndexToggle = (qId: string, index: number) => {
    setQuestions(questions.map(q => {
      if (q.id === qId) {
        let newIndices = [...(q.correctIndices || [])];
        if (newIndices.includes(index)) {
          newIndices = newIndices.filter(i => i !== index);
          if (newIndices.length === 0) newIndices = [0]; // fallback
        } else {
          newIndices.push(index);
        }
        return { ...q, correctIndices: newIndices };
      }
      return q;
    }));
  };

  const handleQuestionTextChange = (qId: string, value: string) => {
    setQuestions(questions.map(q => 
      q.id === qId ? { ...q, text: value } : q
    ));
  };

  const handleAddChoice = (qId: string) => {
    setQuestions(questions.map(q => 
      q.id === qId ? { ...q, choices: [...q.choices, ''] } : q
    ));
  };

  const handleRemoveChoice = (qId: string, cIndex: number) => {
    setQuestions(questions.map(q => {
      if (q.id === qId && q.choices.length > 2) { // min 2 choices
        const newChoices = q.choices.filter((_, idx) => idx !== cIndex);
        const newIndices = (q.correctIndices || []).filter(i => i !== cIndex).map(i => i > cIndex ? i - 1 : i);
        return { ...q, choices: newChoices, correctIndices: newIndices.length > 0 ? newIndices : [0] };
      }
      return q;
    }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!title || selectedCourseIds.length === 0 || questions.length === 0) {
      setFormError('يرجى إدخال عنوان للامتحان، واختيار كورس على الأقل، وإضافة سؤال واحد على الأقل.');
      return;
    }

    // Validate questions
    for (const q of questions) {
      if (!q.imageBase64 && (!q.text || !q.text.trim())) {
        setFormError('يرجى إما كتابة نص السؤال أو رفع صورة لكل سؤال.');
        return;
      }
      if (q.choices.some(c => !c.trim())) {
        setFormError('يرجى إدخال جميع الاختيارات لكل سؤال.');
        return;
      }
      if (!q.correctIndices || q.correctIndices.length === 0) {
        setFormError('يرجى اختيار الإجابة الصحيحة لكل سؤال.');
        return;
      }
    }

    setSaving(true);
    try {
      const payload: any = {
        title,
        courseIds: selectedCourseIds,
        lessonName,
        questions,
        showAnswers,
        type,
        targetAudience: targetAudience || 'all',
        durationMinutes: Number(durationMinutes) || 0,
      };
      
      if (!editingId) {
        payload.createdAt = Date.now();
      }

      if (endTime) {
        payload.endTime = new Date(endTime).getTime();
      }

      if (editingId) {
        await updateDoc(doc(db, 'exams', editingId), payload);
        setFeedbackMsg({ text: 'تم تحديث الامتحان بنجاح!', type: 'success' });
      } else {
        await addDoc(collection(db, 'exams'), payload);
        setFeedbackMsg({ text: 'تم إنشاء وحفظ الامتحان بنجاح!', type: 'success' });
      }
      setTimeout(() => setFeedbackMsg(null), 3500);
      
      setIsAdding(false);
      setEditingId(null);
      setTitle('');
      setLessonName('');
      setEndTime('');
      setType('exam');
      setTargetAudience('all');
      setDurationMinutes(30);
      setQuestions([]);
      setShowAnswers(true);
      setFormError(null);
    } catch (error) {
      console.error(error);
      setFormError('حدث خطأ أثناء حفظ الامتحان');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('هل أنت متأكد من حذف هذا الامتحان؟')) return;
    try {
      await deleteDoc(doc(db, 'exams', id));
      setFeedbackMsg({ text: 'تم حذف الامتحان بنجاح.', type: 'success' });
      setTimeout(() => setFeedbackMsg(null), 3000);
    } catch (error) {
      console.error(error);
      setFeedbackMsg({ text: 'حدث خطأ أثناء الحذف', type: 'error' });
    }
  };

  const handleEdit = (exam: Exam) => {
    setEditingId(exam.id);
    setTitle(exam.title);
    if (exam.courseIds && exam.courseIds.length > 0) {
      setSelectedCourseIds(exam.courseIds);
    } else if (exam.courseId) {
      setSelectedCourseIds([exam.courseId]);
    }
    setLessonName(exam.lessonName || '');
    if (exam.endTime) {
      const date = new Date(exam.endTime);
      date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
      setEndTime(date.toISOString().slice(0, 16));
    } else {
      setEndTime('');
    }
    // ensure all questions have correctIndices
    const mappedQs = exam.questions.map(q => ({
      ...q,
      correctIndices: q.correctIndices || [(q as any).correctIndex || 0]
    }));
    setQuestions(mappedQs);
    setShowAnswers(exam.showAnswers ?? true);
    setType(exam.type || 'exam');
    setTargetAudience(exam.targetAudience || 'all');
    setDurationMinutes(exam.durationMinutes || 30);
    setIsAdding(true);
  };

  const getCourseName = (id: string) => {
    const course = courses.find(c => c.id === id);
    return course ? `${course.name} (${course.grade})` : 'كورس غير معروف';
  };

  if (loading) {
    return <div className="flex justify-center p-8"><Loader2 className="w-8 h-8 animate-spin text-indigo-600" /></div>;
  }

  const filteredExams = filterType === 'all' 
    ? exams 
    : exams.filter(e => (e.type || 'exam') === filterType);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-white">الامتحانات والواجبات الإلكترونية</h2>
          <p className="text-slate-500 dark:text-slate-400 font-medium">إضافة امتحانات مصورة وواجبات منزلية مع إمكانية إيقاف واستئناف الوقت</p>
        </div>
        
        <div className="flex gap-2 flex-wrap">
          <button 
            onClick={() => {
              setType('exam');
              setIsAdding(true);
              setEditingId(null);
              setFormError(null);
            }}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl font-bold flex items-center gap-2 transition-all shadow-sm text-sm cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            + إضافة امتحان جديد
          </button>
          
          <button 
            onClick={() => {
              setType('homework');
              setIsAdding(true);
              setEditingId(null);
              setFormError(null);
            }}
            className="bg-teal-600 hover:bg-teal-700 text-white px-4 py-2.5 rounded-xl font-bold flex items-center gap-2 transition-all shadow-sm text-sm cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            + إضافة واجب جديد
          </button>
        </div>
      </div>

      {feedbackMsg && (
        <div className={`p-4 rounded-xl border flex items-center gap-3 text-sm font-bold animate-fade-in ${
          feedbackMsg.type === 'success'
            ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
            : 'bg-rose-50 dark:bg-rose-950/60 border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-300'
        }`}>
          {feedbackMsg.type === 'success' ? <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" /> : <AlertCircle className="w-5 h-5 text-rose-600 dark:text-rose-400" />}
          <span>{feedbackMsg.text}</span>
        </div>
      )}

      {/* FILTER TABS */}
      <div className="flex items-center gap-2 bg-white dark:bg-slate-900 p-2 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm w-fit transition-colors">
        <button
          onClick={() => setFilterType('all')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            filterType === 'all' ? 'bg-slate-900 dark:bg-slate-800 text-white shadow' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          عرض الكل ({exams.length})
        </button>
        <button
          onClick={() => setFilterType('exam')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            filterType === 'exam' ? 'bg-indigo-600 text-white shadow' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          الامتحانات ({exams.filter(e => (e.type || 'exam') === 'exam').length})
        </button>
        <button
          onClick={() => setFilterType('homework')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            filterType === 'homework' ? 'bg-teal-600 text-white shadow' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          الواجبات والتدريبات ({exams.filter(e => e.type === 'homework').length})
        </button>
      </div>

      <AnimatePresence>
        {isAdding && (
          <motion.form 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
            onSubmit={handleSave}
          >
            <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 space-y-6 mb-6 transition-colors">
              {formError && (
                <div className="p-4 bg-rose-50 dark:bg-rose-950/60 border border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-300 rounded-xl text-sm font-bold flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-rose-600 dark:text-rose-400 flex-shrink-0" />
                  <span>{formError}</span>
                </div>
              )}
              <div className="grid md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 text-sm font-bold mb-2">عنوان الامتحان</label>
                  <input 
                    type="text" 
                    required 
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    placeholder="مثال: امتحان شامل الوحدة الأولى"
                    className="w-full p-3 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 text-sm font-bold mb-2">الكورسات المرتبطة (يمكن اختيار أكثر من واحد)</label>
                  <select
                    multiple
                    value={selectedCourseIds}
                    onChange={e => {
                      const options = Array.from(e.target.selectedOptions, (option: HTMLOptionElement) => option.value);
                      setSelectedCourseIds(options);
                    }}
                    className="w-full p-3 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none min-h-[120px]"
                  >
                    {courses.map(c => (
                      <option key={c.id} value={c.id} className="dark:bg-slate-900 dark:text-white">{c.name} ({c.grade})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 text-sm font-bold mb-2">الدرس (اختياري)</label>
                  <input 
                    type="text" 
                    value={lessonName}
                    onChange={e => setLessonName(e.target.value)}
                    placeholder="مثال: الدرس الأول"
                    list="lessons-exams"
                    className="w-full p-3 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none" 
                  />
                  <datalist id="lessons-exams">
                    {Array.from(new Set(exams.filter(m => m.lessonName).map(m => m.lessonName))).map(ln => (
                      <option key={ln as string} value={ln as string} />
                    ))}
                  </datalist>
                </div>

                <div>
                  <label className="block text-slate-700 dark:text-slate-300 text-sm font-bold mb-2">نوع المحتوى</label>
                  <div className="flex gap-4 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
                    <button
                      type="button"
                      onClick={() => setType('exam')}
                      className={`flex-1 py-2.5 px-3 rounded-lg font-bold text-sm transition-all cursor-pointer ${
                        type === 'exam' 
                        ? 'bg-indigo-600 text-white shadow-sm' 
                        : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      امتحان دوري 📝
                    </button>
                    <button
                      type="button"
                      onClick={() => setType('homework')}
                      className={`flex-1 py-2.5 px-3 rounded-lg font-bold text-sm transition-all cursor-pointer ${
                        type === 'homework' 
                        ? 'bg-emerald-600 text-white shadow-sm' 
                        : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      واجب منزلي / بنك أسئلة 🏠
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-slate-700 text-sm font-bold mb-2">الجمهور المستهدف (السنتر / المنصة)</label>
                  <div className="grid grid-cols-3 gap-2 p-1 bg-slate-100 rounded-xl">
                    <button
                      type="button"
                      onClick={() => setTargetAudience('all')}
                      className={`py-2 px-2 rounded-lg font-bold text-xs transition-all ${
                        targetAudience === 'all'
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      الكل (سنتر وأونلاين)
                    </button>
                    <button
                      type="button"
                      onClick={() => setTargetAudience('center')}
                      className={`py-2 px-2 rounded-lg font-bold text-xs transition-all ${
                        targetAudience === 'center'
                        ? 'bg-amber-500 text-slate-950 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      مخصص للسنتر فقط 🏢
                    </button>
                    <button
                      type="button"
                      onClick={() => setTargetAudience('online')}
                      className={`py-2 px-2 rounded-lg font-bold text-xs transition-all ${
                        targetAudience === 'online'
                        ? 'bg-cyan-600 text-white shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      أونلاين فقط 🌐
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">
                    {targetAudience === 'center' && 'هذا الاختبار سيكون مطلوباً وإلزامياً لطلاب السنتر مع نقاط إضافية.'}
                    {targetAudience === 'online' && 'هذا الاختبار سيظهر لطلاب المنصة الأونلاين فقط.'}
                    {targetAudience === 'all' && 'متاح لجميع الطلاب (السنتر والأونلاين).'}
                  </p>
                </div>

                <div>
                  <label className="block text-slate-700 text-sm font-bold mb-2">مدة التوقيت (بالدقائق)</label>
                  <input 
                    type="number" 
                    min="0"
                    max="300"
                    value={durationMinutes}
                    onChange={e => setDurationMinutes(Number(e.target.value))}
                    placeholder="مثال: 30 (أدخل 0 لفتح الوقت بدون حد)"
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none" 
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    {type === 'homework' 
                      ? 'الواجب يدعم الإيقاف المؤقت للوقت والاستئناف للطالب في أي وقت.' 
                      : 'سيظهر عداد تنازلي للطالب أثناء الامتحان.'}
                  </p>
                </div>

                <div>
                  <label className="block text-slate-700 text-sm font-bold mb-2">موعد إغلاق الامتحان (اختياري)</label>
                  <input 
                    type="datetime-local" 
                    value={endTime}
                    onChange={e => setEndTime(e.target.value)}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-sans text-left" 
                    dir="ltr"
                  />
                  <p className="text-xs text-slate-500 mt-1">لن يتمكن الطلاب من دخول الامتحان بعد هذا الوقت.</p>
                </div>
              </div>

              <div className="flex items-center gap-3 p-4 bg-indigo-50 border border-indigo-100 rounded-xl w-fit">
                <input 
                  type="checkbox" 
                  id="showAnswers"
                  checked={showAnswers}
                  onChange={e => setShowAnswers(e.target.checked)}
                  className="w-5 h-5 text-indigo-600 rounded focus:ring-indigo-500 cursor-pointer" 
                />
                <label htmlFor="showAnswers" className="text-indigo-900 font-bold cursor-pointer">
                  إظهار الإجابات الصحيحة للطالب بعد الانتهاء
                </label>
              </div>

              <div>
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-bold text-slate-900">الأسئلة</h3>
                  <button 
                    type="button"
                    onClick={handleAddQuestion}
                    className="text-indigo-600 hover:text-indigo-700 font-bold flex items-center gap-1 text-sm bg-indigo-50 px-3 py-1.5 rounded-lg"
                  >
                    <Plus className="w-4 h-4" />
                    إضافة سؤال
                  </button>
                </div>

                {questions.length === 0 ? (
                  <div className="text-center p-8 border-2 border-dashed border-slate-200 rounded-xl text-slate-500">
                    لم يتم إضافة أي أسئلة بعد. اضغط على "إضافة سؤال" للبدء.
                  </div>
                ) : (
                  <div className="space-y-6">
                    {questions.map((q, index) => (
                      <div key={q.id} className="bg-slate-50 p-4 rounded-xl border border-slate-200 relative">
                        <button 
                          type="button"
                          onClick={() => handleRemoveQuestion(q.id)}
                          className="absolute top-4 left-4 text-rose-500 hover:text-rose-600 bg-rose-50 p-1.5 rounded-lg"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                        
                        <h4 className="font-bold text-slate-700 mb-4">السؤال رقم {index + 1}</h4>
                        
                        <div className="grid md:grid-cols-3 gap-6">
                          <div className="md:col-span-1 space-y-4">
                            <div>
                              <label className="block text-slate-700 text-xs font-bold mb-2">نص السؤال (اختياري)</label>
                              <textarea
                                value={q.text || ''}
                                onChange={e => handleQuestionTextChange(q.id, e.target.value)}
                                placeholder="اكتب نص السؤال هنا..."
                                className="w-full p-2 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm min-h-[80px]"
                              />
                            </div>
                            <div>
                              <label className="block text-slate-700 text-xs font-bold mb-2">صورة السؤال (اختياري، 5 ميجا بحد أقصى)</label>
                              <div className="relative group border-2 border-dashed border-slate-300 hover:border-indigo-500 rounded-xl h-32 text-center transition-all bg-white flex flex-col items-center justify-center overflow-hidden">
                                <input 
                                  type="file" 
                                  accept="image/*"
                                  onChange={(e) => handleImageUpload(q.id, e)}
                                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                />
                                {q.imageBase64 ? (
                                  <img src={q.imageBase64} alt="السؤال" className="w-full h-full object-contain" />
                                ) : (
                                  <div className="text-slate-400 flex flex-col items-center">
                                    <ImageIcon className="w-6 h-6 mb-1" />
                                    <span className="text-xs">ارفع صورة</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                          
                          <div className="md:col-span-2">
                            <label className="block text-slate-700 text-xs font-bold mb-2 flex justify-between items-center">
                              <span>الاختيارات (يمكن اختيار أكثر من إجابة صحيحة)</span>
                              <button
                                type="button"
                                onClick={() => handleAddChoice(q.id)}
                                className="text-indigo-600 hover:text-indigo-700 bg-indigo-50 px-2 py-1 rounded text-xs"
                              >
                                + إضافة اختيار
                              </button>
                            </label>
                            <div className="space-y-2">
                              {q.choices.map((choice, cIndex) => (
                                <div key={cIndex} className="flex items-center gap-3">
                                  <input 
                                    type="checkbox" 
                                    checked={(q.correctIndices || []).includes(cIndex)}
                                    onChange={() => handleCorrectIndexToggle(q.id, cIndex)}
                                    className="w-5 h-5 text-indigo-600 rounded cursor-pointer"
                                  />
                                  <input 
                                    type="text" 
                                    required
                                    value={choice}
                                    onChange={e => handleChoiceChange(q.id, cIndex, e.target.value)}
                                    placeholder={`الاختيار ${cIndex + 1}`}
                                    className="flex-1 p-2 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                                  />
                                  {q.choices.length > 2 && (
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveChoice(q.id, cIndex)}
                                      className="text-rose-500 hover:bg-rose-50 p-1.5 rounded-lg"
                                    >
                                      <X className="w-4 h-4" />
                                    </button>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="pt-4 flex justify-end border-t border-slate-100">
                <button 
                  type="submit" 
                  disabled={saving}
                  className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white px-8 py-3 rounded-xl font-bold flex items-center gap-2 transition-all shadow-md"
                >
                  {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5" />}
                  حفظ الامتحان
                </button>
              </div>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        {filteredExams.length === 0 ? (
          <div className="p-12 text-center text-slate-500 font-medium">لا توجد عناصر مضافة في هذا التصنيف حالياً.</div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {filteredExams.map((exam) => (
              <li key={exam.id} className="p-4 hover:bg-slate-50 transition-colors flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="font-bold text-slate-900 text-lg">{exam.title}</h4>
                    {exam.type === 'homework' ? (
                      <span className="bg-emerald-100 text-emerald-800 text-xs font-bold px-2.5 py-0.5 rounded-full">واجب منزلي 🏠</span>
                    ) : (
                      <span className="bg-indigo-100 text-indigo-800 text-xs font-bold px-2.5 py-0.5 rounded-full">امتحان 📝</span>
                    )}
                    {exam.durationMinutes ? (
                      <span className="bg-amber-100 text-amber-800 text-xs font-bold px-2 py-0.5 rounded-full">⏱ {exam.durationMinutes} دقيقة</span>
                    ) : null}
                    {exam.targetAudience === 'center' && (
                      <span className="bg-amber-100 text-amber-900 border border-amber-300 text-xs font-black px-2 py-0.5 rounded-full flex items-center gap-1">
                        🏢 إلزامي للسنتر
                      </span>
                    )}
                    {exam.targetAudience === 'online' && (
                      <span className="bg-cyan-100 text-cyan-900 border border-cyan-300 text-xs font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                        🌐 أونلاين فقط
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-3 mt-1 text-sm text-slate-500 font-medium">
                    {exam.courseIds ? exam.courseIds.map(cid => (
                      <span key={cid} className="flex items-center gap-1 bg-slate-100 px-2 py-0.5 rounded text-slate-700">
                        <BookOpen className="w-4 h-4" />
                        {getCourseName(cid)}
                      </span>
                    )) : (
                      <span className="flex items-center gap-1 bg-slate-100 px-2 py-0.5 rounded text-slate-700">
                        <BookOpen className="w-4 h-4" />
                        {getCourseName(exam.courseId || '')}
                      </span>
                    )}
                    {exam.lessonName && (
                      <>
                        <span>•</span>
                        <span className="flex items-center gap-1 bg-indigo-50 px-2 py-0.5 rounded text-indigo-700">
                          {exam.lessonName}
                        </span>
                      </>
                    )}
                    <span>•</span>
                    <span>{exam.questions.length} أسئلة</span>
                    <span>•</span>
                    <span>{new Date(exam.createdAt).toLocaleDateString('ar-EG')}</span>
                  </div>
                </div>
                
                <div className="flex items-center gap-2 w-full sm:w-auto mt-2 sm:mt-0">
                  <button 
                    onClick={() => handleEdit(exam)}
                    className="bg-indigo-50 hover:bg-indigo-100 text-indigo-600 px-4 py-2 rounded-lg transition-colors font-bold text-sm flex items-center gap-2"
                  >
                    <Edit className="w-4 h-4" />
                    تعديل
                  </button>
                  <button 
                    onClick={() => handleDelete(exam.id)}
                    className="bg-rose-50 hover:bg-rose-100 text-rose-600 px-4 py-2 rounded-lg transition-colors font-bold text-sm flex items-center gap-2"
                  >
                    <Trash2 className="w-4 h-4" />
                    حذف
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
