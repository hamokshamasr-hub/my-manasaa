const fs = require('fs');

let code = fs.readFileSync('src/pages/StudentDashboard.tsx', 'utf-8');

code = code.replace(
  "BookOpen, Clock, ChevronLeft } from 'lucide-react';",
  "BookOpen, Clock, ChevronLeft, Moon, Sun } from 'lucide-react';"
);

// Add dark mode state
const stateInjection = `  const [activeTab, setActiveTab] = useState<TabType>('videos');

  const [darkMode, setDarkMode] = useState(() => {
    return localStorage.getItem('theme') === 'dark' || 
      (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches);
  });

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [darkMode]);
`;

code = code.replace("  const [activeTab, setActiveTab] = useState<TabType>('videos');", stateInjection);

// Add the toggle button to the top header area
const headerTarget = `<div className="mb-8">
          <h1 className="text-3xl font-black text-slate-900 mb-2">منصتي التعليمية</h1>`;
          
const newHeader = `<div className="mb-8 flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-black text-slate-900 dark:text-white mb-2">منصتي التعليمية</h1>
            <p className="text-slate-500 dark:text-slate-400 font-medium">مرحباً بك {appUser?.name}، استكمل رحلة تفوقك من هنا.</p>
          </div>
          <button 
            onClick={() => setDarkMode(!darkMode)}
            className="p-3 bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:text-indigo-600 hover:shadow-md transition-all"
          >
            {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>
        </div>`;

// Use replace carefully since the original string is slightly different.
code = code.replace(/<div className="mb-8">[\s\S]*?<\/div>/, newHeader);

fs.writeFileSync('src/pages/StudentDashboard.tsx', code);
