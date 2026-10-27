const fs = require('fs');
let code = fs.readFileSync('src/components/PublicCourses.tsx', 'utf-8');

// Add settings to context
code = code.replace(
  "const { appUser } = useAuth();",
  "const { appUser } = useAuth();\n  const { settings } = useSettings();\n  const [selectedGrade, setSelectedGrade] = useState<string>('all');"
);
code = code.replace(
  "import { useAuth } from '../contexts/AuthContext';",
  "import { useAuth } from '../contexts/AuthContext';\nimport { useSettings } from '../contexts/SettingsContext';"
);

// We should NOT filter out courses initially if they are not logged in, wait, the original code DID filter by appUser.grade.
// Let's modify the filter logic so the user can change it.

const newFetchLogic = `
  useEffect(() => {
    const fetchCourses = async () => {
      try {
        const q = query(collection(db, 'courses'));
        const snapshot = await getDocs(q);
        
        let data = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Course[];
        
        // If logged in student has a grade, maybe pre-select it
        if (appUser && appUser.role === 'student' && appUser.grade && selectedGrade === 'all') {
          setSelectedGrade(appUser.grade);
        }
        
        setCourses(data);

      } catch (err) {
        console.error("Error fetching courses", err);
      } finally {
        setLoading(false);
      }
    };
    fetchCourses();
  }, [appUser]);

  const filteredCourses = courses.filter(course => {
    if (selectedGrade === 'all') return true;
    return course.grade === selectedGrade;
  });
`;

code = code.replace(
  /useEffect\(\(\) => \{[\s\S]*?\}, \[\]\);/,
  newFetchLogic
);

// Add the filter buttons UI
const filterUI = `
        <div className="text-center max-w-3xl mx-auto mb-16">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <span className="inline-block py-1.5 px-4 rounded-full bg-indigo-100 text-indigo-700 font-bold text-sm mb-4 shadow-sm">
              🌟 طريقك نحو التفوق
            </span>
            <h2 className="text-3xl md:text-5xl font-black text-slate-900 dark:text-white mb-6">كورسات المنصة المتاحة</h2>
            <p className="text-lg text-slate-600 dark:text-slate-300 font-medium leading-relaxed mb-8">
              اختر الكورس المناسب لصفك الدراسي وابدأ رحلتك التعليمية مع أفضل نظام تعليمي متكامل يشمل المحاضرات، الامتحانات، المذكرات، والمتابعة المستمرة.
            </p>
            
            {/* Grade Filter */}
            {settings?.grades && settings.grades.length > 0 && (
              <div className="flex flex-wrap justify-center gap-2 mb-8">
                <button
                  onClick={() => setSelectedGrade('all')}
                  className={\`px-6 py-2 rounded-full font-bold text-sm transition-all shadow-sm \${selectedGrade === 'all' ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200' : 'bg-white text-slate-600 border border-slate-200 hover:border-indigo-300 hover:text-indigo-600'}\`}
                >
                  الكل
                </button>
                {settings.grades.map(grade => (
                  <button
                    key={grade}
                    onClick={() => setSelectedGrade(grade)}
                    className={\`px-6 py-2 rounded-full font-bold text-sm transition-all shadow-sm \${selectedGrade === grade ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200' : 'bg-white text-slate-600 border border-slate-200 hover:border-indigo-300 hover:text-indigo-600'}\`}
                  >
                    {grade}
                  </button>
                ))}
              </div>
            )}
          </motion.div>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
`;

code = code.replace(
  /<div className="text-center max-w-3xl mx-auto mb-16">[\s\S]*?<div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">/,
  filterUI
);

// Map over filteredCourses instead of courses
code = code.replace(
  /courses\.map\(\(course\)/,
  "filteredCourses.map((course)"
);

code = code.replace(
  /courses\.length === 0/g,
  "filteredCourses.length === 0"
);

fs.writeFileSync('src/components/PublicCourses.tsx', code);
