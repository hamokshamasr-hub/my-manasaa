import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { GraduationCap, PlayCircle, FileText, CheckSquare, BookOpen, Clock, AlertCircle, ChevronLeft, CheckCircle2, Lock, LogIn } from 'lucide-react';
import { motion } from 'motion/react';

interface Course {
  id: string;
  name: string;
  grade: string;
  price: string;
  description: string;
  imageUrl?: string;
  coverImageBase64?: string;
}

export default function PublicCourse() {
  const { id } = useParams<{ id: string }>();
  const { user, appUser } = useAuth();
  const [course, setCourse] = useState<Course | null>(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ videos: 0, pdfs: 0, exams: 0 });

  useEffect(() => {
    const fetchCourse = async () => {
      if (!id) return;
      try {
        const docRef = doc(db, 'courses', id);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setCourse({ id: docSnap.id, ...docSnap.data() } as Course);
        }

        // Fetch stats for courseId AND courseIds
        const qMaterials1 = query(collection(db, 'materials'), where('courseId', '==', id));
        const qMaterials2 = query(collection(db, 'materials'), where('courseIds', 'array-contains', id));
        
        const qExams1 = query(collection(db, 'exams'), where('courseId', '==', id));
        const qExams2 = query(collection(db, 'exams'), where('courseIds', 'array-contains', id));
        
        const [matSnap1, matSnap2, examSnap1, examSnap2] = await Promise.all([
          getDocs(qMaterials1),
          getDocs(qMaterials2),
          getDocs(qExams1),
          getDocs(qExams2)
        ]);

        const allMaterials = new Map();
        matSnap1.forEach(d => allMaterials.set(d.id, d.data()));
        matSnap2.forEach(d => allMaterials.set(d.id, d.data()));

        let vids = 0; let pdfs = 0;
        allMaterials.forEach(m => {
          if (m.type === 'video') vids++;
          if (m.type === 'pdf') pdfs++;
        });

        const allExams = new Map();
        examSnap1.forEach(d => allExams.set(d.id, true));
        examSnap2.forEach(d => allExams.set(d.id, true));
        
        setStats({ videos: vids, pdfs: pdfs, exams: allExams.size });

      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchCourse();
  }, [id]);

  if (loading) return <div className="py-24 text-center text-slate-600 dark:text-slate-300">جاري التحميل...</div>;
  if (!course) return <div className="py-24 text-center text-rose-500 font-bold">عذراً، لم يتم العثور على الكورس.</div>;

  return (
    <div className="flex-grow bg-slate-50 dark:bg-[#070b14] pb-24 transition-colors">
      {/* Course Header */}
      <div className="bg-white dark:bg-slate-900/80 border-b border-slate-200 dark:border-slate-800 pt-10 pb-16 transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row gap-10 items-center">
            <div className="w-full md:w-1/2">
              {(course.coverImageBase64 || course.imageUrl) ? (
                <div className="w-full aspect-[16/9] relative overflow-hidden rounded-3xl shadow-xl border border-slate-100 dark:border-slate-800 bg-slate-900 flex items-center justify-center">
                  <img src={course.coverImageBase64 || course.imageUrl} alt="" aria-hidden="true" className="absolute inset-0 w-full h-full object-cover blur-sm opacity-35 scale-105 pointer-events-none" />
                  <img src={course.coverImageBase64 || course.imageUrl} alt={course.name} className="relative z-10 w-full h-full object-cover" />
                </div>
              ) : (
                <div className="w-full aspect-[16/9] bg-gradient-to-br from-indigo-950 via-slate-900 to-indigo-900 rounded-3xl shadow-xl flex items-center justify-center text-white">
                  <BookOpen className="w-20 h-20 opacity-80" />
                </div>
              )}
            </div>
            
            <div className="w-full md:w-1/2">
              <span className="inline-block py-1.5 px-4 rounded-full bg-indigo-100 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 font-bold text-sm mb-4">
                {course.grade}
              </span>
              <h1 className="text-3xl md:text-5xl font-black text-slate-900 dark:text-white mb-6 leading-tight">{course.name}</h1>
              <p className="text-lg text-slate-600 dark:text-slate-300 font-medium leading-relaxed mb-8 max-w-2xl">
                {course.description}
              </p>
              
              <div className="space-y-4">
                {!user && !appUser && (
                  <div className="w-full bg-amber-50 dark:bg-amber-950/40 border-2 border-amber-300 dark:border-amber-800 rounded-2xl p-4 text-amber-950 dark:text-amber-200 flex flex-col gap-2.5 shadow-sm">
                    <div className="flex items-center gap-2">
                      <Lock className="w-5 h-5 text-amber-700 dark:text-amber-400 flex-shrink-0" />
                      <span className="font-black text-sm">يجب تسجيل الدخول أولاً لدخول الكورس ومتابعة محتواه</span>
                    </div>
                    <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed font-medium">
                      عزيزي الطالب، لمشاهدة المحاضرات وحل الامتحانات وتحميل المذكرات وحفظ درجاتك، يتوجب عليك تسجيل الدخول أولاً بحسابك أو إنشاء حساب طالب جديد.
                    </p>
                    <div className="flex flex-wrap gap-2 pt-1">
                      <Link
                        to={`/login?redirect=${encodeURIComponent(`/dashboard?course=${course.id}`)}`}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white font-black px-5 py-2.5 rounded-xl text-xs transition-all shadow-sm flex items-center gap-1.5"
                      >
                        <LogIn className="w-4 h-4" />
                        <span>تسجيل الدخول الآن 🔑</span>
                      </Link>
                      <Link
                        to={`/register?redirect=${encodeURIComponent(`/dashboard?course=${course.id}`)}`}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-black px-5 py-2.5 rounded-xl text-xs transition-all shadow-sm flex items-center gap-1.5"
                      >
                        <span>إنشاء حساب طالب جديد 📝</span>
                      </Link>
                    </div>
                  </div>
                )}

                <div className="flex flex-wrap gap-4 items-center">
                  {Number(course.price) === 0 || (course as any).isFree ? (
                    <>
                      <Link 
                        to={(!user && !appUser) 
                          ? `/login?redirect=${encodeURIComponent(`/dashboard?course=${course.id}`)}` 
                          : `/dashboard?course=${course.id}`}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-4 rounded-xl font-black text-lg transition-all shadow-md hover:shadow-lg flex items-center gap-2"
                      >
                        <GraduationCap className="w-6 h-6" />
                        <span>{(!user && !appUser) ? 'تسجيل الدخول لبدء الكورس مجاناً 🚀' : 'ابدأ دراسة الكورس الآن مجاناً 🚀'}</span>
                      </Link>
                      <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 px-6 py-4 rounded-xl flex items-center gap-2">
                        <span className="text-emerald-800 dark:text-emerald-300 font-black text-base">🎁 كورس مجاني بالكامل 100%</span>
                      </div>
                    </>
                  ) : (
                    <>
                      <Link 
                        to={(!user && !appUser)
                          ? `/login?redirect=${encodeURIComponent(`/payment?courseId=${course.id}`)}`
                          : `/payment?courseId=${course.id}`}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-4 rounded-xl font-bold text-lg transition-all shadow-md hover:shadow-lg flex items-center gap-2"
                      >
                        <GraduationCap className="w-6 h-6" />
                        <span>{(!user && !appUser) ? 'تسجيل الدخول للاشتراك في الكورس 🔑' : 'الاشتراك في الكورس'}</span>
                      </Link>
                      <div className="bg-slate-100 dark:bg-slate-800 border border-transparent dark:border-slate-700 px-6 py-4 rounded-xl flex items-center gap-2">
                        <span className="text-slate-500 dark:text-slate-400 font-bold">قيمة الاشتراك:</span>
                        <span className="text-2xl font-black text-indigo-700 dark:text-indigo-400">{course.price}</span>
                        <span className="text-slate-500 dark:text-slate-400 font-bold text-sm">ج.م</span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Course Content Preview */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-8">
        <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800 p-8 transition-colors">
          <div className="text-center mb-10">
            <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-3">محتويات الكورس</h2>
            <p className="text-slate-500 dark:text-slate-400 font-medium">نظرة عامة على ما يحتويه هذا الكورس</p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 mb-12">
            <div className="bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/60 rounded-2xl p-6 text-center">
              <div className="w-16 h-16 bg-indigo-100 dark:bg-indigo-900/60 text-indigo-600 dark:text-indigo-400 rounded-full flex items-center justify-center mx-auto mb-4">
                <PlayCircle className="w-8 h-8" />
              </div>
              <h3 className="font-bold text-slate-900 dark:text-white text-xl mb-1">{stats.videos} محاضرة</h3>
              <p className="text-indigo-600 dark:text-indigo-400 font-medium text-sm">شرح تفصيلي بالفيديو</p>
            </div>
            
            <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-900/60 rounded-2xl p-6 text-center">
              <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-900/60 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mx-auto mb-4">
                <FileText className="w-8 h-8" />
              </div>
              <h3 className="font-bold text-slate-900 dark:text-white text-xl mb-1">{stats.pdfs} مذكرة</h3>
              <p className="text-emerald-600 dark:text-emerald-400 font-medium text-sm">ملفات PDF جاهزة للطباعة</p>
            </div>

            <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-100 dark:border-amber-900/60 rounded-2xl p-6 text-center">
              <div className="w-16 h-16 bg-amber-100 dark:bg-amber-900/60 text-amber-600 dark:text-amber-400 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckSquare className="w-8 h-8" />
              </div>
              <h3 className="font-bold text-slate-900 dark:text-white text-xl mb-1">{stats.exams} امتحان</h3>
              <p className="text-amber-600 dark:text-amber-400 font-medium text-sm">تطبيقات وتقييم مستمر</p>
            </div>
          </div>

          {Number(course.price) === 0 || (course as any).isFree ? (
            <div className="bg-emerald-50/80 dark:bg-emerald-950/40 rounded-2xl p-8 text-center border border-emerald-200 dark:border-emerald-800">
              <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-4" />
              <h3 className="text-xl font-black text-emerald-950 dark:text-emerald-200 mb-2">هذا الكورس مجاني ومفتوح لك الآن!</h3>
              <p className="text-emerald-700 dark:text-emerald-300 font-bold mb-6">يمكنك الدخول مباشرة إلى المحاضرات والامتحانات والمذكرات مجاناً دون الحاجة لدفع أي اشتراك.</p>
              <Link 
                to={(!user && !appUser) 
                  ? `/login?redirect=${encodeURIComponent(`/dashboard?course=${course.id}`)}` 
                  : `/dashboard?course=${course.id}`}
                className="inline-flex bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-3 rounded-xl font-black transition-all shadow-md hover:shadow-lg items-center gap-2"
              >
                <span>{(!user && !appUser) ? 'تسجيل الدخول لبدء دراسة الكورس 🚀' : 'دخول محتوى الكورس فوراً 🚀'}</span>
                <ChevronLeft className="w-5 h-5" />
              </Link>
            </div>
          ) : (
            <div className="bg-slate-50 dark:bg-slate-800/60 rounded-2xl p-8 text-center border border-slate-200 dark:border-slate-800">
              <AlertCircle className="w-12 h-12 text-slate-400 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-slate-700 dark:text-slate-200 mb-2">المحتوى مغلق</h3>
              <p className="text-slate-500 dark:text-slate-400 font-medium mb-6">قم بالاشتراك في الكورس لتتمكن من تصفح المحاضرات والامتحانات والمذكرات الخاصة بهذا الكورس.</p>
              <Link 
                to={`/payment?courseId=${course.id}`}
                className="inline-flex bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-3 rounded-xl font-bold transition-all shadow-md hover:shadow-lg items-center gap-2"
              >
                <span>الاشتراك الآن</span>
                <ChevronLeft className="w-5 h-5" />
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
