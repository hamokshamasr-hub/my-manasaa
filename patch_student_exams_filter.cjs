const fs = require('fs');
let code = fs.readFileSync('src/components/StudentExams.tsx', 'utf-8');

// Update filter logic
const oldFilterLogic = `
        // Tab filter
        if (activeTab === 'homework') {
          if (exam.type !== 'homework') return false;
        } else {
          if (exam.type === 'homework') return false;
        }
`;

const newFilterLogic = `
        // Tab filter
        if (activeTab === 'homework') {
          if (exam.type !== 'homework' && exam.type !== 'recitation') return false;
        } else {
          if (exam.type === 'homework' || exam.type === 'recitation') return false;
        }
`;
code = code.replace(oldFilterLogic, newFilterLogic);

// Add activeTab to include recitation in type definition if needed, but activeTab is just 'exams' | 'homework' (representing the tab).

fs.writeFileSync('src/components/StudentExams.tsx', code);
