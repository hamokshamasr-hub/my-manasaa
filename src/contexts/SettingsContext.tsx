import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { db } from '../lib/firebase';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';

export interface BunnyLibrary {
  id: string;
  name: string;
  libraryId: string;
  apiKey: string;
  watermarkTokenKey?: string;
  cdnHostname?: string;
  grade?: string;
  isDefault?: boolean;
  createdAt?: number;
}

export interface PlatformSettings {
  platformName: string;
  teacherName: string;
  yearsOfExperience: number;
  studentCount: number;
  aboutText: string;
  showFinalRevisions: boolean;
  showMiddleSchool?: boolean;
  grades?: string[];
  autoReplyMessage?: string;
  whatsappNumber?: string;
  showWhatsApp?: boolean;
  contactEmail?: string;
  contactPhone?: string;
  contactAddress?: string;
  heroImageBase64?: string;
  platformLogoBase64?: string;
  facebookUrl?: string;
  youtubeUrl?: string;
  instagramUrl?: string;
  heroVideoUrl?: string;
  enableExams?: boolean;
  enableSupport?: boolean;
  enableMaterials?: boolean;
  enableGoogleAuth?: boolean;
  autoDeleteChats?: boolean;
  gaMeasurementId?: string;
  paymentWalletNumber?: string;
  paymentInstapayUsername?: string;
  paymentInstructions?: string;
  maxHonorsCount?: number;
  showHonorsBoard?: boolean;
  centerGroups?: string[];
  // Dynamic Bunny.net Stream Video Libraries
  bunnyLibraries?: BunnyLibrary[];
  // Bunny.net Stream Video Library Configuration (Backwards compatibility)
  bunnyLibraryIdG1?: string;
  bunnyApiKeyG1?: string;
  bunnyLibraryIdG2?: string;
  bunnyApiKeyG2?: string;
  bunnyLibraryIdG3?: string;
  bunnyApiKeyG3?: string;
  defaultBunnyLibraryId?: string;
  defaultBunnyApiKey?: string;
  // Firebase configuration overrides
  customFirebaseProjectId?: string;
  customFirebaseApiKey?: string;
  customFirebaseAuthDomain?: string;
  customFirebaseStorageBucket?: string;
  updatedAt: number;
}

const defaultSettings: PlatformSettings = {
  platformName: 'منصة مستر محمد صابر',
  teacherName: 'مستر محمد صابر',
  yearsOfExperience: 8,
  studentCount: 10000,
  aboutText: 'مدرس أول للغة الإنجليزية بخبرة تتجاوز الـ 8 سنوات في تبسيط المناهج وتأهيل الطلاب للتفوق واجتياز الامتحانات بثقة ونجاح، معتمد على أحدث الأساليب التربوية التفاعلية.',
  showFinalRevisions: true,
  showMiddleSchool: false,
  showHonorsBoard: true,
  grades: ['الصف الأول الثانوي', 'الصف الثاني الثانوي', 'الصف الثالث الثانوي', 'الصف الأول بكالوريا', 'الصف الثاني بكالوريا', 'الصف الثالث بكالوريا'],
  centerGroups: [
    'مجموعة السبت والثلاثاء - 09:30 صباحاً',
    'مجموعة السبت والثلاثاء - 10:30 صباحاً',
    'مجموعة الأحد والأربعاء - 04:00 مساءً',
    'مجموعة الأحد والأربعاء - 05:30 مساءً',
    'مجموعة الإثنين والخميس - 04:00 مساءً',
    'مجموعة الإثنين والخميس - 05:30 مساءً',
    'مجموعة الجمعة - 02:00 ظهراً'
  ],
  maxHonorsCount: 12,
  autoReplyMessage: 'أهلاً بك! تلقينا رسالتك وسنقوم بالرد عليك في أقرب وقت ممكن.',
  whatsappNumber: '',
  showWhatsApp: true,
  contactEmail: '',
  contactPhone: '',
  contactAddress: 'القاهرة، مصر',
  paymentWalletNumber: '01012345678',
  paymentInstapayUsername: 'saber@instapay',
  paymentInstructions: 'يرجى تحويل قيمة الاشتراك على رقم المحفظة أو عنوان إنستا باي بدقة، وكتابة اسم الطالب في خانة ملاحظات التحويل ورفع لقطة الشاشة (Screenshot) للتأكيد.',
  autoDeleteChats: true,
  bunnyLibraries: [
    {
      id: 'lib_g1',
      name: 'مكتبة الصف الأول الثانوي',
      libraryId: '767120',
      apiKey: 'b5f13fb9-4eb0-4fb4-833057a5148f-70fb-419a',
      watermarkTokenKey: '',
      cdnHostname: 'video.b-cdn.net',
      grade: 'الصف الأول الثانوي',
      isDefault: false,
      createdAt: 1700000000000
    },
    {
      id: 'lib_g2',
      name: 'مكتبة الصف الثاني الثانوي',
      libraryId: '767124',
      apiKey: 'c9ae2432-bbb8-4319-8e5eea17c676-1b0d-41b9',
      watermarkTokenKey: '',
      cdnHostname: 'video.b-cdn.net',
      grade: 'الصف الثاني الثانوي',
      isDefault: false,
      createdAt: 1700000000000
    },
    {
      id: 'lib_g3',
      name: 'مكتبة الصف الثالث الثانوي',
      libraryId: '767125',
      apiKey: '13dc4b71-7b28-475d-b1910a51320b-20b4-45d8',
      watermarkTokenKey: '',
      cdnHostname: 'video.b-cdn.net',
      grade: 'الصف الثالث الثانوي',
      isDefault: true,
      createdAt: 1700000000000
    }
  ],
  bunnyLibraryIdG1: '767120',
  bunnyApiKeyG1: 'b5f13fb9-4eb0-4fb4-833057a5148f-70fb-419a',
  bunnyLibraryIdG2: '767124',
  bunnyApiKeyG2: 'c9ae2432-bbb8-4319-8e5eea17c676-1b0d-41b9',
  bunnyLibraryIdG3: '767125',
  bunnyApiKeyG3: '13dc4b71-7b28-475d-b1910a51320b-20b4-45d8',
  defaultBunnyLibraryId: '767125',
  defaultBunnyApiKey: '13dc4b71-7b28-475d-b1910a51320b-20b4-45d8',
  heroVideoUrl: '',
  heroImageBase64: '',
  platformLogoBase64: '',
  facebookUrl: '',
  youtubeUrl: '',
  instagramUrl: '',
  enableExams: true,
  enableSupport: true,
  enableMaterials: true,
  enableGoogleAuth: true,
  updatedAt: Date.now(),
};

