import { PlayCircle, FileText, CheckCircle2, MessageCircleQuestion, BarChart3, GraduationCap, ArrowUpRight, Sparkles } from 'lucide-react';
import { motion } from 'motion/react';
import { useSettings } from '../contexts/SettingsContext';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function Features() {
  const { settings } = useSettings();
  const { user, appUser } = useAuth();
  const navigate = useNavigate();

  const handleFeatureClick = (tabId: string) => {
    if (!user && !appUser) {
      alert('عذراً، يجب عليك تسجيل الدخول أولاً للوصول إلى هذا القسم.');
      navigate('/login');
    } else {
      navigate(`/dashboard?tab=${tabId}`);
    }
  };

  const features = [
    {
      id: 'videos',
      name: 'محاضرات تفاعلية فائقة الجودة',
      description: 'شرح تفصيلي ومبسط لكل جزئيات المنهج بجودة 4K لتجربة مشاهدة ممتعة ومريحة، مع إمكانية إعادة المشاهدة في أي وقت.',
      icon: PlayCircle,
      gradient: 'from-blue-600 to-indigo-600',
      bgGlow: 'bg-blue-50/70',
      tag: 'شرح وافٍ',
    },
    {
      id: 'exams',
      name: 'امتحانات دورية وتصحيح لحظي',
      description: 'تقييم مستمر لمستواك عبر امتحانات أسبوعية وشهرية مطابقة لنظام الوزارة مع تفنيد الإجابات النموذجية فور الانتهاء.',
      icon: CheckCircle2,
      gradient: 'from-emerald-600 to-teal-600',
      bgGlow: 'bg-emerald-50/70',
      tag: 'تقييم فوري',
    },
    {
      id: 'materials',
      name: 'مذكرات وبنوك أسئلة شاملة',
      description: 'ملفات PDF حصرية مصممة باحترافية وألوان مريحة للعين، تتضمن ملخصات القواعد وبنوك أسئلة منسقة بأحدث الأنماط.',
      icon: FileText,
      gradient: 'from-purple-600 to-indigo-600',
      bgGlow: 'bg-purple-50/70',
      tag: 'ملازم PDF',
    },
    {
      id: 'support',
      name: 'دعم أكاديمي وفني دائم',
      description: 'فريق متخصص من المعلمين والمساعدين للإجابة على جميع استفساراتك وأسئلتك في المنهج على مدار اليوم.',
      icon: MessageCircleQuestion,
      gradient: 'from-rose-500 to-pink-600',
      bgGlow: 'bg-rose-50/70',
      tag: 'متابعة مباشرة',
    },
    {
      id: 'performance',
      name: 'تقارير أداء ومتابعة ولي الأمر',
      description: 'لوحة تحكم خاصة وتنبيهات فورية لولي الأمر تطلعه على درجات الامتحانات والواجبات ونسب الحضور أولاً بأول.',
      icon: BarChart3,
      gradient: 'from-amber-500 to-orange-500',
      bgGlow: 'bg-amber-50/70',
      tag: 'إشعار فوري',
    },
  ];

  if (settings.showFinalRevisions) {
    features.push({
      id: 'videos',
      name: 'معسكرات المراجعة النهائية',
      description: 'مراجعات ليلة الامتحان المكثفة، وحل أكثر من 1000 سؤال متوقع مع استراتيجيات التعامل مع ورقة الامتحان.',
      icon: GraduationCap,
      gradient: 'from-cyan-600 to-blue-600',
      bgGlow: 'bg-cyan-50/70',
      tag: 'الدرجة النهائية',
    });
  }

  return (
    <div id="features" className="py-24 bg-gradient-to-b from-white via-slate-50 to-white dark:from-[#070b14] dark:via-slate-950 dark:to-[#070b14] relative overflow-hidden transition-colors">
      {/* Glow Orbs */}
      <div className="absolute top-1/3 right-0 w-80 h-80 bg-indigo-100/40 dark:bg-indigo-950/20 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute bottom-10 left-0 w-80 h-80 bg-blue-100/40 dark:bg-blue-950/20 rounded-full blur-3xl pointer-events-none"></div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-indigo-100 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 font-black text-xs uppercase tracking-wider mb-4 border border-indigo-200 dark:border-indigo-800">
            <Sparkles className="w-3.5 h-3.5" /> مميزات تجعلنا خيارك الأول
          </span>
          <h2 className="text-3xl md:text-5xl font-black text-slate-900 dark:text-white mb-6 leading-tight">
            بيئة تعليمية متكاملة <br className="hidden md:block"/> صُممت خصيصاً لتفوقك
          </h2>
          <p className="text-base sm:text-lg text-slate-600 dark:text-slate-400 font-medium leading-relaxed">
            نوفر لك ولولي أمرك كل الأدوات الذكية التي تجعل تجربة التعلم ممتعة، سهلة، ومثمرة لتحقيق أعلى الدرجات.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <div
                key={feature.name}
                onClick={() => handleFeatureClick(feature.id)}
                className="block group"
              >
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: index * 0.1 }}
                  className="bg-white dark:bg-slate-900 rounded-3xl p-7 shadow-sm hover:shadow-xl border-2 border-slate-100 dark:border-slate-800 hover:border-indigo-200 dark:hover:border-indigo-600/50 transition-all duration-300 h-full cursor-pointer hover:-translate-y-1 relative overflow-hidden flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between mb-6">
                      <div className={`w-14 h-14 rounded-2xl bg-gradient-to-tr ${feature.gradient} text-white flex items-center justify-center shadow-md group-hover:scale-110 transition-transform`}>
                        <Icon className="w-7 h-7" />
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="px-3 py-1 bg-slate-100 dark:bg-slate-800 group-hover:bg-indigo-50 dark:group-hover:bg-indigo-950/80 text-slate-700 dark:text-slate-300 group-hover:text-indigo-700 dark:group-hover:text-indigo-300 text-xs font-black rounded-full transition-colors border border-transparent dark:border-slate-700">
                          {feature.tag}
                        </span>
                        <div className="w-8 h-8 rounded-full bg-slate-50 dark:bg-slate-800 group-hover:bg-indigo-600 group-hover:text-white flex items-center justify-center transition-all text-slate-400 dark:text-slate-400">
                          <ArrowUpRight className="w-4 h-4" />
                        </div>
                      </div>
                    </div>

                    <h3 className="text-xl font-black text-slate-900 dark:text-white mb-3 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                      {feature.name}
                    </h3>
                    <p className="text-slate-600 dark:text-slate-400 leading-relaxed text-sm font-medium">
                      {feature.description}
                    </p>
                  </div>

                  <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800 text-xs font-black text-indigo-600 dark:text-indigo-400 flex items-center gap-1">
                    <span>استكشف القسم</span>
                    <span>←</span>
                  </div>
                </motion.div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
