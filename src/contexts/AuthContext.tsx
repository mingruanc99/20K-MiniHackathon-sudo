// src/contexts/AuthContext.tsx
import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  auth,
  googleProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  isFirebaseConfigured,
  FirebaseUser
} from '../lib/firebase';
import { User } from '../types';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isDemoMode: boolean;
  isAdmin: boolean;
  signInWithGoogle: () => Promise<void>;
  loginWithEmail: (email: string, pass: string) => Promise<void>;
  registerWithEmail: (email: string, pass: string, name?: string) => Promise<void>;
  loginAsDemo: (profile?: Partial<User>) => void;
  loginAsAdmin: () => void;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const LOCAL_STORAGE_USER_KEY = 'clsg_active_user';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_USER_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed?.email?.toLowerCase() === 'hkthien@husc.edu.vn') {
          parsed.role = 'admin';
        }
        return parsed;
      }
      return null;
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState<boolean>(true);

  // Check if active user is demo mode
  const isDemo = !user || user.uid.startsWith('demo_');
  const isAdminUser = Boolean(user && (user.role === 'admin' || user.email?.toLowerCase() === 'hkthien@husc.edu.vn'));

  useEffect(() => {
    if (isFirebaseConfigured) {
      const unsubscribe = onAuthStateChanged(auth, (fbUser: FirebaseUser | null) => {
        if (fbUser) {
          const isBootstrapAdmin = fbUser.email?.toLowerCase() === 'hkthien@husc.edu.vn';
          const liveUser: User = {
            uid: fbUser.uid,
            email: fbUser.email,
            displayName: fbUser.displayName || fbUser.email?.split('@')[0] || 'User',
            photoURL: fbUser.photoURL,
            role: isBootstrapAdmin ? 'admin' : 'instructor'
          };
          setUser(liveUser);
          localStorage.setItem(LOCAL_STORAGE_USER_KEY, JSON.stringify(liveUser));
        } else {
          // If Firebase says no active session, check if we have an explicit demo user in localStorage
          const saved = localStorage.getItem(LOCAL_STORAGE_USER_KEY);
          if (saved) {
            try {
              const parsed: User = JSON.parse(saved);
              if (parsed && parsed.uid.startsWith('demo_')) {
                setUser(parsed);
                setLoading(false);
                return;
              }
            } catch {
              // ignore
            }
          }
          setUser(null);
        }
        setLoading(false);
      });
      return () => unsubscribe();
    } else {
      // Offline / Local mode
      const saved = localStorage.getItem(LOCAL_STORAGE_USER_KEY);
      if (saved) {
        try {
          setUser(JSON.parse(saved));
        } catch {
          setUser(null);
        }
      }
      setLoading(false);
    }
  }, []);

  const loginAsDemo = (profile?: Partial<User>) => {
    const demoUser: User = {
      uid: profile?.uid || 'demo_user_edtech_01',
      email: profile?.email || 'alex.rivers@stanford.edu',
      displayName: profile?.displayName || 'Prof. Alex Rivers',
      photoURL: profile?.photoURL || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80',
      role: 'instructor',
      createdAt: new Date().toISOString()
    };
    setUser(demoUser);
    localStorage.setItem(LOCAL_STORAGE_USER_KEY, JSON.stringify(demoUser));
  };

  const signInWithGoogle = async () => {
    if (isFirebaseConfigured) {
      try {
        const res = await signInWithPopup(auth, googleProvider);
        if (res.user) {
          const liveUser: User = {
            uid: res.user.uid,
            email: res.user.email,
            displayName: res.user.displayName,
            photoURL: res.user.photoURL,
            role: 'instructor'
          };
          setUser(liveUser);
          localStorage.setItem(LOCAL_STORAGE_USER_KEY, JSON.stringify(liveUser));
          return;
        }
      } catch (err: any) {
        console.warn('Firebase Google Auth encountered issue:', err.code, err.message);
        if (err.code === 'auth/unauthorized-domain') {
          throw new Error('AUTH_UNAUTHORIZED_DOMAIN: Domain clsg-ir-studio.vercel.app chưa được thêm vào Firebase Console (Authentication > Settings > Authorized domains). Vui lòng thêm domain vào Firebase hoặc nhập email Google trực tiếp bên dưới.');
        }
        if (err.code === 'auth/popup-closed-by-user') {
          throw new Error('Cửa sổ đăng nhập Google đã bị đóng trước khi hoàn tất.');
        }
        if (err.code === 'auth/popup-blocked') {
          throw new Error('Trình duyệt đã chặn popup Google. Vui lòng cho phép popup để chọn tài khoản.');
        }
        throw err;
      }
    } else {
      loginAsDemo({
        uid: 'demo_user_google_oauth',
        displayName: 'Prof. Alex Rivers (Google Verified)',
        email: 'alex.rivers@stanford.edu'
      });
    }
  };

  const loginWithEmail = async (email: string, pass: string) => {
    if (isFirebaseConfigured) {
      try {
        const res = await signInWithEmailAndPassword(auth, email, pass);
        if (res.user) {
          const liveUser: User = {
            uid: res.user.uid,
            email: res.user.email,
            displayName: res.user.displayName || email.split('@')[0],
            role: 'instructor'
          };
          setUser(liveUser);
          localStorage.setItem(LOCAL_STORAGE_USER_KEY, JSON.stringify(liveUser));
          return;
        }
      } catch (err: any) {
        console.warn('Firebase email login error:', err.code, err.message);
        // If operation not allowed or user not found, throw informative error
        if (err.code === 'auth/operation-not-allowed') {
          throw new Error('Email/Password provider chưa được bật trong Firebase Console. Bạn có thể dùng ⚡ 1-Click Demo Sign-In để vào ngay.');
        } else if (err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
          throw new Error('Email hoặc mật khẩu chưa chính xác. Nếu chưa có tài khoản, hãy đăng ký hoặc dùng ⚡ 1-Click Demo Sign-In.');
        }
        throw err;
      }
    } else {
      const demoUser: User = {
        uid: `demo_user_${email.replace(/[^a-zA-Z0-9]/g, '_')}`,
        email,
        displayName: email.split('@')[0],
        role: 'instructor',
        createdAt: new Date().toISOString()
      };
      setUser(demoUser);
      localStorage.setItem(LOCAL_STORAGE_USER_KEY, JSON.stringify(demoUser));
    }
  };

  const registerWithEmail = async (email: string, pass: string, name?: string) => {
    if (isFirebaseConfigured) {
      try {
        const res = await createUserWithEmailAndPassword(auth, email, pass);
        if (res.user) {
          const liveUser: User = {
            uid: res.user.uid,
            email: res.user.email,
            displayName: name || email.split('@')[0],
            role: 'instructor'
          };
          setUser(liveUser);
          localStorage.setItem(LOCAL_STORAGE_USER_KEY, JSON.stringify(liveUser));
          return;
        }
      } catch (err: any) {
        console.warn('Firebase registration error:', err.code, err.message);
        if (err.code === 'auth/operation-not-allowed') {
          // Fallback to demo registration if Firebase provider is disabled
          const localUser: User = {
            uid: `demo_user_${Date.now()}`,
            email,
            displayName: name || email.split('@')[0],
            role: 'instructor',
            createdAt: new Date().toISOString()
          };
          setUser(localUser);
          localStorage.setItem(LOCAL_STORAGE_USER_KEY, JSON.stringify(localUser));
          return;
        }
        throw err;
      }
    } else {
      const demoUser: User = {
        uid: `demo_user_${Date.now()}`,
        email,
        displayName: name || email.split('@')[0],
        role: 'instructor',
        createdAt: new Date().toISOString()
      };
      setUser(demoUser);
      localStorage.setItem(LOCAL_STORAGE_USER_KEY, JSON.stringify(demoUser));
    }
  };

  const logout = async () => {
    if (isFirebaseConfigured) {
      try {
        await signOut(auth);
      } catch (err) {
        console.warn('Signout error:', err);
      }
    }
    localStorage.removeItem(LOCAL_STORAGE_USER_KEY);
    setUser(null);
  };

  const loginAsAdmin = () => {
    const adminUser: User = {
      uid: 'admin_hkthien_husc',
      email: 'hkthien@husc.edu.vn',
      displayName: 'Huỳnh Khắc Thiên (Admin)',
      photoURL: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&auto=format&fit=crop&q=80',
      role: 'admin',
      createdAt: new Date().toISOString()
    };
    setUser(adminUser);
    localStorage.setItem(LOCAL_STORAGE_USER_KEY, JSON.stringify(adminUser));
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isDemoMode: isDemo,
        isAdmin: isAdminUser,
        signInWithGoogle,
        loginWithEmail,
        registerWithEmail,
        loginAsDemo,
        loginAsAdmin,
        logout
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};

