import React from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { SettingsProvider } from './contexts/SettingsContext';
import { ToastProvider } from './contexts/ToastContext';
import InitialAppLoader from './components/InitialAppLoader';
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
import ParentReport from './pages/ParentReport';

function AnimatedRoutes() {
  const location = useLocation();
  return (
    <AnimatePresence mode="wait">
      {/* @ts-ignore */}
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={<PageTransition><Home /></PageTransition>} />
        <Route path="/login" element={<PageTransition><Login /></PageTransition>} />
        <Route path="/forgot-password" element={<PageTransition><Login defaultForgot={true} /></PageTransition>} />
        <Route path="/register" element={<PageTransition><Register /></PageTransition>} />
        <Route path="/payment" element={<PageTransition><Payment /></PageTransition>} />
        <Route path="/course/:id" element={<PageTransition><PublicCourse /></PageTransition>} />
        <Route path="/parent-report/:id" element={<PageTransition><ParentReport /></PageTransition>} />
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

function AppShell() {
  const { loading: authLoading } = useAuth();

  return (
    <>
      <InitialAppLoader isReady={!authLoading} />
      <div className="min-h-screen bg-slate-50 dark:bg-[#070b14] text-slate-900 dark:text-slate-100 flex flex-col font-sans transition-colors duration-200" dir="rtl">
        <Navbar />
        <main className="flex-grow flex flex-col overflow-hidden relative">
          <AnimatedRoutes />
        </main>
        <Footer />
        <FloatingWhatsApp />
      </div>
    </>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <SettingsProvider>
        <ToastProvider>
          <Router>
            <GoogleAnalytics />
            <AppShell />
          </Router>
        </ToastProvider>
      </SettingsProvider>
    </AuthProvider>
  );
}
