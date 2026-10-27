const fs = require('fs');
let content = fs.readFileSync('src/pages/StudentDashboard.tsx', 'utf-8');

// Add Leaderboard import
content = content.replace(
  "import StudentExams from '../components/StudentExams';",
  "import StudentExams from '../components/StudentExams';\nimport Leaderboard from '../components/Leaderboard';"
);

// Add activeTab type
content = content.replace(
  "const [activeTab, setActiveTab] = useState<'videos' | 'materials' | 'support' | 'exams' | 'homework'>('videos');",
  "const [activeTab, setActiveTab] = useState<'videos' | 'materials' | 'support' | 'exams' | 'homework' | 'leaderboard'>('videos');"
);

// Add Tab button
const tabButton = `
              <button
                onClick={() => setActiveTab('leaderboard')}
                className={\`flex items-center gap-2 px-6 py-3.5 rounded-2xl font-bold transition-all duration-300 \${
                  activeTab === 'leaderboard' 
                  ? 'bg-purple-600 text-white shadow-lg shadow-purple-200 scale-105' 
                  : 'text-slate-600 hover:bg-slate-50 hover:text-purple-600'
                }\`}
              >
                <span className="text-xl">🏆</span>
                <span>لوحة الشرف والتصنيف</span>
              </button>
            </nav>
`;
content = content.replace(/<\/nav>/, tabButton);

// Add Tab content rendering
const tabContent = `
          {/* TAB: LEADERBOARD */}
          {activeTab === 'leaderboard' && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              <Leaderboard />
            </motion.div>
          )}

        </div>
      </div>
    </div>
  );
`;
content = content.replace(/<\/div>\n\s+<\/div>\n\s+<\/div>\n\s+\);\n\}/, tabContent + "\n}");

fs.writeFileSync('src/pages/StudentDashboard.tsx', content);
