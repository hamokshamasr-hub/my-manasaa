import { Users, BookOpen, Clock, Award, Sparkles } from 'lucide-react';
import { motion } from 'motion/react';
import { useSettings } from '../contexts/SettingsContext';

export default function Stats() {
  const { settings } = useSettings();

  const stats = [
    {
      id: 1,
      name: 'سنوات من الخبرة والعطاء',
      value: `+${settings.yearsOfExperience}`,
      icon: Clock,
      gradient: 'from-blue-500 to-cyan-400',
      badge: 'خبرة موثوقة',
    },
    {
      id: 2,
      name: 'طالب وطالبة في المنصة',
      value: `+${settings.studentCount.toLocaleString('en-US')}`,
      icon: Users,
      gradient: 'from-indigo-500 to-purple-400',
      badge: 'مجتمعنا التعليمي',
    },
    {
      id: 3,
      name: 'مراحل دراسية متخصصة',
      value: '6',
      description: 'إعدادي وثانوي',
      icon: BookOpen,
      gradient: 'from-emerald-500 to-teal-400',
      badge: 'مناهج معتمدة',
    },
    {
      id: 4,
      name: 'أوائل محافظات وجمهورية',
      value: '+50',
      icon: Award,
      gradient: 'from-amber-400 to-orange-400',
      badge: 'قصص نجاح',
    },
  ];

  return (
    <div className="bg-gradient-to-r from-indigo-900 via-indigo-800 to-blue-900 py-16 relative overflow-hidden text-white shadow-2xl">
      {/* Decorative luminous blur circles */}
      <div className="absolute top-0 right-1/4 w-96 h-96 bg-indigo-500/15 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute bottom-0 left-1/4 w-96 h-96 bg-cyan-400/15 rounded-full blur-3xl pointer-events-none"></div>
      
      {/* Subtle grid pattern */}
      <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(#ffffff 1.5px, transparent 1.5px)', backgroundSize: '24px 24px' }}></div>
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="text-center mb-10">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 text-cyan-300 text-xs font-black backdrop-blur-sm border border-white/10 mb-2">
            <Sparkles className="w-3.5 h-3.5" /> أرقام تتحدث عن إنجازاتنا
          </span>
          <h2 className="text-2xl sm:text-3xl font-black text-white">نبني مستقبل أبنائنا بكل فخر وإتقان</h2>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          {stats.map((stat, index) => {
            const Icon = stat.icon;
            return (
              <motion.div
                key={stat.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                className="bg-white/10 hover:bg-white/15 backdrop-blur-md border border-white/20 hover:border-white/30 rounded-3xl p-5 sm:p-6 text-center text-white transition-all hover:-translate-y-1 shadow-lg group"
              >
                <div className={`mx-auto w-14 h-14 rounded-2xl flex items-center justify-center mb-4 bg-gradient-to-tr ${stat.gradient} text-white shadow-lg group-hover:scale-110 transition-transform`}>
                  <Icon className="w-7 h-7" />
                </div>
                <div className="text-3xl sm:text-4xl font-black text-white mb-1 font-mono tracking-tight">
                  {stat.value}
                </div>
                <div className="text-xs sm:text-sm font-bold text-indigo-100 mb-2">
                  {stat.name}
                </div>
                <span className="inline-block px-2.5 py-0.5 rounded-full bg-white/10 text-white/90 text-[10px] font-bold">
                  {stat.badge}
                </span>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
