import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, query, onSnapshot, orderBy, deleteDoc, doc } from 'firebase/firestore';
import { 
  Loader2, Search, Award, Trash2, AlertTriangle, Phone, 
  TrendingUp, Users, CheckCircle, Download, Printer, Sparkles, Filter 
} from 'lucide-react';
import { motion } from 'motion/react';
import MissedDeadlinesReport from './MissedDeadlinesReport';

interface ExamResult {
  id: string;
  studentId: string;
  examId: string;
  examTitle: string;
  courseId: string;
  score: number;
  total: number;
  percentage: number;
  createdAt: number;
}

interface AppUser {
  uid: string;
  name: string;
  email: string;
  phone: string;
  parentPhone: string;
  studentCode?: string;
  grade?: string;
  role: 'student' | 'admin' | 'assistant';
}

export default function AdminPerformance() {
  const [results, setResults] = useState<ExamResult[]>([]);
  const [students, setStudents] = useState<Record<string, AppUser>>({});
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterScore, setFilterScore] = useState<'all' | 'high' | 'mid' | 'low'>('all');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const handleDeleteResult = async (id: string) => {
    if (!confirm('هل أنت متأكد من حذف نتيجة هذا الطالب؟')) return;
    try {
      await deleteDoc(doc(db, 'exam_results', id));
      setSelectedIds(prev => prev.filter(item => item !== id));
    } catch (err) {
      console.error(err);
      alert('حدث خطأ أثناء الحذف.');
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    if (!confirm(`هل أنت متأكد من حذف (${selectedIds.length}) من النتائج المحددة؟`)) return;
    try {
      await Promise.all(selectedIds.map(id => deleteDoc(doc(db, 'exam_results', id))));
      setSelectedIds([]);
    } catch (err) {
      console.error(err);
      alert('حدث خطأ أثناء الحذف الجماعي.');
    }
  };

  const toggleSelectAll = (filteredList: ExamResult[]) => {
    if (selectedIds.length === filteredList.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredList.map(r => r.id));
    }
  };

  const toggleSelectOne = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  useEffect(() => {
    // Fetch users
    const usersQ = query(collection(db, 'users'));
    const unsubUsers = onSnapshot(usersQ, (snap) => {
      const usersMap: Record<string, AppUser> = {};
      snap.forEach(doc => {
        usersMap[doc.id] = doc.data() as AppUser;
      });
      setStudents(usersMap);
    }, (err) => {
      console.warn("Error fetching users in AdminPerformance:", err);
    });

    // Fetch results
    const resultsQ = query(collection(db, 'exam_results'), orderBy('createdAt', 'desc'));
    const unsubResults = onSnapshot(resultsQ, (snap) => {
      const data = snap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as ExamResult[];
      setResults(data);
      setLoading(false);
    }, (err) => {
      console.warn("Error fetching results in AdminPerformance:", err);
      setLoading(false);
    });

    return () => {
      unsubUsers();
      unsubResults();
    };
  }, []);

  // Export to CSV
  const handleExportCSV = () => {
    if (results.length === 0) return;
    const headers = ['اسم الطالب', 'كود الطالب', 'المرحلة', 'هاتف الطالب', 'هاتف ولي الأمر', 'عنوان الامتحان', 'الدرجة', 'المجموع', 'النسبة المئوية', 'التاريخ'];
    const rows = filteredResults.map(r => {
      const st = students[r.studentId];
      return [
        `"${st?.name || (r as any).studentName || 'طالب'}"`,
        `"${st?.studentCode || '-'}"`,
        `"${st?.grade || '-'}"`,
        `"${st?.phone || '-'}"`,
        `"${st?.parentPhone || '-'}"`,
        `"${r.examTitle}"`,
        r.score,
        r.total,
        `"${Math.round(r.percentage)}%"`,
        `"${new Date(r.createdAt).toLocaleDateString('ar-EG')}"`
      ];
    });

    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" 
      + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `نتائج_الطلاب_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-16 gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
        <span className="text-slate-600 font-bold">جاري تحميل سجل درجات وأداء الطلاب...</span>
      </div>
    );
  }

  // Statistics calculation
  const totalSubmissions = results.length;
  const highScorers = results.filter(r => r.percentage >= 85).length;
  const midScorers = results.filter(r => r.percentage >= 60 && r.percentage < 85).length;
  const lowScorers = results.filter(r => r.percentage < 60).length;
  const avgScore = totalSubmissions > 0 
    ? Math.round(results.reduce((acc, curr) => acc + curr.percentage, 0) / totalSubmissions) 
    : 0;

  const filteredResults = results.filter(r => {
    const st = students[r.studentId];
    const studentName = st?.name || (r as any).studentName || r.studentId || 'طالب السنتر';
    const term = searchTerm.toLowerCase();
    const matchesSearch = studentName.toLowerCase().includes(term) || 
      (st?.phone || '').includes(term) || 
      (st?.studentCode || '').toLowerCase().includes(term) ||
      r.examTitle.toLowerCase().includes(term);

    if (filterScore === 'high') return matchesSearch && r.percentage >= 85;
    if (filterScore === 'mid') return matchesSearch && r.percentage >= 60 && r.percentage < 85;
    if (filterScore === 'low') return matchesSearch && r.percentage < 60;
    return matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-6 rounded-3xl shadow-xl border border-indigo-900/40 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <span className="px-3 py-0.5 rounded-full bg-indigo-500/30 text-indigo-300 text-xs font-black border border-indigo-400/30 flex items-center gap-1 w-fit mb-2">
            <Sparkles className="w-3.5 h-3.5 text-amber-300" /> لوحة تحليلات النتائج والدرجات
          </span>
          <h2 className="text-2xl lg:text-3xl font-black text-white">نتائج وتقارير أداء الطلاب</h2>
          <p className="text-slate-300 text-xs sm:text-sm mt-1 font-medium">
            متابعة فورية للدرجات، إرسال تقارير واتساب لأولياء الأمور، وتحديد الطلاب المحتاجين للمتابعة الأكاديمية.
          </p>
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <button
            onClick={handleExportCSV}
            className="px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-black flex items-center gap-2 backdrop-blur-md transition-all border border-white/10"
          >
            <Download className="w-4 h-4" /> تصدير ملف Excel (CSV)
          </button>
        </div>
      </div>

      {/* Metric Counters */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-black">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-black text-slate-900">{totalSubmissions}</div>
            <div className="text-xs font-bold text-slate-500">إجمالي الحلول</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-black">
            <CheckCircle className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-black text-emerald-600">{highScorers}</div>
            <div className="text-xs font-bold text-slate-500">متفوقين (85%+)</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-black">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-black text-blue-600">{avgScore}%</div>
            <div className="text-xs font-bold text-slate-500">متوسط الدرجات</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center font-black">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-black text-rose-600">{lowScorers}</div>
            <div className="text-xs font-bold text-slate-500">متابعة (&lt;60%)</div>
          </div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        
        {/* Filter Pills */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setFilterScore('all')}
            className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all ${
              filterScore === 'all' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            الكل ({results.length})
          </button>
          <button
            onClick={() => setFilterScore('high')}
            className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all ${
              filterScore === 'high' ? 'bg-emerald-600 text-white' : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
            }`}
          >
            المتفوقين ({highScorers})
          </button>
          <button
            onClick={() => setFilterScore('mid')}
            className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all ${
              filterScore === 'mid' ? 'bg-amber-600 text-white' : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
            }`}
          >
            المتوسطين ({midScorers})
          </button>
          <button
            onClick={() => setFilterScore('low')}
            className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all ${
              filterScore === 'low' ? 'bg-rose-600 text-white' : 'bg-rose-50 text-rose-700 hover:bg-rose-100'
            }`}
          >
            بحاجة لمتابعة ({lowScorers})
          </button>
        </div>

        {/* Search input & bulk actions */}
        <div className="flex items-center gap-3 w-full md:w-auto">
          {selectedIds.length > 0 && (
            <button
              onClick={handleBulkDelete}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all flex-shrink-0"
            >
              <Trash2 className="w-4 h-4" />
              حذف المحدد ({selectedIds.length})
            </button>
          )}

          <div className="w-full md:w-72 relative">
            <input
              type="text"
              placeholder="ابحث بالاسم، الكود، الهاتف، أو الامتحان..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pr-10 pl-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-xs font-bold"
            />
            <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
          </div>
        </div>
      </div>

      {/* Results Table */}
      <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
        {filteredResults.length === 0 ? (
          <div className="p-12 text-center text-slate-500 font-medium flex flex-col items-center">
            <Award className="w-12 h-12 text-slate-300 mb-3" />
            <p className="font-bold text-slate-700">لا توجد نتائج مطابقة لبحثك.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-black">
                <tr>
                  <th className="px-4 py-3.5 text-center">
                    <input 
                      type="checkbox" 
                      checked={filteredResults.length > 0 && selectedIds.length === filteredResults.length}
                      onChange={() => toggleSelectAll(filteredResults)}
                      className="w-4 h-4 rounded text-indigo-600 border-slate-300 focus:ring-indigo-500 cursor-pointer"
                    />
                  </th>
                  <th className="px-4 py-3.5">الطالب</th>
                  <th className="px-4 py-3.5">المرحلة</th>
                  <th className="px-4 py-3.5">الامتحان</th>
                  <th className="px-4 py-3.5 text-center">الدرجة</th>
                  <th className="px-4 py-3.5 text-center">النسبة</th>
                  <th className="px-4 py-3.5">التاريخ</th>
                  <th className="px-4 py-3.5 text-center">إشعار ولي الأمر</th>
                  <th className="px-4 py-3.5 text-center">حذف</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredResults.map((result) => {
                  const st = students[result.studentId];
                  const studentName = st?.name || (result as any).studentName || result.studentId || 'طالب';
                  const isSelected = selectedIds.includes(result.id);
                  const isHigh = result.percentage >= 85;
                  const isLow = result.percentage < 60;

                  // WhatsApp Message formulation
                  const waText = isHigh 
                    ? `مرحباً يا بطل ${studentName}! 🎉 نهنئك بتفوقك وحصولك على درجة (${result.score} من ${result.total}) بنسبة ${Math.round(result.percentage)}% في "${result.examTitle}". استمر في هذا التألق!`
                    : isLow
                    ? `تحياتنا من إدارة المنصة التعليمية بخصوص الطالب ${studentName}. نحيطكم علماً بأنه حصل على درجة (${result.score} من ${result.total}) بنسبة ${Math.round(result.percentage)}% في "${result.examTitle}". يُرجى متابعته ومراجعة شرح المحاضرة وحل بنك الأسئلة.`
                    : `تحياتنا من المنصة التعليمية للطالب ${studentName}. درجاتك في "${result.examTitle}" هي (${result.score} من ${result.total}) بنسبة ${Math.round(result.percentage)}%. نتمنى لك دوام التقدم والنجاح.`;

                  return (
                    <tr key={result.id} className={`hover:bg-slate-50/80 transition-colors ${isSelected ? 'bg-indigo-50/40' : ''}`}>
                      <td className="px-4 py-3.5 text-center">
                        <input 
                          type="checkbox" 
                          checked={isSelected}
                          onChange={() => toggleSelectOne(result.id)}
                          className="w-4 h-4 rounded text-indigo-600 border-slate-300 focus:ring-indigo-500 cursor-pointer"
                        />
                      </td>

                      <td className="px-4 py-3.5 font-black text-slate-900">
                        <div>
                          <div className="font-black text-slate-900 text-sm">{studentName}</div>
                          <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-mono mt-0.5">
                            {st?.studentCode && <span className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-700">{st.studentCode}</span>}
                            {st?.phone && <span>{st.phone}</span>}
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-3.5 text-slate-600 font-bold">
                        {st?.grade ? (
                          <span className="px-2 py-0.5 bg-slate-100 rounded text-[11px]">{st.grade}</span>
                        ) : '-'}
                      </td>

                      <td className="px-4 py-3.5 font-bold text-slate-800 max-w-[200px] truncate">
                        {result.examTitle}
                      </td>

                      <td className="px-4 py-3.5 text-center">
                        <span className="bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-xl font-black font-mono">
                          {result.score} / {result.total}
                        </span>
                      </td>

                      <td className="px-4 py-3.5 text-center">
                        <span className={`px-2.5 py-1 rounded-xl font-black text-xs font-mono ${
                          isHigh ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                          isLow ? 'bg-rose-50 text-rose-700 border border-rose-200' :
                          'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}>
                          {Math.round(result.percentage)}%
                        </span>
                      </td>

                      <td className="px-4 py-3.5 text-slate-400 font-mono text-[11px]">
                        {new Date(result.createdAt).toLocaleDateString('ar-EG', { month: 'short', day: 'numeric', hour: '2-digit', minute:'2-digit' })}
                      </td>

                      {/* Send WhatsApp notification to parent/student */}
                      <td className="px-4 py-3.5 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {st?.parentPhone ? (
                            <a
                              href={`https://wa.me/20${st.parentPhone.replace(/^0+/, '')}?text=${encodeURIComponent(waText)}`}
                              target="_blank"
                              rel="noreferrer"
                              className="px-2.5 py-1 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg font-black text-[10px] flex items-center gap-1 transition-colors shadow-sm"
                              title="إرسال تقرير الدرجة لولي الأمر عبر واتساب"
                            >
                              <Phone className="w-3 h-3" /> ولي الأمر
                            </a>
                          ) : st?.phone ? (
                            <a
                              href={`https://wa.me/20${st.phone.replace(/^0+/, '')}?text=${encodeURIComponent(waText)}`}
                              target="_blank"
                              rel="noreferrer"
                              className="px-2.5 py-1 bg-teal-600 hover:bg-teal-700 text-white rounded-lg font-black text-[10px] flex items-center gap-1 transition-colors shadow-sm"
                              title="إرسال التقرير للطالب"
                            >
                              <Phone className="w-3 h-3" /> الطالب
                            </a>
                          ) : (
                            <span className="text-slate-400 text-[10px] italic">لا يوجد رقم</span>
                          )}
                        </div>
                      </td>

                      <td className="px-4 py-3.5 text-center">
                        <button
                          onClick={() => handleDeleteResult(result.id)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                          title="حذف نتيجة الطالب"
                        >
                          <Trash2 className="w-4 h-4 mx-auto" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Missed Deadlines & Homework Report */}
      <MissedDeadlinesReport />
    </div>
  );
}
