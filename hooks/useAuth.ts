import { useState, useEffect } from 'react';
import { auth, db } from '../firebase/config';
import { 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged, 
  User 
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<{ role?: string; displayName?: string; active?: boolean } | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      if (user) {
        try {
          const ref = doc(db, 'users', user.uid);
          const snap = await getDoc(ref);
          if (snap.exists()) {
            setProfile(snap.data() as any);
          } else {
            setProfile(null);
          }
        } catch (e) {
          console.warn('Erro ao buscar perfil do usuário:', e);
          setProfile(null);
        }
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const login = async (email: string, password: string) => {
    try {
      await signInWithEmailAndPassword(auth, email, password);
      return { success: true };
    } catch (error: any) {
      return { 
        success: false, 
        error: error.message 
      };
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
      return { success: true };
    } catch (error: any) {
      return { 
        success: false, 
        error: error.message 
      };
    }
  };

  return {
    user,
    profile,
    loading,
    login,
    logout,
    isAuthenticated: !!user,
    isManager: !!profile && profile.role === 'gestor'
  };
};
