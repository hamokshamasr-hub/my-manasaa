import React, { useState } from 'react';
import { BunnyLibrary, PlatformSettings } from '../contexts/SettingsContext';
import { 
  Server, 
  Plus, 
  Trash2, 
  Edit3, 
  Check, 
  Copy, 
  Eye, 
  EyeOff, 
  Shield, 
  Key, 
  Film, 
  Star, 
  AlertTriangle, 
  Info,
  ExternalLink,
  X
} from 'lucide-react';

interface Props {
  settingsForm: PlatformSettings;
  setSettingsForm: React.Dispatch<React.SetStateAction<PlatformSettings>>;
}

export default function AdminBunnyLibrariesManager({ settingsForm, setSettingsForm }: Props) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingLibraryId, setEditingLibraryId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [visibleKeyIds, setVisibleKeyIds] = useState<Record<string, boolean>>({});

  // Form state for adding/editing a library
  const [formData, setFormData] = useState<Partial<BunnyLibrary>>({
    name: '',
    libraryId: '',
    apiKey: '',
    watermarkTokenKey: '',
    cdnHostname: 'video.b-cdn.net',
    grade: '',
    isDefault: false
  });
  const [formError, setFormError] = useState('');

  // Current libraries list (fallback to defaults if empty)
  const libraries: BunnyLibrary[] = settingsForm.bunnyLibraries && settingsForm.bunnyLibraries.length > 0 
    ? settingsForm.bunnyLibraries 
    : [
        {
          id: 'lib_g1',
          name: 'مكتبة الصف الأول الثانوي',
          libraryId: settingsForm.bunnyLibraryIdG1 || '767120',
          apiKey: settingsForm.bunnyApiKeyG1 || 'b5f13fb9-4eb0-4fb4-833057a5148f-70fb-419a',
          watermarkTokenKey: '',
          cdnHostname: 'video.b-cdn.net',
          grade: 'الصف الأول الثانوي',
          isDefault: false,
          createdAt: 1700000000000
        },
        {
          id: 'lib_g2',
          name: 'مكتبة الصف الثاني الثانوي',
          libraryId: settingsForm.bunnyLibraryIdG2 || '767124',
          apiKey: settingsForm.bunnyApiKeyG2 || 'c9ae2432-bbb8-4319-8e5eea17c676-1b0d-41b9',
          watermarkTokenKey: '',
          cdnHostname: 'video.b-cdn.net',
          grade: 'الصف الثاني الثانوي',
          isDefault: false,
          createdAt: 1700000000000
        },
        {
          id: 'lib_g3',
          name: 'مكتبة الصف الثالث الثانوي',
          libraryId: settingsForm.bunnyLibraryIdG3 || '767125',
          apiKey: settingsForm.bunnyApiKeyG3 || '13dc4b71-7b28-475d-b1910a51320b-20b4-45d8',
          watermarkTokenKey: '',
          cdnHostname: 'video.b-cdn.net',
          grade: 'الصف الثالث الثانوي',
          isDefault: true,
          createdAt: 1700000000000
        }
      ];

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const toggleKeyVisibility = (id: string) => {
    setVisibleKeyIds(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const openAddModal = () => {
    setEditingLibraryId(null);
    setFormData({
      name: '',
      libraryId: '',
      apiKey: '',
      watermarkTokenKey: '',
      cdnHostname: 'video.b-cdn.net',
      grade: settingsForm.grades?.[0] || 'الصف الأول الثانوي',
      isDefault: libraries.length === 0
    });
    setFormError('');
    setIsModalOpen(true);
  };

  const openEditModal = (lib: BunnyLibrary) => {
    setEditingLibraryId(lib.id);
    setFormData({ ...lib });
    setFormError('');
    setIsModalOpen(true);
  };

  const handleDeleteLibrary = (lib: BunnyLibrary) => {
    const confirmDelete = window.confirm(
      `⚠️ تأكيد حذف المكتبة:\nهل أنت متأكد من حذف "${lib.name}" (معرف: ${lib.libraryId})؟\n\nتنويه هام: بعد حذف المكتبة من المنصة، لن تتمكن من رفع فيديوهات جديدة إليها عبر لوحة التحكم. الفيديوهات المرفوعة مسبقاً عليها ستظل تعمل بروابطها المباشرة.`
    );
    if (!confirmDelete) return;

    const updated = libraries.filter(item => item.id !== lib.id);
    updateLibrariesList(updated);
  };

  const handleSetDefault = (libId: string) => {
    const updated = libraries.map(lib => ({
      ...lib,
      isDefault: lib.id === libId
    }));
    updateLibrariesList(updated);
  };

  const updateLibrariesList = (updated: BunnyLibrary[]) => {
    // If no default exists and list is not empty, mark the first one as default
    if (updated.length > 0 && !updated.some(l => l.isDefault)) {
      updated[0].isDefault = true;
    }

    // Keep backwards compatibility keys in sync
    const g1 = updated.find(l => l.grade?.includes('الأول') || l.id === 'lib_g1');
    const g2 = updated.find(l => l.grade?.includes('الثاني') || l.id === 'lib_g2');
    const g3 = updated.find(l => l.grade?.includes('الثالث') || l.id === 'lib_g3');
    const def = updated.find(l => l.isDefault) || updated[0];

    setSettingsForm(prev => ({
      ...prev,
      bunnyLibraries: updated,
      bunnyLibraryIdG1: g1?.libraryId || prev.bunnyLibraryIdG1,
      bunnyApiKeyG1: g1?.apiKey || prev.bunnyApiKeyG1,
      bunnyLibraryIdG2: g2?.libraryId || prev.bunnyLibraryIdG2,
      bunnyApiKeyG2: g2?.apiKey || prev.bunnyApiKeyG2,
      bunnyLibraryIdG3: g3?.libraryId || prev.bunnyLibraryIdG3,
      bunnyApiKeyG3: g3?.apiKey || prev.bunnyApiKeyG3,
      defaultBunnyLibraryId: def?.libraryId,
      defaultBunnyApiKey: def?.apiKey
    }));
  };

  const handleSaveForm = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    const trimmedName = formData.name?.trim();
    const trimmedLibId = formData.libraryId?.trim();
    const trimmedApiKey = formData.apiKey?.trim();

    if (!trimmedName) {
      setFormError('يرجى كتابة اسم واضح للمكتبة (مثال: مكتبة الصف السادس الإعدادي)');
      return;
    }
    if (!trimmedLibId || !/^\d+$/.test(trimmedLibId)) {
      setFormError('يرجى إدخال Library ID رقمي صحيح من حسابك في Bunny.net');
      return;
    }
    if (!trimmedApiKey) {
      setFormError('يرجى إدخال API Key (Access Key) الخاص بالمكتبة للتمكن من الرفع');
      return;
    }

    // Check duplicate Library ID
    const duplicate = libraries.find(
      l => l.libraryId === trimmedLibId && l.id !== editingLibraryId
    );
    if (duplicate) {
      setFormError(`معرف المكتبة (${trimmedLibId}) مستخدم بالفعل في "${duplicate.name}". يرجى التحقق من الرقم.`);
      return;
    }

    let updatedList: BunnyLibrary[];
    if (editingLibraryId) {
      updatedList = libraries.map(lib => {
        if (lib.id === editingLibraryId) {
          return {
            ...lib,
            name: trimmedName,
            libraryId: trimmedLibId,
            apiKey: trimmedApiKey,
            watermarkTokenKey: formData.watermarkTokenKey?.trim() || '',
            cdnHostname: formData.cdnHostname?.trim() || 'video.b-cdn.net',
            grade: formData.grade?.trim() || 'عام',
            isDefault: formData.isDefault || false
          };
        }
        return formData.isDefault ? { ...lib, isDefault: false } : lib;
      });
    } else {
      const newLib: BunnyLibrary = {
        id: `lib_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        name: trimmedName,
        libraryId: trimmedLibId,
        apiKey: trimmedApiKey,
        watermarkTokenKey: formData.watermarkTokenKey?.trim() || '',
        cdnHostname: formData.cdnHostname?.trim() || 'video.b-cdn.net',
        grade: formData.grade?.trim() || 'عام',
        isDefault: formData.isDefault || libraries.length === 0,
        createdAt: Date.now()
      };
      if (newLib.isDefault) {
        updatedList = [...libraries.map(l => ({ ...l, isDefault: false })), newLib];
      } else {
        updatedList = [...libraries, newLib];
      }
    }

    updateLibrariesList(updatedList);
    setIsModalOpen(false);
  };

  return (
    <div className="border-t border-slate-100 dark:border-slate-800 pt-6">
      <div className="bg-gradient-to-br from-indigo-50/70 via-white to-slate-50 dark:from-slate-850 dark:via-slate-900 dark:to-slate-850 border-2 border-indigo-200/80 dark:border-indigo-900/60 rounded-3xl p-6 shadow-sm">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-600/30 shrink-0">
              <Server className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-black text-slate-900 dark:text-white">
                  إدارة مكتبات Bunny.net للبث السحابي (Stream Libraries)
                </h3>
                <span className="bg-indigo-100 dark:bg-indigo-950 text-indigo-800 dark:text-indigo-300 text-xs font-bold px-2.5 py-0.5 rounded-full">
                  {libraries.length} مكتبة نشطة
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                يمكنك هنا إضافة، تعديل، أو حذف أي مكتبة سحابية (مثل مكتبة الصف السادس، الأول الثانوي، إلخ) وتخصيص مفتاح الرفع والمفتاح الأمني للعلامة المائية بحرية كاملة.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={openAddModal}
            className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-xs font-black shadow-md shadow-indigo-600/25 flex items-center justify-center gap-2 transition-all cursor-pointer shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>إضافة مكتبة Bunny جديدة</span>
          </button>
        </div>

        {/* Security / Watermark Hint Banner */}
        <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/40 rounded-2xl p-4 mb-6 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-3">
          <Shield className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div className="leading-relaxed">
            <span className="font-black block mb-0.5">حماية الفيديوهات والعلامة المائية (Watermark Security):</span>
            المنصة تدعم المفتاح الأمني (Token Authentication Key) لكل مكتبة في Bunny.net. عند ربط المفتاح، يضمن النظام تشغيل الفيديوهات فقط للطلاب المصرح لهم ويحمي المحتوى من التسريب أو التنزيل مع تثبيت اسم وكود الطالب على الشاشة.
          </div>
        </div>

        {/* Dynamic Libraries List */}
        {libraries.length === 0 ? (
          <div className="p-8 text-center bg-white dark:bg-slate-800/80 rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-700">
            <Film className="w-12 h-12 text-slate-400 mx-auto mb-3" />
            <h4 className="font-black text-slate-800 dark:text-white text-sm mb-1">لا توجد مكتبات Bunny.net مضافة حالياً</h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
              عند حذف جميع المكتبات، لن تتمكن من رفع أي فيديو جديد عبر المنصة حتى تقوم بإضافة مكتبة واحدة على الأقل.
            </p>
            <button
              type="button"
              onClick={openAddModal}
              className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold inline-flex items-center gap-1.5 shadow-sm hover:bg-indigo-700 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>إضافة أول مكتبة الآن</span>
            </button>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {libraries.map((lib) => {
              const isKeyVisible = visibleKeyIds[lib.id] || false;
              const isWatermarkVisible = visibleKeyIds[`wm_${lib.id}`] || false;

              return (
                <div
                  key={lib.id}
                  className={`p-5 bg-white dark:bg-slate-800 rounded-2xl border-2 transition-all relative flex flex-col justify-between ${
                    lib.isDefault
                      ? 'border-indigo-500 shadow-md shadow-indigo-500/10 dark:shadow-none'
                      : 'border-slate-200 dark:border-slate-700 hover:border-slate-300'
                  }`}
                >
                  {/* Top Bar inside card */}
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                          <Film className="w-4 h-4" />
                        </div>
                        <div>
                          <h4 className="font-black text-slate-900 dark:text-white text-sm leading-tight">
                            {lib.name}
                          </h4>
                          {lib.grade && (
                            <span className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400">
                              {lib.grade}
                            </span>
                          )}
                        </div>
                      </div>

                      {lib.isDefault ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 text-[10px] font-black rounded-lg border border-emerald-200 dark:border-emerald-800">
                          <Star className="w-3 h-3 fill-emerald-500 text-emerald-500" />
                          المكتبة الافتراضية
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleSetDefault(lib.id)}
                          title="تعيين كمكتبة افتراضية للرفع"
                          className="text-[10px] font-bold text-slate-400 hover:text-indigo-600 transition-colors cursor-pointer"
                        >
                          تعيين كافتراضية
                        </button>
                      )}
                    </div>

                    {/* Details Box */}
                    <div className="space-y-2 mt-4 text-xs font-mono">
                      {/* Library ID */}
                      <div className="p-2.5 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 flex items-center justify-between">
                        <span className="text-[10px] font-sans font-bold text-slate-500">Library ID:</span>
                        <div className="flex items-center gap-1.5 font-bold text-slate-900 dark:text-white">
                          <span>#{lib.libraryId}</span>
                          <button
                            type="button"
                            onClick={() => handleCopy(lib.libraryId, `lib_${lib.id}`)}
                            className="p-1 hover:bg-slate-200 dark:hover:bg-slate-800 rounded transition-colors text-slate-400 hover:text-slate-600 cursor-pointer"
                            title="نسخ معرف المكتبة"
                          >
                            {copiedId === `lib_${lib.id}` ? (
                              <Check className="w-3.5 h-3.5 text-emerald-500" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      </div>

                      {/* API Key */}
                      <div className="p-2.5 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 flex items-center justify-between">
                        <span className="text-[10px] font-sans font-bold text-slate-500">API Key:</span>
                        <div className="flex items-center gap-1.5 text-slate-900 dark:text-white">
                          <span className="truncate max-w-[110px]">
                            {isKeyVisible ? lib.apiKey : '••••••••••••••••'}
                          </span>
                          <button
                            type="button"
                            onClick={() => toggleKeyVisibility(lib.id)}
                            className="p-1 hover:bg-slate-200 dark:hover:bg-slate-800 rounded transition-colors text-slate-400 hover:text-slate-600 cursor-pointer"
                            title={isKeyVisible ? 'إخفاء' : 'إظهار'}
                          >
                            {isKeyVisible ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleCopy(lib.apiKey, `key_${lib.id}`)}
                            className="p-1 hover:bg-slate-200 dark:hover:bg-slate-800 rounded transition-colors text-slate-400 hover:text-slate-600 cursor-pointer"
                            title="نسخ مفتاح الـ API"
                          >
                            {copiedId === `key_${lib.id}` ? (
                              <Check className="w-3.5 h-3.5 text-emerald-500" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      </div>

                      {/* Watermark / Token Key */}
                      <div className="p-2.5 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 flex items-center justify-between">
                        <span className="text-[10px] font-sans font-bold text-slate-500 flex items-center gap-1">
                          <Shield className="w-3 h-3 text-indigo-500" />
                          <span>مفتاح الأمان:</span>
                        </span>
                        <div className="flex items-center gap-1.5 text-slate-900 dark:text-white">
                          {lib.watermarkTokenKey ? (
                            <>
                              <span className="truncate max-w-[90px] text-emerald-600 dark:text-emerald-400 font-bold">
                                {isWatermarkVisible ? lib.watermarkTokenKey : '••••••••••••'}
                              </span>
                              <button
                                type="button"
                                onClick={() => toggleKeyVisibility(`wm_${lib.id}`)}
                                className="p-1 hover:bg-slate-200 dark:hover:bg-slate-800 rounded transition-colors text-slate-400 hover:text-slate-600 cursor-pointer"
                              >
                                {isWatermarkVisible ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                              </button>
                            </>
                          ) : (
                            <span className="text-[10px] font-sans text-slate-400">غير محدد (علامة تلقائية)</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Actions Bar */}
                  <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-700/60 flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => openEditModal(lib)}
                      className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                    >
                      <Edit3 className="w-3.5 h-3.5 text-indigo-500" />
                      <span>تعديل</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteLibrary(lib)}
                      className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/50 text-rose-600 dark:text-rose-400 rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>حذف</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-4 text-[11px] text-slate-400 flex items-center gap-1.5">
          <Info className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <span>
            تذكر الضغط على زر <b>"حفظ الإعدادات"</b> في أسفل الصفحة لاعتماد أي إضافات أو تعديلات أو حذوفات تمت على المكتبات في قاعدة البيانات.
          </span>
        </div>
      </div>

      {/* Add / Edit Library Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800 mb-5">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-600/30">
                  <Film className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-slate-900 dark:text-white text-base">
                    {editingLibraryId ? 'تعديل مكتبة Bunny.net' : 'إضافة مكتبة Bunny.net جديدة'}
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    أدخل بيانات المكتبة ومفتاح الـ API ومفتاح الأمان من حسابك في Bunny Stream
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-white flex items-center justify-center cursor-pointer transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {formError && (
              <div className="mb-4 p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 rounded-xl text-rose-700 dark:text-rose-300 text-xs font-bold flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSaveForm} className="space-y-4">
              {/* Library Name */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  اسم المكتبة في المنصة: <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.name || ''}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  placeholder="مثال: مكتبة الصف السادس الإعدادي أو مكتبة المراجعات"
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl text-xs outline-none focus:ring-2 focus:ring-indigo-500 font-bold"
                />
              </div>

              {/* Linked Grade */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  المرحلة الدراسية المرتبطة بالمكتبة:
                </label>
                <input
                  type="text"
                  value={formData.grade || ''}
                  onChange={e => setFormData({ ...formData, grade: e.target.value })}
                  placeholder="مثال: الصف السادس الإعدادي، الصف الأول الثانوي، إلخ"
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl text-xs outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <span className="text-[10px] text-slate-400 mt-1 block">
                  تساعد في التحديد التلقائي للمكتبة عند رفع فيديوهات لصف معين.
                </span>
              </div>

              {/* Library ID & API Key */}
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Library ID (معرف المكتبة): <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.libraryId || ''}
                    onChange={e => setFormData({ ...formData, libraryId: e.target.value })}
                    placeholder="مثال: 767120"
                    dir="ltr"
                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl text-xs font-mono outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    API Key (مفتاح الرفع): <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="password"
                    required
                    value={formData.apiKey || ''}
                    onChange={e => setFormData({ ...formData, apiKey: e.target.value })}
                    placeholder="b5f13fb9-..."
                    dir="ltr"
                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl text-xs font-mono outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* Security / Watermark Token Authentication Key */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Shield className="w-3.5 h-3.5 text-indigo-500" />
                    <span>مفتاح الأمان والعلامة المائية (Token Authentication Key):</span>
                  </span>
                  <span className="text-[10px] text-slate-400 font-normal">اختياري - موصى به</span>
                </label>
                <input
                  type="password"
                  value={formData.watermarkTokenKey || ''}
                  onChange={e => setFormData({ ...formData, watermarkTokenKey: e.target.value })}
                  placeholder="المفتاح الأمني من إعدادات Security في Bunny Stream"
                  dir="ltr"
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl text-xs font-mono outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <span className="text-[10px] text-slate-400 mt-1 block">
                  مفتاح Token Authentication الخاص بمكتبة Bunny لوضع العلامة المائية المشفرة ومنع التحميل غير المصرح به.
                </span>
              </div>

              {/* CDN Hostname */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  CDN Hostname:
                </label>
                <input
                  type="text"
                  value={formData.cdnHostname || 'video.b-cdn.net'}
                  onChange={e => setFormData({ ...formData, cdnHostname: e.target.value })}
                  placeholder="video.b-cdn.net"
                  dir="ltr"
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl text-xs font-mono outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Default checkbox */}
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="isDefaultLib"
                  checked={formData.isDefault || false}
                  onChange={e => setFormData({ ...formData, isDefault: e.target.checked })}
                  className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
                />
                <label htmlFor="isDefaultLib" className="text-xs font-bold text-slate-800 dark:text-slate-200 cursor-pointer">
                  تعيين هذه المكتبة كمكتبة الرفع الافتراضية
                </label>
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black shadow-md shadow-indigo-600/30 transition-all cursor-pointer"
                >
                  {editingLibraryId ? 'حفظ تعديلات المكتبة' : 'إضافة المكتبة الآن'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
