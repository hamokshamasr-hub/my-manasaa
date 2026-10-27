const fs = require('fs');
let code = fs.readFileSync('src/components/Navbar.tsx', 'utf-8');

// Add Bell to imports
code = code.replace(
  "import { BookOpen, Menu, X, LogIn, LogOut, LayoutDashboard, CreditCard, UserPlus } from 'lucide-react';",
  "import { BookOpen, Menu, X, LogIn, LogOut, LayoutDashboard, CreditCard, UserPlus, Bell } from 'lucide-react';"
);

code = code.replace(
  "import { useAuth } from '../contexts/AuthContext';",
  "import { useAuth } from '../contexts/AuthContext';\nimport { db } from '../lib/firebase';\nimport { collection, query, where, onSnapshot, orderBy, updateDoc, doc } from 'firebase/firestore';"
);

const stateAndEffect = `
  const [notifications, setNotifications] = useState<any[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);

  useEffect(() => {
    if (!user && !appUser) return;
    
    let targetUserId = appUser?.uid || user?.uid;
    if (appUser?.role === 'admin' || appUser?.role === 'assistant') {
      targetUserId = 'admin';
    }

    if (!targetUserId) return;

    const q = query(
      collection(db, 'notifications'), 
      where('userId', '==', targetUserId)
    );

    const unsub = onSnapshot(q, (snapshot) => {
      const notifs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      notifs.sort((a, b) => b.createdAt - a.createdAt);
      setNotifications(notifs);
    });

    return () => unsub();
  }, [user, appUser]);

  const markAsRead = async (id: string) => {
    try {
      await updateDoc(doc(db, 'notifications', id), { read: true });
    } catch (err) {}
  };

  const markAllAsRead = async () => {
    try {
      const unread = notifications.filter(n => !n.read);
      for (const n of unread) {
        await updateDoc(doc(db, 'notifications', n.id), { read: true });
      }
    } catch (err) {}
  };
`;

code = code.replace(
  "  const navigate = useNavigate();",
  "  const navigate = useNavigate();\n" + stateAndEffect
);

const bellIcon = `
            {(user || appUser) && (
              <div className="relative">
                <button 
                  onClick={() => setShowNotifications(!showNotifications)}
                  className="p-2 relative text-slate-600 hover:text-indigo-600 transition-colors"
                >
                  <Bell className="w-6 h-6" />
                  {notifications.filter(n => !n.read).length > 0 && (
                    <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-rose-500 rounded-full border-2 border-white"></span>
                  )}
                </button>
                <AnimatePresence>
                  {showNotifications && (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      className="absolute left-0 mt-2 w-80 bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden z-50"
                    >
                      <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                        <h3 className="font-bold text-slate-800">الإشعارات</h3>
                        {notifications.some(n => !n.read) && (
                          <button onClick={markAllAsRead} className="text-xs text-indigo-600 font-bold hover:underline">
                            تحديد الكل كمقروء
                          </button>
                        )}
                      </div>
                      <div className="max-h-80 overflow-y-auto">
                        {notifications.length === 0 ? (
                          <div className="p-6 text-center text-slate-500 text-sm">لا توجد إشعارات</div>
                        ) : (
                          notifications.map(n => (
                            <div 
                              key={n.id} 
                              onClick={() => markAsRead(n.id)}
                              className={\`p-4 border-b border-slate-50 cursor-pointer transition-colors \${n.read ? 'bg-white opacity-60' : 'bg-indigo-50/50 hover:bg-indigo-50'}\`}
                            >
                              <div className="flex justify-between items-start mb-1">
                                <h4 className="font-bold text-sm text-slate-800">{n.title}</h4>
                                {!n.read && <span className="w-2 h-2 bg-indigo-600 rounded-full flex-shrink-0 mt-1"></span>}
                              </div>
                              <p className="text-xs text-slate-600 leading-relaxed">{n.message}</p>
                              <span className="text-[10px] text-slate-400 mt-2 block">
                                {new Date(n.createdAt).toLocaleDateString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                          ))
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}
            
            {(user || appUser) ? (
`;

code = code.replace(
  "{(user || appUser) ? (",
  bellIcon
);

fs.writeFileSync('src/components/Navbar.tsx', code);
