const fs = require('fs');
let code = fs.readFileSync('src/pages/StudentDashboard.tsx', 'utf-8');

const newCourseView = `
          <div className="flex flex-col lg:flex-row gap-8">
            {/* Sidebar for Course Navigation */}
            <div className="w-full lg:w-72 flex-shrink-0">
              <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-5 sticky top-24">
                <div className="mb-6 pb-6 border-b border-slate-100">
                  <button 
                    onClick={() => setSelectedCourseId(null)}
                    className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors"
                  >
                    <ChevronLeft className="w-5 h-5" />
                    العودة للكورسات
                  </button>
                </div>
                
                <h3 className="text-xs font-black text-slate-400 mb-4 px-3 uppercase tracking-wider">محتويات الكورس</h3>
                
                <nav className="flex flex-col gap-2">
                  <button
                    onClick={() => setActiveTab('videos')}
                    className={\`flex items-center gap-3 px-4 py-3.5 rounded-2xl font-bold transition-all duration-300 \${
                      activeTab === 'videos' 
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200' 
                      : 'text-slate-600 hover:bg-slate-50 hover:text-indigo-600'
                    }\`}
                  >
                    <span className="text-xl">🎬</span>
                    <span>محاضرات</span>
                  </button>
                  <button
                    onClick={() => setActiveTab('materials')}
                    className={\`flex items-center gap-3 px-4 py-3.5 rounded-2xl font-bold transition-all duration-300 \${
                      activeTab === 'materials' 
                      ? 'bg-emerald-600 text-white shadow-md shadow-emerald-200' 
                      : 'text-slate-600 hover:bg-slate-50 hover:text-emerald-600'
                    }\`}
                  >
                    <span className="text-xl">📚</span>
                    <span>مذكرات</span>
                  </button>
                  <button
                    onClick={() => setActiveTab('exams')}
                    className={\`flex items-center gap-3 px-4 py-3.5 rounded-2xl font-bold transition-all duration-300 \${
                      activeTab === 'exams' 
                      ? 'bg-amber-500 text-white shadow-md shadow-amber-200' 
                      : 'text-slate-600 hover:bg-slate-50 hover:text-amber-500'
                    }\`}
                  >
                    <span className="text-xl">📝</span>
                    <span>امتحانات</span>
                  </button>
                  <button
                    onClick={() => setActiveTab('homework')}
                    className={\`flex items-center gap-3 px-4 py-3.5 rounded-2xl font-bold transition-all duration-300 \${
                      activeTab === 'homework' 
                      ? 'bg-teal-600 text-white shadow-md shadow-teal-200' 
                      : 'text-slate-600 hover:bg-slate-50 hover:text-teal-600'
                    }\`}
                  >
                    <span className="text-xl">🏠</span>
                    <span>واجبات وتسميع</span>
                  </button>
                  <button
                    onClick={() => setActiveTab('performance')}
                    className={\`flex items-center gap-3 px-4 py-3.5 rounded-2xl font-bold transition-all duration-300 \${
                      activeTab === 'performance' 
                      ? 'bg-purple-600 text-white shadow-md shadow-purple-200' 
                      : 'text-slate-600 hover:bg-slate-50 hover:text-purple-600'
                    }\`}
                  >
                    <span className="text-xl">📈</span>
                    <span>تقارير المتابعة</span>
                  </button>
                </nav>
              </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 min-w-0">
`;

// String replacement to avoid regex issues
const targetStr = '<div className="space-y-8">';
const endStr = '{/* Content List */}';
const startIndex = code.indexOf(targetStr, code.indexOf(') : ('));
const endIndex = code.indexOf(endStr, startIndex);

if (startIndex !== -1 && endIndex !== -1) {
  const toReplace = code.substring(startIndex, endIndex);
  code = code.replace(toReplace, newCourseView + '\n            ');
}

// We need to fix the closing tags at the bottom.
const replaceBottomStr = `) : null}
          </div>
        )
      )}
    </div>
  );
}`;

const newBottomStr = `) : null}
            </div>
          </div>
        )
      )}
    </div>
  );
}`;

code = code.replace(replaceBottomStr, newBottomStr);

fs.writeFileSync('src/pages/StudentDashboard.tsx', code);
