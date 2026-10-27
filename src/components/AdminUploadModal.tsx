import React, { useState, useRef, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, doc, setDoc, onSnapshot } from 'firebase/firestore';
import { 
  Upload, 
  X, 
  CheckCircle2, 
  AlertCircle, 
  Film, 
  Loader2, 
  Play, 
  FileVideo,
  Copy,
  Check,
  BookOpen,
  Users,
  CheckSquare,
  Square,
  Server
} from 'lucide-react';
import BunnyPlayer from './BunnyPlayer';
import { useSettings } from '../contexts/SettingsContext';

export interface UploadedVideoResult {
  success: boolean;
  videoId: string;
  libraryId: string;
  grade: string;
  gradeLabel?: string;
  title: string;
  embedUrl?: string;
  courseId?: string;
  courseIds?: string[];
  materialId?: string;
  error?: string;
}

export interface AdminUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (result: UploadedVideoResult) => void;
  presetGrade?: '1' | '2' | '3' | string;
  presetCourseId?: string;
}

export default function AdminUploadModal({
  isOpen,
  onClose,
  onSuccess,
  presetGrade = '1',
  presetCourseId = ''
}: AdminUploadModalProps) {
  const { settings } = useSettings();
  const [title, setTitle] = useState('');
  const [grade, setGrade] = useState(presetGrade || '1');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Multi-Course linking fields
  const [courses, setCourses] = useState<any[]>([]);
  const [selectedCourseIds, setSelectedCourseIds] = useState<string[]>(presetCourseId ? [presetCourseId] : []);
  const [lessonName, setLessonName] = useState<string>('المحاضرة 1');
  const [targetAudience, setTargetAudience] = useState<'all' | 'center' | 'online'>('all');
  
  // Upload lifecycle states
  const [status, setStatus] = useState<'idle' | 'uploading' | 'processing' | 'success' | 'error'>('idle');
  const [progress, setProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState('');
  const [uploadedResult, setUploadedResult] = useState<UploadedVideoResult | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [copied, setCopied] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const xhrRef = useRef<XMLHttpRequest | null>(null);

  // Fetch courses from Firestore so admin can link video to any course
  useEffect(() => {
    if (!isOpen) return;
    const unsub = onSnapshot(collection(db, 'courses'), (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setCourses(data);
      if (presetCourseId) {
        setSelectedCourseIds([presetCourseId]);
      } else if (selectedCourseIds.length === 0 && data.length > 0) {
        const gradeLabel = grade === '1' ? 'الأول' : grade === '2' ? 'الثاني' : 'الثالث';
        const matches = data.filter((c: any) => c.grade?.includes(gradeLabel) || c.grade?.includes(grade));
        if (matches.length > 0) setSelectedCourseIds(matches.map((c: any) => c.id));
        else setSelectedCourseIds([data[0].id]);
      }
    });
    return () => unsub();
  }, [isOpen, presetCourseId]);

  if (!isOpen) return null;

  // Resolve dynamic Bunny libraries from settings
  const dynamicLibraries = settings.bunnyLibraries !== undefined
    ? settings.bunnyLibraries
    : [
        {
          id: 'lib_g1',
          name: 'مكتبة الصف الأول الثانوي',
          libraryId: settings.bunnyLibraryIdG1 || '767120',
          apiKey: settings.bunnyApiKeyG1 || 'b5f13fb9-4eb0-4fb4-833057a5148f-70fb-419a',
          watermarkTokenKey: '',
          cdnHostname: 'video.b-cdn.net',
          grade: 'الصف الأول الثانوي',
          isDefault: false
        },
        {
          id: 'lib_g2',
          name: 'مكتبة الصف الثاني الثانوي',
          libraryId: settings.bunnyLibraryIdG2 || '767124',
          apiKey: settings.bunnyApiKeyG2 || 'c9ae2432-bbb8-4319-8e5eea17c676-1b0d-41b9',
          watermarkTokenKey: '',
          cdnHostname: 'video.b-cdn.net',
          grade: 'الصف الثاني الثانوي',
          isDefault: false
        },
        {
          id: 'lib_g3',
          name: 'مكتبة الصف الثالث الثانوي',
          libraryId: settings.bunnyLibraryIdG3 || '767125',
          apiKey: settings.bunnyApiKeyG3 || '13dc4b71-7b28-475d-b1910a51320b-20b4-45d8',
          watermarkTokenKey: '',
          cdnHostname: 'video.b-cdn.net',
          grade: 'الصف الثالث الثانوي',
          isDefault: true
        }
      ];

  const [selectedLibraryId, setSelectedLibraryId] = useState<string>(() => {
    const def = dynamicLibraries.find(l => l.isDefault) || dynamicLibraries[0];
    return def ? def.id : '';
  });

  // Ensure selected library is valid
  useEffect(() => {
    if (dynamicLibraries.length > 0 && !dynamicLibraries.some(l => l.id === selectedLibraryId)) {
      const def = dynamicLibraries.find(l => l.isDefault) || dynamicLibraries[0];
      if (def) setSelectedLibraryId(def.id);
    }
  }, [dynamicLibraries, selectedLibraryId]);

  const activeLibrary = dynamicLibraries.find(l => l.id === selectedLibraryId) || dynamicLibraries[0];

  // Filter courses for currently chosen library's grade or name
  const filteredCourses = courses.filter((c: any) => {
    if (!activeLibrary?.grade) return true;
    const g = (activeLibrary.grade || '').toLowerCase();
    const cg = (c.grade || '').toLowerCase();
    return cg.includes(g) || g.includes(cg) || (g.includes('الأول') && cg.includes('الأول')) || (g.includes('الثاني') && cg.includes('الثاني')) || (g.includes('الثالث') && cg.includes('الثالث')) || (g.includes('السادس') && cg.includes('السادس'));
  });
  const displayCourses = filteredCourses.length > 0 ? filteredCourses : courses;

  const handleLibraryChange = (newLibId: string) => {
    setSelectedLibraryId(newLibId);
    const lib = dynamicLibraries.find(l => l.id === newLibId);
    if (lib) {
      setGrade(lib.grade || '1');
      const matches = courses.filter((c: any) => 
        lib.grade ? (c.grade?.includes(lib.grade) || lib.grade.includes(c.grade)) : true
      );
      if (matches.length > 0) {
        setSelectedCourseIds(matches.map((c: any) => c.id));
      }
    }
  };

  const toggleCourseSelection = (cId: string) => {
    setSelectedCourseIds(prev => {
      if (prev.includes(cId)) {
        return prev.filter(id => id !== cId);
      } else {
        return [...prev, cId];
      }
    });
  };

  const selectAllGradeCourses = () => {
    setSelectedCourseIds(displayCourses.map((c: any) => c.id));
  };

  const deselectAllCourses = () => {
    setSelectedCourseIds([]);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      if (!title.trim()) {
        const cleanName = file.name.replace(/\.[^/.]+$/, '');
        setTitle(cleanName);
      }
      setErrorMessage('');
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('video/')) {
      setSelectedFile(file);
      if (!title.trim()) {
        const cleanName = file.name.replace(/\.[^/.]+$/, '');
        setTitle(cleanName);
      }
      setErrorMessage('');
    } else {
      setErrorMessage('يرجى سحب وإفلات ملف فيديو صالح (MP4, MKV, MOV, WebM).');
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const formatFileSize = (bytes: number) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const resetForm = () => {
    setTitle('');
    setSelectedFile(null);
    setStatus('idle');
    setProgress(0);
    setErrorMessage('');
    setUploadedResult(null);
    setShowPreview(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleClose = () => {
    if (status === 'uploading') {
      if (window.confirm('عملية الرفع جارية حالياً. هل أنت متأكد من الإلغاء؟')) {
        if (xhrRef.current) xhrRef.current.abort();
        resetForm();
        onClose();
      }
    } else {
      resetForm();
      onClose();
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) {
      setErrorMessage('يرجى إدخال عنوان المحاضرة');
      return;
    }

    if (selectedCourseIds.length === 0) {
      setErrorMessage('يرجى اختيار كورس واحد على الأقل لربط الفيديو به');
      return;
    }

    if (!selectedFile) {
      setErrorMessage('يرجى اختيار ملف الفيديو المراد رفعه');
      return;
    }

    setStatus('uploading');
    setProgress(0);
    setErrorMessage('');

    if (!activeLibrary) {
      setErrorMessage('لا توجد مكتبة Bunny.net صالحة محددة للرفع. يرجى إضافة مكتبة في إعدادات المنصة أولاً.');
      return;
    }

    const formData = new FormData();
    formData.append('video', selectedFile);
    formData.append('title', title.trim());
    formData.append('grade', activeLibrary.grade || grade || 'عام');
    formData.append('gradeLabel', activeLibrary.name || activeLibrary.grade || 'عام');
    formData.append('courseId', selectedCourseIds[0] || '');
    formData.append('courseIds', JSON.stringify(selectedCourseIds));
    formData.append('lessonName', lessonName.trim() || 'محتوى عام');
    formData.append('targetAudience', targetAudience);
    formData.append('customLibraryId', activeLibrary.libraryId);
    formData.append('customApiKey', activeLibrary.apiKey);
    if (activeLibrary.watermarkTokenKey) {
      formData.append('watermarkTokenKey', activeLibrary.watermarkTokenKey);
    }

    const xhr = new XMLHttpRequest();
    xhrRef.current = xhr;

    // Track upload progress
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        const percentComplete = Math.round((event.loaded / event.total) * 100);
        setProgress(percentComplete);
        if (percentComplete >= 100) {
          setStatus('processing');
        }
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const response = JSON.parse(xhr.responseText) as UploadedVideoResult;
          if (response.success) {
            setStatus('success');
            setUploadedResult(response);

            // Double check Firestore persistence from client session for both lessons and materials
            if (response.videoId) {
              const targetDocId = (response as any).lessonId || response.videoId;
              setDoc(doc(db, 'lessons', targetDocId), {
                id: targetDocId,
                videoId: response.videoId,
                libraryId: response.libraryId,
                title: response.title || title.trim(),
                grade: response.grade || grade,
                gradeLabel: response.gradeLabel || '',
                courseId: selectedCourseIds[0] || '',
                courseIds: selectedCourseIds,
                lessonName: lessonName.trim() || 'محتوى عام',
                targetAudience,
                embedUrl: response.embedUrl || `https://iframe.mediadelivery.net/embed/${response.libraryId}/${response.videoId}`,
                createdAt: Date.now()
              }, { merge: true }).catch(e => console.warn('Client lesson sync notice:', e));

              // Link to all selected courses
              selectedCourseIds.forEach((cId) => {
                const materialRef = doc(collection(db, 'materials'));
                setDoc(materialRef, {
                  id: materialRef.id,
                  title: response.title || title.trim(),
                  url: response.embedUrl || `https://iframe.mediadelivery.net/embed/${response.libraryId}/${response.videoId}`,
                  type: 'video',
                  courseId: cId,
                  courseIds: selectedCourseIds,
                  lessonName: lessonName.trim() || 'محتوى عام',
                  targetAudience: targetAudience || 'all',
                  createdAt: Date.now(),
                  bunnyVideoId: response.videoId,
                  bunnyLibraryId: response.libraryId
                }).catch(e => console.warn('Client material sync notice:', e));
              });
            }

            if (onSuccess) onSuccess(response);
          } else {
            setStatus('error');
            setErrorMessage(response.error || 'فشلت معالجة رفع الفيديو');
          }
        } catch {
          setStatus('error');
          setErrorMessage('استجابة غير صالحة من الخادم');
        }
      } else {
        try {
          const errResp = JSON.parse(xhr.responseText);
          setStatus('error');
          setErrorMessage(errResp.error || `خطأ في الخادم (${xhr.status})`);
        } catch {
          setStatus('error');
          setErrorMessage(`فشل الاتصال بالخادم (${xhr.status})`);
        }
      }
    };

    xhr.onerror = () => {
      setStatus('error');
      setErrorMessage('فشل الاتصال بالخادم. يرجى التحقق من اتصال الإنترنت.');
    };

    xhr.open('POST', '/api/upload-video', true);
    xhr.send(formData);
  };

  const copyEmbedUrl = () => {
    if (uploadedResult?.embedUrl) {
      navigator.clipboard.writeText(uploadedResult.embedUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const linkedCoursesNames = courses.filter((c: any) => selectedCourseIds.includes(c.id)).map((c: any) => c.name).join('، ') || 'الكورسات المحددة';

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-2xl overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="p-5 bg-gradient-to-r from-indigo-900 via-indigo-800 to-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur-md flex items-center justify-center text-amber-300">
              <Film className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-lg">رفع فيديو تعليمي وربطه بكورس المنصة</h3>
              <p className="text-xs text-indigo-200">
                يتم رفع الفيديو إلى Bunny.net Stream ويظهر فوراً داخل محاضرات الكورس بالمنصة
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 space-y-5 max-h-[80vh] overflow-y-auto">
          
          {/* Error Banner */}
          {errorMessage && (
            <div className="p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 rounded-2xl flex items-start gap-3 text-rose-900 dark:text-rose-200 text-xs">
              <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
              <div>
                <strong className="block font-black mb-0.5">حدث خطأ أثناء الرفع:</strong>
                <span>{errorMessage}</span>
              </div>
            </div>
          )}

          {/* Success Screen */}
          {status === 'success' && uploadedResult ? (
            <div className="space-y-5 text-center py-3">
              <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 rounded-3xl flex items-center justify-center mx-auto shadow-inner">
                <CheckCircle2 className="w-8 h-8" />
              </div>

              <div>
                <h4 className="text-xl font-black text-slate-900 dark:text-white">
                  تم الرفع والربط بالكورس بنجاح! 🚀
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  تم تخزين الفيديو في سحابة Bunny.net وإدراجه رسمياً في كورس <b>"{linkedCoursesNames}"</b> ويستطيع الطلاب مشاهدته الآن.
                </p>
              </div>

              {/* Uploaded Meta Card */}
              <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 text-right space-y-2 text-xs">
                <div className="flex justify-between items-center pb-2 border-b border-slate-200 dark:border-slate-700">
                  <span className="text-slate-500 dark:text-slate-400 font-bold">عنوان المحاضرة:</span>
                  <span className="font-black text-slate-900 dark:text-white">{uploadedResult.title}</span>
                </div>
                <div className="flex justify-between items-center pb-2 border-b border-slate-200 dark:border-slate-700">
                  <span className="text-slate-500 dark:text-slate-400 font-bold">الكورسات المرتبطة:</span>
                  <span className="font-black text-emerald-600 dark:text-emerald-400">
                    {linkedCoursesNames}
                  </span>
                </div>
                <div className="flex justify-between items-center pb-2 border-b border-slate-200 dark:border-slate-700">
                  <span className="text-slate-500 dark:text-slate-400 font-bold">المرحلة الدراسية:</span>
                  <span className="font-black text-indigo-600 dark:text-indigo-400">
                    {uploadedResult.gradeLabel || `الصف ${uploadedResult.grade} الثانوي`}
                  </span>
                </div>
                <div className="flex justify-between items-center pb-2 border-b border-slate-200 dark:border-slate-700">
                  <span className="text-slate-500 dark:text-slate-400 font-bold">Bunny Library ID:</span>
                  <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{uploadedResult.libraryId}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 dark:text-slate-400 font-bold">Video GUID:</span>
                  <span className="font-mono text-[11px] text-slate-700 dark:text-slate-300 select-all">{uploadedResult.videoId}</span>
                </div>
              </div>

              {/* Live Preview Button or Player */}
              {showPreview ? (
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-black text-slate-700 dark:text-slate-300">معاينة البث المباشر (BunnyPlayer):</span>
                    <button
                      type="button"
                      onClick={() => setShowPreview(false)}
                      className="text-rose-500 hover:underline font-bold"
                    >
                      إخفاء المعاينة
                    </button>
                  </div>
                  <BunnyPlayer
                    libraryId={uploadedResult.libraryId}
                    videoId={uploadedResult.videoId}
                    studentName="معاينة الفيديو"
                    studentId="PREVIEW"
                    title={uploadedResult.title}
                  />
                </div>
              ) : (
                <div className="flex flex-wrap gap-2.5 justify-center">
                  <button
                    type="button"
                    onClick={() => setShowPreview(true)}
                    className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black flex items-center gap-2 transition-all shadow-md cursor-pointer"
                  >
                    <Play className="w-4 h-4 fill-white" />
                    <span>تشغيل ومعاينة الفيديو الآن</span>
                  </button>

                  <button
                    type="button"
                    onClick={copyEmbedUrl}
                    className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-white rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer"
                  >
                    {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                    <span>{copied ? 'تم نسخ الرابط!' : 'نسخ رابط التضمين'}</span>
                  </button>
                </div>
              )}

              {/* Action Buttons */}
              <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  رفع فيديو آخر ➕
                </button>
                <button
                  type="button"
                  onClick={handleClose}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black transition-colors cursor-pointer"
                >
                  تم والانتهاء ✓
                </button>
              </div>
            </div>
          ) : (
            /* Upload Form */
            <form onSubmit={handleSubmit} className="space-y-4">
              
              {/* Title Input */}
              <div>
                <label className="block text-xs font-black text-slate-700 dark:text-slate-300 mb-1.5">
                  عنوان المحاضرة / الفيديو: <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="مثال: مراجعة شاملة على الفصل الأول - المحاضرة 1"
                  disabled={status === 'uploading' || status === 'processing'}
                  className="w-full p-3 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-2xl text-xs font-bold text-slate-900 dark:text-white outline-none focus:border-indigo-600 dark:focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 dark:focus:ring-indigo-900/30 transition-all"
                  required
                />
              </div>

              {/* Dynamic Bunny Stream Library Selector */}
              <div>
                <label className="block text-xs font-black text-slate-700 dark:text-slate-300 mb-1.5 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Server className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                    <span>مكتبة Bunny.net المراد الرفع إليها: <span className="text-rose-500">*</span></span>
                  </span>
                  <span className="text-[10px] text-slate-400 font-normal">تحدد تلقائياً سحابة Bunny ومفتاح الرفع والعلامة المائية</span>
                </label>

                {dynamicLibraries.length === 0 ? (
                  <div className="p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 rounded-2xl text-xs text-rose-700 dark:text-rose-300 flex items-start gap-2.5">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <div className="leading-relaxed">
                      <span className="font-black block mb-0.5">لا توجد أي مكتبة Bunny.net مضافة بالمنصة حالياً!</span>
                      <span>
                        تم حذف المكتبات من إعدادات المنصة، لذلك تم إيقاف الرفع عبر المنصة مؤقتاً. يمكنك رفع الفيديوهات عبر حساب Bunny.net وجلب الروابط مباشرة، أو إعادة إضافة مكتبة من إعدادات المنصة.
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-2">
                    {dynamicLibraries.map((lib) => {
                      const isSelected = activeLibrary?.id === lib.id;
                      return (
                        <button
                          key={lib.id}
                          type="button"
                          disabled={status === 'uploading' || status === 'processing'}
                          onClick={() => handleLibraryChange(lib.id)}
                          className={`p-3 rounded-2xl border-2 text-right transition-all cursor-pointer relative ${
                            isSelected
                              ? 'border-indigo-600 bg-indigo-50/70 dark:bg-indigo-950/40 text-indigo-950 dark:text-indigo-200 shadow-xs'
                              : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/50 text-slate-700 dark:text-slate-300 hover:border-slate-300'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-black text-xs truncate max-w-[130px]">{lib.name}</span>
                            <span className={`w-3 h-3 rounded-full border-2 ${
                              isSelected ? 'bg-indigo-600 border-indigo-600' : 'border-slate-400'
                            }`} />
                          </div>
                          <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
                            <span>#{lib.libraryId}</span>
                            {lib.grade && <span className="font-sans font-bold text-indigo-600 dark:text-indigo-400 text-[10px]">{lib.grade}</span>}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Multi-Course Selector - Tie the single video upload to one or multiple courses */}
              <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-2xl border border-slate-200 dark:border-slate-700">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
                  <span className="flex items-center gap-1.5 font-black text-xs text-slate-800 dark:text-slate-200">
                    <BookOpen className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                    <span>الكورسات المراد ربط الفيديو بها: <span className="text-rose-500">*</span></span>
                    <span className="bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded-full text-[10px] font-black mr-1">
                      {selectedCourseIds.length} محدد
                    </span>
                  </span>
                  
                  <div className="flex items-center gap-2 text-xs">
                    <button
                      type="button"
                      onClick={selectAllGradeCourses}
                      disabled={status === 'uploading' || status === 'processing'}
                      className="text-indigo-600 dark:text-indigo-400 hover:underline font-bold text-[11px] cursor-pointer"
                    >
                      تحديد كل كورسات المرحلة
                    </button>
                    <span className="text-slate-300 dark:text-slate-600">•</span>
                    <button
                      type="button"
                      onClick={deselectAllCourses}
                      disabled={status === 'uploading' || status === 'processing'}
                      className="text-slate-500 hover:text-rose-500 font-bold text-[11px] cursor-pointer"
                    >
                      إلغاء التحديد
                    </button>
                  </div>
                </div>

                <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-3 font-medium">
                  يتم رفع الفيديو لـ Bunny مرة واحدة، وسيظهر تلقائياً في جميع الكورسات التي تحددها بالأسفل.
                </p>

                {displayCourses.length === 0 ? (
                  <div className="p-3 bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 rounded-xl text-amber-800 dark:text-amber-300 text-xs">
                    لم يتم العثور على كورسات مسجلة لهذه المرحلة. يمكنك اختيار كورس من المراحل الأخرى أدناه.
                  </div>
                ) : (
                  <div className="grid sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto p-1 pr-2">
                    {displayCourses.map((c: any) => {
                      const isSelected = selectedCourseIds.includes(c.id);
                      return (
                        <div
                          key={c.id}
                          onClick={() => {
                            if (status !== 'uploading' && status !== 'processing') {
                              toggleCourseSelection(c.id);
                            }
                          }}
                          className={`p-2.5 rounded-xl border flex items-center justify-between gap-2 cursor-pointer transition-all ${
                            isSelected
                              ? 'bg-indigo-50 dark:bg-indigo-950/70 border-indigo-500 text-indigo-900 dark:text-indigo-200 font-bold shadow-xs'
                              : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-slate-300'
                          }`}
                        >
                          <div className="min-w-0 flex-1">
                            <p className="text-xs truncate font-bold">{c.name}</p>
                            <span className="text-[10px] text-slate-400">{c.grade || 'كورس عام'}</span>
                          </div>
                          <div className="shrink-0 text-indigo-600 dark:text-indigo-400">
                            {isSelected ? (
                              <CheckSquare className="w-4 h-4 fill-indigo-600 text-white" />
                            ) : (
                              <Square className="w-4 h-4 text-slate-400" />
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Lesson / Section & Target Audience */}
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-black text-slate-700 dark:text-slate-300 mb-1.5">
                    اسم الوحدة / المحاضرة:
                  </label>
                  <input
                    type="text"
                    value={lessonName}
                    onChange={(e) => setLessonName(e.target.value)}
                    placeholder="مثال: المحاضرة 1 أو الوحدة الأولى"
                    disabled={status === 'uploading' || status === 'processing'}
                    className="w-full p-2.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-2xl text-xs font-bold text-slate-900 dark:text-white outline-none focus:border-indigo-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-black text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1">
                    <Users className="w-3.5 h-3.5 text-indigo-600" />
                    <span>الفئة المستهدفة:</span>
                  </label>
                  <select
                    value={targetAudience}
                    onChange={(e: any) => setTargetAudience(e.target.value)}
                    disabled={status === 'uploading' || status === 'processing'}
                    className="w-full p-2.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-2xl text-xs font-bold text-slate-900 dark:text-white outline-none focus:border-indigo-600"
                  >
                    <option value="all">الجميع (أونلاين + سنتر)</option>
                    <option value="center">طلاب السنتر فقط</option>
                    <option value="online">طلاب الأونلاين فقط</option>
                  </select>
                </div>
              </div>

              {/* Drag and Drop File Picker */}
              <div>
                <label className="block text-xs font-black text-slate-700 dark:text-slate-300 mb-1.5">
                  ملف الفيديو: <span className="text-rose-500">*</span>
                </label>
                
                <div
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-3xl p-6 text-center cursor-pointer transition-all ${
                    selectedFile
                      ? 'border-emerald-400 bg-emerald-50/50 dark:bg-emerald-950/20'
                      : 'border-slate-300 dark:border-slate-700 hover:border-indigo-400 bg-slate-50/60 dark:bg-slate-800/40'
                  }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="video/*,.mp4,.mov,.mkv,.webm"
                    onChange={handleFileChange}
                    className="hidden"
                    disabled={status === 'uploading' || status === 'processing'}
                  />

                  {selectedFile ? (
                    <div className="flex items-center justify-center gap-3">
                      <div className="w-12 h-12 rounded-2xl bg-emerald-500 text-white flex items-center justify-center shadow-md">
                        <FileVideo className="w-6 h-6" />
                      </div>
                      <div className="text-right">
                        <h5 className="font-black text-slate-900 dark:text-white text-xs truncate max-w-xs">
                          {selectedFile.name}
                        </h5>
                        <p className="text-[11px] text-emerald-700 dark:text-emerald-400 font-bold mt-0.5">
                          الحجم: {formatFileSize(selectedFile.size)} • انقر لتغيير الملف
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="w-12 h-12 mx-auto rounded-2xl bg-indigo-100 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                        <Upload className="w-6 h-6" />
                      </div>
                      <p className="text-xs font-black text-slate-800 dark:text-slate-200">
                        اسحب وأفلت ملف الفيديو هنا أو <span className="text-indigo-600 dark:text-indigo-400 underline">تصفح جهازك</span>
                      </p>
                      <p className="text-[10px] text-slate-400">
                        يدعم صيغ MP4, MOV, MKV, WebM حتى 2 جيجابايت
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Upload Progress Bar (Live state feedback) */}
              {(status === 'uploading' || status === 'processing') && (
                <div className="p-4 bg-indigo-50 dark:bg-indigo-950/40 rounded-2xl border border-indigo-200 dark:border-indigo-900/60 space-y-2 animate-in fade-in">
                  <div className="flex justify-between items-center text-xs font-black">
                    <span className="text-indigo-950 dark:text-indigo-200 flex items-center gap-1.5">
                      <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
                      {status === 'uploading' 
                        ? `جاري رفع الفيديو إلى الخادم (${progress}%)...` 
                        : 'جاري النقل والمعالجة في سحابة Bunny.net وحفظه في الكورس...'}
                    </span>
                    <span className="font-mono text-indigo-600 dark:text-indigo-400">{progress}%</span>
                  </div>

                  <div className="w-full h-3 bg-white dark:bg-slate-800 rounded-full overflow-hidden p-0.5 border border-indigo-200 dark:border-indigo-900">
                    <div
                      className="h-full bg-gradient-to-r from-indigo-500 to-emerald-500 rounded-full transition-all duration-300"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 text-center">
                    يرجى عدم إغلاق هذه النافذة أثناء عملية الرفع والربط بالكورس
                  </p>
                </div>
              )}

              {/* Submit Buttons */}
              <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={handleClose}
                  disabled={status === 'uploading'}
                  className="px-5 py-2.5 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  إلغاء
                </button>

                <button
                  type="submit"
                  disabled={status === 'uploading' || status === 'processing' || !selectedFile || !title.trim() || selectedCourseIds.length === 0 || dynamicLibraries.length === 0}
                  className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 dark:disabled:bg-slate-800 text-white rounded-xl text-xs font-black transition-all shadow-md flex items-center gap-2 cursor-pointer disabled:cursor-not-allowed"
                >
                  {status === 'uploading' || status === 'processing' ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>جاري الرفع...</span>
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4" />
                      <span>رفع وحفظ في الكورس فوراً 🚀</span>
                    </>
                  )}
                </button>
              </div>

            </form>
          )}

        </div>

      </div>
    </div>
  );
}
