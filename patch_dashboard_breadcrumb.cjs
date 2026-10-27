const fs = require('fs');
let code = fs.readFileSync('src/pages/StudentDashboard.tsx', 'utf-8');

const oldContent = `          </div>
        ) : (
          <div className="flex flex-col lg:flex-row gap-8">
            {/* Sidebar for Course Navigation */}`;

const newContent = `          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex items-center gap-2 text-sm font-bold text-slate-500 mb-2">
              <button onClick={() => setSelectedCourseId(null)} className="hover:text-indigo-600 transition-colors">لوحة التحكم</button>
              <ChevronLeft className="w-4 h-4" />
              <span className="text-slate-800">{coursesData.find(c => c.id === selectedCourseId)?.name || 'الكورس'}</span>
            </div>
            
            <div className="bg-indigo-600 rounded-3xl p-6 sm:p-10 text-white shadow-lg shadow-indigo-200 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-white opacity-5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>
              <div className="relative z-10 flex flex-col sm:flex-row items-center justify-between gap-6">
                <div>
                  <h1 className="text-2xl sm:text-4xl font-black mb-2">{coursesData.find(c => c.id === selectedCourseId)?.name || 'الكورس الحالي'}</h1>
                  <p className="text-indigo-100 font-medium opacity-90">مرحباً بك في ساحة التعلم. اختر من القائمة الجانبية لتصفح المحتوى.</p>
                </div>
                <div className="bg-white/10 backdrop-blur-sm px-6 py-3 rounded-2xl border border-white/20 text-center shrink-0">
                   <div className="text-xs font-bold text-indigo-200 uppercase tracking-wider mb-1">المرحلة</div>
                   <div className="font-black">{coursesData.find(c => c.id === selectedCourseId)?.grade || ''}</div>
                </div>
              </div>
            </div>

            <div className="flex flex-col lg:flex-row gap-8">
            {/* Sidebar for Course Navigation */}`;

code = code.replace(oldContent, newContent);
fs.writeFileSync('src/pages/StudentDashboard.tsx', code);
