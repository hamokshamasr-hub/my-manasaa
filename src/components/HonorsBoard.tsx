import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../lib/firebase';
import { collection, query, onSnapshot, orderBy } from 'firebase/firestore';
import { Award, Trophy, Medal, Star, Sparkles, GraduationCap } from 'lucide-react';
import { motion } from 'motion/react';
import { useSettings } from '../contexts/SettingsContext';

export interface HonorStudent {
  id: string;
  name: string;
  grade: string;
  rankTitle: string; // e.g. "المركز الأول على الجمهورية", "الدرجة النهائية 100%"
  percentage: number;
  school?: string;
  governorate?: string;
  year?: string;
  notes?: string;
  avatarBase64?: string;
}

export default function HonorsBoard() {
  const { settings } = useSettings();
  const [honors, setHonors] = useState<HonorStudent[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeGradeFilter, setActiveGradeFilter] = useState<string>('all');

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
      console.warn("Honors fetch note:", err);
      setLoading(false);
    });

    return () => unsub();
  }, []);

  // Default mock/showcase toppers honoring the user's active grades (Baccalaureate & Secondary)
  const defaultHonors: HonorStudent[] = [
    {
      id: 'mock-1',
      name: 'أحمد محمود العوضي',
      grade: 'الصف الثالث الثانوي',
      rankTitle: 'المركز الأول على المحافظة - 100%',
      percentage: 100,
      governorate: 'القاهرة',
      year: 'دفعة 2025',
      notes: 'الدرجة النهائية في اللغة الإنجليزية'
    },
    {
      id: 'mock-2',
      name: 'سارة طارق المنشاوي',
      grade: 'الصف الثالث بكالوريا',
      rankTitle: 'المركز الأول بكالوريا - 99.8%',
      percentage: 99.8,
      governorate: 'الجيزة',
      year: 'دفعة 2025',
      notes: 'تفوق باهر في اللغة الإنجليزية للغات والبكالوريا'
    },
    {
      id: 'mock-3',
      name: 'مريم شريف عبد الرحمن',
      grade: 'الصف الثاني الثانوي',
      rankTitle: 'المركز الثاني جمهورية - 99.5%',
      percentage: 99.5,
      governorate: 'الإسكندرية',
      year: 'دفعة 2025',
      notes: 'درجة شرفية بالامتحان النهائي'
    },
    {
      id: 'mock-4',
      name: 'يوسف كريم الشناوي',
      grade: 'الصف الأول بكالوريا',
      rankTitle: 'الأول على الإدارة - 100%',
      percentage: 100,
      governorate: 'الدقهلية',
      year: 'دفعة 2025',
      notes: 'الدرجة النهائية طوال العام الدراسي'
    }
  ];

  const rawList = honors.length > 0 ? honors : defaultHonors;

  // Filter out middle school grades if middle school is disabled in settings
  const displayedList = useMemo(() => {
    let list = rawList;
    if (settings.showMiddleSchool === false) {
      list = list.filter(h => !h.grade?.includes('الإعدادي'));
    }
    // Limit count based on settings.maxHonorsCount if set
    if (settings.maxHonorsCount && settings.maxHonorsCount > 0) {
      list = list.slice(0, settings.maxHonorsCount);
    }
    return list;
  }, [rawList, settings.showMiddleSchool, settings.maxHonorsCount]);

  if (settings.showHonorsBoard === false) {
    return null;
  }

  const filtered = displayedList.filter(h => {
    if (activeGradeFilter === 'all') return true;
    return h.grade === activeGradeFilter;
  });

  const uniqueGrades = Array.from(new Set(displayedList.map(h => h.grade))).filter(Boolean);

  return (
    <section id="honors" className="py-20 bg-gradient-to-b from-slate-50 via-white to-indigo-50/40 dark:from-[#070b14] dark:via-slate-950 dark:to-[#070b14] relative overflow-hidden transition-colors">
      {/* Radiant Glows */}
      <div className="absolute top-1/4 right-0 w-96 h-96 bg-amber-200/20 dark:bg-amber-950/10 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-indigo-200/20 dark:bg-indigo-950/10 rounded-full blur-3xl pointer-events-none"></div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-14">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-900 dark:text-amber-300 border border-amber-300/60 dark:border-amber-800 font-black text-xs mb-4 shadow-sm">
            <Trophy className="w-4 h-4 text-amber-600 dark:text-amber-400 fill-amber-500" />
            <span>لوحة الشرف وتكريم أوائل الدفعات</span>
            <Sparkles className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
          </div>

          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-slate-900 dark:text-white leading-tight mb-4">
            أبطال منصتنا وصُنّاع التفوق 🌟
          </h2>
          <p className="text-slate-600 dark:text-slate-400 text-sm sm:text-base font-medium max-w-2xl mx-auto">
            نفتخر بكل طالب وطالبة بذلوا الجهد واستحقوا أعلى الدرجات وأوسمة التفوق في امتحانات الجمهورية والمحافظات.
          </p>

          {/* Filter Pills */}
          {uniqueGrades.length > 1 && (
            <div className="flex items-center justify-center gap-2 flex-wrap mt-6">
              <button
                onClick={() => setActiveGradeFilter('all')}
                className={`px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                  activeGradeFilter === 'all'
                    ? 'bg-slate-900 dark:bg-indigo-600 text-white shadow-md scale-105'
                    : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700'
                }`}
              >
                جميع الصفوف ({displayedList.length})
              </button>
              {uniqueGrades.map(g => (
                <button
                  key={g}
                  onClick={() => setActiveGradeFilter(g)}
                  className={`px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                    activeGradeFilter === g
                      ? 'bg-indigo-600 text-white shadow-md scale-105'
                      : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700'
                  }`}
                >
                  {g}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {filtered.map((student, idx) => {
            const isTopRank = idx === 0 || student.percentage >= 100;
            return (
              <motion.div
                key={student.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: idx * 0.08 }}
                className="bg-white dark:bg-slate-900 rounded-3xl p-6 border-2 border-slate-100 dark:border-slate-800 hover:border-amber-300 dark:hover:border-amber-500/60 shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col justify-between group relative overflow-hidden"
              >
                {/* Top Corner Ribbon / Badge */}
                <div className="absolute -top-3 -right-3 bg-gradient-to-tr from-amber-500 to-yellow-400 text-white w-14 h-14 rounded-full flex items-end justify-start p-2.5 shadow-md shadow-amber-500/20">
                  <Medal className="w-4 h-4 text-white" />
                </div>

                <div>
                  {/* Avatar / Initials */}
                  <div className="flex items-center gap-3 mb-4">
                    {student.avatarBase64 ? (
                      <img 
                        src={student.avatarBase64} 
                        alt={student.name} 
                        className="w-14 h-14 rounded-2xl object-cover border-2 border-amber-400 shadow-md"
                      />
                    ) : (
                      <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-amber-500 via-orange-500 to-indigo-600 text-white flex items-center justify-center font-black text-xl shadow-md">
                        {student.name.charAt(0)}
                      </div>
                    )}
                    <div>
                      <h3 className="font-black text-slate-900 dark:text-white text-base group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">
                        {student.name}
                      </h3>
                      <div className="flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400 font-bold mt-0.5">
                        <GraduationCap className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                        <span>{student.grade}</span>
                      </div>
                    </div>
                  </div>

                  {/* Honor Rank Banner */}
                  <div className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/40 dark:to-orange-950/30 border border-amber-200/80 dark:border-amber-800/60 rounded-2xl p-3 mb-3 text-center">
                    <div className="text-amber-900 dark:text-amber-300 font-black text-xs flex items-center justify-center gap-1.5">
                      <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
                      <span>{student.rankTitle}</span>
                    </div>
                  </div>

                  {/* Details / Notes */}
                  <div className="space-y-1.5 text-xs text-slate-600 dark:text-slate-400 font-medium">
                    {student.governorate && (
                      <div className="flex items-center justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                        <span className="text-slate-400 dark:text-slate-500 font-bold">المحافظة:</span>
                        <span className="font-bold text-slate-800 dark:text-slate-200">{student.governorate}</span>
                      </div>
                    )}
                    {student.year && (
                      <div className="flex items-center justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                        <span className="text-slate-400 dark:text-slate-500 font-bold">العام الدراسي:</span>
                        <span className="font-bold text-indigo-600 dark:text-indigo-400">{student.year}</span>
                      </div>
                    )}
                    {student.notes && (
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 pt-2 italic">
                        "{student.notes}"
                      </p>
                    )}
                  </div>
                </div>

                {/* Score Footnote */}
                <div className="mt-5 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500">النسبة النهائية</span>
                  <span className="font-black text-emerald-600 dark:text-emerald-400 font-mono text-sm bg-emerald-50 dark:bg-emerald-950/60 px-2.5 py-0.5 rounded-lg border border-emerald-200 dark:border-emerald-800">
                    {student.percentage}%
                  </span>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Motivational Callout */}
        <div className="mt-14 bg-gradient-to-r from-indigo-900 via-indigo-800 to-slate-900 text-white rounded-3xl p-8 sm:p-10 shadow-2xl relative overflow-hidden flex flex-col md:flex-row items-center justify-between gap-6 text-center md:text-right">
          <div className="space-y-2 max-w-xl">
            <span className="px-3 py-1 rounded-full bg-amber-400/20 text-amber-300 font-black text-xs border border-amber-400/30 inline-block mb-1">
              مكانك محجوز هنا بطلنا القادم 🏆
            </span>
            <h3 className="text-2xl sm:text-3xl font-black text-white">
              تريد أن تصبح من أوائل الجمهورية في دفعتك؟
            </h3>
            <p className="text-slate-300 text-sm font-medium leading-relaxed">
              ابدأ الآن بالاستذكار وحل الامتحانات التفاعلية، واسمك سيتصدر لوحة الشرف وأوائل المحافظات معنا.
            </p>
          </div>
          
          <a
            href="#courses"
            className="px-8 py-4 bg-gradient-to-r from-amber-400 to-yellow-400 hover:from-amber-300 hover:to-yellow-300 text-slate-950 font-black rounded-2xl shadow-xl hover:scale-105 transition-all text-sm flex-shrink-0"
          >
            اختر كورس مرحلتك وابدأ الآن
          </a>
        </div>

      </div>
    </section>
  );
}
