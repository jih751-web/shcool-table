import React, { useEffect, useState } from 'react';
import { collection, query, onSnapshot, where, doc, updateDoc, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import type { AppNotification } from '../types';
import { Bell, X } from 'lucide-react';

const NotificationToast: React.FC = () => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);

  useEffect(() => {
    // 1. Auth Guard Clause (Strict)
    if (!user?.uid) return;

    let unsubscribe: () => void = () => {};

    try {
      // 2. Request Notification Permission (Standard)
      if ('Notification' in window && Notification.permission !== 'granted' && Notification.permission !== 'denied') {
        Notification.requestPermission();
      }

      // 3. Subscription logic with correct field names (isRead, targetUserId)
      const q = query(
        collection(db, 'notifications'),
        where('targetUserId', '==', user.uid),
        where('isRead', '==', false),
        orderBy('timestamp', 'desc')
      );

      unsubscribe = onSnapshot(q, (snapshot) => {
        const currentNotifications: AppNotification[] = [];
        snapshot.forEach(docSnap => {
          currentNotifications.push({ id: docSnap.id, ...docSnap.data() } as AppNotification);
        });

        // [방어 코드] 데이터가 완전히 동일하면 업데이트 건너띄어 무한 루프 방지
        setNotifications(prev => {
          if (JSON.stringify(prev) === JSON.stringify(currentNotifications)) return prev;
          return currentNotifications;
        });

        // Process changes for OS push notifications (newly added only)
        snapshot.docChanges().forEach((change) => {
          if (change.type === 'added') {
            const data = change.doc.data() as AppNotification;
            if ('Notification' in window && Notification.permission === 'granted') {
              new Notification('학사/시간표 알림', {
                body: data.message,
                icon: '/vite.svg'
              });
            }
          }
        });
      }, (error) => {
        console.error("Firestore Notification Listener Failed:", error);
      });

    } catch (e) {
      console.error("Critical Notification Error:", e);
    }

    // 4. Guaranteed Cleanup Logic
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [user?.uid]);

  const markAsRead = async (id: string) => {
    try {
      await updateDoc(doc(db, 'notifications', id), { isRead: true });
    } catch (e) {
      console.error("Failed to mark notification as read:", e);
    }
  };

  if (notifications.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-3 max-w-sm w-full">
      {notifications.map(notif => (
        <div key={notif.id} className="bg-white rounded-xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-brand-100 p-4 relative overflow-hidden flex gap-4 transform transition-all hover:scale-[1.02]">
          <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-brand-500"></div>
          <div className="bg-brand-50 p-2 rounded-full h-fit shrink-0 ml-1">
            <Bell className="w-5 h-5 text-brand-600" />
          </div>
          <div className="flex-1 pr-4">
            <p className="text-[15px] text-slate-800 font-medium leading-relaxed tracking-tight">{notif.message}</p>
            <span className="text-xs text-slate-400 mt-1.5 block font-medium">
              {new Date(notif.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
          <button 
            onClick={() => markAsRead(notif.id!)}
            className="absolute top-2 right-2 p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
};

export default NotificationToast;
