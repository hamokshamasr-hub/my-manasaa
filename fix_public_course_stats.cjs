const fs = require('fs');
let code = fs.readFileSync('src/pages/PublicCourse.tsx', 'utf-8');

const oldStats = `        // Fetch stats
        const qMaterials = query(collection(db, 'materials'), where('courseId', '==', id));
        const matSnap = await getDocs(qMaterials);
        let vids = 0; let pdfs = 0;
        matSnap.forEach(d => {
          const m = d.data();
          if (m.type === 'video') vids++;
          if (m.type === 'pdf') pdfs++;
        });

        const qExams = query(collection(db, 'exams'), where('courseId', '==', id));
        const examSnap = await getDocs(qExams);
        
        setStats({ videos: vids, pdfs, exams: examSnap.size });`;

const newStats = `        // Fetch stats for courseId AND courseIds
        const qMaterials1 = query(collection(db, 'materials'), where('courseId', '==', id));
        const qMaterials2 = query(collection(db, 'materials'), where('courseIds', 'array-contains', id));
        
        const qExams1 = query(collection(db, 'exams'), where('courseId', '==', id));
        const qExams2 = query(collection(db, 'exams'), where('courseIds', 'array-contains', id));
        
        const [matSnap1, matSnap2, examSnap1, examSnap2] = await Promise.all([
          getDocs(qMaterials1),
          getDocs(qMaterials2),
          getDocs(qExams1),
          getDocs(qExams2)
        ]);

        const allMaterials = new Map();
        matSnap1.forEach(d => allMaterials.set(d.id, d.data()));
        matSnap2.forEach(d => allMaterials.set(d.id, d.data()));

        let vids = 0; let pdfs = 0;
        allMaterials.forEach(m => {
          if (m.type === 'video') vids++;
          if (m.type === 'pdf') pdfs++;
        });

        const allExams = new Map();
        examSnap1.forEach(d => allExams.set(d.id, true));
        examSnap2.forEach(d => allExams.set(d.id, true));
        
        setStats({ videos: vids, pdfs: pdfs, exams: allExams.size });`;

code = code.replace(oldStats, newStats);
fs.writeFileSync('src/pages/PublicCourse.tsx', code);
