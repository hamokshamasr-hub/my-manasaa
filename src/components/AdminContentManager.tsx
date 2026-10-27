import React, { useState, useEffect } from 'react';
import { db, storage } from '../lib/firebase';
import { collection, query, where, onSnapshot, addDoc, deleteDoc, doc, updateDoc, orderBy } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Video, FileText, Trash2, Plus, Loader2, Link as LinkIcon, 
  BookOpen, Upload, Copy, Edit2, Search, ExternalLink, CheckCircle2, 
  AlertCircle, Play, Eye, Filter, X, Film
} from 'lucide-react';
import { useSettings } from '../contexts/SettingsContext';
import { compressImage } from '../lib/imageUtils';
import { normalizePdfUrl, openPdfInNewTab } from '../lib/pdfHelper';
import { uploadPdfDirectly, resolvePdfToViewUrl, deletePdfFromCloud } from '../lib/pdfStorage';
import AdminUploadModal, { UploadedVideoResult } from './AdminUploadModal';
import BunnyPlayer from './BunnyPlayer';

export interface Material {
  id: string;
  title: string;
  url?: string;
  videoBase64?: string;
  thumbnailBase64?: string;
  type: 'video' | 'pdf';
  courseId?: string;
  courseIds?: string[];
  lessonName?: string;
  targetAudience?: 'all' | 'center' | 'online';
  order?: number;
  createdAt: number;
}

interface Course {
  id: string;
  name: string;
  grade: string;
}

interface AdminContentManagerProps {
  type: 'video' | 'pdf';
  presetCourseId?: string;
}

// Convert various YouTube links to embeddable URL
function getYouTubeEmbedUrl(url: string): string | null {
  if (!url) return null;
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
  const match = url.match(regExp);
  return (match && match[2].length === 11) ? `https://www.youtube.com/embed/${match[2]}` : null;
}

