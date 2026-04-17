'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  onAuthStateChanged, 
  User as FirebaseUser, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  updateProfile
} from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp, query, collection, where, onSnapshot } from 'firebase/firestore';
import { auth, db } from './firebase';
import { sendNotification } from './notifications';

interface UserProfile {
  uid: string;
  email: string;
  role: 'STUDENT' | 'ADMIN' | 'SECURITY' | 'INVIGILATOR';
  fullName: string;
  studentId?: string;
  department?: string;
  phoneNumber?: string;
}

interface AuthContextType {
  user: FirebaseUser | null;
  profile: UserProfile | null;
  idCard: any | null;
  loading: boolean;
  login: () => Promise<void>;
  loginWithEmail: (email: string, pass: string) => Promise<void>;
  signUp: (email: string, pass: string, fullName: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [idCard, setIdCard] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Safety timeout to ensure app doesn't stay stuck in loading forever
    const timeout = setTimeout(() => {
      setLoading(prev => {
        if (prev) {
          console.warn('Auth loading timed out. Clearing loading state.');
          return false;
        }
        return prev;
      });
    }, 8000);

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      try {
        setUser(user);
        if (user) {
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          let userProfile: UserProfile;

          if (userDoc.exists()) {
            userProfile = userDoc.data() as UserProfile;
          } else {
            // Check if user is pre-assigned a staff role
            let assignedRole: 'STUDENT' | 'ADMIN' | 'SECURITY' | 'INVIGILATOR' = 'STUDENT';
            if (user.email) {
              try {
                const staffDoc = await getDoc(doc(db, 'staff_roles', user.email));
                if (staffDoc.exists()) {
                  assignedRole = staffDoc.data().role;
                }
              } catch (e) {
                console.error("Error checking staff roles:", e);
              }
            }

            userProfile = {
              uid: user.uid,
              email: user.email || '',
              role: assignedRole,
              fullName: user.displayName || 'New User',
            };
            await setDoc(doc(db, 'users', user.uid), {
              ...userProfile,
              createdAt: serverTimestamp(),
            });
          }
          setProfile(userProfile);

          // Fetch ID Card if student
          if (userProfile.role === 'STUDENT') {
            const idQuery = query(collection(db, 'id_cards'), where('studentUid', '==', user.uid), where('status', '==', 'ACTIVE'));
            onSnapshot(idQuery, (snapshot) => {
              if (!snapshot.empty) {
                setIdCard(snapshot.docs[0].data() as any);
              } else {
                setIdCard(null);
              }
            }, (error) => {
              console.error("ID card snapshot error:", error);
            });
          }
        } else {
          setProfile(null);
          setIdCard(null);
        }
      } catch (error) {
        console.error("Auth state change error:", error);
      } finally {
        setLoading(false);
        clearTimeout(timeout);
      }
    });

    return () => {
      unsubscribe();
      clearTimeout(timeout);
    };
  }, []);

  const login = async () => {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  };

  const loginWithEmail = async (email: string, pass: string) => {
    await signInWithEmailAndPassword(auth, email, pass);
  };

  const signUp = async (email: string, pass: string, fullName: string) => {
    const userCredential = await createUserWithEmailAndPassword(auth, email, pass);
    await updateProfile(userCredential.user, { displayName: fullName });
    
    // The onAuthStateChanged will handle the Firestore document creation
  };

  const resetPassword = async (email: string) => {
    await sendPasswordResetEmail(auth, email);
  };

  const logout = async () => {
    await signOut(auth);
  };

  return (
    <AuthContext.Provider value={{ user, profile, idCard, loading, login, loginWithEmail, signUp, resetPassword, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
