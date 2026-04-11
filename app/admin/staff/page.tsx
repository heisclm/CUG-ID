'use client';

import React, { useState, useEffect } from 'react';
import DashboardLayout from '@/components/dashboard-layout';
import { useAuth } from '@/lib/auth-context';
import { db } from '@/lib/firebase';
import { collection, doc, getDocs, setDoc, deleteDoc, query, where } from 'firebase/firestore';
import { Shield, UserPlus, Trash2, AlertCircle, Loader2, CheckCircle } from 'lucide-react';

interface StaffRole {
  email: string;
  role: 'ADMIN' | 'SECURITY' | 'INVIGILATOR';
  addedBy: string;
  addedAt: any;
}

export default function AdminStaffPage() {
  const { profile } = useAuth();
  const [staffList, setStaffList] = useState<StaffRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [newStaff, setNewStaff] = useState({
    email: '',
    role: 'SECURITY' as 'ADMIN' | 'SECURITY' | 'INVIGILATOR'
  });

  useEffect(() => {
    if (profile?.role === 'ADMIN') {
      fetchStaff();
    }
  }, [profile]);

  const fetchStaff = async () => {
    try {
      const staffSnapshot = await getDocs(collection(db, 'staff_roles'));
      const staffData = staffSnapshot.docs.map(doc => ({
        email: doc.id,
        ...doc.data()
      })) as StaffRole[];
      setStaffList(staffData);
    } catch (err) {
      console.error("Error fetching staff:", err);
      setError("Failed to load staff list.");
    } finally {
      setLoading(false);
    }
  };

  const handleAddStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStaff.email || !newStaff.role) {
      setError("Please provide an email and select a role.");
      return;
    }

    setSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      const email = newStaff.email.toLowerCase().trim();
      
      // 1. Add to staff_roles collection (for pre-registration)
      await setDoc(doc(db, 'staff_roles', email), {
        role: newStaff.role,
        addedBy: profile?.email,
        addedAt: new Date()
      });

      // 2. Try to update existing user if they already signed up
      const usersQuery = query(collection(db, 'users'), where('email', '==', email));
      const usersSnapshot = await getDocs(usersQuery);
      
      if (!usersSnapshot.empty) {
        const userDoc = usersSnapshot.docs[0];
        await setDoc(doc(db, 'users', userDoc.id), {
          role: newStaff.role
        }, { merge: true });
      }

      setSuccess(`${email} has been assigned the ${newStaff.role} role.`);
      setNewStaff({ email: '', role: 'SECURITY' });
      fetchStaff();
      
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error("Error adding staff:", err);
      setError("Failed to add staff member.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemoveStaff = async (email: string) => {
    if (!confirm(`Are you sure you want to remove ${email}? They will become a regular STUDENT.`)) return;
    
    try {
      // 1. Remove from staff_roles
      await deleteDoc(doc(db, 'staff_roles', email));

      // 2. Update existing user to STUDENT
      const usersQuery = query(collection(db, 'users'), where('email', '==', email));
      const usersSnapshot = await getDocs(usersQuery);
      
      if (!usersSnapshot.empty) {
        const userDoc = usersSnapshot.docs[0];
        await setDoc(doc(db, 'users', userDoc.id), {
          role: 'STUDENT'
        }, { merge: true });
      }

      fetchStaff();
    } catch (err) {
      console.error("Error removing staff:", err);
      alert("Failed to remove staff member.");
    }
  };

  if (profile?.role !== 'ADMIN') {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center h-[60vh] space-y-4">
          <AlertCircle size={48} className="text-red-500" />
          <h1 className="text-2xl font-bold">Access Denied</h1>
          <p className="text-gray-500">You do not have permission to access this page.</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Shield className="text-orange-500" />
            Manage Staff Roles
          </h1>
          <p className="text-gray-500 dark:text-gray-400 font-medium">Assign Security and Invigilator roles to specific email addresses.</p>
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-3xl border border-gray-100 dark:border-gray-800 p-8 space-y-6">
          <h2 className="text-lg font-bold">Add New Staff</h2>
          
          {error && (
            <div className="p-4 bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-500 rounded-xl text-sm font-medium flex items-center gap-2">
              <AlertCircle size={16} />
              {error}
            </div>
          )}

          {success && (
            <div className="p-4 bg-green-50 dark:bg-green-500/10 text-green-600 dark:text-green-500 rounded-xl text-sm font-medium flex items-center gap-2">
              <CheckCircle size={16} />
              {success}
            </div>
          )}

          <form onSubmit={handleAddStaff} className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-1 space-y-2">
              <label className="text-sm font-bold text-gray-700 dark:text-gray-300">Email Address</label>
              <input
                type="email"
                required
                value={newStaff.email}
                onChange={(e) => setNewStaff({...newStaff, email: e.target.value})}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 focus:ring-2 focus:ring-orange-500 outline-none transition-all"
                placeholder="staff@university.edu"
              />
            </div>
            
            <div className="md:col-span-1 space-y-2">
              <label className="text-sm font-bold text-gray-700 dark:text-gray-300">Role</label>
              <select
                value={newStaff.role}
                onChange={(e) => setNewStaff({...newStaff, role: e.target.value as any})}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 focus:ring-2 focus:ring-orange-500 outline-none transition-all"
              >
                <option value="SECURITY">Security (Gate Access)</option>
                <option value="INVIGILATOR">Invigilator (Exam Hall)</option>
                <option value="ADMIN">Administrator</option>
              </select>
            </div>

            <div className="md:col-span-1 flex items-end">
              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3 bg-orange-500 text-white rounded-xl font-bold hover:bg-orange-600 transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-orange-500/20"
              >
                {submitting ? <Loader2 className="animate-spin" size={18} /> : <UserPlus size={18} />}
                Assign Role
              </button>
            </div>
          </form>
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-3xl border border-gray-100 dark:border-gray-800 overflow-hidden">
          <div className="p-6 border-b border-gray-100 dark:border-gray-800">
            <h2 className="text-lg font-bold">Current Staff Members</h2>
          </div>
          
          {loading ? (
            <div className="p-12 flex justify-center">
              <Loader2 className="animate-spin text-orange-500" size={32} />
            </div>
          ) : staffList.length === 0 ? (
            <div className="p-12 text-center text-gray-500">
              No staff members assigned yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-gray-50 dark:bg-gray-800/50 text-gray-500 text-sm">
                  <tr>
                    <th className="px-6 py-4 font-medium">Email</th>
                    <th className="px-6 py-4 font-medium">Role</th>
                    <th className="px-6 py-4 font-medium">Added By</th>
                    <th className="px-6 py-4 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {staffList.map((staff) => (
                    <tr key={staff.email} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                      <td className="px-6 py-4 font-medium">{staff.email}</td>
                      <td className="px-6 py-4">
                        <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                          staff.role === 'ADMIN' ? 'bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-400' :
                          staff.role === 'INVIGILATOR' ? 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400' :
                          'bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-400'
                        }`}>
                          {staff.role}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">{staff.addedBy || 'System'}</td>
                      <td className="px-6 py-4 text-right">
                        <button 
                          onClick={() => handleRemoveStaff(staff.email)}
                          className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors"
                          title="Remove Role"
                        >
                          <Trash2 size={18} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
