const fs = require('fs');

function patch(file) {
  let code = fs.readFileSync(file, 'utf-8');
  if (code.includes('interface Exam {') && !code.includes('lessonName?: string;')) {
    code = code.replace(
      'durationMinutes?: number;',
      'durationMinutes?: number;\n  lessonName?: string;'
    );
    fs.writeFileSync(file, code);
  }
}

patch('src/components/StudentExams.tsx');
patch('src/components/AdminExams.tsx');
