'use client';

import React, { useState, useEffect } from 'react';
import DashboardLayout from '@/components/dashboard-layout';
import { useAuth } from '@/lib/auth-context';
import { db } from '@/lib/firebase';
import { collection, doc, query, getDocs, updateDoc, writeBatch } from 'firebase/firestore';
import { 
  Users, 
  Search,
  AlertCircle,
  X,
  CheckCircle,
  XCircle,
  Loader2,
  Trash2,
  ShieldCheck,
  ChevronRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function AdminStudentsPage() {
  const { profile } = useAuth();
  const [students, setStudents] = useState<any[]>([]);
  const [filteredStudents, setFilteredStudents] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedStudents, setSelectedStudents] = useState<Set<string>>(new Set());
  const [editingStudent, setEditingStudent] = useState<any | null>(null);
  const [processing, setProcessing] = useState(false);
  const [notification, setNotification] = useState<{message: string, type: 'success' | 'error'} | null>(null);

  useEffect(() => {
    fetchStudents();
  }, []);

  useEffect(() => {
    if (searchQuery) {
      setFilteredStudents(students.filter(s => 
        s.fullName?.toLowerCase().includes(searchQuery.toLowerCase()) || 
        s.studentId?.toLowerCase().includes(searchQuery.toLowerCase())
      ));
    } else {
      setFilteredStudents(students);
    }
  }, [searchQuery, students]);

  const showNotification = (message: string, type: 'success' | 'error') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3500);
  };

  const fetchStudents = async () => {
    try {
      const q = query(collection(db, 'students'));
      const snap = await getDocs(q);
      const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setStudents(data);
    } catch (err) {
      console.error(err);
      showNotification('Failed to fetch students', 'error');
    } finally {
      setLoading(false);
    }
  };

  const toggleSelectAll = () => {
    if (selectedStudents.size === filteredStudents.length && filteredStudents.length > 0) {
      setSelectedStudents(new Set());
    } else {
      setSelectedStudents(new Set(filteredStudents.map(s => s.id)));
    }
  };

  const toggleSelect = (id: string) => {
    const newSelected = new Set(selectedStudents);
    if (newSelected.has(id)) newSelected.delete(id);
    else newSelected.add(id);
    setSelectedStudents(newSelected);
  };

  const handleBulkEligibility = async (eligible: boolean) => {
    if (selectedStudents.size === 0) return;
    setProcessing(true);
    try {
      const batch = writeBatch(db);
      selectedStudents.forEach(id => {
        const ref = doc(db, 'students', id);
        batch.update(ref, {
          'academicStatus.isEligibleForCurrentExam': eligible,
          'academicStatus.clearedAcademicYear': '2025/2026',
          'academicStatus.lastUpdatedBy': profile?.email,
          'academicStatus.lastUpdatedDate': new Date()
        });
      });
      await batch.commit();

      setStudents(prev => prev.map(s => {
        if (selectedStudents.has(s.id)) {
          return {
            ...s,
            academicStatus: {
              ...s.academicStatus,
              isEligibleForCurrentExam: eligible,
              clearedAcademicYear: '2025/2026'
            }
          };
        }
        return s;
      }));

      setSelectedStudents(new Set());
      showNotification(`Successfully updated ${selectedStudents.size} students.`, 'success');
    } catch (err) {
      console.error(err);
      showNotification('Bulk update failed.', 'error');
    } finally {
      setProcessing(false);
    }
  };

  const handleSingleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStudent) return;
    
    setProcessing(true);
    try {
      const ref = doc(db, 'students', editingStudent.id);
      await updateDoc(ref, {
        fullName: editingStudent.fullName,
        department: editingStudent.department,
        level: editingStudent.level,
        'academicStatus.isEligibleForCurrentExam': editingStudent.academicStatus?.isEligibleForCurrentExam ?? false,
        'academicStatus.clearedAcademicYear': '2025/2026',
        'academicStatus.lastUpdatedBy': profile?.email,
        'academicStatus.lastUpdatedDate': new Date()
      });

      setStudents(prev => prev.map(s => s.id === editingStudent.id ? editingStudent : s));
      showNotification('Student updated successfully.', 'success');
      setEditingStudent(null);
    } catch (err) {
      console.error(err);
      showNotification('Update failed.', 'error');
    } finally {
      setProcessing(false);
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
      <div className="max-w-7xl mx-auto space-y-8 pb-10">
        
        {/* Header Setup */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-3xl font-black text-gray-900 dark:text-white flex items-center gap-3">
              <div className="p-2 bg-orange-500 rounded-xl shadow-lg shadow-orange-500/20">
                <Users className="text-white" size={24} />
              </div>
              Master <span className="text-orange-500">Database</span>
            </h1>
            <p className="text-gray-500 dark:text-gray-400 font-medium">Manage student eligibility and profiles for the current academic year.</p>
          </div>
        </div>

        {/* Global Notifications */}
        <AnimatePresence>
          {notification && (
            <motion.div
              initial={{ y: -50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -50, opacity: 0 }}
              className={`fixed top-6 right-6 z-50 px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 border ${
                notification.type === 'success' 
                  ? 'bg-green-50 dark:bg-green-900 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800' 
                  : 'bg-red-50 dark:bg-red-900 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800'
              }`}
            >
              {notification.type === 'success' ? <CheckCircle size={20} /> : <AlertCircle size={20} />}
              <span className="font-bold">{notification.message}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Search & Bulk Actions Bar */}
        <div className="bg-white dark:bg-gray-900 rounded-[2rem] border border-gray-100 dark:border-gray-800 p-4 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="relative w-full md:max-w-md">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <input 
              type="text" 
              placeholder="Search by name or ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-gray-50 dark:bg-gray-800 border-transparent focus:border-orange-500 focus:bg-white dark:focus:bg-gray-900 focus:ring-4 focus:ring-orange-500/10 rounded-xl outline-none transition-all font-bold text-gray-900 dark:text-white"
            />
          </div>
          
          <AnimatePresence mode="popLayout">
            {selectedStudents.size > 0 && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="flex items-center gap-2 bg-orange-50 dark:bg-orange-500/10 p-2 rounded-xl"
              >
                <div className="px-3 py-1 font-bold text-sm text-orange-600 dark:text-orange-400">
                  {selectedStudents.size} selected
                </div>
                <button 
                  onClick={() => handleBulkEligibility(true)}
                  disabled={processing}
                  className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm font-bold flex items-center gap-2 transition-all disabled:opacity-50"
                >
                  {processing ? <Loader2 size={16} className="animate-spin" /> : <ShieldCheck size={16} />}
                  Mark Cleared
                </button>
                <button 
                  onClick={() => handleBulkEligibility(false)}
                  disabled={processing}
                  className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm font-bold flex items-center gap-2 transition-all disabled:opacity-50"
                >
                  Revoke
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Data Grid */}
        <div className="bg-white dark:bg-gray-900 rounded-[2rem] border border-gray-100 dark:border-gray-800 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-500 dark:text-gray-400">
              <thead className="bg-gray-50 dark:bg-gray-800 text-xs uppercase font-black text-gray-700 dark:text-gray-300">
                <tr>
                  <th className="p-5 w-16">
                    <input 
                      type="checkbox" 
                      className="w-5 h-5 rounded border-gray-300 text-orange-500 focus:ring-orange-500 cursor-pointer"
                      checked={selectedStudents.size > 0 && selectedStudents.size === filteredStudents.length}
                      onChange={toggleSelectAll}
                    />
                  </th>
                  <th className="p-5">Student ID</th>
                  <th className="p-5">Full Name</th>
                  <th className="p-5">Level</th>
                  <th className="p-5">Exam Status</th>
                  <th className="p-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="p-12 text-center">
                      <Loader2 size={32} className="animate-spin text-orange-500 mx-auto" />
                      <p className="mt-4 font-bold text-gray-400">Loading database...</p>
                    </td>
                  </tr>
                ) : filteredStudents.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-12 text-center">
                      <p className="font-bold text-gray-400">No students found matching your criteria.</p>
                    </td>
                  </tr>
                ) : (
                  filteredStudents.map(student => (
                    <tr 
                      key={student.id} 
                      onClick={() => setEditingStudent(student)}
                      className={`hover:bg-orange-50/50 dark:hover:bg-orange-500/5 transition-colors cursor-pointer ${selectedStudents.has(student.id) ? 'bg-orange-50/80 dark:bg-orange-500/10' : ''}`}
                    >
                      <td className="p-5" onClick={(e) => e.stopPropagation()}>
                        <input 
                          type="checkbox" 
                          className="w-5 h-5 rounded border-gray-300 text-orange-500 focus:ring-orange-500 cursor-pointer"
                          checked={selectedStudents.has(student.id)}
                          onChange={() => toggleSelect(student.id)}
                        />
                      </td>
                      <td className="p-5 font-bold text-gray-900 dark:text-white">{student.studentId}</td>
                      <td className="p-5 font-bold text-gray-900 dark:text-white">{student.fullName}</td>
                      <td className="p-5 font-medium">{student.level ? `Level ${student.level}` : '-'}</td>
                      <td className="p-5">
                        {student.academicStatus?.isEligibleForCurrentExam ? (
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-green-50 dark:bg-green-500/10 text-green-600 dark:text-green-400 font-bold text-xs">
                            <CheckCircle size={14} /> Cleared
                          </div>
                        ) : (
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 font-bold text-xs">
                            <XCircle size={14} /> Pending Fees
                          </div>
                        )}
                      </td>
                      <td className="p-5 text-right">
                        <button 
                          onClick={(e) => { e.stopPropagation(); setEditingStudent(student); }}
                          className="px-3 py-1.5 text-xs font-bold text-orange-600 bg-orange-50 hover:bg-orange-100 dark:bg-orange-500/10 dark:hover:bg-orange-500/20 rounded-lg transition-colors inline-flex items-center gap-1"
                        >
                          Edit <ChevronRight size={14} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Slide-out Drawer for Editing Student */}
      <AnimatePresence>
        {editingStudent && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setEditingStudent(null)}
              className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm z-40"
            />
            <motion.div 
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed top-0 right-0 h-full w-full max-w-md bg-white dark:bg-gray-900 shadow-2xl z-50 flex flex-col border-l border-gray-100 dark:border-gray-800"
            >
              <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-gray-800">
                <div>
                  <h2 className="text-xl font-black text-gray-900 dark:text-white">Edit Profile</h2>
                  <p className="text-sm text-gray-400 font-medium">Student ID: {editingStudent.studentId}</p>
                </div>
                <button 
                  onClick={() => setEditingStudent(null)}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors text-gray-500"
                >
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleSingleUpdate} className="flex-1 overflow-y-auto p-6 space-y-6">
                
                {/* Basic Details (Editable) */}
                <div className="space-y-4">
                  <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest">Academic Details</h3>
                  <div className="space-y-1">
                    <label className="text-xs font-black text-gray-500">Full Name</label>
                    <input 
                      type="text" 
                      value={editingStudent.fullName || ''}
                      onChange={e => setEditingStudent({...editingStudent, fullName: e.target.value})}
                      className="w-full px-4 py-3 rounded-xl border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50 focus:ring-4 focus:ring-orange-500/10 focus:border-orange-500 outline-none font-bold transition-all text-gray-900 dark:text-white"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-black text-gray-500">Department</label>
                    <input 
                      type="text" 
                      value={editingStudent.department || ''}
                      onChange={e => setEditingStudent({...editingStudent, department: e.target.value})}
                      className="w-full px-4 py-3 rounded-xl border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50 focus:ring-4 focus:ring-orange-500/10 focus:border-orange-500 outline-none font-bold transition-all text-gray-900 dark:text-white"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-black text-gray-500">Level (e.g. 100, 200)</label>
                    <input 
                      type="number" 
                      value={editingStudent.level || ''}
                      onChange={e => setEditingStudent({...editingStudent, level: e.target.value})}
                      className="w-full px-4 py-3 rounded-xl border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50 focus:ring-4 focus:ring-orange-500/10 focus:border-orange-500 outline-none font-bold transition-all text-gray-900 dark:text-white"
                    />
                  </div>
                </div>

                {/* Danger/Action Zone - Styling inspired by user prompt request */}
                <div className="pt-6 border-t border-gray-100 dark:border-gray-800 space-y-4">
                   <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest">Exam Eligibility (Financial Clearance)</h3>
                   
                   <label className={`block relative p-5 rounded-2xl border-2 transition-all cursor-pointer ${
                      editingStudent.academicStatus?.isEligibleForCurrentExam 
                        ? 'bg-green-50 dark:bg-green-500/5 border-green-500 ring-4 ring-green-500/20' 
                        : 'bg-red-50 dark:bg-red-500/5 border-red-500/50'
                    }`}>
                      <div className="flex items-center justify-between pointer-events-none">
                        <div>
                          <p className={`font-black text-lg ${editingStudent.academicStatus?.isEligibleForCurrentExam ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}>
                            {editingStudent.academicStatus?.isEligibleForCurrentExam ? 'Cleared for Exams' : 'Not Cleared (Pending Fees)'}
                          </p>
                          <p className={`text-xs mt-1 font-bold opacity-80 ${editingStudent.academicStatus?.isEligibleForCurrentExam ? 'text-green-600' : 'text-red-600'}`}>
                            Academic Year: 2025/2026
                          </p>
                        </div>
                        <div className={`relative w-14 h-8 rounded-full transition-colors ${editingStudent.academicStatus?.isEligibleForCurrentExam ? 'bg-green-500' : 'bg-red-200 dark:bg-red-900'}`}>
                          <div className={`absolute top-1 left-1 w-6 h-6 bg-white rounded-full transition-transform shadow-md ${editingStudent.academicStatus?.isEligibleForCurrentExam ? 'translate-x-6' : 'translate-x-0'}`} />
                        </div>
                      </div>
                      
                      <input 
                        type="checkbox" 
                        className="opacity-0 absolute inset-0 cursor-pointer w-full h-full"
                        checked={editingStudent.academicStatus?.isEligibleForCurrentExam || false}
                        onChange={(e) => setEditingStudent({
                          ...editingStudent,
                          academicStatus: {
                            ...editingStudent.academicStatus,
                            isEligibleForCurrentExam: e.target.checked
                          }
                        })}
                      />
                   </label>
                </div>
              </form>

              <div className="p-6 border-t border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50">
                <button 
                  onClick={handleSingleUpdate}
                  disabled={processing}
                  className="w-full py-4 bg-orange-500 text-white font-black text-lg rounded-xl hover:bg-orange-600 hover:shadow-xl hover:shadow-orange-500/20 transition-all disabled:opacity-50 flex items-center justify-center gap-3"
                >
                  {processing ? <Loader2 size={24} className="animate-spin" /> : <CheckCircle size={24} />}
                  Save Student Profile
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </DashboardLayout>
  );
}