export default function AdminContentManager({ type, presetCourseId }: AdminContentManagerProps) {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Search & Filter State
  const [searchTerm, setSearchTerm] = useState('');
  const [courseFilter, setCourseFilter] = useState<string>('all');
  const [audienceFilter, setAudienceFilter] = useState<'all' | 'center' | 'online'>('all');

  // Form State
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [thumbnailBase64, setThumbnailBase64] = useState<string>('');
  const [selectedCourseIds, setSelectedCourseIds] = useState<string[]>([]);
  const [lessonName, setLessonName] = useState('');
  const [targetAudience, setTargetAudience] = useState<'all' | 'center' | 'online'>('all');
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // PDF Direct Upload State (Up to 30MB)
  const [pdfUploadMethod, setPdfUploadMethod] = useState<'upload' | 'link'>('upload');
  const [pdfUploading, setPdfUploading] = useState(false);
  const [pdfUploadProgress, setPdfUploadProgress] = useState(0);
  const [pdfUploadStatus, setPdfUploadStatus] = useState('');
  const [pdfUploadError, setPdfUploadError] = useState('');
  const [uploadedPdfName, setUploadedPdfName] = useState('');
  const [pdfPreviewBlobUrl, setPdfPreviewBlobUrl] = useState('');

  // Bunny.net Stream Upload Modal State
  const [isBunnyModalOpen, setIsBunnyModalOpen] = useState(false);
  const [previewBunnyVideo, setPreviewBunnyVideo] = useState<{ libraryId: string; videoId: string; title: string } | null>(null);

  const handleBunnyUploadSuccess = (result: UploadedVideoResult) => {
    setTitle(result.title);
    setUrl(result.embedUrl || '');
    setShowForm(true);
    setFeedback({
      text: `تم رفع الفيديو إلى Bunny.net بنجاح (${result.gradeLabel || result.grade})! تم إدراج الرابط في النموذج أدناه.`,
      type: 'success'
    });
  };

  const handlePdfFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      alert('يرجى اختيار ملف بصيغة PDF فقط.');
      return;
    }

    if (file.size > 30 * 1024 * 1024) {
      alert('حجم الملف يتجاوز 30 ميجابايت. يرجى اختيار ملف أصغر أو استخدام Google Drive.');
      return;
    }

    const cleanTitle = file.name.replace(/\.pdf$/i, '');
    if (!title) {
      setTitle(cleanTitle);
    }
    setUploadedPdfName(file.name);
    setPdfUploadError('');
    setPdfUploading(true);
    setPdfUploadProgress(10);
    setPdfUploadStatus('جاري فحص وتجهيز الملف السحابي...');

    try {
      const result = await uploadPdfDirectly(file, (pct, statusText) => {
        setPdfUploadProgress(pct);
        setPdfUploadStatus(statusText);
      });

      setUrl(result.url);
      setPdfUploading(false);
      setPdfUploadProgress(100);
      setPdfUploadStatus(`تم الرفع السحابي بنجاح (${(result.size / (1024 * 1024)).toFixed(1)} ميجابايت)`);

      // Generate preview blob url
      resolvePdfToViewUrl(result.url)
        .then(blobUrl => setPdfPreviewBlobUrl(blobUrl))
        .catch(() => {});
    } catch (err: any) {
      console.error("Direct PDF upload error:", err);
      setPdfUploading(false);
      setPdfUploadError(err.message || 'حدث خطأ أثناء الرفع السحابي المباشر.');
    }
  };

  // Preview Modal
  const [previewItem, setPreviewItem] = useState<Material | null>(null);

  useEffect(() => {
    const qCourses = query(collection(db, 'courses'), orderBy('createdAt', 'desc'));
    const unsubCourses = onSnapshot(qCourses, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Course[];
      setCourses(data);
      if (presetCourseId) {
        setSelectedCourseIds([presetCourseId]);
      } else if (data.length > 0 && selectedCourseIds.length === 0) {
        setSelectedCourseIds([data[0].id]);
      }
    }, (err) => {
      console.warn("Error fetching courses in AdminContentManager:", err);
    });
    return () => unsubCourses();
  }, [presetCourseId]);

  useEffect(() => {
    const q = query(
      collection(db, 'materials'), 
      where('type', '==', type)
    );
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Material[];
      
      data.sort((a, b) => b.createdAt - a.createdAt);
      
      setMaterials(data);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching materials:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [type]);

  const resetForm = () => {
    setTitle('');
    setUrl('');
    setThumbnailBase64('');
    setLessonName('');
    setTargetAudience('all');
    setEditingId(null);
    setShowForm(false);
    if (courses.length > 0) {
      setSelectedCourseIds([presetCourseId || courses[0].id]);
    }
  };

  const handleEditClick = (item: Material) => {
    setEditingId(item.id);
    setTitle(item.title);
    setUrl(item.url || '');
    setThumbnailBase64(item.thumbnailBase64 || '');
    setLessonName(item.lessonName || '');
    setTargetAudience(item.targetAudience || 'all');
    
    const targetIds = item.courseIds && item.courseIds.length > 0 
      ? item.courseIds 
      : (item.courseId ? [item.courseId] : []);
    setSelectedCourseIds(targetIds.length > 0 ? targetIds : (courses[0] ? [courses[0].id] : []));
    
    setShowForm(true);
    window.scrollTo({ top: 150, behavior: 'smooth' });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      alert(`يرجى إدخال عنوان ${type === 'video' ? 'المحاضرة' : 'المذكرة'}.`);
      return;
    }
    if (selectedCourseIds.length === 0) {
      alert("يرجى اختيار كورس واحد على الأقل لربط هذا المحتوى به.");
      return;
    }
    const finalUrl = type === 'pdf' ? normalizePdfUrl(url.trim()) : url.trim();
    if (!finalUrl) {
      alert("يرجى وضع رابط صالح (URL).");
      return;
    }

    // Safety check against exceeding Firestore 1MB document limit
    if (finalUrl.startsWith('data:application/pdf') && finalUrl.length > 950000) {
      alert("حجم ملف المذكرة كبير جداً للتخزين المباشر (يتجاوز سعة المستند 1 ميجابايت).\n\nيرجى رفع الملف على Google Drive (مجاني بلا حدود) ولصق الرابط لحفظه بشكل فوري ودائم.");
      return;
    }
    
    setSaving(true);
    setFeedback(null);
    try {
      const payload: any = {
        title: title.trim(),
        type,
        courseIds: selectedCourseIds,
        lessonName: lessonName.trim(),
        url: finalUrl,
        targetAudience: targetAudience || 'all',
        updatedAt: Date.now()
      };
      
      if (thumbnailBase64) {
        payload.thumbnailBase64 = thumbnailBase64;
      }

      if (editingId) {
        await updateDoc(doc(db, 'materials', editingId), payload);
        setFeedback({ text: `تم تحديث ${type === 'video' ? 'المحاضرة' : 'المذكرة'} بنجاح!`, type: 'success' });
      } else {
        payload.createdAt = Date.now();
        await addDoc(collection(db, 'materials'), payload);
        setFeedback({ text: `تم رفع وإضافة ${type === 'video' ? 'المحاضرة' : 'المذكرة'} بنجاح!`, type: 'success' });
      }

      resetForm();
      setTimeout(() => setFeedback(null), 4000);
    } catch (error) {
      console.error("Error saving material:", error);
      setFeedback({ text: "حدث خطأ أثناء حفظ المحتوى. يرجى المحاولة ثانية.", type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, itemTitle: string) => {
    if (!confirm(`هل أنت متأكد من حذف "${itemTitle}" نهائياً من المنصة؟`)) return;
    
    try {
      const targetItem = materials.find(m => m.id === id);
      if (targetItem?.url && targetItem.url.startsWith('pdf-cloud://')) {
        await deletePdfFromCloud(targetItem.url);
      }
      await deleteDoc(doc(db, 'materials', id));
      setFeedback({ text: `تم حذف "${itemTitle}" بنجاح.`, type: 'success' });
      setTimeout(() => setFeedback(null), 3000);
    } catch (error) {
      console.error("Error deleting material:", error);
      alert("حدث خطأ أثناء الحذف.");
    }
  };

  const handleDuplicate = async (item: Material) => {
    let msg = "اختر رقم الكورس الذي تريد نسخ هذا المحتوى إليه:\n\n";
    courses.forEach((c, i) => {
      msg += `${i + 1}- ${c.name} (${c.grade})\n`;
    });
    const answer = prompt(msg);
    if (!answer) return;
    
    const index = parseInt(answer) - 1;
    const selectedCourse = courses[index];
    
    if (!selectedCourse) {
      alert("رقم كورس غير صحيح!");
      return;
    }

    try {
      const payload = { 
        ...item, 
        courseIds: [selectedCourse.id],
        courseId: selectedCourse.id, 
        createdAt: Date.now() 
      };
      delete (payload as any).id;
      await addDoc(collection(db, 'materials'), payload);
      alert(`تم نسخ المحتوى بنجاح إلى: ${selectedCourse.name}`);
    } catch (error) {
      console.error(error);
      alert('حدث خطأ أثناء النسخ');
    }
  };

  const getCourseName = (id: string) => {
    const course = courses.find(c => c.id === id);
    return course ? `${course.name} (${course.grade})` : 'كورس غير معروف';
  };

  const Icon = type === 'video' ? Video : FileText;
  const label = type === 'video' ? 'محاضرة / فيديو' : 'مذكرة / ملف PDF';

  // Filtering
  const filteredMaterials = materials.filter(m => {
    const matchesSearch = m.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
      (m.lessonName || '').toLowerCase().includes(searchTerm.toLowerCase());
    
    let matchesCourse = true;
    if (courseFilter !== 'all') {
      const targetIds = m.courseIds || (m.courseId ? [m.courseId] : []);
      matchesCourse = targetIds.includes(courseFilter);
    }

    let matchesAudience = true;
    if (audienceFilter !== 'all') {
      matchesAudience = (m.targetAudience || 'all') === audienceFilter;
    }

    return matchesSearch && matchesCourse && matchesAudience;
  });

  const embedUrl = getYouTubeEmbedUrl(url);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 gap-3">
        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
        <span className="text-slate-600 font-bold">جاري تحميل المحتوى التعليمي...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2">
            <div className={`p-2 rounded-xl ${type === 'video' ? 'bg-indigo-50 text-indigo-600' : 'bg-emerald-50 text-emerald-600'}`}>
              <Icon className="w-6 h-6" />
            </div>
            إدارة {type === 'video' ? 'المحاضرات والفيديوهات' : 'المذكرات والملفات التعليمية'}
          </h1>
          <p className="text-slate-500 text-sm mt-1 font-medium">
            رفع ومراجعة {type === 'video' ? 'فيديوهات الشرح بجودة فائقة وربطها بالكورسات' : 'المذكرات الـ PDF وبنوك الأسئلة'} مع التحقق الكامل من الروابط.
          </p>
        </div>
        
        <div className="flex items-center gap-2.5 flex-wrap">
          {type === 'video' && (
            <button
              type="button"
              onClick={() => setIsBunnyModalOpen(true)}
              className="px-5 py-3 rounded-2xl font-black flex items-center gap-2 bg-gradient-to-r from-amber-500 via-orange-500 to-indigo-600 text-white shadow-md hover:opacity-95 transition-all active:scale-95 cursor-pointer text-xs sm:text-sm"
            >
              <Film className="w-5 h-5 text-white" />
              <span>رفع مباشر Bunny Stream 🚀</span>
            </button>
          )}

          <button 
            onClick={() => {
              if (showForm) resetForm();
              else setShowForm(true);
            }}
            className={`px-6 py-3 rounded-2xl font-black flex items-center gap-2 transition-all shadow-md active:scale-95 ${
              showForm 
                ? 'bg-slate-100 text-slate-700 hover:bg-slate-200' 
                : type === 'video' 
                  ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-600/20' 
                  : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20'
            }`}
          >
            {showForm ? <X className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
            {showForm && !editingId ? 'إلغاء' : showForm && editingId ? 'إلغاء التعديل' : `➕ إضافة ${label} جديد`}
          </button>
        </div>
      </div>

      {/* Feedback Banner */}
      {feedback && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className={`p-4 rounded-2xl flex items-center gap-3 font-bold text-sm ${
            feedback.type === 'success' 
              ? 'bg-emerald-50 border border-emerald-200 text-emerald-800' 
              : 'bg-rose-50 border border-rose-200 text-rose-800'
          }`}
        >
          {feedback.type === 'success' ? <CheckCircle2 className="w-5 h-5 text-emerald-600" /> : <AlertCircle className="w-5 h-5 text-rose-600" />}
          <span>{feedback.text}</span>
        </motion.div>
      )}

      {/* Add / Edit Form */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0, scale: 0.98, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: -10 }}
            className="overflow-hidden"
          >
            <form onSubmit={handleSave} className="bg-white p-6 sm:p-8 rounded-3xl shadow-xl border-2 border-indigo-200 space-y-6">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="font-black text-xl text-slate-900 flex items-center gap-2">
                  <Icon className="w-5 h-5 text-indigo-600" />
                  {editingId ? `تعديل بيانات ${label}` : `بيانات ${label} الجديد`}
                </h3>
                <span className="text-xs font-bold text-slate-400">تحقق فوري من الروابط لضمان التشغيل للطلاب</span>
              </div>
              
              <div className="grid md:grid-cols-3 gap-5">
                <div className="md:col-span-2">
                  <label className="block text-slate-700 text-sm font-black mb-2">
                    عنوان {label} <span className="text-rose-500">*</span>
                  </label>
                  <input 
                    type="text" 
                    required
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    placeholder={type === 'video' ? "مثال: شرح قاعدة المضارع التام وحل أهم 50 سؤالاً..." : "مثال: مذكرة مراجعة ليلة الامتحان والكلمات الهامة..."}
                    className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none text-slate-900 font-bold" 
                  />
                </div>

                <div>
                  <label className="block text-slate-700 text-sm font-black mb-2">
                    اسم الدرس / الوحدة (اختياري)
                  </label>
                  <input 
                    type="text" 
                    value={lessonName}
                    onChange={e => setLessonName(e.target.value)}
                    placeholder="مثال: الدرس الأول - Unit 1"
                    list={`lessons-${type}`}
                    className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-slate-800" 
                  />
                  <datalist id={`lessons-${type}`}>
                    {Array.from(new Set(materials.filter(m => m.lessonName).map(m => m.lessonName))).map(ln => (
                      <option key={ln as string} value={ln as string} />
                    ))}
                  </datalist>
                </div>
              </div>

              {/* Courses Association checkboxes/pills */}
              <div>
                <label className="block text-slate-700 text-sm font-black mb-2">
                  الكورسات التي يظهر فيها هذا المحتوى <span className="text-rose-500">*</span>
                </label>
                <div className="flex flex-wrap gap-2 p-3 bg-slate-50 rounded-2xl border border-slate-200 max-h-40 overflow-y-auto">
                  {courses.map(c => {
                    const isSelected = selectedCourseIds.includes(c.id);
                    return (
                      <button
                        type="button"
                        key={c.id}
                        onClick={() => {
                          if (isSelected) {
                            if (selectedCourseIds.length === 1) {
                              alert("يجب اختيار كورس واحد على الأقل.");
                              return;
                            }
                            setSelectedCourseIds(prev => prev.filter(id => id !== c.id));
                          } else {
                            setSelectedCourseIds(prev => [...prev, c.id]);
                          }
                        }}
                        className={`px-3 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 ${
                          isSelected 
                            ? 'bg-indigo-600 text-white shadow-sm' 
                            : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        <BookOpen className="w-3.5 h-3.5" />
                        <span>{c.name} ({c.grade})</span>
                        {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-indigo-200 mr-1" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Target Audience: Platform / Center / Both */}
              <div>
                <label className="block text-slate-700 text-sm font-black mb-2">
                  توجيه المحتوى والجمهور المستهدف <span className="text-rose-500">*</span>
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <button
                    type="button"
                    onClick={() => setTargetAudience('all')}
                    className={`p-3.5 rounded-2xl border-2 text-right transition-all flex flex-col justify-between ${
                      targetAudience === 'all'
                        ? 'border-indigo-600 bg-indigo-50 text-indigo-900 shadow-sm'
                        : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-black text-sm">🌐 المنصة والسنتر معاً</span>
                      {targetAudience === 'all' && <CheckCircle2 className="w-4 h-4 text-indigo-600" />}
                    </div>
                    <span className="text-xs text-slate-500 font-medium">متاح للجميع وإلزامي لطلاب السنتر والمنصة (يُحتسب غياباً للسنتر إن لم يشاهدوه)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTargetAudience('center')}
                    className={`p-3.5 rounded-2xl border-2 text-right transition-all flex flex-col justify-between ${
                      targetAudience === 'center'
                        ? 'border-amber-600 bg-amber-50 text-amber-900 shadow-sm'
                        : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-black text-sm text-amber-900">🏢 طلاب السنتر فقط</span>
                      {targetAudience === 'center' && <CheckCircle2 className="w-4 h-4 text-amber-600" />}
                    </div>
                    <span className="text-xs text-amber-700/80 font-medium">مخصص لطلاب السنتر وإلزامي عليهم (يدخل في تقارير الغياب والمشاهدة بالسنتر)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTargetAudience('online')}
                    className={`p-3.5 rounded-2xl border-2 text-right transition-all flex flex-col justify-between ${
                      targetAudience === 'online'
                        ? 'border-blue-600 bg-blue-50 text-blue-900 shadow-sm'
                        : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-black text-sm text-blue-900">💻 طلاب المنصة الأونلاين فقط</span>
                      {targetAudience === 'online' && <CheckCircle2 className="w-4 h-4 text-blue-600" />}
                    </div>
                    <span className="text-xs text-blue-700/80 font-medium">مخصص لمشتركي المنصة فقط (غير إلزامي على السنتر ولا يُحتسب غياباً عليهم)</span>
                  </button>
                </div>
              </div>

              {/* PDF Direct Upload or URL selector */}
              {type === 'pdf' ? (
                <div className="space-y-4 p-4 bg-slate-50/80 rounded-2xl border border-slate-200">
                  <div className="flex items-center justify-between">
                    <label className="block text-slate-800 text-sm font-black">
                      ملف المذكرة / الـ PDF <span className="text-rose-500">*</span>
                    </label>
                    <div className="flex items-center bg-slate-200/80 p-1 rounded-xl text-xs font-bold">
                      <button
                        type="button"
                        onClick={() => setPdfUploadMethod('upload')}
                        className={`px-3 py-1 rounded-lg transition-all ${
                          pdfUploadMethod === 'upload'
                            ? 'bg-indigo-600 text-white shadow-sm'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        📁 رفع ملف مباشر (حتى 10MB)
                      </button>
                      <button
                        type="button"
                        onClick={() => setPdfUploadMethod('link')}
                        className={`px-3 py-1 rounded-lg transition-all ${
                          pdfUploadMethod === 'link'
                            ? 'bg-indigo-600 text-white shadow-sm'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        🔗 رابط خارجي أو Drive
                      </button>
                    </div>
                  </div>

                  {pdfUploadMethod === 'upload' ? (
                    <div className="space-y-3">
                      <div className="border-2 border-dashed border-indigo-200 hover:border-indigo-400 bg-indigo-50/40 rounded-2xl p-6 text-center transition-all">
                        <input
                          type="file"
                          id="pdf-upload-input"
                          accept="application/pdf"
                          onChange={handlePdfFileUpload}
                          disabled={pdfUploading}
                          className="hidden"
                        />
                        <label
                          htmlFor="pdf-upload-input"
                          className="cursor-pointer flex flex-col items-center justify-center gap-2"
                        >
                          <div className="w-12 h-12 rounded-2xl bg-indigo-100 text-indigo-600 flex items-center justify-center">
                            {pdfUploading ? (
                              <Loader2 className="w-6 h-6 animate-spin" />
                            ) : (
                              <Upload className="w-6 h-6" />
                            )}
                          </div>
                          <span className="font-bold text-sm text-slate-800">
                            {uploadedPdfName || 'اضغط هنا لاختيار ملف PDF من جهازك'}
                          </span>
                          <span className="text-xs text-slate-500 font-medium">
                            ⚡ يدعم الرفع السحابي المباشر لجميع المذكرات والكتب حتى 30 ميجابايت بدون الحاجة لأي مواقع خارجية
                          </span>
                        </label>
                      </div>

                      {/* Real-time upload progress bar */}
                      {pdfUploading && (
                        <div className="space-y-2 p-4 bg-indigo-50/80 rounded-2xl border border-indigo-100">
                          <div className="flex justify-between items-center text-xs font-black text-indigo-900">
                            <span>{pdfUploadStatus || 'جاري الرفع السحابي المباشر...'}</span>
                            <span className="font-mono text-sm">{pdfUploadProgress}%</span>
                          </div>
                          <div className="w-full bg-slate-200 h-3 rounded-full overflow-hidden">
                            <div 
                              className="bg-gradient-to-r from-indigo-600 to-emerald-500 h-full transition-all duration-300 rounded-full"
                              style={{ width: `${pdfUploadProgress}%` }}
                            />
                          </div>
                        </div>
                      )}

                      {/* Success state */}
                      {url && !pdfUploading && (
                        <div className="space-y-3">
                          <div className="flex items-center justify-between p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-bold text-emerald-800">
                            <div className="flex items-center gap-2 truncate">
                              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                              <span className="truncate">
                                تم الرفع والتخزين السحابي المباشر بنجاح ({uploadedPdfName || 'PDF جاهز'})
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => openPdfInNewTab(url, title || 'معاينة')}
                              className="text-indigo-600 hover:underline shrink-0 ml-2 font-black cursor-pointer"
                            >
                              معاينة المذكرة ↗
                            </button>
                          </div>

                          {/* Instant live preview iframe */}
                          {pdfPreviewBlobUrl && (
                            <div className="p-3 bg-white border border-slate-200 rounded-2xl space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                                  معاينة المذكرة المرفوعة سحابياً:
                                </span>
                                <button
                                  type="button"
                                  onClick={() => openPdfInNewTab(url, title || 'معاينة')}
                                  className="text-xs text-indigo-600 hover:underline font-bold"
                                >
                                  فتح في نافذة كاملة ↗
                                </button>
                              </div>
                              <div className="w-full h-56 rounded-xl overflow-hidden border border-slate-200 bg-slate-100">
                                <iframe 
                                  src={pdfPreviewBlobUrl} 
                                  title="PDF Live Preview" 
                                  className="w-full h-full border-0" 
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {pdfUploadError && (
                        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-2xl flex items-center gap-2">
                          <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                          <span className="leading-relaxed font-bold">{pdfUploadError}</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="relative">
                        <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none">
                          <LinkIcon className="h-5 w-5 text-indigo-500" />
                        </div>
                        <input
                          type="url"
                          required
                          value={url}
                          onChange={e => setUrl(normalizePdfUrl(e.target.value))}
                          placeholder="https://drive.google.com/file/d/... أو رابط PDF مباشر"
                          className="w-full p-3.5 pr-11 bg-white border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none text-left font-mono text-sm"
                          dir="ltr"
                        />
                      </div>

                      {/* Google Drive Super Helper */}
                      <div className="p-3.5 bg-indigo-50/70 border border-indigo-100 rounded-2xl space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-black text-indigo-900 flex items-center gap-1.5">
                            <span>💡 المساعد الذكي لـ Google Drive (موصى به للمذكرات الكبيرة):</span>
                          </span>
                          <a
                            href="https://drive.google.com"
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs font-bold text-indigo-600 hover:underline inline-flex items-center gap-1"
                          >
                            <span>فتح Google Drive</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                        <p className="text-[11px] text-slate-600 leading-relaxed font-medium">
                          1. ارفع ملفك على Google Drive • 2. اضغط زر المشاركة (Share) واجعله "أي شخص لديه الرابط Anyone with link" • 3. الصق الرابط هنا، وسيتم تحويله تلقائياً لعارض PDF سلس للطلاب بدون أي استهلاك لمساحة السيرفر.
                        </p>
                      </div>

                      {/* Live PDF Preview */}
                      {url && (
                        <div className="mt-3 p-3 bg-white border border-slate-200 rounded-2xl space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                              <span>معاينة المذكرة الحالية:</span>
                            </span>
                            <button
                              type="button"
                              onClick={() => openPdfInNewTab(url, title || 'معاينة')}
                              className="text-xs text-indigo-600 hover:underline font-bold"
                            >
                              فتح في نافذة كاملة ↗
                            </button>
                          </div>
                          <div className="w-full h-56 rounded-xl overflow-hidden border border-slate-200 bg-slate-100">
                            <iframe
                              src={normalizePdfUrl(url)}
                              title="PDF Preview"
                              className="w-full h-full border-0"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                /* Video URL Input */
                <div>
                  <label className="block text-slate-700 text-sm font-black mb-2">
                    رابط المحاضرة / الفيديو (URL) <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none">
                      <LinkIcon className="h-5 w-5 text-indigo-500" />
                    </div>
                    <input 
                      type="url" 
                      required 
                      value={url}
                      onChange={e => setUrl(e.target.value)}
                      placeholder="https://www.youtube.com/watch?v=... أو Vimeo أو Google Drive"
                      className="w-full p-3.5 pr-11 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none text-left font-mono text-sm" 
                      dir="ltr"
                    />
                  </div>
                  
                  {/* Instant Live Player / Link Preview */}
                  {embedUrl && (
                    <div className="mt-3 p-3 bg-indigo-50/70 border border-indigo-100 rounded-2xl">
                      <div className="flex items-center gap-2 text-xs font-black text-indigo-800 mb-2">
                        <Play className="w-3.5 h-3.5 text-indigo-600" />
                        معاينة تشغيل الفيديو الفورية (تأكد أن الفيديو يعمل هنا):
                      </div>
                      <div className="aspect-video max-w-md mx-auto rounded-xl overflow-hidden shadow border border-indigo-200">
                        <iframe 
                          src={embedUrl}
                          title="Video Preview"
                          className="w-full h-full"
                          allowFullScreen
                        />
                      </div>
                    </div>
                  )}
                  
                  <p className="text-xs text-slate-500 mt-2 font-medium">
                    💡 يدعم روابط YouTube العادية والمختصرة (youtu.be)، أو Vimeo، أو روابط فيديوهات Google Drive المشتركة.
                  </p>
                </div>
              )}

              {/* Custom Thumbnail */}
              <div>
                <label className="block text-slate-700 text-sm font-black mb-2">صورة مصغرة مخصصة (اختياري)</label>
                <input 
                  type="file" 
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      compressImage(file, 600).then(base64 => {
                        setThumbnailBase64(base64);
                      }).catch(err => {
                        console.error("Error compressing image:", err);
                        alert("حدث خطأ أثناء معالجة الصورة.");
                      });
                    } else {
                      setThumbnailBase64('');
                    }
                  }}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-2xl outline-none text-sm" 
                />
                {thumbnailBase64 && (
                  <div className="mt-2 flex items-center gap-3 p-2 bg-slate-50 rounded-xl border w-fit">
                    <img src={thumbnailBase64} alt="Thumbnail preview" className="h-14 w-20 object-cover rounded-lg border" />
                    <button 
                      type="button" 
                      onClick={() => setThumbnailBase64('')}
                      className="text-xs font-bold text-rose-600 hover:underline"
                    >
                      إزالة الصورة
                    </button>
                  </div>
                )}
              </div>

              <div className="pt-3 flex flex-col sm:flex-row items-center justify-end gap-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={resetForm}
                  className="w-full sm:w-auto px-6 py-3 rounded-xl font-bold text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  إلغاء
                </button>
                <button 
                  type="submit" 
                  disabled={saving}
                  className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white px-8 py-3 rounded-2xl font-black flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-600/20 active:scale-95"
                >
                  {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5" />}
                  {editingId ? 'حفظ التعديلات' : 'إضافة وحفظ المحتوى'}
                </button>
              </div>
            </form>
          </motion.div>
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
              placeholder={`ابحث باسم ${label} أو الدرس...`}
              className="w-full pr-10 pl-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-bold"
            />
          </div>

          <select
            value={courseFilter}
            onChange={e => setCourseFilter(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="all">جميع الكورسات ({materials.length})</option>
            {courses.map(c => (
              <option key={c.id} value={c.id}>{c.name} ({c.grade})</option>
            ))}
          </select>

          <select
            value={audienceFilter}
            onChange={e => setAudienceFilter(e.target.value as any)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="all">كل الفئات (الجميع)</option>
            <option value="center">🏢 سنتر فقط</option>
            <option value="online">💻 أونلاين فقط</option>
          </select>
        </div>

        <div className="text-xs font-bold text-slate-500">
          إجمالي النتائج: <span className="font-black text-indigo-600">{filteredMaterials.length}</span>
        </div>
      </div>

      {/* List of Content */}
      <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
        {filteredMaterials.length === 0 ? (
          <div className="p-12 text-center text-slate-500 flex flex-col items-center">
            <Icon className="w-12 h-12 text-slate-300 mb-3" />
            <p className="font-black text-slate-800 text-base">لا يوجد {type === 'video' ? 'فيديوهات' : 'مذكرات'} مطابقة حالياً.</p>
            <p className="text-xs text-slate-500 mt-1">اضغط على زر الإضافة بالأعلى لرفع محتوى جديد.</p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {filteredMaterials.map((item) => (
              <motion.li 
                key={item.id}
                layout
                className="p-5 hover:bg-slate-50/80 transition-colors flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between"
              >
                <div className="flex items-start gap-4 flex-1">
                  {item.thumbnailBase64 ? (
                    <img src={item.thumbnailBase64} alt={item.title} className="w-16 h-14 rounded-2xl object-cover flex-shrink-0 border border-slate-200 shadow-sm" />
                  ) : (
                    <div className={`p-3.5 rounded-2xl flex-shrink-0 ${type === 'video' ? 'bg-indigo-50 text-indigo-600' : 'bg-emerald-50 text-emerald-600'}`}>
                      <Icon className="w-6 h-6" />
                    </div>
                  )}
                  <div>
                    <h4 className="font-black text-slate-900 text-base mb-1.5 leading-snug">{item.title}</h4>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 font-bold">
                      {/* Target Audience Badge */}
                      {item.targetAudience === 'center' ? (
                        <span className="bg-amber-100 text-amber-900 border border-amber-300 px-2.5 py-0.5 rounded-lg font-black text-xs flex items-center gap-1">
                          🏢 سنتر فقط
                        </span>
                      ) : item.targetAudience === 'online' ? (
                        <span className="bg-blue-100 text-blue-900 border border-blue-300 px-2.5 py-0.5 rounded-lg font-black text-xs flex items-center gap-1">
                          💻 أونلاين فقط
                        </span>
                      ) : (
                        <span className="bg-slate-100 text-slate-700 px-2.5 py-0.5 rounded-lg text-xs font-semibold">
                          🌐 سنتر وأونلاين
                        </span>
                      )}

                      {item.courseIds ? item.courseIds.map(cid => (
                        <span key={cid} className="flex items-center gap-1 bg-indigo-50 text-indigo-700 px-2.5 py-0.5 rounded-lg">
                          <BookOpen className="w-3.5 h-3.5" />
                          {getCourseName(cid)}
                        </span>
                      )) : (
                        <span className="flex items-center gap-1 bg-indigo-50 text-indigo-700 px-2.5 py-0.5 rounded-lg">
                          <BookOpen className="w-3.5 h-3.5" />
                          {getCourseName(item.courseId || '')}
                        </span>
                      )}

                      {item.lessonName && (
                        <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded-lg">
                          {item.lessonName}
                        </span>
                      )}

                      <span className="text-slate-400">
                        {new Date(item.createdAt).toLocaleDateString('ar-EG')}
                      </span>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-2 w-full sm:w-auto mt-2 sm:mt-0 justify-end">
                  {item.url && (
                    <button 
                      type="button"
                      onClick={() => {
                        if (item.type === 'pdf') {
                          openPdfInNewTab(item.url || '', item.title);
                        } else if (item.url && item.url.includes('mediadelivery.net/embed/')) {
                          const parts = item.url.split('mediadelivery.net/embed/')[1]?.split('?')[0]?.split('/');
                          if (parts && parts.length >= 2) {
                            setPreviewBunnyVideo({
                              libraryId: parts[0],
                              videoId: parts[1],
                              title: item.title
                            });
                            return;
                          }
                          window.open(item.url, '_blank', 'noopener,noreferrer');
                        } else {
                          window.open(item.url, '_blank', 'noopener,noreferrer');
                        }
                      }}
                      className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-black text-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                    >
                      <ExternalLink className="w-3.5 h-3.5" /> معاينة المحتوى
                    </button>
                  )}

                  <button 
                    onClick={() => handleEditClick(item)}
                    className="p-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-xl transition-colors"
                    title="تعديل"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>

                  <button 
                    onClick={() => handleDuplicate(item)}
                    className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl transition-colors"
                    title="نسخ لكورس آخر"
                  >
                    <Copy className="w-4 h-4" />
                  </button>

                  <button 
                    onClick={() => handleDelete(item.id, item.title)}
                    className="p-2.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl transition-colors"
                    title="حذف"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </motion.li>
            ))}
          </ul>
        )}
      </div>
      {/* BUNNY.NET STREAM UPLOAD MODAL */}
      <AdminUploadModal
        isOpen={isBunnyModalOpen}
        onClose={() => setIsBunnyModalOpen(false)}
        onSuccess={handleBunnyUploadSuccess}
        presetCourseId={selectedCourseIds[0] || presetCourseId || (courseFilter !== 'all' ? courseFilter : '')}
      />

      {/* BUNNY PLAYER PREVIEW MODAL */}
      {previewBunnyVideo && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden w-full max-w-4xl shadow-2xl space-y-3 p-4">
            <div className="flex justify-between items-center text-white px-2">
              <h3 className="font-black text-sm">{previewBunnyVideo.title}</h3>
              <button
                type="button"
                onClick={() => setPreviewBunnyVideo(null)}
                className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <BunnyPlayer
              libraryId={previewBunnyVideo.libraryId}
              videoId={previewBunnyVideo.videoId}
              studentName="معاينة الإدارة"
              studentId="ADMIN"
              title={previewBunnyVideo.title}
              autoPlay
            />
          </div>
        </div>
      )}
    </div>
  );
}
