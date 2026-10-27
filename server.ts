import express, { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { db } from './src/lib/firebase';
import { collection, doc, setDoc, getDocs, query, where, orderBy } from 'firebase/firestore';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

// Body parsers
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Multer memory storage (supports videos up to 2GB)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 2 * 1024 * 1024 * 1024 // 2GB max
  }
});

// Helper: Resolve Bunny credentials by Grade
interface BunnyConfig {
  libraryId: string;
  apiKey: string;
  gradeLabel: string;
}

function getBunnyConfigForGrade(gradeInput: string): BunnyConfig | null {
  const normalized = (gradeInput || '').toString().trim().toLowerCase();

  // Grade 1 (أولى ثانوي)
  if (['1', 'g1', 'grade1', 'أولى ثانوي', 'الصف الأول الثانوي', 'اولى ثانوي'].includes(normalized)) {
    return {
      libraryId: process.env.BUNNY_LIBRARY_ID_G1 || '767120',
      apiKey: process.env.BUNNY_API_KEY_G1 || 'b5f13fb9-4eb0-4fb4-833057a5148f-70fb-419a',
      gradeLabel: 'الصف الأول الثانوي'
    };
  }

  // Grade 2 (ثانية ثانوي)
  if (['2', 'g2', 'grade2', 'ثانية ثانوي', 'الصف الثاني الثانوي', 'تانية ثانوي'].includes(normalized)) {
    return {
      libraryId: process.env.BUNNY_LIBRARY_ID_G2 || '767124',
      apiKey: process.env.BUNNY_API_KEY_G2 || 'c9ae2432-bbb8-4319-8e5eea17c676-1b0d-41b9',
      gradeLabel: 'الصف الثاني الثانوي'
    };
  }

  // Grade 3 (ثالثة ثانوي)
  if (['3', 'g3', 'grade3', 'ثالثة ثانوي', 'الصف الثالث الثانوي', 'تالته ثانوي'].includes(normalized)) {
    return {
      libraryId: process.env.BUNNY_LIBRARY_ID_G3 || '767125',
      apiKey: process.env.BUNNY_API_KEY_G3 || '13dc4b71-7b28-475d-b1910a51320b-20b4-45d8',
      gradeLabel: 'الصف الثالث الثانوي'
    };
  }

  return null;
}

/**
 * -------------------------------------------------------------
 * POST /api/upload-video
 * Uploads video to Bunny.net Stream based on Grade and saves to Firestore
 * -------------------------------------------------------------
 */