interface SettingsContextType {
  settings: PlatformSettings;
  loading: boolean;
  updateSettings: (newSettings: Partial<PlatformSettings>) => Promise<void>;
}

const SettingsContext = createContext<SettingsContextType | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<PlatformSettings>(defaultSettings);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const docRef = doc(db, 'settings', 'main');
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data() as PlatformSettings;
        if (!data.grades) {
          data.grades = defaultSettings.grades;
          setDoc(docRef, { grades: defaultSettings.grades }, { merge: true }).catch(err => {
            console.warn("Could not auto-patch grades", err);
          });
        }
        if (data.centerGroups === undefined) {
          data.centerGroups = defaultSettings.centerGroups;
          setDoc(docRef, { centerGroups: defaultSettings.centerGroups }, { merge: true }).catch(err => {
            console.warn("Could not auto-patch centerGroups", err);
          });
        }
        setSettings(data);
        try {
          localStorage.setItem('cached_platform_settings', JSON.stringify(data));
        } catch (e) {}
        
        // Update document title
        if (data.platformName) {
          document.title = data.platformName;
        }
        
        // Update favicon
        if (data.platformLogoBase64) {
          let link = document.querySelector("link[rel~='icon']") as HTMLLinkElement;
          if (!link) {
            link = document.createElement('link');
            link.rel = 'icon';
            document.head.appendChild(link);
          }
          link.href = data.platformLogoBase64;
        }
      } else {
        // Initialize default settings if not exists
        setDoc(docRef, defaultSettings).catch(err => {
          console.warn("Could not write default settings, might not be admin:", err);
        });
      }
      setLoading(false);
    }, (error) => {
      console.warn("Error fetching settings (quota or offline):", error?.message || error);
      try {
        const cached = localStorage.getItem('cached_platform_settings');
        if (cached) {
          setSettings(JSON.parse(cached));
        }
      } catch (e) {}
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const updateSettings = async (updates: Partial<PlatformSettings>) => {
    try {
      const docRef = doc(db, 'settings', 'main');
      const newSettings = { ...settings, ...updates, updatedAt: Date.now() };
      await setDoc(docRef, newSettings);
    } catch (error) {
      console.error("Error updating settings:", error);
      throw error;
    }
  };

  return (
    <SettingsContext.Provider value={{ settings, loading, updateSettings }}>
      {children}
    </SettingsContext.Provider>
  );
}

export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (!context) throw new Error('useSettings must be used within a SettingsProvider');
  return context;
};
