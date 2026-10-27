import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../lib/firebase';
import { collection, doc, setDoc, query, getDocs, where } from 'firebase/firestore';
import { motion } from 'motion/react';
import { Upload, CreditCard, CheckCircle, AlertCircle, Loader2, LogIn, Image as ImageIcon, Smartphone, Wallet, Copy, Check, GraduationCap } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { useSettings } from '../contexts/SettingsContext';

interface Course {
  id: string;
  name: string;
  price: number;
  grade?: string;
  coverImageBase64?: string;
}

export default function Payment() {
  const { user, appUser } = useAuth();
  const { settings } = useSettings();
  const [searchParams] = useSearchParams();
  const requestedCourseId = searchParams.get('courseId');

  const [courses, setCourses] = useState<Course[]>([]);
  const [courseName, setCourseName] = useState('');
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'instapay' | 'wallet'>('instapay');
  const [transferNumber, setTransferNumber] = useState('');
  const [receiptBase64, setReceiptBase64] = useState('');
  const [loading, setLoading] = useState(false);
  const [fetchingCourses, setFetchingCourses] = useState(true);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const [courseId, setCourseId] = useState('');
  const [userSubscribedCourseIds, setUserSubscribedCourseIds] = useState<string[]>([]);

  useEffect(() => {
    const fetchCoursesAndSubs = async () => {
      try {
        const q = query(collection(db, 'courses'));
        const snapshot = await getDocs(q);
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Course[];
        
        // Strictly filter by student's grade if user is a student with a registered grade
        let filteredCourses = data;
        const isStudent = appUser?.role === 'student' && Boolean(appUser?.grade);
        if (isStudent && appUser?.grade) {
          filteredCourses = data.filter((c: any) => c.grade === appUser.grade);
        }
        setCourses(filteredCourses);

        // Fetch user subscriptions
        const targetUid = user?.uid || appUser?.uid;
        if (targetUid) {
          const paymentsQ = query(
            collection(db, 'payments'),
            where('userId', '==', targetUid)
          );
          const paymentsSnap = await getDocs(paymentsQ);
          const approved = paymentsSnap.docs
            .map(d => d.data())
            .filter(d => d.status === 'approved' || d.status === 'pending')
            .map(d => d.courseId);
          setUserSubscribedCourseIds(approved);

          // If URL provided a courseId, verify it belongs to user's grade
          if (requestedCourseId) {
            const requestedCourse = filteredCourses.find(c => c.id === requestedCourseId);
            if (requestedCourse) {
              setCourseId(requestedCourse.id);
              setCourseName(requestedCourse.name);
              setAmount(requestedCourse.price.toString());
              return;
            }
          }

          // Select first unsubscribed course
          const firstUnsub = filteredCourses.find(c => !approved.includes(c.id));
          if (firstUnsub) {
            setCourseId(firstUnsub.id);
            setCourseName(firstUnsub.name);
            setAmount(firstUnsub.price.toString());
          } else if (filteredCourses.length > 0) {
            setCourseId(filteredCourses[0].id);
            setCourseName(filteredCourses[0].name);
            setAmount(filteredCourses[0].price.toString());
          }
        } else if (filteredCourses.length > 0) {
          if (requestedCourseId) {
            const requestedCourse = filteredCourses.find(c => c.id === requestedCourseId);
            if (requestedCourse) {
              setCourseId(requestedCourse.id);
              setCourseName(requestedCourse.name);
              setAmount(requestedCourse.price.toString());
              return;
            }
          }
          setCourseId(filteredCourses[0].id);
          setCourseName(filteredCourses[0].name);
          setAmount(filteredCourses[0].price.toString());
        }
      } catch (err) {
        console.warn("Error fetching courses or subs:", err);
      } finally {
        setFetchingCourses(false);
      }
    };
    fetchCoursesAndSubs();
  }, [user, appUser, requestedCourseId]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      setError('حجم الصورة كبير جداً. الحد الأقصى هو 10 ميجابايت.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        
        // Max dimension
        const MAX_DIM = 600;
        if (width > height && width > MAX_DIM) {
          height *= MAX_DIM / width;
          width = MAX_DIM;
        } else if (height > MAX_DIM) {
          width *= MAX_DIM / height;
          height = MAX_DIM;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        
        // Compress
        const compressedBase64 = canvas.toDataURL('image/jpeg', 0.6);
        setReceiptBase64(compressedBase64);
        setError('');
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user && !appUser) return;
    if (!courseName || !amount || !receiptBase64 || !paymentMethod || !transferNumber.trim()) {
      setError('يرجى تعبئة جميع الحقول وإرفاق صورة التحويل بالإضافة إلى رقم التحويل.');
      return;
    }

    setLoading(true);
    setError('');
    
    const targetUid = user?.uid || appUser?.uid;

    try {
      const q = query(
        collection(db, 'payments'),
        where('userId', '==', targetUid),
        where('courseId', '==', courseId)
      );
      const querySnapshot = await getDocs(q);
      let alreadyHasValidPayment = false;
      querySnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        if (data.status === 'pending' || data.status === 'approved') {
          alreadyHasValidPayment = true;
        }
      });

      if (alreadyHasValidPayment) {
        setError('لقد قمت بطلب اشتراك في هذا الكورس مسبقاً (معلق أو مقبول).');
        setLoading(false);
        return;
      }

      const paymentRef = doc(collection(db, 'payments'));
      await setDoc(paymentRef, {
        userId: targetUid,
        userEmail: user?.email || '',
        userName: appUser?.name || '',
        courseId,
        courseName,
        amount: Number(amount),
        paymentMethod,
        transferNumber: transferNumber.trim(),
        receiptBase64,
        status: 'pending',
        createdAt: Date.now(),
      });
      setSuccess(true);
    } catch (err: any) {
      console.error("Payment error:", err);
      setError('حدث خطأ أثناء رفع البيانات. يرجى المحاولة مرة أخرى.');
    } finally {
      setLoading(false);
    }
  };

  if (!user && !appUser) {
    return (
      <div className="flex-grow flex items-center justify-center p-4">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-md w-full bg-white rounded-2xl p-8 text-center shadow-xl border border-slate-100">
          <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center mx-auto mb-6">
            <CreditCard className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-black text-slate-900 mb-3">تسجيل الدخول مطلوب</h2>
          <p className="text-slate-600 mb-8 font-medium">يرجى تسجيل الدخول بحسابك لتتمكن من رفع إيصال الدفع والاشتراك في الكورسات.</p>
          <Link to="/login" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3.5 px-4 rounded-xl flex items-center justify-center gap-2 transition-all">
            <LogIn className="w-5 h-5" /> تسجيل الدخول
          </Link>
        </motion.div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="flex-grow flex items-center justify-center p-4">
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="max-w-md w-full bg-white dark:bg-slate-800 rounded-3xl p-8 text-center shadow-xl border border-slate-100 dark:border-slate-700">
          <div className="w-20 h-20 bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-10 h-10" />
          </div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-3">تم استلام طلبك بنجاح!</h2>
          <p className="text-slate-600 dark:text-slate-300 mb-8 font-medium leading-relaxed">
            لقد تم رفع إثبات التحويل بنجاح. سيقوم الأستاذ أو المساعدين بمراجعة التحويل وتفعيل اشتراكك في أسرع وقت ممكن.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link to="/dashboard" className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3.5 px-6 rounded-xl transition-all shadow-md">
              لوحة الطالب 🎓
            </Link>
            <Link to="/" className="bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-white font-bold py-3.5 px-6 rounded-xl transition-all">
              العودة للرئيسية
            </Link>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="flex-grow py-12 px-4 bg-slate-50 dark:bg-[#070b14] transition-colors">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-10">
          <h1 className="text-3xl md:text-4xl font-black text-slate-900 dark:text-white mb-4">تأكيد الدفع والاشتراك</h1>
          <p className="text-slate-600 dark:text-slate-400 font-medium max-w-xl mx-auto">
            قم بتحويل المبلغ المطلوب عبر إنستا باي أو محفظة إلكترونية ثم ارفع صورة شاشة التحويل (Screen Shot) هنا.
          </p>
        </div>

        <motion.form 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          onSubmit={handleSubmit} 
          className="bg-white dark:bg-slate-900 p-6 md:p-8 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800"
        >
          {error && (
            <div className="mb-6 p-4 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 rounded-xl flex items-start gap-3">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <span className="font-semibold">{error}</span>
            </div>
          )}

          {fetchingCourses ? (
            <div className="flex justify-center p-8"><Loader2 className="w-8 h-8 animate-spin text-indigo-600" /></div>
          ) : courses.length === 0 ? (
            <div className="text-center p-8 text-slate-600 dark:text-slate-300 font-bold bg-amber-50 dark:bg-amber-950/40 rounded-2xl border border-amber-200 dark:border-amber-800 space-y-2">
              <p className="text-amber-900 dark:text-amber-300">
                {appUser?.role === 'student' && appUser.grade 
                  ? `لا توجد كورسات متاحة للاشتراك في صفك الدراسي (${appUser.grade}) حالياً.`
                  : 'لا توجد كورسات متاحة حالياً للاشتراك.'}
              </p>
              <p className="text-xs text-amber-700 dark:text-amber-400 font-normal">
                يرجى التواصل مع المدرس أو الدعم الفني لمزيد من التفاصيل حول بدء كورسات هذا الصف.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <label className="block text-slate-700 dark:text-slate-300 font-bold">اختر الكورس المطلوب</label>
                  {appUser?.role === 'student' && appUser.grade && (
                    <span className="text-xs bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 px-3 py-1 rounded-full font-bold">
                      مخصص لـ: {appUser.grade} 🎓
                    </span>
                  )}
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  {courses.map(c => {
                    const isSubscribed = userSubscribedCourseIds.includes(c.id);
                    return (
                      <div 
                        key={c.id} 
                        onClick={() => {
                          if (isSubscribed) {
                            alert('أنت مشترك بالفعل أو أن طلب اشتراكك قيد المراجعة بهذا الكورس.');
                            return;
                          }
                          setCourseId(c.id);
                          setCourseName(c.name);
                          setAmount(c.price.toString());
                        }}
                        className={`cursor-pointer border-2 rounded-2xl overflow-hidden transition-all group relative ${
                          isSubscribed 
                          ? 'border-emerald-300 dark:border-emerald-700 bg-emerald-50/50 dark:bg-emerald-950/30 opacity-80' 
                          : courseId === c.id 
                          ? 'border-indigo-600 shadow-md ring-4 ring-indigo-50 dark:ring-indigo-950/50' 
                          : 'border-slate-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-500'
                        }`}
                      >
                        {/* SQUARE / HIGH ASPECT THUMBNAIL */}
                        <div className="aspect-[16/10] bg-slate-100 dark:bg-slate-800 relative overflow-hidden">
                          {c.coverImageBase64 ? (
                            <img src={c.coverImageBase64} alt={c.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-indigo-50 dark:bg-indigo-950/40">
                              <ImageIcon className="w-10 h-10 text-indigo-200 dark:text-indigo-700" />
                            </div>
                          )}
                          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
                          {isSubscribed && (
                            <div className="absolute top-3 right-3 bg-emerald-600 text-white font-bold text-xs px-3 py-1 rounded-full shadow">
                              أنت مشترك بالفعل ✨
                            </div>
                          )}
                          {c.grade && (
                            <div className="absolute bottom-2 right-2 bg-black/60 backdrop-blur-sm text-white text-[10px] font-bold px-2 py-0.5 rounded">
                              {c.grade}
                            </div>
                          )}
                        </div>
                        <div className="p-4 bg-white dark:bg-slate-800/90 relative">
                          <div className="flex justify-between items-center mb-1">
                            <h3 className="font-bold text-slate-900 dark:text-white line-clamp-1">{c.name}</h3>
                            {Number(c.price) === 0 || (c as any).isFree ? (
                              <span className="font-black text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 px-2 py-0.5 rounded-lg text-xs whitespace-nowrap mr-2">
                                🎁 مجاني
                              </span>
                            ) : (
                              <span className="font-black text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-100 dark:border-indigo-800/60 px-2 py-1 rounded-lg text-sm whitespace-nowrap mr-2">
                                {c.price} ج.م
                              </span>
                            )}
                          </div>
                          {courseId === c.id && !isSubscribed && (
                            <div className="absolute -top-3 left-3 bg-indigo-600 text-white rounded-full p-1 shadow-sm">
                              <CheckCircle className="w-4 h-4" />
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* IF SELECTED COURSE IS FREE: DO NOT SHOW PAYMENT TRANSFER FORM */}
              {(() => {
                const selectedCourse = courses.find(c => c.id === courseId);
                const isFree = selectedCourse && (Number(selectedCourse.price) === 0 || (selectedCourse as any).isFree);
                if (isFree) {
                  return (
                    <div className="bg-gradient-to-br from-emerald-50 to-teal-50 border-2 border-emerald-300 p-8 rounded-3xl text-center space-y-4 shadow-sm">
                      <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto shadow-sm">
                        <CheckCircle className="w-8 h-8" />
                      </div>
                      <h3 className="text-xl font-black text-emerald-950">كورس مجاني 100%! لا حاجة للدفع أو رفع إيصالات</h3>
                      <p className="text-emerald-800 font-bold text-sm max-w-lg mx-auto leading-relaxed">
                        هذا الكورس متاح مجاناً لجميع طلاب المنصة. تم تفعيله تلقائياً لحسابك ويمكنك البدء في مشاهدة المحاضرات وحل الامتحانات فوراً!
                      </p>
                      <Link
                        to={`/dashboard?course=${selectedCourse.id}`}
                        className="inline-flex bg-emerald-600 hover:bg-emerald-700 text-white font-black px-8 py-4 rounded-2xl shadow-lg shadow-emerald-600/30 transition-all items-center gap-2 cursor-pointer text-base"
                      >
                        <span>الانتقال لمحتوى الكورس الآن في لوحة الطالب 🚀</span>
                      </Link>
                    </div>
                  );
                }
                return null;
              })()}

              {/* PAYMENT DETAILS (Hidden if course is free) */}
              {!(courses.find(c => c.id === courseId) && (Number(courses.find(c => c.id === courseId)?.price) === 0 || (courses.find(c => c.id === courseId) as any)?.isFree)) && (
                <>
                  <div>
                    <label className="block text-slate-700 dark:text-slate-300 font-bold mb-3">طريقة التحويل</label>
                <div className="grid grid-cols-2 gap-4">
                  <label className={`cursor-pointer border-2 rounded-xl p-4 flex flex-col items-center gap-2 transition-all ${paymentMethod === 'instapay' ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300' : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:border-indigo-300 dark:hover:border-indigo-500'}`}>
                    <input 
                      type="radio" 
                      name="paymentMethod" 
                      value="instapay" 
                      checked={paymentMethod === 'instapay'}
                      onChange={() => setPaymentMethod('instapay')}
                      className="hidden"
                    />
                    <Smartphone className="w-6 h-6" />
                    <span className="font-bold">إنستا باي (InstaPay)</span>
                  </label>
                  
                  <label className={`cursor-pointer border-2 rounded-xl p-4 flex flex-col items-center gap-2 transition-all ${paymentMethod === 'wallet' ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300' : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:border-indigo-300 dark:hover:border-indigo-500'}`}>
                    <input 
                      type="radio" 
                      name="paymentMethod" 
                      value="wallet" 
                      checked={paymentMethod === 'wallet'}
                      onChange={() => setPaymentMethod('wallet')}
                      className="hidden"
                    />
                    <Wallet className="w-6 h-6" />
                    <span className="font-bold">محفظة إلكترونية</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-bold mb-2">رقم التحويل (الرقم أو الحساب الذي حولت منه)</label>
                <input 
                  type="text" 
                  value={transferNumber}
                  onChange={(e) => setTransferNumber(e.target.value)}
                  placeholder="أدخل رقم الموبايل أو يوزر إنستا باي الذي قمت بالتحويل منه"
                  className="w-full p-3.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 rounded-xl font-medium focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all outline-none"
                  dir="rtl"
                />
              </div>

              <div className="bg-indigo-50/80 dark:bg-slate-800/80 p-5 rounded-2xl border border-indigo-100 dark:border-slate-700 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-indigo-950 dark:text-indigo-300 font-black text-sm flex items-center gap-2">
                    <span>بيانات التحويل الخاصة بالمنصة:</span>
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      const textToCopy = paymentMethod === 'instapay' 
                        ? (settings.paymentInstapayUsername || 'saber@instapay') 
                        : (settings.paymentWalletNumber || '01012345678');
                      navigator.clipboard?.writeText(textToCopy);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1 bg-white dark:bg-slate-700 hover:bg-indigo-50 dark:hover:bg-slate-600 text-indigo-700 dark:text-indigo-200 text-xs font-bold rounded-lg border border-indigo-200 dark:border-slate-600 transition-colors shadow-sm"
                  >
                    {copied ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        <span className="text-emerald-700 dark:text-emerald-400">تم النسخ بنجاح!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                        <span>نسخ الرقم</span>
                      </>
                    )}
                  </button>
                </div>

                <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-indigo-100 dark:border-slate-700 flex items-center justify-between">
                  <div>
                    <span className="text-xs text-slate-500 dark:text-slate-400 font-bold block mb-0.5">
                      {paymentMethod === 'instapay' ? 'عنوان أو معرف إنستا باي:' : 'رقم محفظة التحويل (كاش):'}
                    </span>
                    <span className="text-base font-black text-indigo-900 dark:text-indigo-300 font-mono" dir="ltr">
                      {paymentMethod === 'instapay' 
                        ? (settings.paymentInstapayUsername || 'saber@instapay') 
                        : (settings.paymentWalletNumber || '01012345678')}
                    </span>
                  </div>
                  <span className="text-xs bg-indigo-100 dark:bg-indigo-950/80 text-indigo-800 dark:text-indigo-300 font-bold px-2.5 py-1 rounded-md border border-indigo-200 dark:border-indigo-800">
                    {paymentMethod === 'instapay' ? 'InstaPay' : 'Cash Wallet'}
                  </span>
                </div>

                {settings.paymentInstructions ? (
                  <p className="text-indigo-900 dark:text-indigo-300 text-xs leading-relaxed font-medium bg-indigo-100/50 dark:bg-slate-900/60 p-2.5 rounded-lg border border-indigo-100 dark:border-slate-700">
                    💡 <strong>تنبيه:</strong> {settings.paymentInstructions}
                  </p>
                ) : (
                  <p className="text-indigo-800 dark:text-indigo-300 text-xs leading-relaxed font-medium">
                    💡 يرجى التحويل ثم كتابة رقم أو حساب المحول منه ورفع صورة إشعار التحويل لتفعيل اشتراكك في الكورس فوراً.
                  </p>
                )}
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-bold mb-2">صورة إثبات التحويل (Screenshot)</label>
                <div className="relative group border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-indigo-500 dark:hover:border-indigo-500 rounded-2xl p-8 text-center transition-all bg-slate-50 dark:bg-slate-800/50">
                  <input 
                    type="file" 
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                  />
                  
                  {receiptBase64 ? (
                    <div className="flex flex-col items-center">
                      <img src={receiptBase64} alt="Receipt preview" className="w-full max-w-[200px] h-auto rounded-xl shadow-sm mb-4 border border-slate-200 dark:border-slate-700" />
                      <span className="text-indigo-600 dark:text-indigo-400 font-bold text-sm bg-indigo-50 dark:bg-indigo-950/80 px-4 py-1.5 rounded-full border border-indigo-100 dark:border-indigo-800">
                        تم اختيار الصورة. انقر للتغيير.
                      </span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-12 h-12 bg-indigo-100 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400 rounded-full flex items-center justify-center border border-indigo-200 dark:border-indigo-800">
                        <ImageIcon className="w-6 h-6" />
                      </div>
                      <div>
                        <p className="font-bold text-slate-700 dark:text-slate-200 text-lg">اضغط هنا أو اسحب الصورة</p>
                        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">صيغ مدعومة: JPG, PNG (بحد أقصى 1MB)</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <button 
                type="submit" 
                disabled={loading}
                className="w-full mt-4 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-bold text-lg py-4 px-6 rounded-xl flex items-center justify-center gap-3 shadow-lg shadow-indigo-200 transition-all"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-6 h-6 animate-spin" /> جاري الإرسال...
                  </>
                ) : (
                  <>
                    <Upload className="w-6 h-6" /> إرسال طلب الاشتراك
                  </>
                )}
              </button>
            </>
          )}
        </div>
      )}
        </motion.form>
      </div>
    </div>
  );
}
