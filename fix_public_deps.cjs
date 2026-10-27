const fs = require('fs');
let code = fs.readFileSync('src/components/PublicCourses.tsx', 'utf-8');

code = code.replace(
  "if (appUser && appUser.role === 'student' && appUser.grade && selectedGrade === 'all') {",
  "if (appUser && appUser.role === 'student' && appUser.grade) { // Just use their grade on mount"
);

code = code.replace(
  "}, [appUser]);",
  "}, [appUser, appUser?.grade]);"
);

fs.writeFileSync('src/components/PublicCourses.tsx', code);
