import React, { useState, useMemo } from 'react';
import { X, Plus, Trash2, Calendar, Clock, Check, AlertCircle, Sparkles } from 'lucide-react';
import { useSettings } from '../contexts/SettingsContext';

interface GroupScheduleBuilderModalProps {
  isOpen: boolean;
  onClose: () => void;
  availableGroups: string[];
  onSelectGroup?: (groupName: string) => void;
}

const STANDARD_DAY_PATTERNS = [
  { id: 'sat_tue', label: 'السبت والثلاثاء', desc: 'المواعيد الرئيسية (أول الأسبوع ونصفه)' },
  { id: 'sun_wed', label: 'الأحد والأربعاء', desc: 'المواعيد الموازية' },
  { id: 'mon_thu', label: 'الإثنين والخميس', desc: 'المواعيد البديلة' },
  { id: 'fri_only', label: 'الجمعة فقط', desc: 'حصة مكثفة أسبوعية' },
  { id: 'custom', label: 'يومين مخصصين ⚙️', desc: 'اختيار يومين بحرية' },
];

const ALL_WEEKDAYS = ['السبت', 'الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة'];

const TIME_SLOTS = {
  morning: [
    '06:00 صباحاً',
    '06:30 صباحاً',
    '07:00 صباحاً',
    '07:30 صباحاً',
    '08:00 صباحاً',
    '08:30 صباحاً',
    '09:00 صباحاً',
    '09:30 صباحاً',
    '10:00 صباحاً',
    '10:30 صباحاً',
    '11:00 صباحاً',
    '11:30 صباحاً',
    '12:00 ظهراً'
  ],
  evening: [
    '01:00 مساءً',
    '01:30 مساءً',
    '02:00 مساءً',
    '02:30 مساءً',
    '03:00 مساءً',
    '03:30 مساءً',
    '04:00 مساءً',
    '04:30 مساءً',
    '05:00 مساءً',
    '05:30 مساءً',
    '06:00 مساءً',
    '06:30 مساءً',
    '07:00 مساءً',
    '07:30 مساءً',
    '08:00 مساءً',
    '08:30 مساءً',
    '09:00 مساءً',
    '09:30 مساءً',
    '10:00 مساءً'
  ]
};