app.post(
  '/api/upload-video',
  upload.single('video'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { title, grade, courseId, lessonName } = req.body;
      const file = req.file;

      // Extract multiple courseIds if provided
      let targetCourseIds: string[] = [];
      if (req.body.courseIds) {
        try {
          if (Array.isArray(req.body.courseIds)) {
            targetCourseIds = req.body.courseIds.filter(Boolean);
          } else if (typeof req.body.courseIds === 'string') {
            const parsed = JSON.parse(req.body.courseIds);
            if (Array.isArray(parsed)) targetCourseIds = parsed.filter(Boolean);
            else targetCourseIds = req.body.courseIds.split(',').map((s: string) => s.trim()).filter(Boolean);
          }
        } catch (_) {
          targetCourseIds = String(req.body.courseIds).split(',').map((s: string) => s.trim()).filter(Boolean);
        }
      }
      if (courseId && !targetCourseIds.includes(courseId)) {
        targetCourseIds.unshift(courseId);
      }

      // 1. Validation
      if (!file) {
        res.status(400).json({
          success: false,
          error: 'يرجى إرفاق ملف الفيديو (video file is required)'
        });
        return;
      }

      if (!title || !title.trim()) {
        res.status(400).json({
          success: false,
          error: 'يرجى تحديد عنوان الفيديو (video title is required)'
        });
        return;
      }

      const customLibraryId = req.body.customLibraryId;
      const customApiKey = req.body.customApiKey;
      const bunnyDefault = grade ? getBunnyConfigForGrade(grade) : undefined;
      const libraryId = customLibraryId || bunnyDefault?.libraryId;
      const apiKey = customApiKey || bunnyDefault?.apiKey;
      const gradeLabel = req.body.gradeLabel || bunnyDefault?.gradeLabel || (grade ? String(grade) : 'عام');

      if (!libraryId || !apiKey) {
        res.status(400).json({
          success: false,
          error: `لم يتم العثور على إعدادات مكتبة Bunny.net صالحة. يرجى التأكد من إضافة وتحديد مكتبة صالحة ومفتاح الرفع الخاص بها.`
        });
        return;
      }
      const videoTitle = title.trim();

      // Step 1: Create Video Entry on Bunny.net Stream
      // POST https://video.bunnycdn.com/library/<LIBRARY_ID>/videos
      const createResponse = await fetch(`https://video.bunnycdn.com/library/${libraryId}/videos`, {
        method: 'POST',
        headers: {
          'AccessKey': apiKey,
          'Content-Type': 'application/json',
          'accept': 'application/json'
        },
        body: JSON.stringify({
          title: videoTitle
        })
      });

      if (!createResponse.ok) {
        const errorText = await createResponse.text();
        console.error('Bunny.net Create Video Error:', createResponse.status, errorText);
        res.status(createResponse.status).json({
          success: false,
          error: `فشل إنشاء الفيديو في Bunny.net (${createResponse.status}): ${errorText}`
        });
        return;
      }

      const createData = (await createResponse.json()) as { guid?: string; id?: string };
      const videoId = createData.guid || createData.id;

      if (!videoId) {
        res.status(500).json({
          success: false,
          error: 'لم تتم استعادة معرف الفيديو (guid) من Bunny.net'
        });
        return;
      }

      // Step 2: Upload Video Binary to Bunny.net Stream
      // PUT https://video.bunnycdn.com/library/<LIBRARY_ID>/videos/<VIDEO_ID>
      const uploadResponse = await fetch(
        `https://video.bunnycdn.com/library/${libraryId}/videos/${videoId}`,
        {
          method: 'PUT',
          headers: {
            'AccessKey': apiKey,
            'Content-Type': 'application/octet-stream'
          },
          body: file.buffer
        }
      );

      if (!uploadResponse.ok) {
        const uploadError = await uploadResponse.text();
        console.error('Bunny.net Upload Buffer Error:', uploadResponse.status, uploadError);
        res.status(uploadResponse.status).json({
          success: false,
          error: `فشل رفع محتوى الفيديو إلى Bunny.net (${uploadResponse.status}): ${uploadError}`
        });
        return;
      }

      // Step 3: Save Video Metadata to Firebase Firestore under collection 'lessons'
      const embedUrl = `https://iframe.mediadelivery.net/embed/${libraryId}/${videoId}`;
      const normalizedGrade = grade.toString().trim();
      const lessonDocRef = doc(collection(db, 'lessons'));

      const lessonData = {
        id: lessonDocRef.id,
        videoId,
        libraryId,
        title: videoTitle,
        grade: normalizedGrade,
        gradeLabel,
        courseId: courseId || '',
        lessonName: lessonName || '',
        embedUrl,
        fileSize: file.size,
        mimeType: file.mimetype,
        originalFilename: file.originalname,
        createdAt: Date.now()
      };

      let firestoreSaved = false;
      let materialId = '';
      try {
        await setDoc(lessonDocRef, lessonData);
        firestoreSaved = true;

        // If courses are provided, link directly to the courses in 'materials'
        if (targetCourseIds.length > 0) {
          const materialDocRef = doc(collection(db, 'materials'));
          await setDoc(materialDocRef, {
            id: materialDocRef.id,
            title: videoTitle,
            url: embedUrl,
            type: 'video',
            courseId: targetCourseIds[0],
            courseIds: targetCourseIds,
            lessonName: lessonName || 'محتوى عام',
            targetAudience: req.body.targetAudience || 'all',
            createdAt: Date.now(),
            bunnyVideoId: videoId,
            bunnyLibraryId: libraryId,
            fileSize: file.size
          });
          materialId = materialDocRef.id;

          // Also ensure backward-compatible single documents if each course needs independent listing
          if (targetCourseIds.length > 1) {
            for (let i = 1; i < targetCourseIds.length; i++) {
              const cId = targetCourseIds[i];
              const extraDocRef = doc(collection(db, 'materials'));
              await setDoc(extraDocRef, {
                id: extraDocRef.id,
                title: videoTitle,
                url: embedUrl,
                type: 'video',
                courseId: cId,
                courseIds: [cId],
                lessonName: lessonName || 'محتوى عام',
                targetAudience: req.body.targetAudience || 'all',
                createdAt: Date.now(),
                bunnyVideoId: videoId,
                bunnyLibraryId: libraryId,
                fileSize: file.size
              });
            }
          }
        }
      } catch (firestoreErr: any) {
        console.warn('Notice: Background Firestore save in /api/upload-video:', firestoreErr?.message || firestoreErr);
      }

      // Return requested JSON response
      res.status(200).json({
        success: true,
        videoId,
        libraryId,
        grade: normalizedGrade,
        gradeLabel,
        title: videoTitle,
        embedUrl,
        lessonId: lessonDocRef.id,
        courseId: targetCourseIds[0] || courseId || '',
        courseIds: targetCourseIds,
        materialId,
        firestoreSaved
      });
    } catch (err: any) {
      console.error('Server error in /api/upload-video:', err);
      res.status(500).json({
        success: false,
        error: err.message || 'حدث خطأ داخلي أثناء معالجة رفع الفيديو'
      });
    }
  }
);

