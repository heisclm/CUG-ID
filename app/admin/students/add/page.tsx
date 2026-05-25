'use client';

import React, { useState, useEffect, useRef } from 'react';
import DashboardLayout from '@/components/dashboard-layout';
import { useAuth } from '@/lib/auth-context';
import { db } from '@/lib/firebase';
import { collection, doc, setDoc, query, orderBy, limit, getDocs, serverTimestamp, writeBatch } from 'firebase/firestore';
import { 
  Users, 
  UserPlus,
  Upload,
  AlertCircle,
  Loader2,
  CheckCircle,
  Info,
  Check,
  Download,
  FileText
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Link from 'next/link';
import Papa from 'papaparse';

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

  // Batch Upload State
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const [importStats, setImportStats] = useState<{ total: number; added: number } | null>(null);

  const normalizeHeaders = (row: Record<string, string>) => {
    const result: any = {
      studentId: '',
      fullName: '',
      department: '',
      program: '',
      level: '100',
      entryYear: ''
    };

    const cleanKey = (k: string) => k.toLowerCase().replace(/[\s_-]/g, '');

    for (const [key, value] of Object.entries(row)) {
      const kCleaned = cleanKey(key);
      const valCleaned = (value || '').trim();

      if (kCleaned === 'studentid' || kCleaned === 'student_id' || kCleaned === 'id' || kCleaned === 'matricno' || kCleaned === 'matric_no') {
        result.studentId = valCleaned.toUpperCase();
      } else if (kCleaned === 'fullname' || kCleaned === 'full_name' || kCleaned === 'name') {
        result.fullName = valCleaned;
      } else if (kCleaned === 'department' || kCleaned === 'dept' || kCleaned === 'faculty') {
        result.department = valCleaned;
      } else if (kCleaned === 'program' || kCleaned === 'academicprogram' || kCleaned === 'course') {
        result.program = valCleaned;
      } else if (kCleaned === 'level' || kCleaned === 'class') {
        const match = valCleaned.match(/\d+/);
        result.level = match ? match[0] : '100';
      } else if (kCleaned === 'entryyear' || kCleaned === 'yearofentry' || kCleaned === 'entry_year' || kCleaned === 'admissionyear') {
        result.entryYear = valCleaned;
      }
    }

    return result;
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleBatchFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleBatchFile(e.target.files[0]);
    }
  };

  const handleBatchFile = (file: File) => {
    if (!file) return;
    
    if (!file.name.endsWith('.csv')) {
      showNotification('Please upload a valid CSV file.', 'error');
      return;
    }

    setProcessing(true);
    setImportStats(null);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const rawRows = results.data as any[];
        if (!rawRows || rawRows.length === 0) {
          showNotification('The uploaded file is empty.', 'error');
          setProcessing(false);
          return;
        }

        const validRecords: any[] = [];
        for (const row of rawRows) {
          const norm = normalizeHeaders(row);
          if (norm.studentId && norm.fullName) {
            validRecords.push(norm);
          }
        }

        if (validRecords.length === 0) {
          showNotification('No valid records found. Please check column headers (studentId, fullName required).', 'error');
          setProcessing(false);
          return;
        }

        try {
          let importCount = 0;
          const chunkLimit = 500;
          
          for (let i = 0; i < validRecords.length; i += chunkLimit) {
            const batch = writeBatch(db);
            const chunk = validRecords.slice(i, i + chunkLimit);
            
            for (const record of chunk) {
              const ref = doc(db, 'students', record.studentId);
              batch.set(ref, {
                studentId: record.studentId,
                fullName: record.fullName,
                department: record.department || 'N/A',
                program: record.program || 'N/A',
                level: record.level || '100',
                entryYear: record.entryYear || new Date().getFullYear().toString(),
                createdAt: serverTimestamp(),
                'academicStatus': {
                  isEligibleForCurrentExam: true,
                  clearedAcademicYear: '2025/2026',
                  lastUpdatedBy: profile?.email || 'System',
                  lastUpdatedDate: serverTimestamp()
                }
              });
              importCount++;
            }
            
            await batch.commit();
          }

          showNotification(`Successfully imported ${importCount} student records!`, 'success');
          setImportStats({ total: validRecords.length, added: importCount });
          fetchRecentStudents();
        } catch (err) {
          console.error('Error importing batch:', err);
          showNotification('Failed to import student database records.', 'error');
        } finally {
          setProcessing(false);
        }
      },
      error: (parseError) => {
        console.error('CSV parse error:', parseError);
        showNotification('Failed to parse CSV file structures.', 'error');
        setProcessing(false);
      }
    });
  };

  const downloadTemplate = () => {
    const csvContent = "studentId,fullName,department,program,level,entryYear\nUGR0202210043,Oyekunle Clement,Faculty of CEMs,BSc Computer Science,200,2022\nUGR0202210044,Mark Leo,Faculty of CEMs,BSc Computer Engineering,200,2022\n";
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "student_database_template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

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
      data.sort((a: any, b: any) => {
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
                        placeholder="e.g. UGR0202210065"
                        className="w-full px-5 py-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-transparent focus:ring-4 focus:ring-orange-500/10 focus:border-orange-500 outline-none font-bold transition-all text-gray-900 dark:text-white uppercase placeholder:normal-case placeholder:font-medium"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-black text-gray-500 uppercase tracking-widest pl-1">Full Name</label>
                      <input 
                        type="text" 
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="e.g. Ama Nana"
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
                        className="w-full px-5 py-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 focus:ring-4 focus:ring-orange-500/10 focus:border-orange-500 outline-none font-bold transition-all text-gray-900 dark:text-white appearance-none cursor-pointer"
                      >
                        <option value="" disabled className="bg-white dark:bg-gray-950 text-gray-400">Select Level</option>
                        <option value="100" className="bg-white dark:bg-gray-950 text-gray-900 dark:text-white">Level 100</option>
                        <option value="200" className="bg-white dark:bg-gray-950 text-gray-900 dark:text-white">Level 200</option>
                        <option value="300" className="bg-white dark:bg-gray-950 text-gray-900 dark:text-white">Level 300</option>
                        <option value="400" className="bg-white dark:bg-gray-950 text-gray-900 dark:text-white">Level 400</option>
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
          <div className="max-w-4xl mx-auto space-y-6">
            <div 
              onDragEnter={handleDrag}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onDrop={handleDrop}
              className={`flex flex-col items-center justify-center min-h-[45vh] bg-white dark:bg-gray-900 border-2 border-dashed rounded-[2rem] text-center p-8 transition-all relative ${
                dragActive 
                  ? 'border-orange-500 bg-orange-50/50 dark:bg-orange-500/10' 
                  : 'border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700'
              }`}
            >
              <input 
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept=".csv"
                className="hidden"
              />

              {processing ? (
                <div className="space-y-4 animate-pulse">
                  <Loader2 size={56} className="text-orange-500 animate-spin mx-auto" />
                  <h3 className="text-xl font-black text-gray-900 dark:text-white">Importing Records...</h3>
                  <p className="text-gray-500 text-sm max-w-sm">Parsing the CSV file and writing to Firestore database. Do not close this session.</p>
                </div>
              ) : importStats ? (
                <div className="space-y-6">
                  <div className="w-16 h-16 bg-green-500/10 text-green-500 rounded-full flex items-center justify-center mx-auto mb-2">
                    <CheckCircle size={36} />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-2xl font-black text-gray-900 dark:text-white">Import Successful!</h3>
                    <p className="text-gray-500 text-sm max-w-md mx-auto">
                      Successfully processed the database file. <span className="text-green-600 font-bold">{importStats.added}</span> out of <span className="font-bold">{importStats.total}</span> entries were synchronized securely.
                    </p>
                  </div>
                  <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
                    <button 
                      onClick={() => setImportStats(null)}
                      className="px-6 py-3 bg-orange-500 text-white font-bold rounded-xl hover:bg-orange-600 shadow-md hover:shadow-orange-500/10 transition-all text-sm cursor-pointer"
                    >
                      Upload Another File
                    </button>
                    <button 
                      onClick={() => setActiveTab('single')}
                      className="px-6 py-3 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-bold rounded-xl hover:bg-gray-200 dark:hover:bg-gray-700 transition-all text-sm cursor-pointer"
                    >
                      Return to Single Entry
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="relative">
                    <div className="absolute inset-0 bg-orange-500 blur-3xl opacity-10 rounded-full"></div>
                    <Upload size={54} className="text-orange-500 stroke-[1.5] relative z-10 mx-auto" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-black text-gray-900 dark:text-white mb-2">Batch Upload Utility</h2>
                    <p className="text-gray-500 dark:text-gray-400 max-w-md mx-auto text-sm font-medium">
                      Drag and drop your student records CSV file here, or click to browse standard spreadsheets.
                    </p>
                  </div>
                  
                  <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
                    <button 
                      onClick={() => fileInputRef.current?.click()}
                      className="px-8 py-4 bg-orange-500 text-white font-black text-sm rounded-xl hover:bg-orange-600 shadow-lg shadow-orange-500/10 transition-all w-full sm:w-auto cursor-pointer"
                    >
                      Select File to Upload
                    </button>
                    <button 
                      onClick={downloadTemplate}
                      className="px-6 py-4 bg-white dark:bg-gray-850 text-gray-700 dark:text-gray-300 font-bold text-sm rounded-xl border border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-850 transition-all w-full sm:w-auto flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <Download size={16} /> Download CSV Template
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Instruction Panel */}
            <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 p-6 rounded-3xl flex items-start gap-4">
              <div className="p-2.5 bg-orange-500/10 text-orange-500 rounded-2xl shrink-0 animate-pulse">
                <FileText size={20} />
              </div>
              <div className="space-y-1 text-left">
                <h4 className="font-black text-gray-900 dark:text-white text-sm">Required CSV File Specifications</h4>
                <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed font-medium">
                  Columns must match: <code className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 rounded font-mono text-orange-500 font-bold">studentId</code>, <code className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 rounded font-mono text-orange-500 font-bold">fullName</code>, <code className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 rounded font-mono text-gray-600 dark:text-gray-400">department</code>, <code className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 rounded font-mono text-gray-600 dark:text-gray-400">program</code>, <code className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 rounded font-mono text-gray-600 dark:text-gray-400">level</code> (100-400), and <code className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 rounded font-mono text-gray-600 dark:text-gray-400">entryYear</code>.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
