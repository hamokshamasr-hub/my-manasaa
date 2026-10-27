const fs = require('fs');

// 1. Remove from StudentDashboard
let dashboardCode = fs.readFileSync('src/pages/StudentDashboard.tsx', 'utf-8');

// Remove dark mode state
const stateToRemove = `  const [darkMode, setDarkMode] = useState(() => {
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
  }, [darkMode]);`;

dashboardCode = dashboardCode.replace(stateToRemove, "");

// Remove toggle button
const buttonToRemove = `<button 
            onClick={() => setDarkMode(!darkMode)}
            className="p-3 bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:text-indigo-600 hover:shadow-md transition-all"
          >
            {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>`;

dashboardCode = dashboardCode.replace(buttonToRemove, "");
// also clean up any unused Sun/Moon imports if I want, but it's fine.

fs.writeFileSync('src/pages/StudentDashboard.tsx', dashboardCode);

// 2. Add to Navbar
let navbarCode = fs.readFileSync('src/components/Navbar.tsx', 'utf-8');

// Add Sun/Moon imports
navbarCode = navbarCode.replace(
  "import { BookOpen, Menu, X, LogIn, LogOut, LayoutDashboard, CreditCard, UserPlus, Bell } from 'lucide-react';",
  "import { BookOpen, Menu, X, LogIn, LogOut, LayoutDashboard, CreditCard, UserPlus, Bell, Sun, Moon } from 'lucide-react';"
);

// Add state
const navState = `  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
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
  }, [darkMode]);`;

navbarCode = navbarCode.replace("  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);", navState);

// Add button to desktop nav
const desktopNavBtn = `<button 
              onClick={() => setDarkMode(!darkMode)}
              className="p-2 text-slate-600 hover:text-indigo-600 transition-colors"
            >
              {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
            <Link to="/" className="text-slate-600 hover:text-indigo-600 font-semibold transition-colors">الرئيسية</Link>`;

navbarCode = navbarCode.replace(`<Link to="/" className="text-slate-600 hover:text-indigo-600 font-semibold transition-colors">الرئيسية</Link>`, desktopNavBtn);

// Add button to mobile nav
const mobileNavBtn = `              <div className="flex items-center justify-between px-3 py-3 border-b border-slate-100">
                <span className="text-slate-700 font-bold">المظهر</span>
                <button 
                  onClick={() => setDarkMode(!darkMode)}
                  className="p-2 bg-slate-100 rounded-lg text-slate-600"
                >
                  {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                </button>
              </div>
              <Link to="/" onClick={() => setIsMobileMenuOpen(false)} className="block px-3 py-3 rounded-md text-base font-semibold text-slate-700 hover:text-indigo-600 hover:bg-slate-50">الرئيسية</Link>`;

navbarCode = navbarCode.replace(`<Link to="/" onClick={() => setIsMobileMenuOpen(false)} className="block px-3 py-3 rounded-md text-base font-semibold text-slate-700 hover:text-indigo-600 hover:bg-slate-50">الرئيسية</Link>`, mobileNavBtn);

fs.writeFileSync('src/components/Navbar.tsx', navbarCode);
