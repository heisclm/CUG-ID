'use client';

import React, { useState, useEffect } from 'react';
import DashboardLayout from '@/components/dashboard-layout';
import { useAuth } from '@/lib/auth-context';
import { db } from '@/lib/firebase';
import { collection, doc, setDoc, query, orderBy, limit, getDocs, serverTimestamp } from 'firebase/firestore';
import { 
  Users, 
  UserPlus,
  Upload,
  AlertCircle,
  Loader2,
  CheckCircle,
  Info,
  Check
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Link from 'next/link';

export default function AdminAddStudentPage() {
  const { profile } = useAuth();
  const [activeTab, setActiveTab] = useState<'single' | 'batch'>('single');
  const [processing, setProcessing] = useState(false);
  const [notification, setNotification] = useState<{message: string, type: 'success' | 'error'} | null>(null);
  
  const [recentStudents, setRecentStudents] = useState<any[]>([]);

  // Form State
  const [studentId, setStudentId] = useState('');
  const [fullName, setFullName] = useState('');
  const [department, setDepartment] = useState('');
  const [program, setProgram] = useState('');
  const [level, setLevel] = useState('');
  const [entryYear, setEntryYear] = useState('');
  const [isEligible, setIsEligible] = useState(true);

  useEffect(() => {
    fetchRecentStudents();
  }, []);

  const fetchRecentStudents = async () => {
    try {
      // Assuming we have a createdAt field, if not we just fetch some recent ones
      const q = query(collection(db, 'students'), limit(5));
      const snap = await getDocs(q);
      const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      // Sort in memory by lastUpdatedDate or randomly if we don't have createdAt yet
      data.sort((a, b) => {
        const dateA = a.createdAt?.toMillis() || a.academicStatus?.lastUpdatedDate?.toMillis() || 0;
        const dateB = b.createdAt?.toMillis() || b.academicStatus?.lastUpdatedDate?.toMillis() || 0;
        return dateB - dateA;
      });
      setRecentStudents(data);
    } catch (err) {
      console.error('Failed to fetch recent students:', err);
    }
  };

  const showNotification = (message: string, type: 'success' | 'error') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3500);
  };

  const handleSingleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentId || !fullName || !department || !program || !level || !entryYear) {
      showNotification('Please fill in all fields.', 'error');
      return;
    }

    setProcessing(true);
    try {
      const ref = doc(db, 'students', studentId.toUpperCase());
      await setDoc(ref, {
        studentId: studentId.toUpperCase(),
        fullName,
        department,
        program,
        level,
        entryYear,
        createdAt: serverTimestamp(),
        'academicStatus': {
          isEligibleForCurrentExam: isEligible,
          clearedAcademicYear: '2025/2026',
          lastUpdatedBy: profile?.email,
          lastUpdatedDate: serverTimestamp()
        }
      });

      showNotification('Student record added successfully.', 'success');
      
      // Reset form
      setStudentId('');
      setFullName('');
      setDepartment('');
      setProgram('');
      setLevel('');
      setEntryYear('');
      setIsEligible(true);

      // Refresh recent
      fetchRecentStudents();
    } catch (err) {
      console.error(err);
      showNotification('Failed to add student record.', 'error');
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
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-1">
            <h1 className="text-3xl font-black text-gray-900 dark:text-white flex items-center gap-3">
              <div className="p-2 bg-orange-500 rounded-xl shadow-lg shadow-orange-500/20">
                <Users className="text-white" size={24} />
              </div>
              Student <span className="text-orange-500">Database</span>
            </h1>
            <p className="text-gray-500 dark:text-gray-400 font-medium">Provision student records to enable ID card applications.</p>
          </div>

          {/* Toggle buttons */}
          <div className="flex items-center bg-gray-100 dark:bg-gray-800/80 p-1.5 rounded-2xl">
            <button 
              onClick={() => setActiveTab('batch')}
              className={`px-5 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 transition-all ${activeTab === 'batch' ? 'bg-white dark:bg-gray-700 shadow-sm text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
            >
              <Upload size={16} /> Batch Upload
            </button>
            <button 
              onClick={() => setActiveTab('single')}
              className={`px-5 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 transition-all ${activeTab === 'single' ? 'bg-white dark:bg-gray-700 shadow-sm text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
            >
              <UserPlus size={16} /> Single Entry
            </button>
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

        {activeTab === 'single' ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Main Form Area */}
            <div className="lg:col-span-2">
              <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-[2rem] p-8 shadow-sm">
                
                <div className="mb-8">
                  <h2 className="text-xl font-black text-gray-900 dark:text-white mb-2">Single Student Entry</h2>
                  <p className="text-gray-500 dark:text-gray-400 text-sm font-medium">Manually add individual student records to the database.</p>
                </div>

                <form onSubmit={handleSingleSubmit} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-xs font-black text-gray-500 uppercase tracking-widest pl-1">Student ID</label>
                      <input 
                        type="text" 
                        value={studentId}
                        onChange={(e) => setStudentId(e.target.value)}
                        placeholder="e.g. CUG12345"
                        className="w-full px-5 py-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-transparent focus:ring-4 focus:ring-orange-500/10 focus:border-orange-500 outline-none font-bold transition-all text-gray-900 dark:text-white uppercase placeholder:normal-case placeholder:font-medium"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-black text-gray-500 uppercase tracking-widest pl-1">Full Name</label>
                      <input 
                        type="text" 
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="e.g. Oyekunle Clement"
                        className="w-full px-5 py-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-transparent focus:ring-4 focus:ring-orange-500/10 focus:border-orange-500 outline-none font-bold transition-all text-gray-900 dark:text-white placeholder:font-medium"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-xs font-black text-gray-500 uppercase tracking-widest pl-1">Department</label>
                      <input 
                        type="text" 
                        value={department}
                        onChange={(e) => setDepartment(e.target.value)}
                        placeholder="e.g. Faculty of CEMs"
                        className="w-full px-5 py-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-transparent focus:ring-4 focus:ring-orange-500/10 focus:border-orange-500 outline-none font-bold transition-all text-gray-900 dark:text-white placeholder:font-medium"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-black text-gray-500 uppercase tracking-widest pl-1">Academic Program</label>
                      <input 
                        type="text" 
                        value={program}
                        onChange={(e) => setProgram(e.target.value)}
                        placeholder="e.g. BSc Computer Science"
                        className="w-full px-5 py-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-transparent focus:ring-4 focus:ring-orange-500/10 focus:border-orange-500 outline-none font-bold transition-all text-gray-900 dark:text-white placeholder:font-medium"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-xs font-black text-gray-500 uppercase tracking-widest pl-1">Level</label>
                      <select 
                        value={level}
                        onChange={(e) => setLevel(e.target.value)}
                        className="w-full px-5 py-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-transparent focus:ring-4 focus:ring-orange-500/10 focus:border-orange-500 outline-none font-bold transition-all text-gray-900 dark:text-white appearance-none cursor-pointer"
                      >
                        <option value="" disabled className="text-gray-500">Select Level</option>
                        <option value="100">Level 100</option>
                        <option value="200">Level 200</option>
                        <option value="300">Level 300</option>
                        <option value="400">Level 400</option>
                        <option value="500">Level 500</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-black text-gray-500 uppercase tracking-widest pl-1">Entry Year</label>
                      <input 
                        type="number" 
                        value={entryYear}
                        onChange={(e) => setEntryYear(e.target.value)}
                        placeholder="e.g. 2022"
                        className="w-full px-5 py-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-transparent focus:ring-4 focus:ring-orange-500/10 focus:border-orange-500 outline-none font-bold transition-all text-gray-900 dark:text-white placeholder:font-medium"
                      />
                    </div>
                  </div>

                  <div className="pt-2">
                    <label className="flex items-center justify-between p-5 rounded-2xl border border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30 cursor-pointer hover:border-orange-500/30 transition-all">
                      <div>
                        <p className="font-bold text-gray-900 dark:text-white mb-1">Exam Eligibility</p>
                        <p className="text-sm font-medium text-gray-500">Allow student to verify for exams immediately.</p>
                      </div>
                      <div className="relative flex items-center justify-center">
                        <input 
                          type="checkbox" 
                          checked={isEligible}
                          onChange={(e) => setIsEligible(e.target.checked)}
                          className="w-6 h-6 rounded border-gray-300 text-orange-500 focus:ring-orange-500/20 focus:ring-offset-0 cursor-pointer appearance-none bg-white dark:bg-gray-900 checked:bg-orange-500 checked:border-orange-500 transition-all peer"
                        />
                        <Check className="absolute text-white pointer-events-none opacity-0 peer-checked:opacity-100 transition-opacity" size={16} strokeWidth={4} />
                      </div>
                    </label>
                  </div>

                  <div className="pt-4">
                    <button 
                      type="submit"
                      disabled={processing}
                      className="w-full py-4 bg-orange-500 text-white font-black text-lg rounded-xl hover:bg-orange-600 hover:shadow-xl hover:shadow-orange-500/20 transition-all disabled:opacity-50 flex items-center justify-center gap-3"
                    >
                      {processing ? <Loader2 size={24} className="animate-spin" /> : <UserPlus size={24} />}
                      Submit Student Record
                    </button>
                  </div>
                </form>
              </div>
            </div>

            {/* Right Sidebar Area */}
            <div className="space-y-6">
              
              {/* Recently Added Cards */}
              <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-[2rem] p-6 shadow-sm">
                <div className="flex items-center gap-2 mb-6">
                  <CheckCircle className="text-green-500" size={20} />
                  <h3 className="font-black text-gray-900 dark:text-white text-lg">Recently Added</h3>
                </div>

                {recentStudents.length === 0 ? (
                  <div className="py-12 flex flex-col items-center justify-center text-center opacity-50">
                    <Users size={32} className="mb-4 text-gray-400" />
                    <p className="text-sm font-black text-gray-500 uppercase tracking-widest">No entries yet</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {recentStudents.slice(0, 4).map((student) => (
                      <div key={student.id} className="p-4 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-transparent dark:border-gray-800">
                        <div className="flex justify-between items-start mb-1">
                          <p className="font-bold text-gray-900 dark:text-white">{student.fullName}</p>
                          <span className="text-xs font-black text-gray-500 uppercase">{student.studentId}</span>
                        </div>
                        <p className="text-xs font-medium text-gray-500">{student.department}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Pro Tip Alert */}
              <div className="bg-orange-500 rounded-[2rem] p-6 shadow-xl shadow-orange-500/20 text-white relative overflow-hidden text-left">
                <div className="absolute -top-12 -right-12 w-32 h-32 bg-white/10 rounded-full blur-2xl"></div>
                <div className="relative z-10 space-y-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Info size={20} className="stroke-[2.5]" />
                    <h3 className="font-black text-xl">Pro Tip</h3>
                  </div>
                  <p className="text-orange-50 font-medium leading-relaxed">
                    Use batch upload for initial database population, and single entry for onboarding new students during registration periods.
                  </p>
                </div>
              </div>

            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-[40vh] bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-[2rem] text-center p-8">
            <Upload size={48} className="text-gray-300 dark:text-gray-700 mb-6" />
            <h2 className="text-2xl font-black text-gray-900 dark:text-white mb-2">Batch Upload Utility</h2>
            <p className="text-gray-500 max-w-md mx-auto mb-8 font-medium">Upload a CSV or Excel file containing multiple student records to populate the database instantly.</p>
            <button className="px-8 py-4 bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-black rounded-xl hover:shadow-xl transition-all">
              Select File to Upload
            </button>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
