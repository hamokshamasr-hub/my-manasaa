import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, query, getDocs } from 'firebase/firestore';
import { GraduationCap, Clock, FileText, CheckCircle2, ChevronLeft, Calendar, BookOpen, Star } from 'lucide-react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { useAuth } from '../contexts/AuthContext';
import { useSettings } from '../contexts/SettingsContext';

interface Course {
  id: string;
  name: string;
  grade: string;
  price: string;
  description: string;
  imageUrl?: string;
  coverImageBase64?: string;
  features?: string[];
}

export default function PublicCourses() {
  const { appUser } = useAuth();
  const { settings } = useSettings();
  const [selectedGrade, setSelectedGrade] = useState<string>('all');
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);

  const standardGrades = [
    'الصف الأول الإعدادي',
    'الصف الثاني الإعدادي',
    'الصف الثالث الإعدادي',
    'الصف الأول الثانوي',
    'الصف الثاني الثانوي',
    'الصف الثالث الثانوي',
  ];

  const allGrades = Array.from(
    new Set([
      ...(settings?.grades && settings.grades.length > 0 ? settings.grades : standardGrades),
      ...courses.map(c => c.grade).filter(Boolean)
    ])
  );

  useEffect(() => {
    const fetchCourses = async () => {
      try {
        const q = query(collection(db, 'courses'));
        const snapshot = await getDocs(q);
        
        let data = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Course[];
        
        setCourses(data);
        
        // If logged in student has a grade and it has courses, select it initially
        if (appUser?.role === 'student' && appUser.grade) {
          setSelectedGrade(appUser.grade);
        }
      } catch (err) {
        console.error("Error fetching courses", err);
      } finally {
        setLoading(false);
      }
    };
    fetchCourses();
  }, [appUser?.role, appUser?.grade]);

  const isStudent = appUser?.role === 'student' && Boolean(appUser?.grade);

  const filteredCourses = courses.filter(course => {
    if (isStudent && appUser?.grade) {
      return course.grade === appUser.grade;
    }
    if (selectedGrade === 'all') return true;
    return course.grade === selectedGrade;
  });

  if (loading) {
    return (
      <div id="courses" className="py-24 bg-slate-50 text-center">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-indigo-600 border-t-transparent mb-3"></div>
        <div className="text-slate-600 font-bold">جاري تحميل الكورسات المتاحة...</div>
      </div>
    );
  }

  return (
    <div id="courses" className="py-20 bg-slate-50 dark:bg-[#070b14] relative overflow-hidden transition-colors">
      {/* Decorative background elements */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-100/40 dark:bg-indigo-950/20 rounded-full blur-3xl opacity-50 -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-emerald-100/40 dark:bg-emerald-950/20 rounded-full blur-3xl opacity-50 translate-y-1/2 -translate-x-1/2 pointer-events-none"></div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        
        <div className="text-center max-w-3xl mx-auto mb-12">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <span className="inline-block py-1.5 px-4 rounded-full bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 font-bold text-sm mb-4 shadow-sm">
              🌟 طريقك نحو التفوق
            </span>
            <h2 className="text-3xl md:text-5xl font-black text-slate-900 dark:text-white mb-4">
              {isStudent ? `كورسات صفك (${appUser?.grade})` : 'كورسات المنصة المتاحة'}
            </h2>
            <p className="text-lg text-slate-600 dark:text-slate-300 font-medium leading-relaxed mb-6">
              {isStudent
                ? `هذه الكورسات مخصصة حصرياً لصفك الدراسي (${appUser?.grade}) لتناسب منهجك ومستواك التعليمي بدقة.`
                : 'اختر الكورس المناسب لصفك الدراسي وابدأ رحلتك التعليمية مع أفضل نظام تعليمي متكامل يشمل المحاضرات، الامتحانات، المذكرات، والمتابعة المستمرة.'}
            </p>

            {/* Student grade locked message */}
            {isStudent ? (
              <div className="inline-flex items-center gap-3 bg-gradient-to-r from-indigo-50 via-white to-indigo-50 dark:from-slate-900 dark:via-indigo-950/50 dark:to-slate-900 border border-indigo-200 dark:border-indigo-800 text-indigo-900 dark:text-indigo-200 px-6 py-3 rounded-2xl font-bold text-sm mb-8 shadow-sm">
                <span>🎓 تم تخصيص المحتوى تلقائياً لصفك:</span>
                <span className="bg-indigo-600 text-white px-3.5 py-1 rounded-xl font-black">{appUser?.grade}</span>
                <span className="text-xs text-indigo-600 dark:text-indigo-400 font-normal">({filteredCourses.length} كورس متاح)</span>
              </div>
            ) : (
              /* Grade Filter: shown to Admins and visitors */
              <div className="flex flex-wrap justify-center gap-2 mb-8">
                <button
                  onClick={() => setSelectedGrade('all')}
                  className={`px-6 py-2.5 rounded-full font-bold text-sm transition-all shadow-sm cursor-pointer ${selectedGrade === 'all' ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200 dark:shadow-none' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-500 hover:text-indigo-600 dark:hover:text-white'}`}
                >
                  الكل ({courses.length})
                </button>
                {allGrades.map(grade => {
                  const count = courses.filter(c => c.grade === grade).length;
                  return (
                    <button
                      key={grade}
                      onClick={() => setSelectedGrade(grade)}
                      className={`px-6 py-2.5 rounded-full font-bold text-sm transition-all shadow-sm flex items-center gap-2 cursor-pointer ${selectedGrade === grade ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200 dark:shadow-none ring-2 ring-indigo-300 dark:ring-indigo-600' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-500 hover:text-indigo-600 dark:hover:text-white'}`}
                    >
                      <span>{grade}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${selectedGrade === grade ? 'bg-indigo-700 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'}`}>
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </motion.div>
        </div>

        {filteredCourses.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-10 text-center max-w-xl mx-auto border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <div className="w-16 h-16 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 rounded-2xl flex items-center justify-center mx-auto mb-2 border border-indigo-100 dark:border-indigo-800/60">
              <BookOpen className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-black text-slate-900 dark:text-white">
              {selectedGrade === 'all' ? 'لا توجد كورسات متاحة حالياً' : `لا توجد كورسات متاحة حالياً لـ (${selectedGrade})`}
            </h3>
            <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed max-w-md mx-auto">
              جاري إعداد محتوى وملازم هذا الصف وسيتم رفعه قريباً بإذن الله. يمكنك استعراض الصفوف الأخرى بالأعلى أو التواصل معنا لمعرفة المواعيد.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              {selectedGrade !== 'all' && (
                <button
                  onClick={() => setSelectedGrade('all')}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-xl font-bold text-sm transition-all shadow-md shadow-indigo-200 dark:shadow-none cursor-pointer"
                >
                  عرض جميع الكورسات المتاحة ({courses.length})
                </button>
              )}
              {settings.whatsappNumber && (
                <a
                  href={`https://wa.me/${settings.whatsappNumber}?text=${encodeURIComponent(`السلام عليكم، أود الاستفسار عن موعد إتاحة كورسات ${selectedGrade !== 'all' ? selectedGrade : 'المنصة'}`)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-xl font-bold text-sm transition-all flex items-center gap-2 shadow-md shadow-emerald-200 dark:shadow-none cursor-pointer"
                >
                  <span>استفسار واتساب</span>
                </a>
              )}
            </div>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {filteredCourses.map((course, index) => (
              <motion.div
                key={course.id}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="bg-white dark:bg-slate-900 rounded-3xl overflow-hidden shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_20px_40px_rgb(0,0,0,0.12)] transition-all duration-300 border border-slate-100 dark:border-slate-800 flex flex-col group"
              >
                {/* RECTANGULAR WIDESCREEN COURSE IMAGE */}
                <div className="relative w-full aspect-[16/9] overflow-hidden bg-slate-900 flex items-center justify-center">
                  {(course.coverImageBase64 || course.imageUrl) ? (
                    <>
                      <img 
                        src={course.coverImageBase64 || course.imageUrl} 
                        alt="" 
                        aria-hidden="true"
                        className="absolute inset-0 w-full h-full object-cover blur-sm scale-110 opacity-40 pointer-events-none" 
                      />
                      <img 
                        src={course.coverImageBase64 || course.imageUrl} 
                        alt={course.name} 
                        className="relative z-10 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" 
                      />
                    </>
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-indigo-950 via-slate-900 to-indigo-900 text-white p-6 text-center">
                      <BookOpen className="w-16 h-16 mb-2 opacity-80" />
                      <span className="font-bold text-lg opacity-95">{course.name}</span>
                    </div>
                  )}
                  
                  <div className="absolute top-4 right-4 z-20 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm text-indigo-700 dark:text-indigo-400 px-4 py-1.5 rounded-full font-black text-xs shadow-md flex items-center gap-1.5 border border-slate-200/50 dark:border-slate-700">
                    <Star className="w-3.5 h-3.5 fill-indigo-700 dark:fill-indigo-400" />
                    <span>كورس معتمد</span>
                  </div>
                </div>

                <div className="p-8 flex flex-col flex-grow">
                  <div className="mb-4">
                    <span className="text-indigo-600 dark:text-indigo-400 font-bold text-sm bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-100 dark:border-indigo-800/60 px-3 py-1 rounded-lg inline-block mb-3">
                      {course.grade}
                    </span>
                    <h3 className="text-2xl font-black text-slate-900 dark:text-white leading-tight mb-3">
                      {course.name}
                    </h3>
                    <p className="text-slate-600 dark:text-slate-400 font-medium text-sm leading-relaxed line-clamp-3">
                      {course.description}
                    </p>
                  </div>

                  <div className="space-y-3 mb-8 flex-grow">
                    <div className="flex items-center gap-3 text-slate-700 dark:text-slate-300 text-sm font-medium">
                      <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0" />
                      <span>محاضرات فيديو عالية الجودة</span>
                    </div>
                    <div className="flex items-center gap-3 text-slate-700 dark:text-slate-300 text-sm font-medium">
                      <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0" />
                      <span>امتحانات دورية وتدريبات مكثفة</span>
                    </div>
                    <div className="flex items-center gap-3 text-slate-700 dark:text-slate-300 text-sm font-medium">
                      <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0" />
                      <span>مذكرات PDF قابلة للتحميل</span>
                    </div>
                    <div className="flex items-center gap-3 text-slate-700 dark:text-slate-300 text-sm font-medium">
                      <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0" />
                      <span>دعم فني ومتابعة مستمرة</span>
                    </div>
                  </div>

                  <div className="pt-6 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between mt-auto">
                    <div className="flex flex-col">
                      <span className="text-xs text-slate-500 dark:text-slate-400 font-bold mb-1">قيمة الاشتراك</span>
                      {Number(course.price) === 0 || (course as any).isFree ? (
                        <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 rounded-xl font-black text-xs">
                          <span>🎁 مجاني بالكامل</span>
                        </div>
                      ) : (
                        <div className="flex items-baseline gap-1">
                          <span className="text-2xl font-black text-indigo-700 dark:text-indigo-400">{course.price}</span>
                          <span className="text-slate-500 dark:text-slate-400 font-bold text-sm">ج.م</span>
                        </div>
                      )}
                    </div>
                    <Link 
                      to={`/course/${course.id}`}
                      className={`px-6 py-3 rounded-xl font-bold transition-all shadow-md hover:shadow-lg flex items-center gap-2 group-hover:-translate-x-1 cursor-pointer ${
                        Number(course.price) === 0 || (course as any).isFree
                          ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                          : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                      }`}
                    >
                      <span>{Number(course.price) === 0 || (course as any).isFree ? 'دخول مجاني 🚀' : 'دخول الكورس'}</span>
                      <ChevronLeft className="w-5 h-5" />
                    </Link>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
