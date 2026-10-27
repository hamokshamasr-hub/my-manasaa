import { CheckCircle2 } from 'lucide-react';
import { motion } from 'motion/react';
import { useSettings } from '../contexts/SettingsContext';

const stages = [
  {
    title: 'المرحلة الثانوية',
    grades: ['الصف الأول الثانوي', 'الصف الثاني الثانوي (أو الثاني بكالوريا)', 'الصف الثالث الثانوي (أو الثالث بكالوريا)'],
    badge: 'النظام الجديد',
    color: 'bg-indigo-600',
    lightColor: 'bg-indigo-50',
    borderColor: 'border-indigo-100',
    isMiddle: false
  },
  {
    title: 'المرحلة الإعدادية',
    grades: ['الصف الأول الإعدادي', 'الصف الثاني الإعدادي', 'الصف الثالث الإعدادي'],
    badge: 'تأسيس قوي',
    color: 'bg-emerald-600',
    lightColor: 'bg-emerald-50',
    borderColor: 'border-emerald-100',
    isMiddle: true
  }
];

export default function Stages() {
  const { settings } = useSettings();
  
  const visibleStages = stages.filter(stage => 
    !stage.isMiddle || (stage.isMiddle && (settings.showMiddleSchool ?? true))
  );

  return (
    <div id="stages" className="py-24 bg-white dark:bg-[#070b14] transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-3xl md:text-4xl font-black text-slate-900 dark:text-white mb-6">المراحل الدراسية</h2>
          <p className="text-lg text-slate-600 dark:text-slate-300 font-medium">
            تغطية شاملة لمناهج اللغة الإنجليزية بأحدث المواصفات لجميع صفوف المرحلتين.
          </p>
        </div>

        <div className={`grid md:grid-cols-${visibleStages.length === 1 ? '1 max-w-2xl' : '2 max-w-5xl'} gap-8 mx-auto`}>
          {visibleStages.map((stage, index) => (
            <motion.div
              key={stage.title}
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.2 }}
              className={`rounded-3xl border-2 ${stage.borderColor} dark:border-slate-800 overflow-hidden shadow-sm`}
            >
              <div className={`${stage.lightColor} dark:bg-slate-800/80 p-8 text-center border-b ${stage.borderColor} dark:border-slate-800 relative`}>
                <span className={`absolute top-4 left-4 ${stage.color} text-white text-xs font-bold px-3 py-1 rounded-full shadow-sm`}>
                  {stage.badge}
                </span>
                <h3 className="text-2xl font-black text-slate-900 dark:text-white">{stage.title}</h3>
              </div>
              <div className="p-8 bg-white dark:bg-slate-900">
                <ul className="space-y-4">
                  {stage.grades.map((grade) => (
                    <li key={grade} className="flex items-center gap-3">
                      <CheckCircle2 className={`w-6 h-6 ${stage.color.replace('bg-', 'text-')}`} />
                      <span className="text-lg font-bold text-slate-700 dark:text-slate-200">{grade}</span>
                    </li>
                  ))}
                </ul>
                <a href="/payment" className={`w-full mt-8 block text-center ${stage.color} hover:opacity-90 text-white font-bold py-4 rounded-xl transition-opacity text-lg shadow-md`}>
                  تصفح الكورسات
                </a>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
