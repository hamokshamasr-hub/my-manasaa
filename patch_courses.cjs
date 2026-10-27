const fs = require('fs');
let content = fs.readFileSync('src/components/AdminCourses.tsx', 'utf-8');

// Add description to Course interface
content = content.replace(/coverImageBase64\?: string;/g, 'coverImageBase64?: string;\n  description?: string;');
content = content.replace(/import { Plus, Trash2, Loader2, Save, X, Image as ImageIcon } from 'lucide-react';/, "import { Plus, Trash2, Loader2, Save, X, Image as ImageIcon, Edit2 } from 'lucide-react';");
content = content.replace(/setDoc, deleteDoc, orderBy, where, getDocs } from 'firebase\/firestore';/, "setDoc, deleteDoc, updateDoc, orderBy, where, getDocs } from 'firebase/firestore';");

// Add editingId state
content = content.replace(/const \[saving, setSaving\] = useState\(false\);/, "const [saving, setSaving] = useState(false);\n  const [editingId, setEditingId] = useState<string | null>(null);");

// Update form state to include description
content = content.replace(/coverImageBase64: ''\n  }\);/, "coverImageBase64: '',\n    description: ''\n  });");

// Update handleImageUpload size limit
content = content.replace(/const file = e\.target\.files\?\.\[0\];\n    if \(file\) \{/g, `const file = e.target.files?.[0];\n    if (file) {\n      if (file.size > 500 * 1024) {\n        alert("حجم الصورة يجب أن يكون أقل من 500 كيلوبايت.");\n        e.target.value = '';\n        return;\n      }`);

// Update handleSave logic
const saveLogic = `  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || form.price <= 0) return;
    
    setSaving(true);
    try {
      const formattedName = form.name; // Keep name simple or append grade if needed
      
      if (editingId) {
        await updateDoc(doc(db, 'courses', editingId), {
          name: formattedName,
          grade: form.grade,
          price: form.price,
          description: form.description || '',
          ...(form.coverImageBase64 ? { coverImageBase64: form.coverImageBase64 } : {})
        });
        setEditingId(null);
      } else {
        const docRef = doc(collection(db, 'courses'));
        await setDoc(docRef, {
          name: formattedName,
          grade: form.grade,
          price: form.price,
          description: form.description || '',
          coverImageBase64: form.coverImageBase64 || '',
          createdAt: Date.now()
        });
      }
      
      setIsAdding(false);
      setForm({ name: '', price: 0, grade: grades[0], coverImageBase64: '', description: '' });
    } catch (error) {
      console.error(error);
      alert('حدث خطأ أثناء الحفظ');
    } finally {
      setSaving(false);
    }
  };`;

content = content.replace(/const handleSave = async.*?finally \{\n      setSaving\(false\);\n    \}\n  \};/s, saveLogic);

// Add handleEdit
const handleEditCode = `
  const handleEditClick = (course: Course) => {
    setEditingId(course.id);
    setIsAdding(true);
    setForm({
      name: course.name,
      price: course.price,
      grade: course.grade,
      description: course.description || '',
      coverImageBase64: course.coverImageBase64 || ''
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
`;
content = content.replace(/const handleDelete = async/, handleEditCode + "\n  const handleDelete = async");

// Replace description text area in form
const descriptionField = `</div>
          
          <div className="mb-4 mt-4">
            <label className="block text-slate-700 text-sm font-bold mb-2">وصف الكورس (يظهر للطلاب)</label>
            <textarea
              value={form.description}
              onChange={e => setForm({...form, description: e.target.value})}
              placeholder="اكتب نبذة أو تفاصيل عن محتوى الكورس..."
              rows={3}
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
            ></textarea>
          </div>
                    
          <div className="flex justify-end pt-4 border-t border-slate-100">`;
content = content.replace(/<\/div>\n\s+<div className="flex justify-end pt-4 border-t border-slate-100">/s, descriptionField);

// Replace Add button logic to reset editing
content = content.replace(/onClick=\{\(\) => setIsAdding\(\!isAdding\)\}/, `onClick={() => {
            if (isAdding) {
              setIsAdding(false);
              setEditingId(null);
              setForm({ name: '', price: 0, grade: grades[0], coverImageBase64: '', description: '' });
            } else {
              setIsAdding(true);
            }
          }}`);

// Replace Add icon logic
content = content.replace(/{isAdding \? 'إلغاء' : 'إضافة كورس'}/, "{isAdding && !editingId ? 'إلغاء' : isAdding && editingId ? 'إلغاء التعديل' : 'إضافة كورس'}");

// Edit button in table
const tableAction = `<div className="flex justify-center gap-2">
                      <button onClick={() => handleEditClick(course)} className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors">
                        <Edit2 className="w-5 h-5" />
                      </button>
                      <button onClick={() => handleDelete(course.id)} className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors">`;
content = content.replace(/<div className="flex justify-center gap-2">\n\s+<button onClick=\{\(\) => handleDelete\(course\.id\)\}/, tableAction);

fs.writeFileSync('src/components/AdminCourses.tsx', content);
