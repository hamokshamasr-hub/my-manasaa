const fs = require('fs');
let code = fs.readFileSync('src/components/AdminCourses.tsx', 'utf-8');

if (!code.includes("compressImage")) {
  code = code.replace(
    "import { motion, AnimatePresence } from 'motion/react';",
    "import { motion, AnimatePresence } from 'motion/react';\nimport { compressImage } from '../lib/imageUtils';"
  );
}

const oldHandler = `const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 800 * 1024) {
      alert('حجم الصورة كبير جداً. أقصى حجم هو 800 كيلوبايت.');
      e.target.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      setForm(prev => ({ ...prev, coverImageBase64: reader.result as string }));
    };
    reader.readAsDataURL(file);`;

const newHandler = `const file = e.target.files?.[0];
    if (!file) return;
    compressImage(file, 800).then(base64 => {
      setForm(prev => ({ ...prev, coverImageBase64: base64 }));
    }).catch(err => {
      console.error("Error compressing image:", err);
      alert("حدث خطأ أثناء معالجة الصورة.");
    });`;

code = code.replace(oldHandler, newHandler);
fs.writeFileSync('src/components/AdminCourses.tsx', code);
