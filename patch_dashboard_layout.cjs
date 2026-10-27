const fs = require('fs');
let code = fs.readFileSync('src/pages/StudentDashboard.tsx', 'utf-8');

// We need to move Support and Leaderboard OUTSIDE.
// Currently, they are rendered inside the `!selectedCourseId ? (courses list) : (tabs)` block.

// Replace the course list render block
const outsideRender = `
        ) : (!selectedCourseId && coursesData.length > 0) ? (
          <div className="space-y-8">
            <h2 className="text-2xl font-black text-slate-800">كورساتي المشترك بها:</h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              {coursesData.map(course => (
                <motion.div
                  key={course.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  onClick={() => setSelectedCourseId(course.id)}
                  className="bg-white rounded-3xl shadow-md border border-slate-200 overflow-hidden cursor-pointer hover:shadow-2xl hover:-translate-y-2 transition-all duration-300 group"
                >
                  <div className="h-64 bg-slate-100 relative overflow-hidden">
                    {course.coverImageBase64 ? (
                      <img src={course.coverImageBase64} alt={course.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-indigo-50">
                        <BookOpen className="w-16 h-16 text-indigo-200" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent"></div>
                    <div className="absolute bottom-4 right-4 left-4">
                      <span className="bg-indigo-600 text-white text-xs font-bold px-3 py-1.5 rounded-lg mb-2 inline-block shadow-sm">
                        {course.grade}
                      </span>
                      <h2 className="text-2xl font-black text-white line-clamp-1">{course.name}</h2>
                    </div>
                  </div>
                  <div className="p-5 flex items-center justify-between bg-white">
                    <span className="text-slate-500 font-bold text-sm flex items-center gap-2">
                      <BookOpen className="w-4 h-4" /> اضغط للدخول للمحتوى
                    </span>
                    <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center group-hover:bg-indigo-600 transition-colors">
                      <ChevronLeft className="w-5 h-5 text-indigo-600 group-hover:text-white transition-colors" />
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>

            <div className="grid lg:grid-cols-2 gap-8 mt-12">
              <div>
                <Leaderboard />
              </div>
              <div>
                <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-[600px]">
                  <StudentSupport />
                </div>
              </div>
            </div>
          </div>
        ) : (
`;

code = code.replace(/\) : \(\!selectedCourseId && coursesData\.length > 0\) \? \([\s\S]*?\) : \(/, outsideRender);

// Remove Support and Leaderboard tabs from inside the course view
code = code.replace(/<button\s*onClick=\{\(\) => setActiveTab\('support'\)\}[\s\S]*?<\/button>/, '');
code = code.replace(/<button\s*onClick=\{\(\) => setActiveTab\('leaderboard'\)\}[\s\S]*?<\/button>/, '');
code = code.replace(/<button\s*onClick=\{\(\) => setActiveTab\('performance'\)\}[\s\S]*?<\/button>/, `
              <button
                onClick={() => setActiveTab('performance')}
                className={\`flex items-center gap-2 px-6 py-3.5 rounded-2xl font-bold transition-all duration-300 \${
                  activeTab === 'performance' 
                  ? 'bg-purple-600 text-white shadow-lg shadow-purple-200 scale-105' 
                  : 'text-slate-600 hover:bg-slate-50 hover:text-purple-600'
                }\`}
              >
                <span className="text-xl">📈</span>
                <span>تقارير المتابعة</span>
              </button>
`);

// Remove Support and Leaderboard content sections
code = code.replace(/\{\s*\/\* TAB: LEADERBOARD \*\/\s*\}(.|\n)*?(?=\{activeTab === 'videos')/m, '');
code = code.replace(/\{activeTab === 'support' \? \([\s\S]*?\) : activeTab === 'performance' \? \(/, "{activeTab === 'performance' ? (");

fs.writeFileSync('src/pages/StudentDashboard.tsx', code);
