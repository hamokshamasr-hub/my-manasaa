import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../lib/firebase';
import { collection, query, onSnapshot, where } from 'firebase/firestore';
import { motion } from 'motion/react';
import { Trophy, Medal, Star, Crown, Shield, Award, Sparkles, Search, Users, ChevronDown, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export interface StudentStats {
  id: string;
  name: string;
  code?: string;
  totalPoints: number;
  centerPoints?: number;
  centerGroup?: string;
  grade: string;
  isCenterStudent?: boolean;
}

export interface LevelInfo {
  name: string;
  threshold: number;
  nextThreshold: number;
  color: string;
  bg: string;
  border: string;
  icon: any;
  perks: string;
}

export const levels: LevelInfo[] = [
  { name: 'المستوى البرونزي', threshold: 0, nextThreshold: 500, color: 'text-amber-800', bg: 'bg-amber-100', border: 'border-amber-300', icon: Shield, perks: 'بداية رحلة التفوق واكتساب النقاط' },
  { name: 'المستوى الفضي', threshold: 500, nextThreshold: 1500, color: 'text-slate-700', bg: 'bg-slate-200', border: 'border-slate-400', icon: Award, perks: 'طالب ملتزم ومثابر في حل الواجبات' },
  { name: 'المستوى الذهبي', threshold: 1500, nextThreshold: 3000, color: 'text-yellow-800', bg: 'bg-yellow-100', border: 'border-yellow-400', icon: Medal, perks: 'طالب متفوق ودرجات عالية في الامتحانات' },
  { name: 'المستوى البلاتيني', threshold: 3000, nextThreshold: 5000, color: 'text-cyan-800', bg: 'bg-cyan-100', border: 'border-cyan-400', icon: Star, perks: 'نخبة متميزة من أوائل الدفعة' },
  { name: 'المستوى الماسي', threshold: 5000, nextThreshold: 10000, color: 'text-indigo-800', bg: 'bg-indigo-100', border: 'border-indigo-400', icon: Sparkles, perks: 'قمة التألق والريادة على المنصة' },
  { name: 'مستوى الأستاذ (الأسطورة)', threshold: 10000, nextThreshold: 25000, color: 'text-rose-800', bg: 'bg-rose-100', border: 'border-rose-400', icon: Crown, perks: 'أسطورة منصة التعليم وأعلى مراتب التميز' }
];

export const getLevel = (points: number): LevelInfo => {
  let currentLevel = levels[0];
  for (const lvl of levels) {
    if (points >= lvl.threshold) {
      currentLevel = lvl;
    } else {
      break;
    }
  }
  return currentLevel;
};

const ALL_GRADES = [
  'الصف الأول الإعدادي',
  'الصف الثاني الإعدادي',
  'الصف الثالث الإعدادي',
  'الصف الأول الثانوي',
  'الصف الثاني الثانوي',
  'الصف الثالث الثانوي'
];

export default function Leaderboard() {
  const { appUser } = useAuth();
  const [allStudents, setAllStudents] = useState<StudentStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedGrade, setSelectedGrade] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'center' | 'online'>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [displayLimit, setDisplayLimit] = useState<number>(100);

  useEffect(() => {
    // Fetch users and strictly exclude admins and assistants from student leaderboard
    const q = collection(db, 'users');
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs
        .map(doc => {
          const d = doc.data();
          return {
            id: doc.id,
            role: d.role || 'student',
            name: d.name || 'طالب مجهول',
            code: d.code || '',
            totalPoints: Number(d.totalPoints) || 0,
            centerPoints: Number(d.centerPoints) || 0,
            centerGroup: d.centerGroup || '',
            grade: d.grade || 'غير محدد',
            isCenterStudent: Boolean(d.isCenterStudent)
          };
        })
        // Strictly exclude admins and assistants from student leaderboard
        .filter(u => u.role !== 'admin' && u.role !== 'assistant')
        .map(({ role, ...rest }) => rest as StudentStats);
      
      // Sort strictly by total points descending
      data.sort((a, b) => b.totalPoints - a.totalPoints);
      setAllStudents(data);
      setLoading(false);
    }, (error) => {
      console.warn("Leaderboard error:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Filter based on grade, category (all/center/online), and search term
  const filteredStudents = useMemo(() => {
    let list = allStudents.filter(student => {
      const matchesGrade = selectedGrade === 'all' || student.grade === selectedGrade;
      const matchesCategory = 
        categoryFilter === 'all' ? true :
        categoryFilter === 'center' ? student.isCenterStudent :
        !student.isCenterStudent;
      const normalizedSearch = searchTerm.trim().toLowerCase();
      const matchesSearch = !normalizedSearch || 
        student.name.toLowerCase().includes(normalizedSearch) ||
        (student.code && student.code.toLowerCase().includes(normalizedSearch));
      return matchesGrade && matchesCategory && matchesSearch;
    });

    // If center category is selected, prioritize centerPoints
    if (categoryFilter === 'center') {
      list = [...list].sort((a, b) => ((b.centerPoints || 0) + b.totalPoints) - ((a.centerPoints || 0) + a.totalPoints));
    }

    return list;
  }, [allStudents, selectedGrade, categoryFilter, searchTerm]);

  // Paginated/limited slice (100 initially, expandable to 200+)
  const displayedStudents = filteredStudents.slice(0, displayLimit);

  // Find logged-in user's rank
  const myRank = useMemo(() => {
    if (!appUser || appUser.role !== 'student') return null;
    const index = allStudents.findIndex(s => s.id === appUser.uid);
    if (index === -1) return null;
    return {
      rank: index + 1,
      student: allStudents[index]
    };
  }, [allStudents, appUser]);

  if (loading) {
    return (
      <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-12 text-center">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-indigo-600 border-t-transparent mb-3"></div>
        <p className="text-slate-500 font-bold text-sm">جاري تحميل لوحة الشرف والتصنيف...</p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800 p-6 sm:p-8 space-y-6">
      
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 rounded-2xl flex items-center justify-center font-black shadow-inner">
            <Trophy className="w-6 h-6 text-amber-600 dark:text-amber-400" />
          </div>
          <div>
            <h2 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
              <span>لوحة الشرف وتصنيف الطلاب</span>
              <span className="text-xs bg-indigo-50 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 font-bold px-3 py-1 rounded-full border border-indigo-100 dark:border-indigo-800">
                {allStudents.length} طالب مسجل
              </span>
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 font-medium mt-0.5">
              ترتيب الطلاب بناءً على مجموع النقاط ونتائج الامتحانات والواجبات المنجزة
            </p>
          </div>
        </div>

        {/* Current Student Rank Pin (If student is logged in) */}
        {myRank && (
          <div className="bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-950/60 dark:to-purple-950/60 border border-indigo-200/80 dark:border-indigo-800/80 rounded-2xl px-5 py-3 flex items-center gap-3 shadow-sm self-start sm:self-auto">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-black text-sm shadow">
              #{myRank.rank}
            </div>
            <div>
              <div className="text-[11px] font-bold text-indigo-700 dark:text-indigo-300">ترتيبك الحالي في المنصة</div>
              <div className="font-black text-slate-900 dark:text-white text-sm">{myRank.student.totalPoints} نقطة ({getLevel(myRank.student.totalPoints).name})</div>
            </div>
          </div>
        )}
      </div>

      {/* Grade Filters & Search Bar */}
      <div className="space-y-3">
        {/* Search */}
        <div className="relative">
          <Search className="w-5 h-5 absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="ابحث بالاسم أو كود الطالب في قائمة الشرف..."
            className="w-full pr-12 pl-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-medium text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
          />
        </div>

        {/* Category Filter Tabs (All / Center / Online) */}
        <div className="flex items-center gap-2 p-1.5 bg-slate-100 dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 self-start">
          <button
            onClick={() => setCategoryFilter('all')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
              categoryFilter === 'all'
                ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-sm'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            الترتيب العام (الجميع)
          </button>
          <button
            onClick={() => setCategoryFilter('center')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${
              categoryFilter === 'center'
                ? 'bg-amber-500 text-slate-950 shadow-sm'
                : 'text-amber-800 dark:text-amber-300 hover:text-amber-950 dark:hover:text-amber-200'
            }`}
          >
            <span>🏆 أوائل السنتر والتسميع</span>
            <span className="text-[10px] bg-amber-600/30 px-1.5 py-0.5 rounded-full">
              {allStudents.filter(s => s.isCenterStudent).length}
            </span>
          </button>
          <button
            onClick={() => setCategoryFilter('online')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
              categoryFilter === 'online'
                ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-sm'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            طلاب المنصة الأونلاين
          </button>
        </div>

        {/* Grade tabs */}
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          <button
            onClick={() => setSelectedGrade('all')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              selectedGrade === 'all'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-100 dark:shadow-none'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            جميع الصفوف ({allStudents.length})
          </button>
          {ALL_GRADES.map(grade => {
            const count = allStudents.filter(s => s.grade === grade).length;
            return (
              <button
                key={grade}
                onClick={() => setSelectedGrade(grade)}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  selectedGrade === grade
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-100 dark:shadow-none'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                <span>{grade}</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${selectedGrade === grade ? 'bg-indigo-700 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'}`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Leaderboard Table / Dense List */}
      {displayedStudents.length === 0 ? (
        <div className="text-center py-12 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700">
          <Users className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
          <p className="text-slate-500 dark:text-slate-400 font-bold text-sm">لا يوجد طلاب مطابقين للبحث أو الصف المختار.</p>
        </div>
      ) : (
        <div className="overflow-hidden border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm">
          {/* Table Header */}
          <div className="bg-slate-100/80 dark:bg-slate-800/90 px-4 py-3 text-xs font-black text-slate-500 dark:text-slate-400 grid grid-cols-12 gap-2 items-center border-b border-slate-200 dark:border-slate-800">
            <div className="col-span-2 sm:col-span-1 text-center">الترتيب</div>
            <div className="col-span-6 sm:col-span-5 pr-2">اسم الطالب</div>
            <div className="hidden sm:block sm:col-span-3">الصف الدراسي</div>
            <div className="col-span-4 sm:col-span-3 text-left pl-2">النقاط والمستوى</div>
          </div>

          {/* Table Body: Fast, Dense, Clean Rows */}
          <div className="divide-y divide-slate-100 dark:divide-slate-800/80 max-h-[700px] overflow-y-auto">
            {displayedStudents.map((student, idx) => {
              const rank = idx + 1;
              const isMe = appUser?.uid === student.id;
              const level = getLevel(student.totalPoints);
              const LevelIcon = level.icon;

              return (
                <div
                  key={student.id}
                  className={`px-4 py-3.5 grid grid-cols-12 gap-2 items-center transition-colors ${
                    isMe
                      ? 'bg-indigo-50/80 dark:bg-indigo-950/40 border-y border-indigo-200 dark:border-indigo-800'
                      : rank === 1
                      ? 'bg-amber-50/40 dark:bg-amber-950/20 hover:bg-amber-50/70 dark:hover:bg-amber-950/30'
                      : rank === 2
                      ? 'bg-slate-50/70 dark:bg-slate-800/40 hover:bg-slate-100/60 dark:hover:bg-slate-800/60'
                      : rank === 3
                      ? 'bg-orange-50/40 dark:bg-orange-950/20 hover:bg-orange-50/70 dark:hover:bg-orange-950/30'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                  }`}
                >
                  {/* Rank Column */}
                  <div className="col-span-2 sm:col-span-1 flex justify-center">
                    {rank === 1 ? (
                      <span className="w-8 h-8 rounded-xl bg-amber-400 text-slate-950 font-black text-sm flex items-center justify-center shadow-sm">
                        🥇 1
                      </span>
                    ) : rank === 2 ? (
                      <span className="w-8 h-8 rounded-xl bg-slate-300 text-slate-800 font-black text-sm flex items-center justify-center shadow-sm">
                        🥈 2
                      </span>
                    ) : rank === 3 ? (
                      <span className="w-8 h-8 rounded-xl bg-amber-700 text-amber-100 font-black text-sm flex items-center justify-center shadow-sm">
                        🥉 3
                      </span>
                    ) : (
                      <span className="w-8 h-8 rounded-xl bg-slate-100 text-slate-600 font-bold text-xs flex items-center justify-center">
                        #{rank}
                      </span>
                    )}
                  </div>

                  {/* Name Column */}
                  <div className="col-span-6 sm:col-span-5 pr-2 flex flex-col justify-center min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`font-bold text-sm truncate ${isMe ? 'text-indigo-600 dark:text-indigo-400 font-black' : 'text-slate-900 dark:text-white'}`}>
                        {student.name}
                      </span>
                      {isMe && (
                        <span className="bg-indigo-600 text-white text-[10px] font-black px-2 py-0.5 rounded-full shadow-sm">
                          أنت
                        </span>
                      )}
                      {student.isCenterStudent && (
                        <span className="bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800 text-[10px] font-bold px-2 py-0.5 rounded flex items-center gap-1">
                          <span>سنتر</span>
                          {student.centerGroup && <span className="opacity-75">({student.centerGroup})</span>}
                        </span>
                      )}
                    </div>
                    {student.code && (
                      <span className="text-[11px] font-mono text-slate-400 dark:text-slate-500 mt-0.5">
                        كود: {student.code}
                      </span>
                    )}
                    {/* Grade for mobile */}
                    <span className="text-[11px] text-indigo-600 dark:text-indigo-400 font-medium block sm:hidden mt-0.5">
                      {student.grade}
                    </span>
                  </div>

                  {/* Grade Column (Desktop) */}
                  <div className="hidden sm:block sm:col-span-3">
                    <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-lg inline-block">
                      {student.grade}
                    </span>
                  </div>

                  {/* Points & Level Column */}
                  <div className="col-span-4 sm:col-span-3 text-left pl-2 flex flex-col items-end justify-center">
                    <div className="flex items-baseline gap-1">
                      <span className="font-black text-indigo-700 dark:text-indigo-400 text-base sm:text-lg">
                        {(categoryFilter === 'center' ? ((student.centerPoints || 0) + student.totalPoints) : student.totalPoints).toLocaleString()}
                      </span>
                      <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">نقطة</span>
                    </div>

                    {student.isCenterStudent && (student.centerPoints || 0) > 0 && (
                      <span className="text-[10px] font-bold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 px-1.5 py-0.2 rounded mt-0.5">
                        نقاط السنتر والتسميع: +{student.centerPoints}
                      </span>
                    )}

                    <div className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md mt-0.5 ${level.bg} ${level.color}`}>
                      <LevelIcon className="w-3 h-3" />
                      <span>{level.name}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Table Footer: Expand limit to 200 */}
          <div className="bg-slate-50 dark:bg-slate-800/80 p-4 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400">
            <span>
              يتم عرض <strong>{displayedStudents.length}</strong> من أصل <strong>{filteredStudents.length}</strong> طالب في لوحة الشرف
            </span>
            {filteredStudents.length > displayLimit && (
              <button
                onClick={() => setDisplayLimit(prev => Math.min(prev + 100, 300))}
                className="bg-white hover:bg-slate-100 text-indigo-600 font-bold px-4 py-2 rounded-xl border border-slate-200 shadow-sm transition-all flex items-center gap-1.5"
              >
                <span>عرض المزيد (حتى 200 طالب وأكثر)</span>
                <ChevronDown className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
