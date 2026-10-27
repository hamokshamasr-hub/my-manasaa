const fs = require('fs');
let code = fs.readFileSync('src/pages/StudentDashboard.tsx', 'utf-8');

if (!code.includes("import { getLevel }")) {
  code = code.replace(
    "import Leaderboard from '../components/Leaderboard';",
    "import Leaderboard, { getLevel } from '../components/Leaderboard';"
  );
}
if (!code.includes("import { Trophy, Medal")) {
  code = code.replace(
    "import { Video, FileText, Lock, Loader2, PlayCircle, Download, MessageCircle, X, CheckSquare, BookOpen, Clock, ChevronLeft, Moon, Sun } from 'lucide-react';",
    "import { Video, FileText, Lock, Loader2, PlayCircle, Download, MessageCircle, X, CheckSquare, BookOpen, Clock, ChevronLeft, Moon, Sun, Trophy, Medal, Star, Award } from 'lucide-react';"
  );
}

// In the dashboard render
const renderProfile = `
        {/* Profile Stats Widget */}
        {!selectedCourseId && appUser && (
          <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 mb-8 flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className={\`w-16 h-16 rounded-2xl flex items-center justify-center shadow-inner \${getLevel(appUser.totalPoints || 0).bg} \${getLevel(appUser.totalPoints || 0).color}\`}>
                {(() => {
                  const Icon = getLevel(appUser.totalPoints || 0).icon;
                  return <Icon className="w-8 h-8" />;
                })()}
              </div>
              <div>
                <h2 className="text-xl font-black text-slate-800 dark:text-white">التصنيف الحالي: {getLevel(appUser.totalPoints || 0).name}</h2>
                <div className="text-slate-500 dark:text-slate-400 font-bold flex items-center gap-2 mt-1">
                  <Star className="w-4 h-4 text-yellow-500" />
                  مجموع النقاط: <span className="text-indigo-600 dark:text-indigo-400">{appUser.totalPoints || 0}</span> نقطة
                </div>
              </div>
            </div>
            <div className="w-full md:w-1/3 bg-slate-50 dark:bg-slate-700 p-4 rounded-2xl border border-slate-100 dark:border-slate-600">
              <div className="flex justify-between text-xs font-bold mb-2">
                <span className="text-slate-500 dark:text-slate-300">التقدم للمستوى التالي</span>
              </div>
              <div className="w-full h-3 bg-slate-200 dark:bg-slate-600 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-indigo-500 to-indigo-600 rounded-full"
                  style={{ width: \`\${Math.min(100, ((appUser.totalPoints || 0) % 500) / 500 * 100)}%\` }}
                ></div>
              </div>
            </div>
          </div>
        )}

        {subscribedCourses.length === 0 && coursesData.length === 0 ? (
`;

code = code.replace(
  "{subscribedCourses.length === 0 && coursesData.length === 0 ? (",
  renderProfile
);

fs.writeFileSync('src/pages/StudentDashboard.tsx', code);
