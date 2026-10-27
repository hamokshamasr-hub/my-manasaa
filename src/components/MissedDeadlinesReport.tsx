import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, query, onSnapshot, getDocs, where, doc, setDoc } from 'firebase/firestore';
import { Loader2, AlertCircle, MessageCircle, Send, Check } from 'lucide-react';
import { motion } from 'motion/react';
import { buildWhatsAppUrl } from '../lib/whatsapp';

export default function MissedDeadlinesReport() {
  const [loading, setLoading] = useState(true);
  const [reports, setReports] = useState<any[]>([]);

  useEffect(() => {
    const fetchMissed = async () => {
      try {
        // 1. Get all students
        const qUsers = query(collection(db, 'users'), where('role', '==', 'student'));
        const usersSnap = await getDocs(qUsers);
        const students = usersSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));

        // 2. Get all exams with deadline passed
        const now = Date.now();
        const qExams = query(collection(db, 'exams'));
        const examsSnap = await getDocs(qExams);
        const passedExams = examsSnap.docs
          .map(d => ({ id: d.id, ...d.data() } as any))
          .filter(e => e.endTime && e.endTime < now);

        // 3. Get all exam results
        const qResults = query(collection(db, 'exam_results'));
        const resultsSnap = await getDocs(qResults);
        const results = resultsSnap.docs.map(d => d.data());

        // 4. Get all payments/subscriptions to know which course students have
        const qPayments = query(collection(db, 'payments'), where('status', '==', 'approved'));
        const paymentsSnap = await getDocs(qPayments);
        const payments = paymentsSnap.docs.map(d => d.data());

        // Process data
        const missed: any[] = [];
        for (const student of students) {
          // What courses does this student have?
          const studentCourses = new Set<string>(student.allowedCourseIds || []);
          payments.filter(p => p.userId === student.id).forEach(p => studentCourses.add(p.courseId));

          // Which passed exams should they have taken?
          for (const exam of passedExams) {
            const courseIds = exam.courseIds || (exam.courseId ? [exam.courseId] : []);
            const hasCourse = courseIds.some((cid: string) => studentCourses.has(cid));
            
            // Allow center students if exam is assigned to 'all' or no specific course? Let's keep it simple.
            if (hasCourse || student.isCenterStudent) {
              // Did they take it?
              const tookIt = results.some(r => r.studentId === student.id && r.examId === exam.id);
              if (!tookIt) {
                missed.push({
                  studentId: student.id,
                  studentName: student.name,
                  studentPhone: student.phone,
                  parentPhone: student.parentPhone,
                  examTitle: exam.title,
                  examType: exam.type === 'recitation' ? 'تسميع' : exam.type === 'homework' ? 'واجب' : 'امتحان',
                  deadline: exam.endTime
                });
              }
            }
          }
        }

        setReports(missed);
        setLoading(false);
      } catch (err) {
        console.error(err);
        setLoading(false);
      }
    };

    fetchMissed();
  }, []);

  const [notifiedMap, setNotifiedMap] = useState<Record<string, boolean>>({});

  const handleNotifyParent = async (r: any) => {
    const key = `${r.studentId}_${r.examTitle}`;
    try {
      // 1. Send in-app notification to student
      const notifRef = doc(collection(db, 'notifications'));
      await setDoc(notifRef, {
        userId: r.studentId,
        title: `تنبيه: عدم إتمام ${r.examType}`,
        message: `نود تنبيهك بأنه لم يتم إنجاز (${r.examTitle}) وتم إرسال إشعار لولي الأمر للمتابعة.`,
        read: false,
        createdAt: Date.now()
      });

      setNotifiedMap(prev => ({ ...prev, [key]: true }));
    } catch (e) {
      console.warn("Notification error:", e);
    }
  };

  if (loading) return <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-indigo-600" /></div>;

  return (
    <div className="bg-white rounded-3xl shadow-sm border border-rose-200 overflow-hidden mt-8">
      <div className="bg-rose-50 p-6 border-b border-rose-100 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <AlertCircle className="w-6 h-6 text-rose-600" />
          <div>
            <h2 className="text-xl font-black text-rose-900">تقرير المتخلفين عن التقييمات والتسميعات</h2>
            <p className="text-sm text-rose-600 font-medium">الطلاب الذين لم يؤدوا الامتحانات أو التسميعات قبل انتهاء وقتها وإشعار أولياء الأمور</p>
          </div>
        </div>
        <span className="bg-rose-200 text-rose-800 text-xs font-black px-3 py-1 rounded-full">
          {reports.length} متأخر
        </span>
      </div>
      
      <div className="p-0 overflow-x-auto">
        <table className="w-full text-right">
          <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 text-sm font-bold">
            <tr>
              <th className="px-6 py-4">الطالب</th>
              <th className="px-6 py-4">التقييم / المهمة</th>
              <th className="px-6 py-4">النوع</th>
              <th className="px-6 py-4">هاتف ولي الأمر</th>
              <th className="px-6 py-4 text-center">إشعار ولي الأمر</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {reports.length === 0 ? (
              <tr><td colSpan={5} className="p-8 text-center text-slate-500 font-bold">لا يوجد طلاب متخلفين عن التقييمات والتسميعات 🎉</td></tr>
            ) : (
              reports.map((r, i) => {
                const key = `${r.studentId}_${r.examTitle}`;
                const isNotified = notifiedMap[key];
                const msg = `تحية طيبة من إدارة المنصة. نود إحاطة سيادتكم بأن الطالب (${r.studentName}) لم يقم بإتمام (${r.examType}: ${r.examTitle}) في الموعد المحدد. يرجى متابعته للالتزام والتفوق.`;
                const whatsappUrl = buildWhatsAppUrl(r.parentPhone, msg);

                return (
                  <tr key={i} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-bold text-slate-900">{r.studentName}</div>
                      <div className="text-xs text-slate-500">{r.studentPhone}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-bold text-slate-800">{r.examTitle}</div>
                      <div className="text-xs text-rose-500 font-bold">انتهى: {new Date(r.deadline).toLocaleDateString('ar-EG')}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="bg-slate-100 text-slate-700 px-3 py-1 rounded-full text-xs font-bold">
                        {r.examType}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-mono text-sm text-slate-700" dir="ltr">
                      {r.parentPhone || '-'}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        {r.parentPhone ? (
                          <a
                            href={whatsappUrl}
                            target="_blank"
                            rel="noreferrer"
                            onClick={() => handleNotifyParent(r)}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
                            title="إرسال إشعار فوري لولي الأمر عبر واتساب"
                          >
                            <MessageCircle className="w-3.5 h-3.5" />
                            <span>واتساب ولي الأمر</span>
                          </a>
                        ) : (
                          <span className="text-xs text-slate-400">لا يوجد هاتف</span>
                        )}

                        <button
                          onClick={() => handleNotifyParent(r)}
                          disabled={isNotified}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 transition-all ${
                            isNotified
                              ? 'bg-emerald-100 text-emerald-800 cursor-default'
                              : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700 cursor-pointer'
                          }`}
                          title="إشعار الطالب على المنصة"
                        >
                          {isNotified ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Send className="w-3.5 h-3.5" />}
                          <span>{isNotified ? 'تم الإشعار' : 'إشعار بالمنصة'}</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
