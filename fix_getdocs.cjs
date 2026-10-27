const fs = require('fs');
let dash = fs.readFileSync('src/pages/StudentDashboard.tsx', 'utf-8');
dash = dash.replace(/import { collection, query, where, onSnapshot, orderBy } from 'firebase\/firestore';/, "import { collection, query, where, onSnapshot, orderBy, getDocs } from 'firebase/firestore';");
dash = dash.replace(/import\('firebase\/firestore'\)\.then\(m => m\.getDocs\(q1\)\)/g, 'getDocs(q1)');
dash = dash.replace(/import\('firebase\/firestore'\)\.then\(m => m\.getDocs\(q2\)\)/g, 'getDocs(q2)');
fs.writeFileSync('src/pages/StudentDashboard.tsx', dash);
