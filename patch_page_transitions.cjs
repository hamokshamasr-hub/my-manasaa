const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf-8');

// We need AnimatePresence and motion, and we need useLocation inside the Router.
// Since Router is in App, we need to create a nested component.

code = `import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { AuthProvider } from './contexts/AuthContext';
import { SettingsProvider } from './contexts/SettingsContext';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import FloatingWhatsApp from './components/FloatingWhatsApp';
import GoogleAnalytics from './components/GoogleAnalytics';
import Home from './pages/Home';
import Payment from './pages/Payment';
import AdminDashboard from './pages/Admin';
import StudentDashboard from './pages/StudentDashboard';
import Login from './pages/Login';
import Register from './pages/Register';
import PublicCourse from './pages/PublicCourse';

function AnimatedRoutes() {
  const location = useLocation();
  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={<PageTransition><Home /></PageTransition>} />
        <Route path="/login" element={<PageTransition><Login /></PageTransition>} />
        <Route path="/register" element={<PageTransition><Register /></PageTransition>} />
        <Route path="/payment" element={<PageTransition><Payment /></PageTransition>} />
        <Route path="/course/:id" element={<PageTransition><PublicCourse /></PageTransition>} />
        <Route path="/admin" element={<PageTransition><AdminDashboard /></PageTransition>} />
        <Route path="/dashboard" element={<PageTransition><StudentDashboard /></PageTransition>} />
      </Routes>
    </AnimatePresence>
  );
}

function PageTransition({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -15 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className="flex-grow flex flex-col"
    >
      {children}
    </motion.div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <SettingsProvider>
        <Router>
          <GoogleAnalytics />
          <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans" dir="rtl">
            <Navbar />
            <main className="flex-grow flex flex-col overflow-hidden relative">
              <AnimatedRoutes />
            </main>
            <Footer />
            <FloatingWhatsApp />
          </div>
        </Router>
      </SettingsProvider>
    </AuthProvider>
  );
}
`;

fs.writeFileSync('src/App.tsx', code);
