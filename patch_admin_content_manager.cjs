const fs = require('fs');
let code = fs.readFileSync('src/components/AdminContentManager.tsx', 'utf-8');

// Add import
code = code.replace(
  "import { useSettings } from '../contexts/SettingsContext';",
  "import { useSettings } from '../contexts/SettingsContext';\nimport { compressImage } from '../lib/imageUtils';"
);

// Replace file handler
const oldFileHandler = `const file = e.target.files?.[0];
                    if (file) {
                      if (file.size > 500 * 1024) {
                        alert("حجم الصورة يجب أن يكون أقل من 500 كيلوبايت.");
                        e.target.value = '';
                        return;
                      }
                      const reader = new FileReader();
                      reader.onloadend = () => {
                        setThumbnailBase64(reader.result as string);
                      };
                      reader.readAsDataURL(file);
                    } else {
                      setThumbnailBase64('');
                    }`;

const newFileHandler = `const file = e.target.files?.[0];
                    if (file) {
                      compressImage(file, 500).then(base64 => {
                        setThumbnailBase64(base64);
                      }).catch(err => {
                        console.error("Error compressing image:", err);
                        alert("حدث خطأ أثناء معالجة الصورة.");
                      });
                    } else {
                      setThumbnailBase64('');
                    }`;

code = code.replace(oldFileHandler, newFileHandler);
fs.writeFileSync('src/components/AdminContentManager.tsx', code);
