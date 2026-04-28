import React, { useState, useEffect, useRef } from 'react';
import { collection, onSnapshot, addDoc, query, orderBy, limit, serverTimestamp } from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from '../lib/firebase';
import { motion, AnimatePresence } from 'motion/react';
import { Send, User as UserIcon, MessageCircle, MoreHorizontal } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function ChatPage() {
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const q = query(
      collection(db, 'chats', 'global', 'messages'),
      orderBy('timestamp', 'asc'),
      limit(50)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setMessages(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'chats/global/messages');
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    try {
      await addDoc(collection(db, 'chats', 'global', 'messages'), {
        senderId: auth.currentUser?.uid,
        senderEmail: auth.currentUser?.email,
        text: newMessage,
        timestamp: serverTimestamp()
      });
      setNewMessage('');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'chats/global/messages');
    }
  };

  return (
    <div className="max-w-4xl mx-auto h-[calc(100vh-120px)] flex flex-col bg-white border border-[#141414] relative">
      <div className="absolute top-0 left-0 w-full h-1 bg-[#141414]" />
      
      <header className="p-6 border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-[#141414] text-[#E4E3E0] flex items-center justify-center">
            <MessageCircle className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-black tracking-tighter text-xl">Internal Support</h2>
            <p className="text-[10px] font-mono opacity-50 tracking-widest">Connect with our support team</p>
          </div>
        </div>
        <button className="p-2 hover:bg-gray-50 rounded-full">
          <MoreHorizontal className="w-5 h-5" />
        </button>
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-6 bg-gray-50/50">
        <AnimatePresence initial={false}>
          {messages.map((msg, idx) => {
            const isMe = msg.senderId === auth.currentUser?.uid;
            return (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={cn(
                  "flex flex-col max-w-[80%]",
                  isMe ? "ml-auto items-end" : "mr-auto items-start"
                )}
              >
                <div className="flex items-center gap-2 mb-1">
                  {!isMe && <span className="font-bold text-[10px] opacity-40">{msg.senderEmail?.split('@')[0]}</span>}
                  <span className="text-[9px] font-mono opacity-30">
                    {msg.timestamp?.toDate?.()?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  {isMe && <span className="font-bold text-[10px] opacity-40">You</span>}
                </div>
                <div className={cn(
                  "px-4 py-3 text-sm font-medium leading-relaxed",
                  isMe ? "bg-[#141414] text-[#E4E3E0]" : "bg-white border border-gray-200 text-[#141414]"
                )}>
                  {msg.text}
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      <form onSubmit={handleSendMessage} className="p-6 bg-white border-t border-gray-100 flex gap-4">
        <input 
          type="text"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder="Type your message..."
          className="flex-1 bg-gray-50 border border-gray-200 px-6 py-4 outline-none focus:border-[#141414] text-sm font-medium transition-all"
        />
        <button 
          type="submit"
          disabled={!newMessage.trim()}
          className="bg-[#141414] text-[#E4E3E0] px-8 py-4 font-black text-xs tracking-widest hover:invert transition-all disabled:opacity-20"
        >
          <Send className="w-5 h-5" />
        </button>
      </form>
    </div>
  );
}
