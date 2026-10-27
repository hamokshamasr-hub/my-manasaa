import React, { useState } from 'react';
import { 
  Calendar, 
  Clock, 
  Plus, 
  Trash2, 
  Check, 
  X, 
  Sparkles, 
  AlertTriangle, 
  Building, 
  GraduationCap, 
  ToggleLeft, 
  ToggleRight,
  Info,
  Layers
} from 'lucide-react';

export interface ExtraSlot {
  id: string;
  day: string; // e.g. "الجمعة", "السبت", "الأحد", etc.
  time: string; // e.g. "05:00 م", "07:00 م", "09:00 م", "09:00 ص"
  room?: string; // e.g. "القاعة الكبرى"
}

export interface MultiSlotExtraSession {
  id: string;
  title: string;
  targetGrade: string; // 'all' or specific grade
  slots: ExtraSlot[];
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD (validity duration)
  isActive: boolean;
  notes?: string;
  createdAt: number;
}

interface ExtraSessionManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  plans: MultiSlotExtraSession[];
  onSavePlan: (plan: MultiSlotExtraSession) => void;
  onDeletePlan: (planId: string) => void;
  onToggleActive: (planId: string, isActive: boolean) => void;
  availableGrades: string[];
}

export default function ExtraSessionManagerModal({
  isOpen,
  onClose,
  plans,
  onSavePlan,
  onDeletePlan,
  onToggleActive,
  availableGrades
}: ExtraSessionManagerModalProps) {
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null);

  // Form State
  const [title, setTitle] = useState('ميعاد إضافي جديد (مراجعة / تعويض)');
  const [targetGrade, setTargetGrade] = useState('all');
  const [startDate, setStartDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().split('T')[0];
  });
  const [slots, setSlots] = useState<ExtraSlot[]>([
    { id: 'slot_1', day: 'الجمعة', time: '05:00 م', room: 'القاعة الرئيسية' }
  ]);
  const [notes, setNotes] = useState('ميعاد إضافي متاح للطلاب لتعويض ما فاتهم أو لحضور مراجعات مكثفة.');

  if (!isOpen) return null;

  const ALL_DAYS = ['السبت', 'الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة'];

  const handleAddSlot = (preferredDay?: string, preferredTime?: string) => {
    const newSlot: ExtraSlot = {
      id: `slot_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      day: preferredDay || (slots[slots.length - 1]?.day || 'الجمعة'),
      time: preferredTime || '05:00 م',
      room: 'القاعة الرئيسية'
    };
    setSlots(prev => [...prev, newSlot]);
  };

  const handleApplySingleDayPreset = (dayName: string) => {
    setTitle(`مجموعة يوم ${dayName} الإضافية`);
    setSlots([
      { id: `slot_${Date.now()}_1`, day: dayName, time: '05:00 م', room: 'القاعة الرئيسية' },
      { id: `slot_${Date.now()}_2`, day: dayName, time: '07:00 م', room: 'القاعة الرئيسية' },
      { id: `slot_${Date.now()}_3`, day: dayName, time: '09:00 م', room: 'القاعة الرئيسية' }
    ]);
  };

  const handleApplyDaysPairPreset = (day1: string, day2: string) => {
    setTitle(`مجموعة ${day1} و${day2} الإضافية`);
    setSlots([
      { id: `slot_${Date.now()}_1`, day: day1, time: '05:00 م', room: 'القاعة الرئيسية' },
      { id: `slot_${Date.now()}_2`, day: day2, time: '09:00 ص', room: 'القاعة 2' }
    ]);
  };

  const handleSetDurationDays = (daysCount: number) => {
    const start = new Date(startDate || new Date());
    const end = new Date(start);
    end.setDate(end.getDate() + (daysCount - 1));
    setEndDate(end.toISOString().split('T')[0]);
  };

  const handleRemoveSlot = (slotId: string) => {
    if (slots.length <= 1) {
      alert('يجب أن يحتوي الميعاد الإضافي على ميعاد واحد على الأقل.');
      return;
    }
    setSlots(prev => prev.filter(s => s.id !== slotId));
  };

  const handleUpdateSlot = (slotId: string, field: keyof ExtraSlot, val: string) => {
    setSlots(prev => prev.map(s => s.id === slotId ? { ...s, [field]: val } : s));
  };

  const handleResetForm = () => {
    setEditingPlanId(null);
    setTitle('ميعاد إضافي جديد (مراجعة / تعويض)');
    setTargetGrade('all');
    setStartDate(new Date().toISOString().split('T')[0]);
    const d = new Date();
    d.setDate(d.getDate() + 7);
    setEndDate(d.toISOString().split('T')[0]);
    setSlots([
      { id: 'slot_1', day: 'الجمعة', time: '05:00 م', room: 'القاعة الرئيسية' }
    ]);
  };

  const handleStartEdit = (plan: MultiSlotExtraSession) => {
    setEditingPlanId(plan.id);
    setTitle(plan.title);
    setTargetGrade(plan.targetGrade || 'all');
    setStartDate(plan.startDate);
    setEndDate(plan.endDate);
    setSlots(plan.slots && plan.slots.length > 0 ? plan.slots : [
      { id: 'slot_1', day: 'الجمعة', time: '05:00 م' }
    ]);
    setNotes(plan.notes || '');
  };

  const handleSaveSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      alert('يرجى إدخال اسم الميعاد الإضافي.');
      return;
    }
    if (slots.length === 0) {
      alert('يرجى إضافة ميعاد واحد على الأقل.');
      return;
    }

    const newPlan: MultiSlotExtraSession = {
      id: editingPlanId || `extra_${Date.now()}`,
      title: title.trim(),
      targetGrade,
      slots,
      startDate,
      endDate,
      isActive: true,
      notes: notes.trim(),
      createdAt: Date.now()
    };

    onSavePlan(newPlan);
    handleResetForm();
  };

  const isExpired = (endIso: string) => {
    if (!endIso) return false;
    const now = new Date().setHours(0, 0, 0, 0);
    const end = new Date(endIso).setHours(23, 59, 59, 999);
    return now > end;
  };

  const getRemainingDays = (endIso: string) => {
    if (!endIso) return '';
    const now = new Date().getTime();
    const end = new Date(endIso).getTime();
    const diff = Math.ceil((end - now) / (1000 * 3600 * 24));
    if (diff < 0) return 'منتهي الصلاحية ⏰';
    if (diff === 0) return 'ينتهي اليوم ⏳';
    return `متبقي ${diff} يوم`;
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-3xl overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-200">
        
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-amber-600 via-amber-700 to-amber-800 text-white p-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-sm flex items-center justify-center text-white font-black text-xl shadow-inner">
              <Calendar className="w-6 h-6 text-amber-200" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-black text-white">إدارة المواعيد الإضافية الذكية (Multi-Slots)</h2>
              <p className="text-xs text-amber-100 font-bold mt-0.5">
                إضافة عدة مواعيد باليوم الواحد (مثل الجمعة 5 و 7 و 9) أو عدة أيام معاً، وتحديد مدة الصلاحية وإزالتها بعد الانتهاء.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          
          {/* 1. EXISTING EXTRA SESSIONS LIST */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                <Layers className="w-4 h-4 text-amber-600" />
                <span>المواعيد الإضافية المسجلة حالياً ({plans.length}):</span>
              </h3>
              {editingPlanId && (
                <button
                  onClick={handleResetForm}
                  className="text-xs font-bold text-amber-700 hover:underline"
                >
                  + إنشاء ميعاد إضافي جديد
                </button>
              )}
            </div>

            {plans.length === 0 ? (
              <div className="p-6 text-center bg-slate-50 border border-slate-200 rounded-2xl text-slate-500 text-xs font-medium">
                لا توجد مواعيد إضافية مسجلة بعد. استخدم النموذج أدناه لإنشاء أول موعد إضافي متعدد الفترات.
              </div>
            ) : (
              <div className="space-y-3">
                {plans.map(p => {
                  const expired = isExpired(p.endDate);
                  return (
                    <div
                      key={p.id}
                      className={`p-4 rounded-2xl border-2 transition-all ${
                        p.isActive && !expired
                          ? 'bg-amber-50/70 border-amber-300 shadow-sm'
                          : 'bg-slate-50 border-slate-200 opacity-80'
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-black text-sm text-slate-900">{p.title}</span>
                            <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                              p.isActive && !expired
                                ? 'bg-emerald-600 text-white'
                                : 'bg-slate-400 text-white'
                            }`}>
                              {p.isActive ? (expired ? 'انتهت مدته ⏰' : 'نشط بالقاعة ⚡') : 'معطل'}
                            </span>
                            <span className="text-[10px] font-bold bg-amber-100 text-amber-900 px-2 py-0.5 rounded-md border border-amber-200">
                              {getRemainingDays(p.endDate)}
                            </span>
                            {p.targetGrade !== 'all' && (
                              <span className="text-[10px] font-bold bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-md border border-indigo-200">
                                {p.targetGrade}
                              </span>
                            )}
                          </div>

                          {/* Slots List Badges */}
                          <div className="flex items-center gap-1.5 flex-wrap mt-2.5">
                            <span className="text-[11px] font-bold text-slate-500">المواعيد المتاحة:</span>
                            {p.slots.map(s => (
                              <span
                                key={s.id}
                                className="bg-white px-2.5 py-1 rounded-lg border border-amber-200 text-xs font-black text-amber-950 flex items-center gap-1 shadow-xs"
                              >
                                <Clock className="w-3 h-3 text-amber-600" />
                                <span>{s.day} ({s.time})</span>
                                {s.room && <span className="text-[10px] text-slate-400">• {s.room}</span>}
                              </span>
                            ))}
                          </div>

                          <div className="text-[11px] text-slate-500 mt-2 flex items-center gap-4">
                            <span>صلاحية الميعاد: من <b>{p.startDate}</b> إلى <b>{p.endDate}</b></span>
                          </div>
                        </div>

                        {/* Plan Controls */}
                        <div className="flex items-center gap-2 flex-shrink-0 self-end sm:self-center">
                          {/* Toggle Active Switch */}
                          <button
                            type="button"
                            onClick={() => onToggleActive(p.id, !p.isActive)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 transition-colors cursor-pointer ${
                              p.isActive
                                ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                                : 'bg-slate-200 hover:bg-slate-300 text-slate-700'
                            }`}
                          >
                            <span>{p.isActive ? 'مفعل ✓' : 'تفعيل'}</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleStartEdit(p)}
                            className="px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                          >
                            تعديل
                          </button>

                          {/* ONE CLICK REMOVAL / DELETION */}
                          <button
                            type="button"
                            onClick={() => {
                              if (confirm(`هل أنت متأكد من إزالة وحذف الميعاد الإضافي "${p.title}" نهائياً؟`)) {
                                onDeletePlan(p.id);
                              }
                            }}
                            className="p-2 text-rose-600 hover:bg-rose-50 rounded-xl border border-rose-200 transition-colors cursor-pointer"
                            title="إزالة وحذف الميعاد الإضافي نهائياً"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* 2. CREATE / EDIT FORM */}
          <form onSubmit={handleSaveSubmit} className="bg-slate-50 p-5 rounded-3xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h4 className="font-black text-sm text-slate-900 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-600" />
                <span>{editingPlanId ? 'تعديل بيانات الميعاد الإضافي' : 'إنشاء ميعاد إضافي جديد متعدد المواعيد:'}</span>
              </h4>
              <span className="text-[11px] font-bold text-slate-500">يدعم عدة فترات باليوم الواحد وعدة أيام</span>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-black text-slate-800 block mb-1">عنوان / اسم الميعاد الإضافي:</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="مثال: مراجعة ليلة الامتحان الشاملة - الجمعة والسبت"
                  className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="text-xs font-black text-slate-800 block mb-1">المرحلة / الصف المستهدف:</label>
                <select
                  value={targetGrade}
                  onChange={e => setTargetGrade(e.target.value)}
                  className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 outline-none focus:border-amber-500"
                >
                  <option value="all">🌐 جميع المراحل والصفوف (حضور عام)</option>
                  {availableGrades.map(g => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* DURATION / VALIDITY DATES */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 space-y-2">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <label className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-amber-600" />
                  <span>تحديد مدة الصلاحية (صلاحية الميعاد الإضافي وإزالته بعد انتهائه):</span>
                </label>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    type="button"
                    onClick={() => handleSetDurationDays(1)}
                    className="text-[10px] font-bold bg-slate-100 hover:bg-slate-200 px-2 py-0.5 rounded text-slate-700 cursor-pointer"
                  >
                    يوم واحد فقط
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSetDurationDays(3)}
                    className="text-[10px] font-bold bg-slate-100 hover:bg-slate-200 px-2 py-0.5 rounded text-slate-700 cursor-pointer"
                  >
                    3 أيام
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSetDurationDays(7)}
                    className="text-[10px] font-bold bg-amber-100 hover:bg-amber-200 px-2 py-0.5 rounded text-amber-900 cursor-pointer font-black"
                  >
                    أسبوع كامل (7 أيام)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSetDurationDays(14)}
                    className="text-[10px] font-bold bg-slate-100 hover:bg-slate-200 px-2 py-0.5 rounded text-slate-700 cursor-pointer"
                  >
                    أسبوعين (14 يوم)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSetDurationDays(30)}
                    className="text-[10px] font-bold bg-slate-100 hover:bg-slate-200 px-2 py-0.5 rounded text-slate-700 cursor-pointer"
                  >
                    شهر كامل
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <span className="text-[11px] font-bold text-slate-500 block mb-1">يبدأ من تاريخ:</span>
                  <input
                    type="date"
                    value={startDate}
                    onChange={e => setStartDate(e.target.value)}
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <span className="text-[11px] font-bold text-slate-500 block mb-1">ينتهي في تاريخ (تلقائي):</span>
                  <input
                    type="date"
                    value={endDate}
                    onChange={e => setEndDate(e.target.value)}
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 outline-none focus:border-amber-500"
                  />
                </div>
              </div>
            </div>

            {/* DYNAMIC MULTI-SLOT BUILDER */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <h5 className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-amber-600" />
                    <span>مواعيد وفترات الحصة الإضافية (يمكنك تحديد يوم واحد أو عدة أيام، وبعدة فترات):</span>
                  </h5>
                  <p className="text-[11px] text-slate-500 font-medium">
                    حرية تامة: يمكنك جعلها يوم الإثنين فقط، أو الجمعة فقط، أو الجمعة 5م و7م و9م، أو الجمعة والسبت، إلخ.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => handleAddSlot()}
                  className="bg-amber-600 hover:bg-amber-700 text-white font-black px-3.5 py-1.5 rounded-xl text-xs flex items-center gap-1 shadow-xs cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>إضافة توقيت آخر +</span>
                </button>
              </div>

              {/* Single Day Quick Selectors */}
              <div className="p-3 bg-amber-50/60 rounded-xl border border-amber-200/80 space-y-2">
                <span className="text-[11px] font-black text-amber-950 block">⚡ تخصيص سريع ليوم واحد فقط (بـ 3 فترات مختلفة في نفس اليوم 5م، 7م، 9م):</span>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {ALL_DAYS.map(dayName => (
                    <button
                      key={dayName}
                      type="button"
                      onClick={() => handleApplySingleDayPreset(dayName)}
                      className="bg-white hover:bg-amber-600 hover:text-white text-slate-700 border border-slate-300 hover:border-amber-600 text-xs font-bold px-2.5 py-1 rounded-lg transition-all shadow-2xs cursor-pointer"
                    >
                      {dayName} فقط
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => handleApplyDaysPairPreset('الجمعة', 'السبت')}
                    className="bg-amber-600 text-white text-xs font-black px-3 py-1 rounded-lg transition-all shadow-xs cursor-pointer mr-auto"
                  >
                    ميكس (الجمعة + السبت)
                  </button>
                </div>
              </div>

              {/* Slots List */}
              <div className="space-y-2.5">
                {slots.map((slot, index) => (
                  <div 
                    key={slot.id} 
                    className="flex flex-wrap items-center gap-2 p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                  >
                    <span className="w-6 h-6 rounded-full bg-amber-100 text-amber-900 font-black text-xs flex items-center justify-center flex-shrink-0">
                      {index + 1}
                    </span>

                    {/* Day selector */}
                    <div className="w-28 flex-shrink-0">
                      <select
                        value={slot.day}
                        onChange={e => handleUpdateSlot(slot.id, 'day', e.target.value)}
                        className="w-full p-1.5 bg-white border border-slate-300 rounded-lg text-xs font-black text-slate-800 outline-none"
                      >
                        {ALL_DAYS.map(d => (
                          <option key={d} value={d}>{d}</option>
                        ))}
                      </select>
                    </div>

                    {/* Time Input / Selector */}
                    <div className="w-36 flex-shrink-0">
                      <input
                        type="text"
                        value={slot.time}
                        onChange={e => handleUpdateSlot(slot.id, 'time', e.target.value)}
                        placeholder="مثال: 05:00 م"
                        className="w-full p-1.5 bg-white border border-slate-300 rounded-lg text-xs font-black text-slate-800 text-center outline-none"
                      />
                    </div>

                    {/* Room input */}
                    <div className="flex-1 min-w-[120px]">
                      <input
                        type="text"
                        value={slot.room || ''}
                        onChange={e => handleUpdateSlot(slot.id, 'room', e.target.value)}
                        placeholder="القاعة (اختياري: القاعة 1)"
                        className="w-full p-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-700 outline-none"
                      />
                    </div>

                    {/* Remove slot */}
                    <button
                      type="button"
                      onClick={() => handleRemoveSlot(slot.id)}
                      className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                      title="حذف هذا الموعد"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>

              {/* Quick Preset Buttons for easy addition */}
              <div className="flex items-center gap-2 flex-wrap pt-2 text-[11px] font-bold text-slate-500">
                <span>إضافة توقيت إضافي بنقرة زر:</span>
                {[
                  { time: '05:00 م' },
                  { time: '07:00 م' },
                  { time: '09:00 م' },
                  { time: '09:00 ص' },
                  { time: '11:00 ص' },
                  { time: '02:00 م' },
                  { time: '04:00 م' },
                ].map((pre, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleAddSlot(slots[slots.length - 1]?.day || 'الجمعة', pre.time)}
                    className="bg-white hover:bg-amber-100 text-amber-900 border border-slate-300 hover:border-amber-300 px-2 py-1 rounded-md text-[10px] transition-colors cursor-pointer font-bold"
                  >
                    + الساعة {pre.time}
                  </button>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-2">
              {editingPlanId && (
                <button
                  type="button"
                  onClick={handleResetForm}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-200"
                >
                  إلغاء التعديل
                </button>
              )}
              <button
                type="submit"
                className="bg-amber-600 hover:bg-amber-700 text-white font-black px-6 py-2.5 rounded-xl text-xs flex items-center gap-2 shadow-md cursor-pointer transition-all active:scale-95"
              >
                <Check className="w-4 h-4" />
                <span>{editingPlanId ? 'حفظ تعديلات الميعاد الإضافي' : 'اعتماد وحفظ الميعاد الإضافي الآن'}</span>
              </button>
            </div>
          </form>

        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-100 border-t border-slate-200 flex items-center justify-between text-xs font-bold text-slate-600">
          <div className="flex items-center gap-1.5">
            <Info className="w-4 h-4 text-amber-600" />
            <span>عند تفعيل أي ميعاد إضافي، سيتعرف ماسح الباركود تلقائياً على جميع الطلاب المستهدفين.</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 text-white rounded-xl font-bold cursor-pointer hover:bg-slate-800"
          >
            إغلاق
          </button>
        </div>

      </div>
    </div>
  );
}
