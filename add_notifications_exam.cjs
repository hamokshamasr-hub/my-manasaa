const fs = require('fs');
let code = fs.readFileSync('src/components/StudentExams.tsx', 'utf-8');

const notifLogic = `
      // Add notifications
      try {
        const studentNotifRef = doc(collection(db, 'notifications'));
        await setDoc(studentNotifRef, {
          userId: studentUid,
          title: 'نتيجة تقييم جديدة',
          message: \`لقد حصلت على \${score} من \${selectedExam.questions.length} في \${selectedExam.title}\`,
          read: false,
          createdAt: Date.now()
        });

        const adminNotifRef = doc(collection(db, 'notifications'));
        await setDoc(adminNotifRef, {
          userId: 'admin',
          title: 'طالب أتم التقييم',
          message: \`الطالب \${appUser?.name || 'غير معروف'} حصل على \${score} من \${selectedExam.questions.length} في \${selectedExam.title}\`,
          read: false,
          createdAt: Date.now()
        });
      } catch (err) {
        console.warn('Failed to send notifications', err);
      }
`;

code = code.replace(
  "// Gamification: add points based on score (e.g., 10 points per correct answer)",
  notifLogic + "\n      // Gamification: add points based on score (e.g., 10 points per correct answer)"
);

fs.writeFileSync('src/components/StudentExams.tsx', code);
