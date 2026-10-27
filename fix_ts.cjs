const fs = require('fs');

// Fix StudentDashboard.tsx
let dashboard = fs.readFileSync('src/pages/StudentDashboard.tsx', 'utf-8');
dashboard = dashboard.replace(
  `const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));`,
  `const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Material[];`
);
fs.writeFileSync('src/pages/StudentDashboard.tsx', dashboard);

// Fix StudentExams.tsx type
let exams = fs.readFileSync('src/components/StudentExams.tsx', 'utf-8');
exams = exams.replace(
  `export interface Exam {`,
  `export interface Exam {`
);
// Actually I'll use sed for exams
