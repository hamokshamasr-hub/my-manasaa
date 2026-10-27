import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, query, onSnapshot, where } from 'firebase/firestore';
import { Loader2, TrendingUp, Award, Target, Trophy } from 'lucide-react';
import { motion } from 'motion/react';
import { useAuth } from '../contexts/AuthContext';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts';

export default function StudentPerformance({ 
  subscribedCourses = ['all'], 
  studentId 
}: { 
  subscribedCourses?: string[]; 
  studentId?: string;
}) {
  const { user, appUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [results, setResults] = useState<any[]>([]);

  const targetUid = studentId || user?.uid || appUser?.uid;

  useEffect(() => {
    if (!targetUid) {
      setLoading(false);
      return;
    }
    const q = query(collection(db, 'exam_results'), where('studentId', '==', targetUid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as any[];
      // sort by date
      data.sort((a, b) => a.createdAt - b.createdAt);
      
      const filtered = data.filter(r => {
        if (!r.courseId) return true; // keep old data
        if (subscribedCourses.includes('all')) return true;
        return subscribedCourses.includes(r.courseId);
      });
      
      setResults(filtered);
      setLoading(false);
    }, (err) => {
      console.error(err);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [targetUid]);

  if (loading) {
    return <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-indigo-600" /></div>;
  }

  if (results.length === 0) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-20 text-center flex flex-col items-center">
        <div className="text-6xl mb-6 float-animation">📉</div>
        <p className="text-2xl font-black text-slate-800">لا توجد بيانات للأداء بعد.</p>
        <p className="text-slate-500 font-medium mt-2 text-lg">قم بإنجاز الامتحانات لتتمكن من متابعة تطور مستواك! ✨</p>
      </div>
    );
  }

  const averagePercentage = results.reduce((acc, curr) => acc + curr.percentage, 0) / results.length;
  
  let feedbackMessage = "";
  let feedbackColor = "";
  if (averagePercentage >= 90) {
    feedbackMessage = "ممتاز جداً! أداء رائع، استمر في تفوقك.";
    feedbackColor = "text-emerald-600 bg-emerald-50 border-emerald-200";
  } else if (averagePercentage >= 75) {
    feedbackMessage = "جيد جداً. أنت على الطريق الصحيح.";
    feedbackColor = "text-blue-600 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/50 border-blue-200 dark:border-blue-800/80";
  } else if (averagePercentage >= 50) {
    feedbackMessage = "جيد، لكنك تستطيع تحقيق الأفضل. اجتهد أكثر!";
    feedbackColor = "text-amber-600 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/50 border-amber-200 dark:border-amber-800/80";
  } else {
    feedbackMessage = "مستواك يحتاج إلى تحسين. راجع المحاضرات بتركيز أكثر.";
    feedbackColor = "text-rose-600 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/50 border-rose-200 dark:border-rose-800/80";
  }

  const chartData = results.map((r, index) => ({
    name: `امتحان ${index + 1}`,
    score: Math.round(r.percentage),
    title: r.examTitle
  }));

  return (
    <div className="space-y-6">
      <div className="grid md:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 flex items-center gap-4 hover:shadow-md transition-all">
          <div className="w-14 h-14 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 rounded-2xl flex items-center justify-center border border-indigo-100 dark:border-indigo-800/60">
            <Target className="w-7 h-7" />
          </div>
          <div>
            <p className="text-slate-500 dark:text-slate-400 font-medium">عدد الامتحانات المنجزة</p>
            <p className="text-2xl font-black text-slate-900 dark:text-white">{results.length}</p>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 flex items-center gap-4 hover:shadow-md transition-all">
          <div className="w-14 h-14 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 rounded-2xl flex items-center justify-center border border-emerald-100 dark:border-emerald-800/60">
            <TrendingUp className="w-7 h-7" />
          </div>
          <div>
            <p className="text-slate-500 dark:text-slate-400 font-medium">متوسط الدرجات</p>
            <p className="text-2xl font-black text-slate-900 dark:text-white">{Math.round(averagePercentage)}%</p>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 flex items-center gap-4 hover:shadow-md transition-all">
          <div className="w-14 h-14 bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 rounded-2xl flex items-center justify-center border border-amber-100 dark:border-amber-800/60">
            <Trophy className="w-7 h-7" />
          </div>
          <div>
            <p className="text-slate-500 dark:text-slate-400 font-medium">أعلى درجة</p>
            <p className="text-2xl font-black text-slate-900 dark:text-white">
              {Math.round(Math.max(...results.map(r => r.percentage)))}%
            </p>
          </div>
        </div>
      </div>

      <div className={`p-6 rounded-2xl border flex items-start gap-4 ${feedbackColor}`}>
        <Award className="w-8 h-8 flex-shrink-0" />
        <div>
          <h3 className="font-bold text-lg mb-1">تقييم الأستاذ:</h3>
          <p className="font-medium">{feedbackMessage}</p>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 p-6 md:p-8 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800">
        <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-6">منحنى التطور المستمر</h3>
        <div className="h-[300px] w-full" dir="ltr">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} vertical={false} />
              <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} tickMargin={10} />
              <YAxis stroke="#94a3b8" fontSize={12} tickFormatter={(value) => `${value}%`} />
              <Tooltip 
                contentStyle={{ borderRadius: '12px', border: 'none', backgroundColor: '#1e293b', color: '#f8fafc', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.3)' }}
                formatter={(value) => [`${value}%`, 'النسبة']}
                labelFormatter={(label, payload) => {
                  if (payload && payload.length > 0) {
                    return payload[0].payload.title;
                  }
                  return label;
                }}
              />
              <Line 
                type="monotone" 
                dataKey="score" 
                stroke="#6366f1" 
                strokeWidth={3}
                dot={{ r: 4, strokeWidth: 2, fill: "#1e293b" }}
                activeDot={{ r: 6, fill: "#818cf8", stroke: "#fff", strokeWidth: 2 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
