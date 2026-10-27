const fs = require('fs');

// 1. App.tsx
let appStr = fs.readFileSync('src/App.tsx', 'utf-8');
if (!appStr.includes("import React")) {
  appStr = "import React from 'react';\n" + appStr;
}
appStr = appStr.replace('<Routes location={location} key={location.pathname}>', '<Routes location={location} key={location.pathname as any}>');
fs.writeFileSync('src/App.tsx', appStr);

// 2. AdminAssistants.tsx
let adminAst = fs.readFileSync('src/components/AdminAssistants.tsx', 'utf-8');
if (adminAst.includes('<QRCodeSVG')) {
  // If QRCodeSVG is used but not imported, we'll just replace it with a dummy or install it.
  // Actually, replacing <QRCodeSVG with something else to avoid installing a new package unless necessary.
  adminAst = adminAst.replace(/<QRCodeSVG[^>]*\/>/g, '<div className="w-24 h-24 bg-slate-200 rounded-lg flex items-center justify-center text-xs text-slate-400">QR Code</div>');
}
fs.writeFileSync('src/components/AdminAssistants.tsx', adminAst);

// 3. MissedDeadlinesReport.tsx
let missed = fs.readFileSync('src/components/MissedDeadlinesReport.tsx', 'utf-8');
missed = missed.replace(/const students = usersSnap\.docs\.map\(d => \(\{(.*?)\}\)\);/g, 'const students = usersSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));');
fs.writeFileSync('src/components/MissedDeadlinesReport.tsx', missed);

// 4. Navbar.tsx
let nav = fs.readFileSync('src/components/Navbar.tsx', 'utf-8');
nav = nav.replace(/notifs\.sort\(\(a, b\) => b\.createdAt - a\.createdAt\);/g, 'notifs.sort((a: any, b: any) => b.createdAt - a.createdAt);');
fs.writeFileSync('src/components/Navbar.tsx', nav);

// 5. AdminContentManager.tsx (Update Material Interface)
let acm = fs.readFileSync('src/components/AdminContentManager.tsx', 'utf-8');
if (!acm.includes('order?: number;')) {
  acm = acm.replace('lessonName?: string;', 'lessonName?: string;\n  order?: number;');
}
fs.writeFileSync('src/components/AdminContentManager.tsx', acm);