export default function GroupScheduleBuilderModal({
  isOpen,
  onClose,
  availableGroups,
  onSelectGroup
}: GroupScheduleBuilderModalProps) {
  const { settings, updateSettings } = useSettings();

  const [selectedPattern, setSelectedPattern] = useState<string>('sat_tue');
  const [customDays, setCustomDays] = useState<string[]>(['السبت', 'الثلاثاء']);
  const [selectedTime, setSelectedTime] = useState<string>('10:30 صباحاً');
  const [isSaving, setIsSaving] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Compute the day string
  const resolvedDaysString = useMemo(() => {
    if (selectedPattern === 'sat_tue') return 'السبت والثلاثاء';
    if (selectedPattern === 'sun_wed') return 'الأحد والأربعاء';
    if (selectedPattern === 'mon_thu') return 'الإثنين والخميس';
    if (selectedPattern === 'fri_only') return 'الجمعة';
    if (selectedPattern === 'custom') {
      if (customDays.length === 0) return 'غير محدد';
      if (customDays.length === 1) return customDays[0];
      return customDays.join(' و');
    }
    return 'السبت والثلاثاء';
  }, [selectedPattern, customDays]);

  // Unified canonical group name generated automatically without typos/spaces
  const generatedGroupName = useMemo(() => {
    if (!resolvedDaysString || resolvedDaysString === 'غير محدد') return '';
    return `مجموعة ${resolvedDaysString} - ${selectedTime}`.replace(/\s+/g, ' ').trim();
  }, [resolvedDaysString, selectedTime]);

  const isAlreadyExisting = useMemo(() => {
    return availableGroups.some(g => g.trim() === generatedGroupName.trim());
  }, [availableGroups, generatedGroupName]);

  if (!isOpen) return null;

  const toggleCustomDay = (day: string) => {
    setCustomDays(prev => {
      if (prev.includes(day)) {
        return prev.filter(d => d !== day);
      }
      if (prev.length >= 2) {
        // Keep max 2 days
        return [prev[1], day];
      }
      return [...prev, day];
    });
  };

  const handleSaveGroup = async () => {
    if (!generatedGroupName) {
      setFeedbackMsg({ type: 'error', text: 'يرجى اختيار الأيام والموعد أولاً' });
      return;
    }
    if (isAlreadyExisting) {
      setFeedbackMsg({ type: 'error', text: 'هذه المجموعة مضافة وموجودة بالفعل في القائمة!' });
      return;
    }

    setIsSaving(true);
    setFeedbackMsg(null);
    try {
      const currentList = Array.isArray(settings.centerGroups) ? settings.centerGroups : [];
      const updated = Array.from(new Set([...currentList, generatedGroupName]));
      await updateSettings({ centerGroups: updated });
      
      setFeedbackMsg({ type: 'success', text: `تم إضافة [${generatedGroupName}] بنجاح!` });
      if (onSelectGroup) {
        onSelectGroup(generatedGroupName);
      }
      setTimeout(() => {
        setFeedbackMsg(null);
      }, 3000);
    } catch (err: any) {
      console.error(err);
      setFeedbackMsg({ type: 'error', text: 'حدث خطأ أثناء حفظ المجموعة' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteExistingGroup = async (groupName: string) => {
    if (!confirm(`هل تريد بالتأكيد حذف [${groupName}] من قائمة المجموعات؟`)) return;
    try {
      const currentList = Array.isArray(settings.centerGroups) ? settings.centerGroups : [];
      const updated = currentList.filter(g => g !== groupName);
      await updateSettings({ centerGroups: updated });
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden my-6 animate-in fade-in zoom-in-95 duration-150">
        
        {/* HEADER */}
        <div className="bg-gradient-to-r from-indigo-900 via-indigo-800 to-slate-900 p-6 text-white flex justify-between items-start">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center border border-white/20">
              <Calendar className="w-6 h-6 text-amber-300" />
            </div>
            <div>
              <h3 className="text-lg font-black flex items-center gap-2">
                <span>منشئ وجدول مواعيد مجموعات السنتر</span>
                <span className="text-[10px] bg-amber-400 text-slate-950 px-2 py-0.5 rounded-full font-black">
                  دقة 100% بدون كتابة يدوية
                </span>
              </h3>
              <p className="text-xs text-indigo-200 mt-1">
                اختر نمط الأيام والوقت من الجدول لتوليد اسم مجموعة موحد ومعتمد في المنظومة
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-indigo-200 hover:text-white hover:bg-white/10 rounded-xl transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* BODY */}
        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          
          {/* STEP 1: CHOOSE DAYS PATTERN */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 text-xs flex items-center justify-center font-bold">1</span>
                <span>اختر نمط يومي المحاضرة في الأسبوع:</span>
              </label>
              <span className="text-[11px] text-slate-500 font-bold">
                المحدد: <span className="text-indigo-700 font-black">{resolvedDaysString}</span>
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {STANDARD_DAY_PATTERNS.map(pat => {
                const isSelected = selectedPattern === pat.id;
                return (
                  <button
                    key={pat.id}
                    type="button"
                    onClick={() => setSelectedPattern(pat.id)}
                    className={`p-3 rounded-2xl text-right border transition-all cursor-pointer flex flex-col justify-between ${
                      isSelected
                        ? 'bg-indigo-600 text-white border-indigo-700 shadow-md shadow-indigo-600/20'
                        : 'bg-slate-50 hover:bg-slate-100 text-slate-800 border-slate-200'
                    }`}
                  >
                    <div className="font-black text-xs flex items-center justify-between">
                      <span>{pat.label}</span>
                      {isSelected && <Check className="w-3.5 h-3.5 text-amber-300" />}
                    </div>
                    <span className={`text-[10px] mt-1 line-clamp-1 ${isSelected ? 'text-indigo-100' : 'text-slate-500'}`}>
                      {pat.desc}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* CUSTOM DAYS PICKER IF CUSTOM SELECTED */}
            {selectedPattern === 'custom' && (
              <div className="mt-3 p-3.5 bg-amber-50 rounded-2xl border border-amber-200">
                <div className="text-xs font-bold text-amber-900 mb-2 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                  <span>انقر لاختيار يومين من الأسبوع للمجموعة:</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {ALL_WEEKDAYS.map(day => {
                    const isPicked = customDays.includes(day);
                    return (
                      <button
                        key={day}
                        type="button"
                        onClick={() => toggleCustomDay(day)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                          isPicked
                            ? 'bg-indigo-600 text-white shadow-xs'
                            : 'bg-white text-slate-700 hover:bg-amber-100 border border-slate-200'
                        }`}
                      >
                        {day} {isPicked ? '✓' : ''}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* STEP 2: CHOOSE TIME SLOT FROM TABLE */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 text-xs flex items-center justify-center font-bold">2</span>
                <span>اختر الموعد الدقيق من جدول الأوقات:</span>
              </label>
              <span className="text-[11px] text-slate-500 font-bold">
                المحدد: <span className="text-indigo-700 font-black">{selectedTime}</span>
              </span>
            </div>

            {/* MORNING SLOTS */}
            <div className="mb-3">
              <div className="text-[11px] font-black text-amber-800 bg-amber-100/60 px-2.5 py-1 rounded-lg inline-flex items-center gap-1 mb-2">
                <Clock className="w-3 h-3 text-amber-600" />
                <span>الفترة الصباحية (Morning)</span>
              </div>
              <div className="grid grid-cols-4 sm:grid-cols-8 gap-1.5">
                {TIME_SLOTS.morning.map(slot => {
                  const isSelected = selectedTime === slot;
                  return (
                    <button
                      key={slot}
                      type="button"
                      onClick={() => setSelectedTime(slot)}
                      className={`py-2 px-1 rounded-xl text-center text-[11px] font-black transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-indigo-600 text-white shadow-xs ring-2 ring-indigo-300'
                          : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200'
                      }`}
                    >
                      {slot}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* EVENING SLOTS */}
            <div>
              <div className="text-[11px] font-black text-indigo-900 bg-indigo-100/60 px-2.5 py-1 rounded-lg inline-flex items-center gap-1 mb-2">
                <Clock className="w-3 h-3 text-indigo-600" />
                <span>فترة بعد الظهر والمساء (Evening)</span>
              </div>
              <div className="grid grid-cols-4 sm:grid-cols-7 gap-1.5">
                {TIME_SLOTS.evening.map(slot => {
                  const isSelected = selectedTime === slot;
                  return (
                    <button
                      key={slot}
                      type="button"
                      onClick={() => setSelectedTime(slot)}
                      className={`py-2 px-1 rounded-xl text-center text-[11px] font-black transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-indigo-600 text-white shadow-xs ring-2 ring-indigo-300'
                          : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200'
                      }`}
                    >
                      {slot}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* STEP 3: PREVIEW & ADD */}
          <div className="bg-slate-900 text-white p-4 rounded-2xl border border-slate-800">
            <div className="text-[11px] text-slate-400 font-bold mb-1">
              معاينة اسم المجموعة المتولد تلقائياً (بدون أخطاء كتابية):
            </div>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="text-base sm:text-lg font-black text-amber-300 font-mono tracking-wide">
                {generatedGroupName || 'يرجى تحديد الأيام والموعد'}
              </div>

              <button
                type="button"
                onClick={handleSaveGroup}
                disabled={isSaving || !generatedGroupName || isAlreadyExisting}
                className={`w-full sm:w-auto px-5 py-2.5 rounded-xl font-black text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg ${
                  isAlreadyExisting
                    ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
                    : 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-emerald-950/30'
                }`}
              >
                <Plus className="w-4 h-4" />
                <span>{isAlreadyExisting ? 'موجودة بالفعل' : 'حفظ وإضافة للمنظومة'}</span>
              </button>
            </div>

            {feedbackMsg && (
              <div className={`mt-3 p-2 rounded-xl text-xs font-bold flex items-center gap-2 ${
                feedbackMsg.type === 'success' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'
              }`}>
                {feedbackMsg.type === 'success' ? <Check className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                <span>{feedbackMsg.text}</span>
              </div>
            )}
          </div>

          {/* CURRENT GROUPS LIST */}
          <div className="pt-2 border-t border-slate-100">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs font-black text-slate-900">
                المجموعات المسجلة حالياً في السنتر ({availableGroups.length}):
              </h4>
            </div>

            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {availableGroups.length === 0 ? (
                <div className="text-xs text-slate-400 text-center py-4">
                  لا توجد مجموعات مسجلة بعد، استخدم المنشئ أعلاه لإضافة مجموعتك الأولى.
                </div>
              ) : (
                availableGroups.map((grp, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-2.5 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-200 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-lg bg-indigo-100 text-indigo-800 text-[11px] font-black flex items-center justify-center">
                        {idx + 1}
                      </span>
                      <span className="text-xs font-black text-slate-800">{grp}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      {onSelectGroup && (
                        <button
                          type="button"
                          onClick={() => {
                            onSelectGroup(grp);
                            onClose();
                          }}
                          className="px-2.5 py-1 bg-indigo-100 hover:bg-indigo-200 text-indigo-800 rounded-lg text-[11px] font-bold transition-colors cursor-pointer"
                        >
                          اختيار
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => handleDeleteExistingGroup(grp)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                        title="حذف المجموعة"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>

        {/* FOOTER */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl text-xs font-bold transition-colors cursor-pointer"
          >
            إغلاق النافذة
          </button>
        </div>

      </div>
    </div>
  );
}
