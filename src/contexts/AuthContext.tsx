import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { auth, db } from '../lib/firebase';
import { onAuthStateChanged, User, signInWithPopup, GoogleAuthProvider, signOut as firebaseSignOut, createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile, sendPasswordResetEmail, signInWithPhoneNumber, ConfirmationResult, updatePassword, RecaptchaVerifier, fetchSignInMethodsForEmail } from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, onSnapshot, query as fsQuery, collection as fsColl, where as fsWhere, getDocs as fsGetDocs } from 'firebase/firestore';

export interface AppUser {
  uid: string;
  email: string;
  name: string;
  phone: string;
  parentPhone: string;
  role: 'student' | 'assistant' | 'admin';
  createdAt: number;
  banned?: boolean;
  code?: string;
  password?: string;
  grade?: string;
  isCenterStudent?: boolean;
  registrationMethod?: 'google' | 'email' | 'center' | 'phone';
  allowedCourseIds?: string[];
  totalPoints?: number;
  centerPoints?: number;
  centerGroup?: string; // e.g. "سبت وثلاثاء", "أحد وأربعاء", "إثنين وخميس"
  attendanceCount?: number;
  absentCount?: number;
  currentSessionId?: string;
  lastLoginAt?: number;
  cardPrinted?: boolean;
  cardPrintedAt?: number;
  promoCode?: string;
  cardQrCode?: string;
  externalCardCode?: string;
  cardBoundAt?: number;
  cardBoundMethod?: string;
}

