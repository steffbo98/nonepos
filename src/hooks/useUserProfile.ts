import { useState, useEffect } from 'react';
import { doc, onSnapshot, collection, query, where, limit } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';

export interface UserProfile {
  fullName: string;
  email: string;
  role: 'admin' | 'staff';
  active: boolean;
}

export function useUserProfile() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (authUser) => {
      setUser(authUser);
      if (!authUser) {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
    if (!user) return;

    // First try by UID
    const unsubscribeProfile = onSnapshot(doc(db, 'users', user.uid), (docSnap) => {
      if (docSnap.exists()) {
        setProfile(docSnap.data() as UserProfile);
        setLoading(false);
      } else {
        // Fallback: search by email (needed for pre-authorized staff without UID known yet)
        if (user.email) {
          const q = query(collection(db, 'users'), where('email', '==', user.email.toLowerCase().trim()), limit(1));
          const unsubscribeEmail = onSnapshot(q, (snapshot) => {
            if (!snapshot.empty) {
              setProfile(snapshot.docs[0].data() as UserProfile);
            } else if (user.email === 'ezrahbosire1@gmail.com') {
              // Master Admin hardcoded fallback
              setProfile({
                fullName: 'Master Admin',
                email: user.email,
                role: 'admin',
                active: true
              });
            } else {
              setProfile(null);
            }
            setLoading(false);
          });
          return () => unsubscribeEmail();
        } else {
          setLoading(false);
        }
      }
    }, (error) => {
      console.error("Error fetching user profile:", error);
      setLoading(false);
    });

    return () => unsubscribeProfile();
  }, [user]);

  const isAdmin = profile?.role === 'admin' || user?.email === 'ezrahbosire1@gmail.com';

  return { user, profile, isAdmin, loading };
}