/**
 * -------------------------------------------------------------
 * GET /api/lessons
 * Retrieve all Bunny.net lessons (optionally filtered by grade)
 * -------------------------------------------------------------
 */
app.get('/api/lessons', async (req: Request, res: Response): Promise<void> => {
  try {
    const { grade } = req.query;
    let q = query(collection(db, 'lessons'), orderBy('createdAt', 'desc'));

    if (grade) {
      q = query(
        collection(db, 'lessons'),
        where('grade', '==', grade.toString().trim()),
        orderBy('createdAt', 'desc')
      );
    }

    const snapshot = await getDocs(q);
    const lessons = snapshot.docs
      .filter(d => d.id !== 'test_health_doc')
      .map(d => ({ id: d.id, ...d.data() }));
    res.json({ success: true, count: lessons.length, lessons });
  } catch (err: any) {
    console.error('Error fetching lessons:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * -------------------------------------------------------------
 * POST /api/register
 * Direct server-side student registration ensuring 100% reliability
 * -------------------------------------------------------------
 */
app.post('/api/register', async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, phone, parentPhone, grade, pass, email } = req.body;
    if (!name || !name.trim()) {
      res.status(400).json({ success: false, error: 'يرجى كتابة الاسم الرباعي الكامل.' });
      return;
    }
    const cleanPhone = (phone || '').toString()
      .replace(/[٠-٩]/g, (d: string) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString())
      .replace(/[۰-۹]/g, (d: string) => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d).toString())
      .trim().replace(/[\s\-\(\)\+]/g, '');
    const cleanParentPhone = (parentPhone || '').toString()
      .replace(/[٠-٩]/g, (d: string) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString())
      .replace(/[۰-۹]/g, (d: string) => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d).toString())
      .trim().replace(/[\s\-\(\)\+]/g, '');
    const cleanPass = (pass || '').toString().trim();

    if (!cleanPhone || cleanPhone.length < 10) {
      res.status(400).json({ success: false, error: 'يرجى إدخال رقم هاتف صحيح.' });
      return;
    }
    if (!cleanPass || cleanPass.length < 6) {
      res.status(400).json({ success: false, error: 'كلمة المرور يجب أن لا تقل عن 6 أحرف.' });
      return;
    }

    // Check duplicate phone in Firestore
    const qPhone = query(collection(db, 'users'), where('phone', '==', cleanPhone));
    const phoneSnap = await getDocs(qPhone);
    if (!phoneSnap.empty) {
      res.status(400).json({ success: false, error: 'رقم الهاتف هذا مسجل بالفعل. يرجى تسجيل الدخول مباشرة.' });
      return;
    }

    const uid = `student_${cleanPhone}`;
    const finalEmail = (email && email.trim()) ? email.trim().toLowerCase() : `${cleanPhone}@student.com`;
    const role = (finalEmail === 'adam.albalshi.4@gmail.com') ? 'admin' : 'student';

    const newUser = {
      uid,
      email: finalEmail,
      name: name.trim(),
      phone: cleanPhone,
      parentPhone: cleanParentPhone || '',
      grade: grade || 'الصف الثالث الثانوي',
      password: cleanPass,
      code: cleanPhone,
      role,
      registrationMethod: email ? 'email' : 'phone',
      totalPoints: 0,
      centerPoints: 0,
      allowedCourseIds: [],
      createdAt: Date.now()
    };

    await setDoc(doc(db, 'users', uid), newUser);
    res.status(200).json({ success: true, user: newUser });
  } catch (err: any) {
    console.error('Registration server error:', err);
    res.status(500).json({ success: false, error: err.message || 'حدث خطأ أثناء إنشاء الحساب' });
  }
});

/**
 * -------------------------------------------------------------
 * Health Check API
 * -------------------------------------------------------------
 */
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: Date.now(),
    bunnyConfigured: {
      g1: Boolean(process.env.BUNNY_API_KEY_G1),
      g2: Boolean(process.env.BUNNY_API_KEY_G2),
      g3: Boolean(process.env.BUNNY_API_KEY_G3)
    }
  });
});

/**
 * -------------------------------------------------------------
 * Setup Vite Integration & Server Startup
 * -------------------------------------------------------------
 */
async function startServer() {
  const isDev = process.env.NODE_ENV !== 'production';

  if (isDev) {
    // Mount Vite middlewares in development
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    // Serve static files in production
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Saber Educational Platform Server running on http://localhost:${PORT}`);
  });
}

startServer().catch(err => {
  console.error('Fatal error starting server:', err);
  process.exit(1);
});
