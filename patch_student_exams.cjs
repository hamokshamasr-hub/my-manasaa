const fs = require('fs');
let content = fs.readFileSync('src/components/StudentExams.tsx', 'utf-8');

content = content.replace(
  /import \{ collection, query, onSnapshot, where, doc, setDoc \} from 'firebase\/firestore';/,
  "import { collection, query, onSnapshot, where, doc, setDoc, updateDoc, increment } from 'firebase/firestore';"
);

const newSubmitCode = `
    try {
      const resultRef = doc(collection(db, 'exam_results'));
      const percentage = (score / selectedExam.questions.length) * 100;
      await setDoc(resultRef, {
        studentId: studentUid,
        examId: selectedExam.id,
        examTitle: selectedExam.title,
        courseId: selectedExam.courseId || (selectedExam.courseIds && selectedExam.courseIds[0]) || '',
        score,
        total: selectedExam.questions.length,
        percentage,
        type: selectedExam.type || 'exam',
        createdAt: Date.now()
      });

      // Gamification: add points based on score (e.g., 10 points per correct answer)
      const pointsEarned = score * 10;
      try {
        await updateDoc(doc(db, 'users', studentUid), {
          totalPoints: increment(pointsEarned)
        });
      } catch (err) {
        console.error("Could not update user points:", err);
      }
`;

content = content.replace(/try \{\n\s+const resultRef = doc\(collection\(db, 'exam_results'\)\);\n\s+await setDoc\(resultRef, \{.*?\n\s+createdAt: Date\.now\(\)\n\s+\}\);/s, newSubmitCode);

fs.writeFileSync('src/components/StudentExams.tsx', content);
