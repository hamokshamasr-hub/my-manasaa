import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, query, onSnapshot, where, doc, setDoc, updateDoc, increment } from 'firebase/firestore';
import { Loader2, CheckSquare, ChevronRight, ChevronLeft, BookOpen } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../contexts/AuthContext';

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
  questions: Question[];
  showAnswers?: boolean;
  endTime?: number;
  type?: 'exam' | 'homework' | 'recitation';
  durationMinutes?: number;
  lessonName?: string;
  createdAt: number;
}

export default function StudentExams({ 
  subscribedCourses, 
  activeTab = 'exams' 
}: { 
  subscribedCourses: string[]; 
  activeTab?: 'exams' | 'homework'; 
}) {
  const { user, appUser } = useAuth();
  const studentUid = user?.uid || appUser?.uid;

  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedExam, setSelectedExam] = useState<Exam | null>(null);
  const [shuffledQuestions, setShuffledQuestions] = useState<{
    originalIndex: number;
    text: string;
    imageBase64?: string;
    choices: { text: string; originalIndex: number }[];
    correctIndices: number[];
  }[]>([]);
  
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, number[]>>({});
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [submittedScore, setSubmittedScore] = useState(0);
  const [submittingResult, setSubmittingResult] = useState(false);
  const [hasCompleted, setHasCompleted] = useState<string[]>([]);

  // Timer & Pause State
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [cheatWarnings, setCheatWarnings] = useState(0);
  const [cheatNotice, setCheatNotice] = useState<string | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const secretKeyMapRef = React.useRef<Map<number, number[]>>(new Map());

  // Anti-Cheating: detect window blur or tab switching
  useEffect(() => {
    if (!selectedExam || isSubmitted) return;

    const handleVisibilityChange = () => {
      if (document.hidden && !isSubmitted) {
        setCheatWarnings(prev => {
          const next = prev + 1;
          if (next >= 3) {
            setCheatNotice('🚨 تم رصد مغادرة نافذة الامتحان 3 مرات متتالية! يتم إنهاء وتسليم الامتحان تلقائياً الآن لحماية النزاهة.');
            setTimeout(() => {
              handleSubmitAuto();
            }, 800);
          } else {
            setCheatNotice(`⚠️ تحذير أمني: يمنع مغادرة صفحة الامتحان! تم رصد محاولة خروج (${next}/3). مغادرة النافذة للمرة الثالثة ستنهي الامتحان فوراً.`);
            setTimeout(() => setCheatNotice(null), 4000);
          }
          return next;
        });
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [selectedExam, isSubmitted]);

  // Fetch completed exams for this student
  useEffect(() => {
    if (!studentUid) return;
    const q = query(collection(db, 'exam_results'), where('studentId', '==', studentUid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setHasCompleted(snapshot.docs.map(doc => doc.data().examId));
    }, (err) => {
      console.warn("Error fetching completed exams (quota or offline):", err);
    });
    return () => unsubscribe();
  }, [studentUid]);

  // Fetch exams matching subscribed courses & activeTab
  useEffect(() => {
    const q = query(collection(db, 'exams'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const allExams = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Exam[];
      
      const filtered = allExams.filter(exam => {
        // Tab filter
        if (activeTab === 'homework') {
          if (exam.type !== 'homework' && exam.type !== 'recitation') return false;
        } else {
          if (exam.type === 'homework' || exam.type === 'recitation') return false;
        }

        // Course filter
        if (exam.courseIds && exam.courseIds.length > 0) {
          return exam.courseIds.some(cid => subscribedCourses.includes(cid));
        }
        return exam.courseId && subscribedCourses.includes(exam.courseId);
      });
      
      filtered.sort((a, b) => b.createdAt - a.createdAt);
      setExams(filtered);
      try {
        localStorage.setItem(`cached_exams_${activeTab}`, JSON.stringify(filtered));
      } catch (e) {}
      setLoading(false);
    }, (err) => {
      console.warn("Error fetching exams (quota or offline):", err);
      try {
        const cached = localStorage.getItem(`cached_exams_${activeTab}`);
        if (cached) setExams(JSON.parse(cached));
      } catch (e) {}
      setLoading(false);
    });
    return () => unsubscribe();
  }, [subscribedCourses, activeTab]);

  // Timer countdown effect
  useEffect(() => {
    if (!selectedExam || isSubmitted || timeLeft === null || isPaused) return;

    if (timeLeft <= 0) {
      setCheatNotice("⏰ انتهى وقت الامتحان المحدد! تم تسليم إجاباتك تلقائياً للحفاظ على النزاهة.");
      handleSubmitAuto();
      return;
    }

    const timer = setInterval(() => {
      setTimeLeft(prev => (prev !== null && prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => clearInterval(timer);
  }, [selectedExam, isSubmitted, timeLeft, isPaused]);

  const shuffleArray = <T,>(arr: T[]): T[] => {
    const copy = [...arr];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  };

  const handleStartExam = (exam: Exam) => {
    if (hasCompleted.includes(exam.id)) {
      setCheatNotice("لقد قمت بإتمام هذا المحتوى مسبقاً.");
      setTimeout(() => setCheatNotice(null), 3500);
      return;
    }

    setCheatWarnings(0);
    setCheatNotice(null);
    secretKeyMapRef.current.clear();

    // Shuffle questions and shuffle choices for each question (Anti-Cheating Randomization)
    const randomized = shuffleArray(
      exam.questions.map((q, originalQIdx) => {
        const correctIndices = q.correctIndices || [(q as any).correctIndex || 0];
        const choicesWithOriginal = (q.choices || []).map((text, cIdx) => ({
          text,
          originalIndex: cIdx
        }));
        return {
          originalIndex: originalQIdx,
          text: q.text || '',
          imageBase64: q.imageBase64,
          choices: shuffleArray(choicesWithOriginal),
          correctIndices
        };
      })
    );

    // Save secrets in protected ref map
    randomized.forEach((q, idx) => {
      secretKeyMapRef.current.set(idx, q.correctIndices);
    });

    const sanitized = randomized.map(({ correctIndices: _, ...rest }) => rest);
    setShuffledQuestions(sanitized as any);
    setSelectedExam(exam);
    setCurrentQuestionIndex(0);
    setAnswers({});
    setIsSubmitted(false);
    setSubmittedScore(0);
    setIsPaused(false);

    if (exam.durationMinutes && exam.durationMinutes > 0) {
      setTimeLeft(exam.durationMinutes * 60);
    } else {
      setTimeLeft(null);
    }
  };

  const handleAnswer = (choiceOriginalIndex: number) => {
    if (isSubmitted || isPaused) return;
    setAnswers(prev => {
      const current = prev[currentQuestionIndex] || [];
      if (current.includes(choiceOriginalIndex)) {
        return { ...prev, [currentQuestionIndex]: current.filter(i => i !== choiceOriginalIndex) };
      }
      return { ...prev, [currentQuestionIndex]: [...current, choiceOriginalIndex] };
    });
  };

  const handleNext = () => {
    const totalQ = shuffledQuestions.length || (selectedExam ? selectedExam.questions.length : 0);
    if (selectedExam && currentQuestionIndex < totalQ - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
    }
  };

  const handlePrev = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(prev => prev - 1);
    }
  };

  const handleSubmitAuto = async () => {
    if (!selectedExam || !studentUid) return;

    // Instant calculation using protected key map - zero delay for student
    const questionsCount = shuffledQuestions.length || (selectedExam.questions?.length || 1);
    let score = 0;

    for (let idx = 0; idx < questionsCount; idx++) {
      const studentAnswers = answers[idx] || [];
      const correctAnswers = secretKeyMapRef.current.get(idx) || (selectedExam.questions[idx]?.correctIndices || []);
      if (
        studentAnswers.length === correctAnswers.length &&
        correctAnswers.every(c => studentAnswers.includes(c))
      ) {
        score++;
      }
    }

    const totalQuestions = questionsCount || 1;
    const percentage = Math.round((score / totalQuestions) * 100);

    // Instant 0ms transition - student sees score without waiting
    setSubmittedScore(score);
    setIsSubmitted(true);
    setSubmittingResult(false);
    setShowConfirmModal(false);

    // 2. Asynchronous background write to Firestore
    try {
      const resultRef = doc(collection(db, 'exam_results'));
      setDoc(resultRef, {
        studentId: studentUid,
        examId: selectedExam.id,
        examTitle: selectedExam.title,
        courseId: selectedExam.courseId || (selectedExam.courseIds && selectedExam.courseIds[0]) || '',
        score,
        total: totalQuestions,
        percentage,
        type: selectedExam.type || 'exam',
        createdAt: Date.now()
      }).catch(err => console.warn('Background result save error:', err));

      // Notifications
      const studentNotifRef = doc(collection(db, 'notifications'));
      setDoc(studentNotifRef, {
        userId: studentUid,
        title: 'نتيجة تقييم جديدة',
        message: `لقد حصلت على ${score} من ${totalQuestions} في ${selectedExam.title}`,
        read: false,
        createdAt: Date.now()
      }).catch(() => {});

      const adminNotifRef = doc(collection(db, 'notifications'));
      setDoc(adminNotifRef, {
        userId: 'admin',
        title: 'طالب أتم التقييم',
        message: `الطالب ${appUser?.name || 'غير معروف'} حصل على ${score} من ${totalQuestions} في ${selectedExam.title}`,
        read: false,
        createdAt: Date.now()
      }).catch(() => {});

      // Points System Tiers:
      let tierBonus = 0;
      if (percentage >= 95) {
        tierBonus = 200;
      } else if (percentage >= 90) {
        tierBonus = 100;
      } else if (percentage >= 85) {
        tierBonus = 50;
      }

      const pointsEarned = (score * 10) + tierBonus;
      updateDoc(doc(db, 'users', studentUid), {
        totalPoints: increment(pointsEarned)
      }).catch(err => console.warn('Background points update error:', err));

    } catch (err) {
      console.warn("Background persistence notice:", err);
    }
  };

  const handleSubmit = () => {
    if (!selectedExam || !studentUid || isSubmitted) return;
    setShowConfirmModal(true);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  if (loading) {
    return <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-indigo-600" /></div>;
  }

  if (selectedExam) {
    const questionsList = shuffledQuestions.length > 0 ? shuffledQuestions : selectedExam.questions.map((q, idx) => ({
      originalIndex: idx,
      text: q.text,
      imageBase64: q.imageBase64,
      choices: (q.choices || []).map((text, cIdx) => ({ text, originalIndex: cIdx })),
      correctIndices: q.correctIndices || [(q as any).correctIndex || 0]
    }));

    const question = questionsList[currentQuestionIndex];
    const score = isSubmitted ? submittedScore : 0;

    return (
      <div 
        className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden relative transition-colors select-none"
        onContextMenu={e => e.preventDefault()}
      >
        {/* Anti-Cheating Active Warning Banner */}
        {cheatNotice && (
          <div className="p-3 bg-rose-600 text-white font-black text-xs text-center flex items-center justify-center gap-2 animate-pulse shadow-md z-30 relative">
            <span>{cheatNotice}</span>
          </div>
        )}

        {/* Anti-Screen Recording Dynamic Watermark */}
        {!isSubmitted && (
          <div className="absolute inset-0 pointer-events-none select-none overflow-hidden opacity-5 z-10 flex items-center justify-center">
            <div className="text-2xl font-black text-slate-900 dark:text-white rotate-12 text-center leading-loose">
              {appUser?.name || user?.displayName || 'طالب المنصة'} • {appUser?.phone || appUser?.code || studentUid}<br />
              {appUser?.name || user?.displayName || 'طالب المنصة'} • {appUser?.phone || appUser?.code || studentUid}
            </div>
          </div>
        )}

        {/* Confirmation Modal */}
        <AnimatePresence>
          {showConfirmModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full p-6 text-right border border-slate-200 dark:border-slate-800 shadow-2xl space-y-4"
              >
                <div className="w-12 h-12 rounded-2xl bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-black mx-auto">
                  <CheckSquare className="w-6 h-6" />
                </div>

                <div className="text-center">
                  <h3 className="text-lg font-black text-slate-900 dark:text-white">تأكيد تسليم الامتحان</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-1">
                    أجبت على ({Object.values(answers).filter(a => Array.isArray(a) && a.length > 0).length}) من أصل ({questionsList.length}) أسئلة.
                  </p>
                </div>

                {Object.values(answers).filter(a => Array.isArray(a) && a.length > 0).length < questionsList.length && (
                  <div className="p-3 bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 rounded-2xl text-amber-800 dark:text-amber-300 text-xs font-bold text-center">
                    ⚠️ تنبيه: لم تُجب على جميع الأسئلة بعد. هل تريد التسليم الفعلي الآن؟
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowConfirmModal(false)}
                    className="p-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition-all cursor-pointer"
                  >
                    متابعة واستكمال الحل
                  </button>
                  <button
                    type="button"
                    onClick={handleSubmitAuto}
                    disabled={submittingResult}
                    className="p-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black transition-all shadow-md cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    {submittingResult ? <Loader2 className="w-4 h-4 animate-spin" /> : <span>تسليم الامتحان الآن ✓</span>}
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="bg-indigo-50 dark:bg-slate-800/80 p-6 border-b border-indigo-100 dark:border-slate-700/60 flex flex-wrap justify-between items-center gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-2xl font-black text-slate-900 dark:text-white">{selectedExam.title}</h2>
              {selectedExam.type === 'homework' && (
                <span className="bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 text-xs font-bold px-2.5 py-1 rounded-full border border-emerald-200 dark:border-emerald-800">واجب منزلي</span>
              )}
              <span className="bg-indigo-100 dark:bg-indigo-950/80 text-indigo-800 dark:text-indigo-300 text-xs font-bold px-2.5 py-1 rounded-full border border-indigo-200 dark:border-indigo-800 flex items-center gap-1">
                <span>🛡️</span>
                <span>ترتيب عشوائي للأسئلة والإجابات لمنع الغش</span>
              </span>
            </div>
            <p className="text-slate-500 dark:text-slate-400 font-medium mt-1">سؤال {currentQuestionIndex + 1} من {questionsList.length}</p>
          </div>

          <div className="flex items-center gap-3">
            {timeLeft !== null && !isSubmitted && (
              <div className={`px-4 py-2 rounded-xl font-mono font-bold text-lg flex items-center gap-2 shadow-sm ${
                timeLeft < 60 ? 'bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-800 animate-pulse' : 'bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800'
              }`}>
                <span>⏱</span>
                <span>{formatTime(timeLeft)}</span>
              </div>
            )}

            {!isSubmitted && (selectedExam.type === 'homework' || activeTab === 'homework') && (
              <button
                onClick={() => setIsPaused(!isPaused)}
                className={`px-4 py-2 rounded-xl font-bold transition-all shadow-sm flex items-center gap-2 ${
                  isPaused 
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white' 
                  : 'bg-amber-500 hover:bg-amber-600 text-white'
                }`}
              >
                {isPaused ? 'استئناف الوقت ▶️' : 'إيقاف مؤقت ⏸️'}
              </button>
            )}

            <button 
              onClick={() => setSelectedExam(null)}
              className="text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-white dark:bg-slate-800 px-4 py-2 rounded-xl font-bold shadow-sm border border-slate-200 dark:border-slate-700 transition-colors"
            >
              العودة للقائمة
            </button>
          </div>
        </div>

        {isPaused && (
          <div className="absolute inset-0 bg-slate-900/90 backdrop-blur-md z-30 flex flex-col items-center justify-center text-white p-6">
            <div className="text-6xl mb-4 animate-bounce">⏸️</div>
            <h3 className="text-3xl font-black mb-2">الواجب متوقف مؤقتاً</h3>
            <p className="text-slate-300 font-medium mb-6 text-center max-w-md">تم إيقاف عداد الوقت مؤقتاً. اضغط على "استئناف الواجب" لمواصلة الحل في أي وقت.</p>
            <button
              onClick={() => setIsPaused(false)}
              className="px-8 py-3.5 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl text-lg shadow-lg transition-all"
            >
              استئناف الواجب ▶️
            </button>
          </div>
        )}

        {isSubmitted && (
          <div className="bg-emerald-50 dark:bg-emerald-950/60 p-6 text-center border-b border-emerald-100 dark:border-emerald-800">
            <h3 className="text-xl font-bold text-emerald-700 dark:text-emerald-400 mb-2">النتيجة النهائية</h3>
            <p className="text-3xl font-black text-emerald-600 dark:text-emerald-300">{score} / {questionsList.length}</p>
          </div>
        )}

        {question && (
          <div className="p-6 md:p-8 flex flex-col items-center">
            <div className="w-full max-w-2xl bg-slate-50 dark:bg-slate-800/80 rounded-xl p-6 border border-slate-200 dark:border-slate-700 mb-8 space-y-4">
              {question.text && (
                <p className="text-xl font-medium text-slate-800 dark:text-slate-100 leading-relaxed text-right whitespace-pre-wrap">
                  {question.text}
                </p>
              )}
              {question.imageBase64 && (
                <img 
                  src={question.imageBase64} 
                  alt={`سؤال ${currentQuestionIndex + 1}`} 
                  className="w-full h-auto max-h-[400px] object-contain rounded-lg shadow-sm mx-auto bg-white p-2"
                />
              )}
            </div>

            <div className="w-full max-w-2xl grid gap-4">
              {question.choices.map((choice, idx) => {
                const currentAnswers = answers[currentQuestionIndex] || [];
                const isSelected = currentAnswers.includes(choice.originalIndex);
                const isCorrect = isSubmitted && selectedExam.showAnswers
                  ? (secretKeyMapRef.current.get(currentQuestionIndex) || []).includes(choice.originalIndex)
                  : false;
                
                let btnClass = "p-4 flex items-center justify-start text-right rounded-xl border-2 font-bold transition-all text-lg ";
                
                if (isSubmitted) {
                  if (selectedExam.showAnswers) {
                    if (isCorrect) {
                      btnClass += "bg-emerald-50 dark:bg-emerald-950/60 border-emerald-500 text-emerald-700 dark:text-emerald-300";
                    } else if (isSelected) {
                      btnClass += "bg-rose-50 dark:bg-rose-950/60 border-rose-500 text-rose-700 dark:text-rose-300";
                    } else {
                      btnClass += "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-500 opacity-50";
                    }
                  } else {
                    if (isSelected) {
                      btnClass += "bg-indigo-50 dark:bg-indigo-950/60 border-indigo-600 dark:border-indigo-500 text-indigo-700 dark:text-indigo-300";
                    } else {
                      btnClass += "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-500 opacity-50";
                    }
                  }
                } else {
                  if (isSelected) {
                    btnClass += "bg-indigo-50 dark:bg-indigo-950/60 border-indigo-600 dark:border-indigo-400 text-indigo-700 dark:text-indigo-200 shadow-sm";
                  } else {
                    btnClass += "bg-white dark:bg-slate-800/90 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-indigo-300 dark:hover:border-indigo-500 hover:bg-slate-50 dark:hover:bg-slate-800";
                  }
                }

                return (
                  <button
                    key={idx}
                    onClick={() => handleAnswer(choice.originalIndex)}
                    disabled={isSubmitted}
                    className={btnClass}
                  >
                    <div className={`w-6 h-6 rounded-md border-2 ml-4 flex items-center justify-center shrink-0 ${isSelected ? (isSubmitted && selectedExam.showAnswers ? (isCorrect ? 'bg-emerald-500 border-emerald-500 text-white' : 'bg-rose-500 border-rose-500 text-white') : 'bg-indigo-600 border-indigo-600 text-white') : 'border-slate-300 dark:border-slate-600'}`}>
                      {isSelected && <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                    </div>
                    <span>{choice.text}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="p-6 bg-slate-50 dark:bg-slate-850 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex justify-between items-center">
          <button
            onClick={handlePrev}
            disabled={currentQuestionIndex === 0}
            className="flex items-center gap-2 px-6 py-3 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-750 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronRight className="w-5 h-5" />
            السابق
          </button>

          {currentQuestionIndex === questionsList.length - 1 ? (
            <button
              onClick={handleSubmit}
              disabled={isSubmitted || submittingResult}
              className="px-8 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold rounded-xl shadow-md transition-all cursor-pointer"
            >
              {submittingResult ? 'جاري التسليم...' : 'إنهاء الامتحان'}
            </button>
          ) : (
            <button
              onClick={handleNext}
              className="flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-md transition-all"
            >
              التالي
              <ChevronLeft className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
        {exams.length === 0 ? (
          <div className="p-12 text-center text-slate-500 dark:text-slate-400 font-medium">
            {activeTab === 'homework' ? 'لا توجد واجبات منزلية متاحة حالياً.' : 'لا توجد امتحانات متاحة حالياً.'}
          </div>
        ) : (
          <div className="p-6">
            {/* Items without lesson */}
            {exams.filter(e => !e.lessonName).length > 0 && (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                {exams.filter(e => !e.lessonName).map((exam) => (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    key={exam.id}
                    className="group bg-slate-50 dark:bg-slate-800/70 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden hover:shadow-xl transition-all hover:border-indigo-200 dark:hover:border-indigo-500/50 flex flex-col"
                  >
                    <div className={`h-32 flex items-center justify-center relative ${exam.type === 'homework' ? 'bg-emerald-600' : 'bg-amber-500'}`}>
                      <CheckSquare className="w-12 h-12 text-white/50 group-hover:text-white transition-colors group-hover:scale-110 duration-300" />
                    </div>
                    <div className="p-5 flex-1 flex flex-col justify-between">
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="font-bold text-slate-900 dark:text-white text-lg line-clamp-2">{exam.title}</h3>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mb-2 flex flex-wrap gap-2 items-center">
                          <span>{exam.questions.length} أسئلة</span>
                          {exam.durationMinutes ? <span>• ⏱ {exam.durationMinutes} دقيقة</span> : null}
                          <span>• {new Date(exam.createdAt).toLocaleDateString('ar-EG')}</span>
                        </p>
                        {exam.endTime && (
                          <p className={`text-xs font-bold mb-4 ${exam.endTime < Date.now() ? 'text-rose-600 dark:text-rose-400' : 'text-amber-600 dark:text-amber-400'}`}>
                            {exam.endTime < Date.now() ? 'مغلق' : 'ينتهي:'} {new Date(exam.endTime).toLocaleString('ar-EG')}
                          </p>
                        )}
                      </div>
                      {hasCompleted.includes(exam.id) ? (
                        <button
                          disabled
                          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold transition-all bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 opacity-90"
                        >
                          تم الإنجاز ✓
                        </button>
                      ) : exam.endTime && exam.endTime < Date.now() ? (
                        <button
                          disabled
                          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold transition-all bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 opacity-80 cursor-not-allowed"
                        >
                          انتهى الوقت
                        </button>
                      ) : (
                        <button
                          onClick={() => handleStartExam(exam)}
                          className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold transition-all ${
                            exam.type === 'homework' 
                            ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-600 hover:text-white dark:hover:bg-emerald-600 dark:hover:text-white' 
                            : 'bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-600 hover:text-white dark:hover:bg-indigo-600 dark:hover:text-white'
                          }`}
                        >
                          {exam.type === 'homework' ? 'ابدأ حل الواجب 🏠' : 'ابدأ الامتحان 📝'}
                        </button>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>
            )}

            {/* Items grouped by lesson */}
            {Array.from(new Set(exams.filter(e => e.lessonName).map(e => e.lessonName))).map(lesson => (
              <div key={lesson} className="mb-10 last:mb-0">
                <h2 className="text-xl font-black text-slate-800 dark:text-white mb-4 pb-2 border-b-2 border-slate-100 dark:border-slate-800 flex items-center gap-2">
                  <BookOpen className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
                  {lesson}
                </h2>
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {exams.filter(e => e.lessonName === lesson).map((exam) => (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      key={exam.id}
                      className="group bg-white dark:bg-slate-800/70 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden hover:shadow-xl transition-all hover:border-indigo-200 dark:hover:border-indigo-500/50 flex flex-col"
                    >
                      <div className={`h-32 flex items-center justify-center relative ${exam.type === 'homework' ? 'bg-emerald-600' : 'bg-amber-500'}`}>
                        <CheckSquare className="w-12 h-12 text-white/50 group-hover:text-white transition-colors group-hover:scale-110 duration-300" />
                      </div>
                      <div className="p-5 flex-1 flex flex-col justify-between">
                        <div>
                          <h3 className="font-bold text-slate-900 dark:text-white text-lg mb-2 line-clamp-2">{exam.title}</h3>
                          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mb-2 flex flex-wrap gap-2 items-center">
                            <span>{exam.questions.length} أسئلة</span>
                            {exam.durationMinutes ? <span>• ⏱ {exam.durationMinutes} دقيقة</span> : null}
                            <span>• {new Date(exam.createdAt).toLocaleDateString('ar-EG')}</span>
                          </p>
                          {exam.endTime && (
                            <p className={`text-xs font-bold mb-4 ${exam.endTime < Date.now() ? 'text-rose-600 dark:text-rose-400' : 'text-amber-600 dark:text-amber-400'}`}>
                              {exam.endTime < Date.now() ? 'مغلق' : 'ينتهي:'} {new Date(exam.endTime).toLocaleString('ar-EG')}
                            </p>
                          )}
                        </div>
                        {hasCompleted.includes(exam.id) ? (
                          <button
                            disabled
                            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold transition-all bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 opacity-90"
                          >
                            تم الإنجاز ✓
                          </button>
                        ) : exam.endTime && exam.endTime < Date.now() ? (
                          <button
                            disabled
                            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold transition-all bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 opacity-80 cursor-not-allowed"
                          >
                            انتهى الوقت
                          </button>
                        ) : (
                          <button
                            onClick={() => handleStartExam(exam)}
                            className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold transition-all ${
                              exam.type === 'homework' 
                              ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-600 hover:text-white dark:hover:bg-emerald-600 dark:hover:text-white' 
                              : 'bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-600 hover:text-white dark:hover:bg-indigo-600 dark:hover:text-white'
                            }`}
                          >
                            {exam.type === 'homework' ? 'ابدأ حل الواجب 🏠' : 'ابدأ الامتحان 📝'}
                          </button>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
