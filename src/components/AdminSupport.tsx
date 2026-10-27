import React, { useState, useEffect, useRef } from 'react';
import { db } from '../lib/firebase';
import { collection, query, onSnapshot, addDoc, orderBy, deleteDoc, doc, getDocs, where } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { 
  Send, Loader2, MessageCircle, User, Trash2, Search, 
  Phone, MessageSquare, CheckCheck, Sparkles, ExternalLink, RefreshCw
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useSettings } from '../contexts/SettingsContext';

interface Message {
  id: string;
  studentId: string;
  senderId: string;
  text: string;
  createdAt: number;
}

interface StudentProfile {
  id: string;
  displayName?: string;
  name?: string;
  studentCode?: string;
  phone?: string;
  parentPhone?: string;
  grade?: string;
}

export default function AdminSupport() {
  const { user, appUser } = useAuth();
  const { settings } = useSettings();
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [studentsMap, setStudentsMap] = useState<Record<string, StudentProfile>>({});
  const [loading, setLoading] = useState(true);
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Auto-delete logic for older messages
  useEffect(() => {
    const doAutoDelete = async () => {
      if (settings?.autoDeleteChats === false) return;
      const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
      try {
        const q = query(collection(db, 'messages'), where('createdAt', '<', oneWeekAgo));
        const snap = await getDocs(q);
        snap.docs.forEach(d => {
          deleteDoc(doc(db, 'messages', d.id)).catch(() => {});
        });
      } catch (err) {
        console.warn("Auto delete older messages error:", err);
      }
    };
    doAutoDelete();
  }, [settings?.autoDeleteChats]);

  // Load students profile directory
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const snap = await getDocs(collection(db, 'users'));
        const map: Record<string, StudentProfile> = {};
        snap.docs.forEach(d => {
          map[d.id] = { id: d.id, ...d.data() } as StudentProfile;
        });
        setStudentsMap(map);
      } catch (e) {
        console.warn("Error fetching students directory for support:", e);
      }
    };
    fetchUsers();
  }, []);

  // Listen to messages
  useEffect(() => {
    const q = query(collection(db, 'messages'), orderBy('createdAt', 'desc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Message[];
      
      setMessages(data);
      setLoading(false);
    }, (err) => {
      console.warn("Error fetching messages in AdminSupport:", err);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Scroll to bottom when selecting student or getting new messages
  useEffect(() => {
    if (selectedStudentId) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [selectedStudentId, messages]);

  const handleClearChat = async (studentId: string) => {
    const student = studentsMap[studentId];
    const name = student?.displayName || student?.name || `طالب ${studentId.substring(0, 6)}`;
    if (!confirm(`هل أنت متأكد من حذف سجل المحادثة بالكامل مع "${name}"؟`)) return;
    try {
      const q = query(collection(db, 'messages'), where('studentId', '==', studentId));
      const snap = await getDocs(q);
      await Promise.all(snap.docs.map(d => deleteDoc(doc(db, 'messages', d.id))));
      if (selectedStudentId === studentId) {
        setSelectedStudentId(null);
      }
    } catch (err) {
      console.error(err);
      alert('حدث خطأ أثناء الحذف');
    }
  };

  const handleSendMessage = async (e?: React.FormEvent, customMsg?: string) => {
    if (e) e.preventDefault();
    const textToSend = (customMsg || replyText).trim();
    if (!textToSend || (!user && !appUser) || !selectedStudentId) return;
    
    setSending(true);
    try {
      await addDoc(collection(db, 'messages'), {
        studentId: selectedStudentId,
        senderId: 'admin',
        text: textToSend,
        createdAt: Date.now()
      });
      setReplyText('');
    } catch (error) {
      console.error(error);
      alert('حدث خطأ أثناء إرسال الرد');
    } finally {
      setSending(false);
    }
  };

  // Unique students with messages
  const studentsWithMessages = Array.from(new Set(messages.map(m => m.studentId))) as string[];

  // Filtered by search query (name, phone, code)
  const filteredStudentIds = studentsWithMessages.filter(studentId => {
    if (!searchQuery.trim()) return true;
    const queryLower = searchQuery.toLowerCase();
    const student = studentsMap[studentId];
    const name = (student?.displayName || student?.name || '').toLowerCase();
    const phone = (student?.phone || '').toLowerCase();
    const code = (student?.studentCode || '').toLowerCase();
    return name.includes(queryLower) || phone.includes(queryLower) || code.includes(queryLower) || studentId.toLowerCase().includes(queryLower);
  });

  const selectedStudent = selectedStudentId ? studentsMap[selectedStudentId] : null;
  const selectedStudentName = selectedStudent?.displayName || selectedStudent?.name || (selectedStudentId ? `طالب (#${selectedStudentId.substring(0, 6)})` : '');

  const selectedMessages = messages
    .filter(m => m.studentId === selectedStudentId)
    .sort((a, b) => a.createdAt - b.createdAt);

  // Quick reply options
  const quickReplies = [
    "أهلاً بك يا بطل! جاري مراجعة سؤالك وسنوافيك بالحل بالتفصيل.",
    "تم مراجعة طلبك وتفعيل اشتراكك بنجاح. بالتوفيق والتميز دائمًا!",
    "يرجى مراجعة شرح المحاضرة وحل الواجب قبل موعد الامتحان القادم.",
    "هل السؤال من مذكرة الشرح أم من بنك أسئلة الامتحانات؟",
    "ممتاز جداً! استمر في هذا المستوى الرائع."
  ];

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-16 gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
        <span className="text-slate-600 font-bold">جاري تحميل رسائل الدعم الفني...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4 h-[780px] flex flex-col">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-white p-5 rounded-3xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-2xl font-black text-slate-900 flex items-center gap-2">
            <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
              <MessageSquare className="w-5 h-5" />
            </div>
            مركز الدعم الفني واستفسارات الطلاب
          </h2>
          <p className="text-slate-500 text-xs font-medium mt-1">
            متابعة فورية ومباشرة لكافة رسائل الطلاب مع أسماء وبيانات التواصل الكاملة والرد المباشر أو عبر واتساب.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs font-black">
          <span className="px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-xl border border-indigo-100">
            {studentsWithMessages.length} محادثة نشطة
          </span>
        </div>
      </div>

      {/* Main Chat Interface */}
      <div className="flex-1 bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden flex flex-col md:flex-row">
        
        {/* Sidebar: List of students */}
        <div className="w-full md:w-80 lg:w-96 border-b md:border-b-0 md:border-l border-slate-200 bg-slate-50/70 flex flex-col h-72 md:h-full">
          {/* Search bar */}
          <div className="p-3 border-b border-slate-200 bg-white">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="ابحث بالاسم، الهاتف، أو الكود..."
                className="w-full pr-9 pl-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-xs font-bold"
              />
            </div>
          </div>

          {/* Student list */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
            {filteredStudentIds.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs font-bold">
                {searchQuery ? 'لا توجد نتائج مطابقة' : 'لا توجد محادثات واردة حتى الآن'}
              </div>
            ) : (
              filteredStudentIds.map(studentId => {
                const student = studentsMap[studentId];
                const studentName = student?.displayName || student?.name || `طالب (#${studentId.substring(0, 5)})`;
                const studentMessages = messages.filter(m => m.studentId === studentId);
                const latestMessage = studentMessages[0];
                const isUnanswered = latestMessage?.senderId !== 'admin';
                const isSelected = selectedStudentId === studentId;

                return (
                  <div key={studentId} className="relative group">
                    <button
                      onClick={() => setSelectedStudentId(studentId)}
                      className={`w-full text-right p-3.5 transition-all flex gap-3 items-center ${
                        isSelected 
                          ? 'bg-indigo-50/90 border-r-4 border-indigo-600 shadow-sm' 
                          : 'hover:bg-slate-100/70'
                      }`}
                    >
                      <div className={`w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0 font-black text-sm shadow-sm ${
                        isSelected 
                          ? 'bg-indigo-600 text-white' 
                          : 'bg-indigo-100 text-indigo-700'
                      }`}>
                        {studentName.charAt(0)}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-0.5">
                          <p className="font-black text-slate-900 text-xs truncate">
                            {studentName}
                          </p>
                          {latestMessage && (
                            <span className="text-[10px] text-slate-400 font-sans">
                              {new Date(latestMessage.createdAt).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5 text-[10px] text-slate-500 font-bold mb-1">
                          {student?.studentCode && (
                            <span className="bg-slate-200/80 px-1.5 py-0.5 rounded text-slate-700 font-mono">
                              {student.studentCode}
                            </span>
                          )}
                          {student?.grade && (
                            <span className="text-indigo-600 truncate max-w-[120px]">
                              {student.grade}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center justify-between">
                          <p className="text-[11px] text-slate-500 truncate max-w-[180px]">
                            {latestMessage?.text}
                          </p>
                          {isUnanswered && (
                            <span className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0" title="رسالة جديدة بانتظار الرد"></span>
                          )}
                        </div>
                      </div>
                    </button>

                    <button
                      onClick={() => handleClearChat(studentId)}
                      className="absolute left-2 top-3 p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                      title="حذف المحادثة"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Chat Conversation Pane */}
        <div className="flex-1 flex flex-col bg-white">
          {!selectedStudentId ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-400">
              <div className="w-20 h-20 rounded-3xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-4 shadow-sm">
                <MessageCircle className="w-10 h-10" />
              </div>
              <h3 className="font-black text-slate-800 text-lg mb-1">حدد محادثة من القائمة الجانبية</h3>
              <p className="text-xs text-slate-500 font-medium max-w-sm">
                يمكنك التحدث مباشرة مع الطالب، والاطلاع على بياناته ورقم ولي أمره أو فتح محادثة واتساب بضغطة زر واحدة.
              </p>
            </div>
          ) : (
            <>
              {/* Chat Header with Student info & WhatsApp */}
              <div className="p-4 border-b border-slate-100 bg-white flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-black">
                    {selectedStudentName.charAt(0)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-black text-slate-900 text-sm">{selectedStudentName}</h3>
                      {selectedStudent?.studentCode && (
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-700 text-[10px] font-mono font-bold rounded-lg">
                          كود: {selectedStudent.studentCode}
                        </span>
                      )}
                      {selectedStudent?.grade && (
                        <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 text-[10px] font-bold rounded-lg">
                          {selectedStudent.grade}
                        </span>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-3 text-xs text-slate-500 font-medium mt-0.5">
                      {selectedStudent?.phone && (
                        <span className="flex items-center gap-1 font-mono">
                          هاتف الطالب: {selectedStudent.phone}
                        </span>
                      )}
                      {selectedStudent?.parentPhone && (
                        <span className="flex items-center gap-1 font-mono text-emerald-700">
                          ولي الأمر: {selectedStudent.parentPhone}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Direct Actions (WhatsApp & Clear) */}
                <div className="flex items-center gap-2">
                  {selectedStudent?.phone && (
                    <a
                      href={`https://wa.me/20${selectedStudent.phone.replace(/^0+/, '')}?text=${encodeURIComponent(`مرحباً يا بطل ${selectedStudentName}، معك فريق دعم المنصة بخصوص استفسارك.`)}`}
                      target="_blank"
                      rel="noreferrer"
                      className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs font-black flex items-center gap-1.5 transition-all shadow-sm"
                    >
                      <Phone className="w-3.5 h-3.5" /> واتساب الطالب
                    </a>
                  )}
                  {selectedStudent?.parentPhone && (
                    <a
                      href={`https://wa.me/20${selectedStudent.parentPhone.replace(/^0+/, '')}?text=${encodeURIComponent(`السلام عليكم، تحياتنا من إدارة المنصة التعليمية لولي أمر الطالب ${selectedStudentName}.`)}`}
                      target="_blank"
                      rel="noreferrer"
                      className="px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-black flex items-center gap-1.5 transition-all shadow-sm"
                    >
                      <Phone className="w-3.5 h-3.5" /> واتساب ولي الأمر
                    </a>
                  )}

                  <button
                    onClick={() => handleClearChat(selectedStudentId)}
                    className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors"
                    title="حذف المحادثة"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Messages Body */}
              <div className="flex-1 p-6 overflow-y-auto bg-slate-50/70 flex flex-col gap-3">
                {selectedMessages.length === 0 ? (
                  <div className="text-center text-slate-400 my-auto text-xs font-bold">لا توجد رسائل سابقة مع هذا الطالب.</div>
                ) : (
                  selectedMessages.map(msg => {
                    const isAdmin = msg.senderId === 'admin';
                    return (
                      <motion.div
                        key={msg.id}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`max-w-[80%] sm:max-w-[70%] p-3.5 rounded-2xl ${
                          isAdmin 
                            ? 'bg-gradient-to-r from-indigo-600 to-indigo-700 text-white self-start rounded-tr-none shadow-md shadow-indigo-600/10'
                            : 'bg-white border border-slate-200 text-slate-800 self-end rounded-tl-none shadow-sm'
                        }`}
                      >
                        <div className="text-xs font-bold mb-1 opacity-75">
                          {isAdmin ? 'الإدارة' : selectedStudentName}
                        </div>
                        <p className="text-sm font-medium leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                        <div className={`text-[10px] mt-1.5 flex items-center justify-end gap-1 ${isAdmin ? 'text-indigo-200' : 'text-slate-400'}`}>
                          <span>{new Date(msg.createdAt).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}</span>
                          {isAdmin && <CheckCheck className="w-3.5 h-3.5 text-emerald-300" />}
                        </div>
                      </motion.div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Quick Reply Presets */}
              <div className="px-4 py-2 bg-slate-50 border-t border-slate-100 flex items-center gap-1.5 overflow-x-auto text-[11px] font-bold">
                <span className="text-slate-400 flex items-center gap-1 flex-shrink-0">
                  <Sparkles className="w-3 h-3 text-amber-500" /> ردود سريعة:
                </span>
                {quickReplies.map((qr, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSendMessage(undefined, qr)}
                    className="px-2.5 py-1 bg-white hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 border border-slate-200 rounded-lg flex-shrink-0 transition-colors"
                  >
                    {qr.substring(0, 24)}...
                  </button>
                ))}
              </div>

              {/* Input Form */}
              <form onSubmit={handleSendMessage} className="p-3.5 bg-white border-t border-slate-100 flex gap-2">
                <input 
                  type="text" 
                  value={replyText}
                  onChange={e => setReplyText(e.target.value)}
                  placeholder="اكتب ردك للطالب هنا..."
                  className="flex-1 bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-bold text-slate-800"
                />
                <button 
                  type="submit"
                  disabled={sending || !replyText.trim()}
                  className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white px-5 py-3 rounded-2xl flex items-center justify-center gap-2 transition-all shadow-md shadow-indigo-600/20 active:scale-95 font-bold text-sm"
                >
                  {sending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                  <span>إرسال</span>
                </button>
              </form>
            </>
          )}
        </div>

      </div>
    </div>
  );
}
