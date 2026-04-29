import { createContext, ReactNode, useContext } from 'react';

export interface UserProfile {
  fullName: string;
  email: string;
  role: 'admin' | 'staff';
  active: boolean;
  uid: string;
}

const UserProfileContext = createContext<UserProfile | null>(null);

export function UserProfileProvider({
  user,
  children,
}: {
  user: UserProfile | null;
  children: ReactNode;
}) {
  return (
    <UserProfileContext.Provider value={user}>
      {children}
    </UserProfileContext.Provider>
  );
}

export function useUserProfile() {
  const profile = useContext(UserProfileContext);
  const isAdmin = profile?.role === 'admin';

  return { profile, loading: false, isAdmin };
}
