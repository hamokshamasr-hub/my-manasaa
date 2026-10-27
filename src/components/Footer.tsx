import { BookOpen, Facebook, Youtube, Instagram, Phone, Mail, MapPin } from 'lucide-react';
import { useSettings } from '../contexts/SettingsContext';

export default function Footer() {
  const { settings } = useSettings();

  return (
    <footer className="bg-slate-900 text-slate-300 py-16 border-t border-slate-800" id="contact">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12">
          
          {/* Brand */}
          <div className="col-span-1 md:col-span-2 lg:col-span-1">
            <div className="flex items-center gap-3 mb-6">
              <div className="bg-indigo-600 text-white p-2 rounded-xl">
                <BookOpen className="w-7 h-7" />
              </div>
              <div>
                <h2 className="font-bold text-xl text-white">{settings.platformName}</h2>
              </div>
            </div>
            <p className="text-slate-400 font-medium mb-6 leading-relaxed text-sm">
              المنصة التعليمية الأولى لتعلم اللغة الإنجليزية في مصر، مصممة بأحدث التقنيات لضمان تجربة تعليمية متميزة وفريدة من نوعها.
            </p>
            <div className="flex gap-4">
              {settings.facebookUrl && (
                <a href={settings.facebookUrl} target="_blank" rel="noreferrer" className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 hover:bg-indigo-600 hover:text-white transition-colors">
                  <Facebook className="w-5 h-5" />
                </a>
              )}
              {settings.youtubeUrl && (
                <a href={settings.youtubeUrl} target="_blank" rel="noreferrer" className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 hover:bg-rose-600 hover:text-white transition-colors">
                  <Youtube className="w-5 h-5" />
                </a>
              )}
              {settings.instagramUrl && (
                <a href={settings.instagramUrl} target="_blank" rel="noreferrer" className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 hover:bg-pink-600 hover:text-white transition-colors">
                  <Instagram className="w-5 h-5" />
                </a>
              )}
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="text-white font-bold text-lg mb-6">روابط سريعة</h3>
            <ul className="space-y-4">
              <li><a href="#" className="text-slate-400 hover:text-white transition-colors font-medium">الرئيسية</a></li>
              <li><a href="#features" className="text-slate-400 hover:text-white transition-colors font-medium">مميزات المنصة</a></li>
              <li><a href="#stages" className="text-slate-400 hover:text-white transition-colors font-medium">المراحل الدراسية</a></li>
              <li><a href="#" className="text-slate-400 hover:text-white transition-colors font-medium">الأسئلة الشائعة</a></li>
            </ul>
          </div>

          {/* Student Services */}
          <div>
            <h3 className="text-white font-bold text-lg mb-6">خدمات الطلاب</h3>
            <ul className="space-y-4">
              <li><a href="#" className="text-slate-400 hover:text-white transition-colors font-medium">تسجيل الدخول</a></li>
              <li><a href="#" className="text-slate-400 hover:text-white transition-colors font-medium">إنشاء حساب جديد</a></li>
              <li><a href="#" className="text-slate-400 hover:text-white transition-colors font-medium">كيفية استخدام المنصة</a></li>
              <li><a href="#" className="text-slate-400 hover:text-white transition-colors font-medium">الدعم الفني</a></li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h3 className="text-white font-bold text-lg mb-6">تواصل معنا</h3>
            <ul className="space-y-4">
              {settings.contactPhone && (
                <li className="flex items-start gap-3">
                  <Phone className="w-5 h-5 text-indigo-500 mt-1 flex-shrink-0" />
                  <a 
                    href={`tel:${settings.contactPhone.trim()}`} 
                    className="text-slate-400 hover:text-white font-medium transition-colors" 
                    dir="ltr"
                  >
                    {settings.contactPhone}
                  </a>
                </li>
              )}
              {settings.contactEmail && (
                <li className="flex items-start gap-3">
                  <Mail className="w-5 h-5 text-indigo-500 mt-1 flex-shrink-0" />
                  <a 
                    href={`mailto:${settings.contactEmail.trim()}`} 
                    className="text-slate-400 hover:text-white font-medium transition-colors"
                  >
                    {settings.contactEmail}
                  </a>
                </li>
              )}
              {settings.contactAddress && (
                <li className="flex items-start gap-3">
                  <MapPin className="w-5 h-5 text-indigo-500 mt-1 flex-shrink-0" />
                  <span className="text-slate-400 font-medium">{settings.contactAddress}</span>
                </li>
              )}
            </ul>
          </div>
        </div>

        <div className="mt-16 pt-8 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4 text-slate-500 text-sm font-medium">
          <p>جميع الحقوق محفوظة &copy; {new Date().getFullYear()} لـ {settings.platformName}.</p>
          <p className="text-xs font-mono font-bold text-indigo-400 tracking-wider">
            powered by <a 
              href="https://hybernotic-studio.ai.studio/" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="text-white hover:text-indigo-300 font-black transition-colors underline decoration-indigo-500/60 underline-offset-4"
              title="Hypernotic Studio"
            >
              Hypernotic Studio
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}
