const fs = require('fs');
let pc = fs.readFileSync('src/components/PublicCourses.tsx', 'utf-8');
pc = pc.replace(/course\.imageUrl/g, 'course.coverImageBase64');
fs.writeFileSync('src/components/PublicCourses.tsx', pc);

let pd = fs.readFileSync('src/pages/PublicCourse.tsx', 'utf-8');
pd = pd.replace(/course\.imageUrl/g, 'course.coverImageBase64');
fs.writeFileSync('src/pages/PublicCourse.tsx', pd);
