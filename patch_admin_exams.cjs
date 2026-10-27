const fs = require('fs');
let code = fs.readFileSync('src/components/AdminExams.tsx', 'utf-8');

// Update type interface
code = code.replace(/type\?: 'exam' \| 'homework';/, "type?: 'exam' | 'homework' | 'recitation';");

// Update initial form state
code = code.replace(/const \[examForm, setExamForm\] = useState<\s*\{\s*title: string;\s*courseId: string;\s*courseIds: string\[\];\s*lessonName: string;\s*showAnswers: boolean;\s*endTime: string;\s*type: 'exam' \| 'homework';\s*durationMinutes: number;\s*\}\s*>\(\{\s*title: '',\s*courseId: '',\s*courseIds: \[\],\s*lessonName: '',\s*showAnswers: false,\s*endTime: '',\s*type: 'exam',\s*durationMinutes: 60\s*\}\);/,
`const [examForm, setExamForm] = useState<{
    title: string;
    courseId: string;
    courseIds: string[];
    lessonName: string;
    showAnswers: boolean;
    endTime: string;
    type: 'exam' | 'homework' | 'recitation';
    durationMinutes: number;
  }>({
    title: '',
    courseId: '',
    courseIds: [],
    lessonName: '',
    showAnswers: false,
    endTime: '',
    type: 'exam',
    durationMinutes: 60
  });`);

// Update type selector UI
const typeSelector = `
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">النوع</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="examType" checked={examForm.type === 'exam'} onChange={() => setExamForm(prev => ({...prev, type: 'exam'}))} className="w-4 h-4 text-indigo-600 focus:ring-indigo-500" />
                    <span className="font-bold text-slate-700">امتحان</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="examType" checked={examForm.type === 'homework'} onChange={() => setExamForm(prev => ({...prev, type: 'homework'}))} className="w-4 h-4 text-indigo-600 focus:ring-indigo-500" />
                    <span className="font-bold text-slate-700">واجب</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="examType" checked={examForm.type === 'recitation'} onChange={() => setExamForm(prev => ({...prev, type: 'recitation'}))} className="w-4 h-4 text-indigo-600 focus:ring-indigo-500" />
                    <span className="font-bold text-slate-700">تسميع</span>
                  </label>
                </div>
              </div>
`;

code = code.replace(/<div>\s*<label className="block text-sm font-bold text-slate-700 mb-2">نوع التقييم<\/label>\s*<select\s*value=\{examForm\.type\}\s*onChange=\{e => setExamForm\(prev => \(\{ \.\.\.prev, type: e\.target\.value as 'exam' \| 'homework' \}\)\)\}\s*className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500 transition-shadow"\s*>\s*<option value="exam">امتحان<\/option>\s*<option value="homework">واجب<\/option>\s*<\/select>\s*<\/div>/, typeSelector);

fs.writeFileSync('src/components/AdminExams.tsx', code);