interface AuthContextType {
  user: User | null;
  appUser: AppUser | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  registerWithEmail: (email: string, pass: string, name: string, phone: string, parentPhone: string, grade?: string) => Promise<void>;
  registerUser: (details: { name: string; phone: string; parentPhone: string; grade: string; pass: string; email?: string }) => Promise<void>;
  loginWithEmail: (email: string, pass: string) => Promise<void>;
  loginWithCode: (code: string, pass: string) => Promise<void>;
  loginWithPhone: (phone: string, pass: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  sendPhoneResetOtp: (rawPhone: string, recaptchaVerifier: RecaptchaVerifier) => Promise<ConfirmationResult>;
  confirmPhoneResetOtp: (confirmationResult: ConfirmationResult, otpCode: string, newPass: string, rawPhone: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [appUser, setAppUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  // Establish unique device session for single-device login enforcement
  const establishDeviceSession = async (uid: string) => {
    const token = `dev_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    localStorage.setItem('app_device_session_token', token);
    try {
      await updateDoc(doc(db, 'users', uid), {
        currentSessionId: token,
        lastLoginAt: Date.now()
      });
    } catch (e) {
      console.warn("Could not sync currentSessionId:", e);
    }
    return token;
  };

  // Check center student local session on mount
  useEffect(() => {
    const storedCenterUser = localStorage.getItem('center_student_user');
    if (storedCenterUser) {
      try {
        const parsed = JSON.parse(storedCenterUser);
        setAppUser(parsed);
      } catch (e) {
        localStorage.removeItem('center_student_user');
      }
    }
  }, []);

  // Real-time listener for current logged-in user profile changes (e.g. course permissions & single device enforcement)
  useEffect(() => {
    if (!appUser?.uid) return;
    const unsub = onSnapshot(doc(db, 'users', appUser.uid), async (docSnap) => {
      if (docSnap.exists()) {
        const liveData = { uid: docSnap.id, ...docSnap.data() } as AppUser;

        // Single-Device Enforcement (إنهاء الجلسة إذا سجل الحساب من جهاز آخر)
        const localSessionToken = localStorage.getItem('app_device_session_token');
        if (liveData.currentSessionId && localSessionToken && liveData.currentSessionId !== localSessionToken) {
          console.warn("Terminating session: account logged in from another device.");
          localStorage.removeItem('app_device_session_token');
          localStorage.removeItem('center_student_user');
          try {
            await firebaseSignOut(auth);
          } catch (e) {}
          setUser(null);
          setAppUser(null);
          alert('⚠️ تم إنهاء الجلسة وتسجيل الخروج تلقائياً!\nتم تسجيل الدخول إلى هذا الحساب من جهاز آخر (هاتف أو تابلت آخر). النظام يسمح بجهاز واحد متصل في نفس الوقت.');
          window.location.href = '/login';
          return;
        }

        setAppUser(prev => ({ ...prev, ...liveData }));
        if (localStorage.getItem('center_student_user')) {
          localStorage.setItem('center_student_user', JSON.stringify(liveData));
        }
      }
    }, (err) => {
      console.warn("Realtime user sync error:", err);
    });
    return () => unsub();
  }, [appUser?.uid]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        // Clear any center student local session if real firebase user logs in
        localStorage.removeItem('center_student_user');
        try {
          const userDocRef = doc(db, 'users', firebaseUser.uid);
          const userDoc = await getDoc(userDocRef);
          
          if (userDoc.exists()) {
            const data = userDoc.data() as AppUser;
            if (data.banned) {
              await firebaseSignOut(auth);
              setUser(null);
              setAppUser(null);
              alert('عذراً، تم حظر هذا الحساب من قبل الإدارة.');
            } else {
              setUser(firebaseUser);
              setAppUser(data);
              establishDeviceSession(firebaseUser.uid);
              try {
                localStorage.setItem(`cached_user_${firebaseUser.uid}`, JSON.stringify(data));
              } catch (e) {}
            }
          } else {
            const role = firebaseUser.email === 'adam.albalshi.4@gmail.com' ? 'admin' : 'student';
            const devToken = `dev_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
            localStorage.setItem('app_device_session_token', devToken);
            const newUser: AppUser = {
              uid: firebaseUser.uid,
              email: firebaseUser.email || '',
              name: firebaseUser.displayName || 'مستخدم جديد',
              phone: '',
              parentPhone: '',
              role,
              registrationMethod: 'google',
              currentSessionId: devToken,
              lastLoginAt: Date.now(),
              createdAt: Date.now()
            };
            try {
              await setDoc(userDocRef, newUser);
            } catch (e) {
              console.warn("Could not save new user doc:", e);
            }
            setUser(firebaseUser);
            setAppUser(newUser);
            try {
              localStorage.setItem(`cached_user_${firebaseUser.uid}`, JSON.stringify(newUser));
            } catch (e) {}
          }
        } catch (error) {
          console.warn("Using offline/cached profile:", error);
          setUser(firebaseUser);
          establishDeviceSession(firebaseUser.uid);
          
          let cached: AppUser | null = null;
          try {
            const str = localStorage.getItem(`cached_user_${firebaseUser.uid}`);
            if (str) cached = JSON.parse(str);
          } catch (e) {}

          if (cached) {
            setAppUser(cached);
          } else {
            const fallbackUser: AppUser = {
              uid: firebaseUser.uid,
              email: firebaseUser.email || '',
              name: firebaseUser.displayName || 'طالب المنصة',
              phone: '',
              parentPhone: '',
              grade: 'الصف الثالث الثانوي',
              role: firebaseUser.email === 'adam.albalshi.4@gmail.com' ? 'admin' : 'student',
              registrationMethod: 'google',
              createdAt: Date.now()
            };
            setAppUser(fallbackUser);
          }
        }
      } else {
        setUser(null);
        if (!localStorage.getItem('center_student_user')) {
          setAppUser(null);
        }
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const registerWithEmail = async (email: string, pass: string, name: string, phone: string, parentPhone: string, grade?: string) => {
    return registerUser({ name, phone, parentPhone, grade: grade || 'الصف الثالث الثانوي', pass, email });
  };

  const registerUser = async (details: { name: string; phone: string; parentPhone: string; grade: string; pass: string; email?: string }) => {
    localStorage.removeItem('center_student_user');
    const cleanPhone = details.phone
      .replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString())
      .replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d).toString())
      .trim()
      .replace(/[\s\-\(\)\+]/g, '');
    const cleanParentPhone = details.parentPhone
      .replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString())
      .replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d).toString())
      .trim()
      .replace(/[\s\-\(\)\+]/g, '');
    const cleanPass = details.pass.trim();
    const finalEmail = (details.email && details.email.trim()) ? details.email.trim().toLowerCase() : `${cleanPhone}@student.com`;

    // 1. Check if phone already registered in users collection
    try {
      const checkPhoneQuery = fsQuery(fsColl(db, 'users'), fsWhere('phone', '==', cleanPhone));
      const phoneSnap = await fsGetDocs(checkPhoneQuery);
      if (!phoneSnap.empty) {
        throw new Error('رقم الهاتف هذا مسجل بالفعل. يرجى تسجيل الدخول مباشرة.');
      }
      const directStudent = await getDoc(doc(db, 'users', `student_${cleanPhone}`));
      if (directStudent.exists()) {
        throw new Error('رقم الهاتف هذا مسجل بالفعل. يرجى تسجيل الدخول مباشرة.');
      }
    } catch (e: any) {
      if (e.message && e.message.includes('مسجل بالفعل')) {
        throw e;
      }
      console.warn("Could not check existing phone:", e);
    }

    let uid = `student_${cleanPhone}`;
    let firebaseUserObj: User | null = null;

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, finalEmail, cleanPass);
      await updateProfile(userCredential.user, { displayName: details.name.trim() });
      uid = userCredential.user.uid;
      firebaseUserObj = userCredential.user;
    } catch (e: any) {
      console.warn("Firebase Auth creation fallback (normal):", e?.code || e?.message);
    }

    const role = (finalEmail === 'adam.albalshi.4@gmail.com') ? 'admin' : 'student';
    const newUser: AppUser = {
      uid,
      email: finalEmail,
      name: details.name.trim(),
      phone: cleanPhone,
      parentPhone: cleanParentPhone,
      grade: details.grade || 'الصف الثالث الثانوي',
      password: cleanPass,
      code: cleanPhone,
      role,
      registrationMethod: details.email ? 'email' : 'phone',
      totalPoints: 0,
      centerPoints: 0,
      allowedCourseIds: [],
      createdAt: Date.now()
    };

    // Save to Firestore with backend fallback
    try {
      await setDoc(doc(db, 'users', uid), newUser);
    } catch (fsErr: any) {
      console.warn("Client setDoc failed, trying server API fallback:", fsErr?.message || fsErr);
      try {
        const resp = await fetch('/api/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: details.name.trim(),
            phone: cleanPhone,
            parentPhone: cleanParentPhone,
            grade: details.grade,
            pass: cleanPass,
            email: details.email
          })
        });
        const resData = await resp.json();
        if (!resData.success) {
          throw new Error(resData.error || 'تعذر حفظ بيانات الحساب');
        }
      } catch (bkErr: any) {
        throw new Error(bkErr.message || fsErr.message || 'حدث خطأ أثناء حفظ بيانات الحساب');
      }
    }

    localStorage.setItem('center_student_user', JSON.stringify(newUser));
    if (firebaseUserObj) {
      setUser(firebaseUserObj);
    } else {
      setUser(null);
    }
    setAppUser(newUser);
    await establishDeviceSession(uid);
  };

  const loginWithEmail = async (email: string, pass: string) => {
    localStorage.removeItem('center_student_user');
    const cleanEmail = email.trim().toLowerCase();
    const cleanPass = pass.trim();

    try {
      await signInWithEmailAndPassword(auth, cleanEmail, cleanPass);
    } catch (err: any) {
      // Fallback to Firestore check
      const q = fsQuery(fsColl(db, 'users'), fsWhere('email', '==', cleanEmail));
      const snap = await fsGetDocs(q);

      if (snap.empty) {
        throw new Error('لم يتم العثور على حساب بهذا البريد الإلكتروني.');
      }

      const matchedDoc = snap.docs.find(d => {
        const data = d.data();
        return data.password === cleanPass;
      });

      if (!matchedDoc) {
        throw new Error('كلمة المرور غير صحيحة.');
      }

      const userData = { uid: matchedDoc.id, ...matchedDoc.data() } as AppUser;

      if (userData.banned) {
        throw new Error('عذراً، تم حظر هذا الحساب من قبل الإدارة.');
      }

      localStorage.setItem('center_student_user', JSON.stringify(userData));
      setUser(null);
      setAppUser(userData);
      establishDeviceSession(userData.uid);
    }
  };

  const loginWithPhone = async (phone: string, pass: string) => {
    const rawClean = phone
      .replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString())
      .replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d).toString())
      .trim()
      .replace(/[\s\-\(\)\+]/g, '');
    const cleanPass = pass.trim();

    if (!rawClean) {
      throw new Error('يرجى كتابة رقم الهاتف.');
    }

    // Build candidate variants (e.g., 01012345678, 1012345678, 201012345678)
    const phoneCandidates = new Set<string>();
    phoneCandidates.add(rawClean);

    if (rawClean.startsWith('0') && rawClean.length === 11) {
      phoneCandidates.add(rawClean.substring(1));
      phoneCandidates.add('20' + rawClean.substring(1));
    } else if (rawClean.length === 10 && (rawClean.startsWith('10') || rawClean.startsWith('11') || rawClean.startsWith('12') || rawClean.startsWith('15'))) {
      phoneCandidates.add('0' + rawClean);
      phoneCandidates.add('20' + rawClean);
    } else if (rawClean.startsWith('20') && rawClean.length === 12) {
      phoneCandidates.add('0' + rawClean.substring(2));
      phoneCandidates.add(rawClean.substring(2));
    }

    try {
      let matchedDocData: AppUser | null = null;

      // 1. Direct document lookups (fastest & most reliable)
      for (const p of Array.from(phoneCandidates)) {
        try {
          const sDoc = await getDoc(doc(db, 'users', `student_${p}`));
          if (sDoc.exists()) {
            matchedDocData = { uid: sDoc.id, ...sDoc.data() } as AppUser;
            break;
          }
        } catch (_) {}

        try {
          const cDoc = await getDoc(doc(db, 'users', `center_${p}`));
          if (cDoc.exists()) {
            matchedDocData = { uid: cDoc.id, ...cDoc.data() } as AppUser;
            break;
          }
        } catch (_) {}

        try {
          const uDoc = await getDoc(doc(db, 'users', p));
          if (uDoc.exists()) {
            matchedDocData = { uid: uDoc.id, ...uDoc.data() } as AppUser;
            break;
          }
        } catch (_) {}
      }

      // 2. Query by phone or code if direct lookup didn't find anything
      if (!matchedDocData) {
        for (const p of Array.from(phoneCandidates)) {
          const qPhone = fsQuery(fsColl(db, 'users'), fsWhere('phone', '==', p));
          const snapPhone = await fsGetDocs(qPhone);
          if (!snapPhone.empty) {
            const found = snapPhone.docs.find(d => {
              const data = d.data();
              return data.password === cleanPass || !data.password;
            }) || snapPhone.docs[0];
            matchedDocData = { uid: found.id, ...found.data() } as AppUser;
            break;
          }

          const qCode = fsQuery(fsColl(db, 'users'), fsWhere('code', '==', p));
          const snapCode = await fsGetDocs(qCode);
          if (!snapCode.empty) {
            const found = snapCode.docs.find(d => {
              const data = d.data();
              return data.password === cleanPass || !data.password;
            }) || snapCode.docs[0];
            matchedDocData = { uid: found.id, ...found.data() } as AppUser;
            break;
          }
        }
      }

      if (!matchedDocData) {
        throw new Error('لم يتم العثور على حساب برقم الهاتف أو الكود المكتوب.');
      }

      if (matchedDocData.banned) {
        throw new Error('عذراً، تم حظر هذا الحساب من قبل الإدارة.');
      }

      // Verify password
      if (matchedDocData.password && matchedDocData.password !== cleanPass) {
        throw new Error('كلمة المرور غير صحيحة.');
      }

      // Try authenticating via Firebase Auth if email exists
      if (matchedDocData.email && matchedDocData.email.includes('@')) {
        try {
          const cred = await signInWithEmailAndPassword(auth, matchedDocData.email, cleanPass);
          localStorage.removeItem('center_student_user');
          setUser(cred.user);
          setAppUser(matchedDocData);
          establishDeviceSession(matchedDocData.uid);
          return;
        } catch (e) {
          // If Firebase Auth signIn fails, fall back to stored session below
        }
      }

      localStorage.setItem('center_student_user', JSON.stringify(matchedDocData));
      setUser(null);
      setAppUser(matchedDocData);
      establishDeviceSession(matchedDocData.uid);
    } catch (err: any) {
      if (err.message && (err.message.includes('غير صحيحة') || err.message.includes('لم يتم العثور') || err.message.includes('تم حظر'))) {
        throw err;
      }
      throw new Error(err.message || 'حدث خطأ أثناء تسجيل الدخول برقم الهاتف');
    }
  };

  const loginWithCode = async (code: string, pass: string) => {
    const cleanCode = code.trim();
    const cleanPass = pass.trim();

    try {
      // 1. Try direct doc lookup
      const docRef = doc(db, 'users', `center_${cleanCode}`);
      const docSnap = await getDoc(docRef);

      let userData: AppUser | null = null;

      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.password && data.password !== cleanPass) {
          throw new Error('كلمة المرور غير صحيحة.');
        }
        userData = { uid: docSnap.id, ...data } as AppUser;
      } else {
        // 2. Try query by code field
        const q = fsQuery(fsColl(db, 'users'), fsWhere('code', '==', cleanCode));
        const snap = await fsGetDocs(q);
        if (snap.empty) {
          throw new Error('لم يتم العثور على حساب بهذا الكود.');
        }
        const matched = snap.docs.find(d => {
          const data = d.data();
          return data.password === cleanPass || !data.password;
        });
        if (!matched) {
          throw new Error('كلمة المرور غير صحيحة.');
        }
        userData = { uid: matched.id, ...matched.data() } as AppUser;
      }

      if (userData.banned) {
        throw new Error('عذراً، تم حظر هذا الحساب من قبل الإدارة.');
      }

      localStorage.setItem('center_student_user', JSON.stringify(userData));
      setUser(null);
      setAppUser(userData);
      establishDeviceSession(userData.uid);
    } catch (err: any) {
      if (err.message && (err.message.includes('غير صحيحة') || err.message.includes('لم يتم العثور') || err.message.includes('تم حظر'))) {
        throw err;
      }
      throw new Error('حدث خطأ أثناء تسجيل الدخول بالكود: ' + (err.message || ''));
    }
  };

  const findUserByPhoneOrCode = async (rawPhone: string): Promise<AppUser | null> => {
    const cleanPhone = rawPhone.replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString()).trim().replace(/[\s\-\(\)]/g, '');
    if (!cleanPhone) return null;

    // Generate possible phone formats (e.g., 01012345678, 1012345678, +201012345678, 00201012345678)
    const candidates = new Set<string>();
    candidates.add(cleanPhone);

    if (cleanPhone.startsWith('0') && cleanPhone.length === 11) {
      candidates.add(cleanPhone.slice(1));
      candidates.add('+20' + cleanPhone.slice(1));
      candidates.add('0020' + cleanPhone.slice(1));
    } else if ((cleanPhone.startsWith('10') || cleanPhone.startsWith('11') || cleanPhone.startsWith('12') || cleanPhone.startsWith('15')) && cleanPhone.length === 10) {
      candidates.add('0' + cleanPhone);
      candidates.add('+20' + cleanPhone);
      candidates.add('0020' + cleanPhone);
    } else if (cleanPhone.startsWith('+20') && cleanPhone.length === 13) {
      candidates.add('0' + cleanPhone.slice(3));
      candidates.add(cleanPhone.slice(3));
    } else if (cleanPhone.startsWith('0020') && cleanPhone.length === 14) {
      candidates.add('0' + cleanPhone.slice(4));
      candidates.add(cleanPhone.slice(4));
    }

    for (const p of Array.from(candidates)) {
      // 1. Check phone field
      try {
        const qPhone = fsQuery(fsColl(db, 'users'), fsWhere('phone', '==', p));
        const snapPhone = await fsGetDocs(qPhone);
        if (!snapPhone.empty) {
          const docItem = snapPhone.docs[0];
          return { uid: docItem.id, ...docItem.data() } as AppUser;
        }
      } catch (e) {}

      // 2. Check code field
      try {
        const qCode = fsQuery(fsColl(db, 'users'), fsWhere('code', '==', p));
        const snapCode = await fsGetDocs(qCode);
        if (!snapCode.empty) {
          const docItem = snapCode.docs[0];
          return { uid: docItem.id, ...docItem.data() } as AppUser;
        }
      } catch (e) {}

      // 3. Check direct center document
      try {
        const cDoc = await getDoc(doc(db, 'users', `center_${p}`));
        if (cDoc.exists()) {
          return { uid: cDoc.id, ...cDoc.data() } as AppUser;
        }
      } catch (e) {}

      // 4. Check direct student document
      try {
        const sDoc = await getDoc(doc(db, 'users', `student_${p}`));
        if (sDoc.exists()) {
          return { uid: sDoc.id, ...sDoc.data() } as AppUser;
        }
      } catch (e) {}
    }

    return null;
  };

  const resetPassword = async (email: string) => {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@') || !cleanEmail.includes('.')) {
      throw new Error('يرجى إدخال بريد إلكتروني صحيح.');
    }

    // 1. Verify existence in Firestore users collection
    let existingUser: AppUser | null = null;
    try {
      const q = fsQuery(fsColl(db, 'users'), fsWhere('email', '==', cleanEmail));
      const snap = await fsGetDocs(q);
      if (!snap.empty) {
        existingUser = { uid: snap.docs[0].id, ...snap.docs[0].data() } as AppUser;
      }
    } catch (e) {
      console.warn("Could not query users by email:", e);
    }

    // 2. Check if user is banned
    if (existingUser && existingUser.banned) {
      throw new Error('عذراً، هذا الحساب محظور من قبل الإدارة. يرجى التواصل مع الدعم الفني أو السكرتارية.');
    }

    // 3. Verify in Firebase Auth if not found in Firestore
    if (!existingUser) {
      try {
        const methods = await fetchSignInMethodsForEmail(auth, cleanEmail);
        if (!methods || methods.length === 0) {
          throw new Error('هذا البريد الإلكتروني غير مسجل لدينا في المنصة. يرجى التأكد من كتابة البريد بشكل صحيح أو إنشاء حساب جديد.');
        }
      } catch (authErr: any) {
        if (authErr.code === 'auth/user-not-found' || (authErr.message && authErr.message.includes('غير مسجل'))) {
          throw new Error('هذا البريد الإلكتروني غير مسجل لدينا في المنصة. يرجى التأكد من كتابة البريد بشكل صحيح أو إنشاء حساب جديد.');
        }
        if (authErr.code === 'auth/invalid-email') {
          throw new Error('صيغة البريد الإلكتروني غير صحيحة.');
        }
        // If not found in Firestore and auth error occurred, prevent reset
        throw new Error('هذا البريد الإلكتروني غير مسجل لدينا في المنصة. يرجى التأكد من كتابة البريد بشكل صحيح أو إنشاء حساب جديد.');
      }
    }

    // 4. Send Firebase password reset email
    try {
      await sendPasswordResetEmail(auth, cleanEmail);
    } catch (sendErr: any) {
      if (sendErr.code === 'auth/user-not-found') {
        throw new Error('هذا البريد الإلكتروني غير مسجل لدينا في المنصة. يرجى التأكد من كتابة البريد بشكل صحيح أو إنشاء حساب جديد.');
      }
      if (sendErr.code === 'auth/invalid-email') {
        throw new Error('صيغة البريد الإلكتروني غير صحيحة.');
      }
      throw new Error(sendErr.message || 'حدث خطأ أثناء إرسال رابط إعادة تعيين كلمة المرور.');
    }
  };

  const formatE164Phone = (rawPhone: string) => {
    let p = rawPhone.replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString()).trim().replace(/[\s\-\(\)]/g, '');
    if (p.startsWith('+')) return p;
    if (p.startsWith('00')) return '+' + p.slice(2);
    if (p.startsWith('01') && p.length === 11) {
      return '+20' + p.slice(1);
    }
    if ((p.startsWith('10') || p.startsWith('11') || p.startsWith('12') || p.startsWith('15')) && p.length === 10) {
      return '+20' + p;
    }
    return p.startsWith('+') ? p : `+20${p}`;
  };

  const sendPhoneResetOtp = async (rawPhone: string, verifier: RecaptchaVerifier): Promise<ConfirmationResult> => {
    const formatted = formatE164Phone(rawPhone);
    const cleanPhone = rawPhone.replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString()).trim().replace(/\s+/g, '');

    // 1. MUST verify user is already registered in the system before proceeding with SMS
    const existingUser = await findUserByPhoneOrCode(cleanPhone);
    if (!existingUser) {
      throw new Error('رقم الهاتف هذا غير مسجل لدينا في المنصة. يرجى التأكد من كتابة الرقم بشكل صحيح أو إنشاء حساب جديد أولاً.');
    }

    if (existingUser.banned) {
      throw new Error('عذراً، هذا الحساب محظور من قبل الإدارة. يرجى مراجعة الدعم الفني أو السكرتارية.');
    }

    // 2. User exists and is active, send SMS verification code
    try {
      const confirmationResult = await signInWithPhoneNumber(auth, formatted, verifier);
      return confirmationResult;
    } catch (err: any) {
      console.error("Firebase signInWithPhoneNumber error:", err);
      if (err.code === 'auth/operation-not-allowed') {
        throw new Error('خدمة التحقق بالهاتف SMS غير مفعلة بعد في إعدادات Firebase Console. يرجى تفعيل Phone Provider من تبويب Authentication > Sign-in method.');
      }
      if (err.code === 'auth/invalid-phone-number') {
        throw new Error('رقم الهاتف غير صالح. يرجى إدخال رقم صحيح يبدأ بـ 01 مثل 01012345678.');
      }
      if (err.code === 'auth/quota-exceeded') {
        throw new Error('تم تجاوز الحصة اليومية المتاحة لرسائل SMS على Firebase. يمكنك إضافة أرقام اختبار مجانية في Firebase Console أو الترقية لباقة Blaze.');
      }
      if (err.code === 'auth/too-many-requests') {
        throw new Error('تم إرسال عدة طلبات خلال وقت قصير جداً. يرجى الانتظار دقيقة واحدة ثم المحاولة.');
      }
      throw new Error(err.message || 'تعذر إرسال كود التحقق عبر رسالة SMS.');
    }
  };

  const confirmPhoneResetOtp = async (
    confirmationResult: ConfirmationResult,
    otpCode: string,
    newPass: string,
    rawPhone: string
  ) => {
    const cleanPhone = rawPhone.replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString()).trim().replace(/\s+/g, '');
    const cleanNewPass = newPass.trim();

    if (!cleanNewPass || cleanNewPass.length < 6) {
      throw new Error('يجب ألا تقل كلمة المرور الجديدة عن 6 أحرف أو أرقام.');
    }

    // 1. Confirm code with Firebase Auth
    const userCredential = await confirmationResult.confirm(otpCode);
    const fbUser = userCredential.user;

    // 2. If firebase user exists, try updating auth password
    try {
      if (fbUser) {
        await updatePassword(fbUser, cleanNewPass);
      }
    } catch (e) {
      console.warn("Could not update auth password directly:", e);
    }

    // 3. Find registered user in Firestore and update password
    let updated = false;
    let foundUserData: AppUser | null = null;

    const matchedUser = await findUserByPhoneOrCode(cleanPhone);
    if (matchedUser) {
      try {
        await updateDoc(doc(db, 'users', matchedUser.uid), { password: cleanNewPass });
        foundUserData = { ...matchedUser, password: cleanNewPass };
        updated = true;
      } catch (e) {
        console.warn("Error updating matched user doc:", e);
      }
    }

    // Also update all documents that match phone or code directly
    try {
      const qPhone = fsQuery(fsColl(db, 'users'), fsWhere('phone', '==', cleanPhone));
      const snapPhone = await fsGetDocs(qPhone);
      for (const d of snapPhone.docs) {
        await updateDoc(doc(db, 'users', d.id), { password: cleanNewPass });
        if (!foundUserData) {
          foundUserData = { uid: d.id, ...d.data(), password: cleanNewPass } as AppUser;
        }
        updated = true;
      }
    } catch (e) {}

    try {
      const qCode = fsQuery(fsColl(db, 'users'), fsWhere('code', '==', cleanPhone));
      const snapCode = await fsGetDocs(qCode);
      for (const d of snapCode.docs) {
        await updateDoc(doc(db, 'users', d.id), { password: cleanNewPass });
        if (!foundUserData) {
          foundUserData = { uid: d.id, ...d.data(), password: cleanNewPass } as AppUser;
        }
        updated = true;
      }
    } catch (e) {}

    // Direct center doc fallback
    try {
      const centerDocRef = doc(db, 'users', `center_${cleanPhone}`);
      const cSnap = await getDoc(centerDocRef);
      if (cSnap.exists()) {
        await updateDoc(centerDocRef, { password: cleanNewPass });
        if (!foundUserData) {
          foundUserData = { uid: cSnap.id, ...cSnap.data(), password: cleanNewPass } as AppUser;
        }
        updated = true;
      }
    } catch (e) {}

    // If still not found, try fbUser.uid
    if (!updated && fbUser) {
      try {
        const userDocRef = doc(db, 'users', fbUser.uid);
        const uSnap = await getDoc(userDocRef);
        if (uSnap.exists()) {
          await updateDoc(userDocRef, { password: cleanNewPass });
          foundUserData = { uid: uSnap.id, ...uSnap.data(), password: cleanNewPass } as AppUser;
          updated = true;
        }
      } catch (e) {}
    }

    if (foundUserData) {
      setAppUser(foundUserData);
      localStorage.setItem('center_student_user', JSON.stringify(foundUserData));
    }
  };

  const signInWithGoogle = async () => {
    try {
      const sSnap = await getDoc(doc(db, 'settings', 'main'));
      if (sSnap.exists() && sSnap.data().enableGoogleAuth === false) {
        throw new Error('تم إيقاف التسجيل والدخول عبر Google من قبل إدارة المنصة.');
      }
    } catch (e: any) {
      if (e.message && e.message.includes('إدارة المنصة')) {
        throw e;
      }
    }
    localStorage.removeItem('center_student_user');
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  };

  const signOut = async () => {
    localStorage.removeItem('app_device_session_token');
    localStorage.removeItem('center_student_user');
    if (auth.currentUser) {
      await firebaseSignOut(auth);
    }
    setUser(null);
    setAppUser(null);
  };

  return (
    <AuthContext.Provider value={{
      user,
      appUser,
      loading,
      signInWithGoogle,
      signOut,
      registerWithEmail,
      registerUser,
      loginWithEmail,
      loginWithCode,
      loginWithPhone,
      resetPassword,
      sendPhoneResetOtp,
      confirmPhoneResetOtp
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
