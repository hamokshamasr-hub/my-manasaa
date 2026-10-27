import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, query, where, onSnapshot, addDoc, orderBy } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { useSettings } from '../contexts/SettingsContext';
import { Send, Loader2, MessageCircle } from 'lucide-react';
import { motion } from 'motion/react';

interface Message {
  id: string;
  studentId: string;
  senderId: string;
  text: string;
  createdAt: number;
}

export default function StudentSupport() {
  const { user, appUser } = useAuth();
  const { settings } = useSettings();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);

  const studentUid = user?.uid || appUser?.uid;

  useEffect(() => {
    if (!studentUid) {
      setLoading(false);
      return;
    }
    
    const q = query(
      collection(db, 'messages'),
      where('studentId', '==', studentUid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Message[];
      
      data.sort((a, b) => a.createdAt - b.createdAt);
      setMessages(data);
      setLoading(false);
    }, (err) => {
      console.error(err);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [studentUid]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !studentUid) return;
    
    setSending(true);
    try {
      // User message
      await addDoc(collection(db, 'messages'), {
        studentId: studentUid,
        senderId: studentUid,
        text: newMessage.trim(),
        createdAt: Date.now()
      });
      
      // Auto reply message from admin if it's the first message
      if (messages.length === 0 && settings?.autoReplyMessage) {
        await addDoc(collection(db, 'messages'), {
          studentId: studentUid,
          senderId: 'admin',
          text: settings.autoReplyMessage,
          createdAt: Date.now() + 1000 // slight delay
        });
      }

      setNewMessage('');
    } catch (error) {
      console.error(error);
      alert('حدث خطأ أثناء إرسال الرسالة');
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-indigo-600" /></div>;
  }

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col h-[500px] transition-colors">
      <div className="bg-indigo-50 dark:bg-slate-800/80 p-4 border-b border-indigo-100 dark:border-slate-700/60 flex items-center gap-3">
        <div className="w-10 h-10 bg-indigo-600 rounded-full flex items-center justify-center">
          <MessageCircle className="w-5 h-5 text-white" />
        </div>
        <div>
          <h3 className="font-bold text-slate-900 dark:text-white">الدعم الفني والتواصل</h3>
          <p className="text-xs text-indigo-600 dark:text-indigo-400 font-medium">نحن هنا لمساعدتك والإجابة على استفساراتك</p>
        </div>
      </div>
      
      <div className="flex-1 p-4 overflow-y-auto flex flex-col gap-3 bg-slate-50 dark:bg-slate-950">
        {messages.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400 dark:text-slate-500">
            <MessageCircle className="w-12 h-12 mb-2 opacity-50" />
            <p className="font-medium">لا توجد رسائل سابقة. أرسل استفسارك الآن.</p>
          </div>
        ) : (
          messages.map(msg => {
            const isAdmin = msg.senderId === 'admin';
            return (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                key={msg.id} 
                className={`max-w-[80%] p-3 rounded-2xl ${
                  isAdmin 
                  ? 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 self-start rounded-tr-none' 
                  : 'bg-indigo-600 text-white self-end rounded-tl-none shadow-md shadow-indigo-200 dark:shadow-none'
                }`}
              >
                <p className="text-sm font-medium leading-relaxed">{msg.text}</p>
                <span className={`text-[10px] mt-1 block ${isAdmin ? 'text-slate-400 dark:text-slate-400' : 'text-indigo-200'}`}>
                  {new Date(msg.createdAt).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </motion.div>
            );
          })
        )}
      </div>

      <form onSubmit={handleSendMessage} className="p-3 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 flex gap-2">
        <input 
          type="text" 
          value={newMessage}
          onChange={e => setNewMessage(e.target.value)}
          placeholder="اكتب رسالتك هنا..."
          className="flex-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
        />
        <button 
          type="submit"
          disabled={sending || !newMessage.trim()}
          className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 dark:disabled:bg-indigo-900/50 text-white p-3 rounded-xl flex items-center justify-center transition-colors shadow-sm"
        >
          {sending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
        </button>
      </form>
    </div>
  );
}
