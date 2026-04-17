'use client';

import React, { useState } from 'react';
import DashboardLayout from '@/components/dashboard-layout';
import { useAuth } from '@/lib/auth-context';
import { db } from '@/lib/firebase';
import { doc, setDoc, writeBatch } from 'firebase/firestore';
import { Upload, CheckCircle, Loader2, Users, AlertCircle, UserPlus, FileJson } from 'lucide-react';

export default function AdminStudentsPage() {
  const { profile } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileData, setFileData] = useState<any[] | null>(null);
  const [activeTab, setActiveTab] = useState<'upload' | 'manual'>('upload');

  // Manual entry state
  const [manualStudent, setManualStudent] = useState({
    studentId: '',
    fullName: '',
    department: '',
    program: '',
    level: '',
    entryYear: '',
    isClearedForExam: false
  });

  const [recentlyAdded, setRecentlyAdded] = useState<any[]>([]);

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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        if (Array.isArray(json)) {
          setFileData(json);
          setError(null);
        } else {
          setError('Invalid format. Please upload a JSON array of students.');
        }
      } catch (err) {
        setError('Failed to parse JSON file.');
      }
    };
    reader.readAsText(file);
  };

  const handleUpload = async () => {
    if (!fileData) return;

    setUploading(true);
    setError(null);
    try {
      // Use batches for efficiency (max 500 per batch)
      const batchSize = 500;
      for (let i = 0; i < fileData.length; i += batchSize) {
        const batch = writeBatch(db);
        const chunk = fileData.slice(i, i + batchSize);
        
        chunk.forEach((student) => {
          if (student.studentId) {
            const studentRef = doc(db, 'students', student.studentId);
            batch.set(studentRef, {
              ...student,
              updatedAt: new Date(),
              isClearedForExam: student.isClearedForExam ?? false
            }, { merge: true });
          }
        });
        
        await batch.commit();
      }
      
      setSuccess(true);
      setFileData(null);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      console.error('Upload error:', err);
      setError('Failed to upload student data. Check console for details.');
    } finally {
      setUploading(false);
    }
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Basic Validation
    if (!manualStudent.studentId || manualStudent.studentId.length < 5) {
      setError('Student ID must be at least 5 characters.');
      return;
    }
    if (!manualStudent.fullName || manualStudent.fullName.split(' ').length < 2) {
      setError('Please enter a full name (First and Last name).');
      return;
    }
    if (!manualStudent.department || !manualStudent.program) {
      setError('Department and Program are required.');
      return;
    }

    setUploading(true);
    setError(null);
    try {
      const studentRef = doc(db, 'students', manualStudent.studentId);
      
      const studentData: any = {
        studentId: manualStudent.studentId,
        fullName: manualStudent.fullName,
        department: manualStudent.department,
        program: manualStudent.program,
        isClearedForExam: manualStudent.isClearedForExam,
        updatedAt: new Date(),
      };

      if (manualStudent.level) studentData.level = parseInt(manualStudent.level);
      if (manualStudent.entryYear) studentData.entryYear = parseInt(manualStudent.entryYear);

      await setDoc(studentRef, studentData, { merge: true });
      
      // Add to recently added list
      setRecentlyAdded(prev => [studentData, ...prev].slice(0, 5));
      
      setSuccess(true);
      setManualStudent({
        studentId: '',
        fullName: '',
        department: '',
        program: '',
        level: '',
        entryYear: '',
        isClearedForExam: false
      });
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      console.error('Manual entry error:', err);
      setError('Failed to add student. Check console for details.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto space-y-8 pb-10">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-3xl font-black text-gray-900 dark:text-white flex items-center gap-3">
              <div className="p-2 bg-orange-500 rounded-xl shadow-lg shadow-orange-500/20">
                <Users className="text-white" size={24} />
              </div>
              Student <span className="text-orange-500">Database</span>
            </h1>
            <p className="text-gray-500 dark:text-gray-400 font-medium">Provision student records to enable ID card applications.</p>
          </div>

          <div className="flex bg-gray-100 dark:bg-gray-800 p-1 rounded-2xl w-fit">
            <button
              onClick={() => { setActiveTab('upload'); setError(null); setSuccess(false); }}
              className={`px-6 py-2.5 text-sm font-black flex items-center gap-2 rounded-xl transition-all ${
                activeTab === 'upload' 
                  ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' 
                  : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              <FileJson size={18} />
              Batch Upload
            </button>
            <button
              onClick={() => { setActiveTab('manual'); setError(null); setSuccess(false); }}
              className={`px-6 py-2.5 text-sm font-black flex items-center gap-2 rounded-xl transition-all ${
                activeTab === 'manual' 
                  ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' 
                  : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              <UserPlus size={18} />
              Single Entry
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <div className="lg:col-span-8">
            <div className="bg-white dark:bg-gray-900 rounded-[2.5rem] border border-gray-100 dark:border-gray-800 p-8 md:p-10 shadow-xl shadow-gray-200/50 dark:shadow-none space-y-8">
              {error && (
                <div className="p-4 bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-500 rounded-2xl text-sm font-bold flex items-center gap-2 border border-red-100 dark:border-red-500/20">
                  <AlertCircle size={18} />
                  {error}
                </div>
              )}

              {success && (
                <div className="p-4 bg-green-50 dark:bg-green-500/10 text-green-600 dark:text-green-500 rounded-2xl text-sm font-bold flex items-center gap-2 border border-green-100 dark:border-green-500/20">
                  <CheckCircle size={18} />
                  Student record successfully updated!
                </div>
              )}

              {activeTab === 'upload' ? (
                <div className="space-y-6">
                  <div className="space-y-2">
                    <h2 className="text-xl font-black text-gray-900 dark:text-white">Batch Import Students</h2>
                    <p className="text-sm text-gray-500">Upload a JSON array containing student records for high-volume provisioning.</p>
                  </div>
                  
                  <div className="relative h-60 border-4 border-dashed border-gray-100 dark:border-gray-800 rounded-[2rem] flex flex-col items-center justify-center group hover:border-orange-500/30 hover:bg-orange-50/30 dark:hover:bg-orange-500/5 transition-all cursor-pointer">
                    <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-2xl group-hover:bg-orange-100 dark:group-hover:bg-orange-500/20 transition-all mb-4">
                      <Upload className="text-gray-400 group-hover:text-orange-500" size={32} />
                    </div>
                    <p className="text-sm font-black text-gray-400 group-hover:text-gray-700 dark:group-hover:text-gray-200">Drop JSON file here or click to browse</p>
                    <input 
                      type="file" 
                      accept=".json" 
                      onChange={handleFileChange}
                      className="absolute inset-0 opacity-0 cursor-pointer"
                    />
                  </div>

                  <div className="p-6 bg-gray-50 dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700/50">
                    <p className="text-xs font-black text-gray-400 mb-3 uppercase tracking-widest">Required Schema Example</p>
                    <code className="text-[10px] sm:text-xs text-orange-600 dark:text-orange-400 break-all leading-relaxed">{`[{"studentId": "230918", "fullName": "Kwame Mensah", "department": "Science", "program": "BSc Computer Science"}]`}</code>
                  </div>

                  {fileData && (
                    <div className="flex items-center justify-between p-4 bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 rounded-2xl text-sm font-bold border border-blue-100 dark:border-blue-500/20">
                      <div className="flex items-center gap-2">
                        <CheckCircle size={18} />
                        Found {fileData.length} student records
                      </div>
                    </div>
                  )}

                  <button
                    onClick={handleUpload}
                    disabled={!fileData || uploading}
                    className="w-full py-4 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-2xl font-black text-lg hover:shadow-xl hover:shadow-gray-200 dark:hover:shadow-none transition-all disabled:opacity-50 flex items-center justify-center gap-3"
                  >
                    {uploading ? <Loader2 className="animate-spin" /> : <Upload size={20} />}
                    Process Batch Upload
                  </button>
                </div>
              ) : (
                <form onSubmit={handleManualSubmit} className="space-y-8">
                  <div className="space-y-2">
                    <h2 className="text-xl font-black text-gray-900 dark:text-white">Single Student Entry</h2>
                    <p className="text-sm text-gray-500">Manually add individual student records to the database.</p>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                    <div className="space-y-2">
                      <label className="text-xs font-black text-gray-400 uppercase tracking-widest ml-1">Student ID</label>
                      <input
                        type="text"
                        required
                        value={manualStudent.studentId}
                        onChange={(e) => setManualStudent({...manualStudent, studentId: e.target.value})}
                        className="w-full px-5 py-4 rounded-2xl border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50 focus:ring-4 focus:ring-orange-500/10 focus:border-orange-500 outline-none transition-all font-bold text-gray-900 dark:text-white"
                        placeholder="e.g. 10293847"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <label className="text-xs font-black text-gray-400 uppercase tracking-widest ml-1">Full Name</label>
                      <input
                        type="text"
                        required
                        value={manualStudent.fullName}
                        onChange={(e) => setManualStudent({...manualStudent, fullName: e.target.value})}
                        className="w-full px-5 py-4 rounded-2xl border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50 focus:ring-4 focus:ring-orange-500/10 focus:border-orange-500 outline-none transition-all font-bold text-gray-900 dark:text-white"
                        placeholder="e.g. Ama Serwaa"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-black text-gray-400 uppercase tracking-widest ml-1">Department</label>
                      <input
                        type="text"
                        required
                        value={manualStudent.department}
                        onChange={(e) => setManualStudent({...manualStudent, department: e.target.value})}
                        className="w-full px-5 py-4 rounded-2xl border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50 focus:ring-4 focus:ring-orange-500/10 focus:border-orange-500 outline-none transition-all font-bold text-gray-900 dark:text-white"
                        placeholder="e.g. Faculty of Science"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-black text-gray-400 uppercase tracking-widest ml-1">Academic Program</label>
                      <input
                        type="text"
                        required
                        value={manualStudent.program}
                        onChange={(e) => setManualStudent({...manualStudent, program: e.target.value})}
                        className="w-full px-5 py-4 rounded-2xl border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50 focus:ring-4 focus:ring-orange-500/10 focus:border-orange-500 outline-none transition-all font-bold text-gray-900 dark:text-white"
                        placeholder="e.g. BSc Computer Science"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-black text-gray-400 uppercase tracking-widest ml-1">Level</label>
                      <select
                        value={manualStudent.level}
                        onChange={(e) => setManualStudent({...manualStudent, level: e.target.value})}
                        className="w-full px-5 py-4 rounded-2xl border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50 focus:ring-4 focus:ring-orange-500/10 focus:border-orange-500 outline-none transition-all font-bold text-gray-900 dark:text-white"
                      >
                        <option value="">Select Level</option>
                        <option value="100">Level 100</option>
                        <option value="200">Level 200</option>
                        <option value="300">Level 300</option>
                        <option value="400">Level 400</option>
                        <option value="500">Postgraduate</option>
                      </select>
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-black text-gray-400 uppercase tracking-widest ml-1">Entry Year</label>
                      <input
                        type="number"
                        value={manualStudent.entryYear}
                        onChange={(e) => setManualStudent({...manualStudent, entryYear: e.target.value})}
                        className="w-full px-5 py-4 rounded-2xl border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50 focus:ring-4 focus:ring-orange-500/10 focus:border-orange-500 outline-none transition-all font-bold text-gray-900 dark:text-white"
                        placeholder="e.g. 2024"
                      />
                    </div>

                    <div className="md:col-span-2 flex items-center justify-between p-5 bg-orange-50 dark:bg-orange-500/5 rounded-[1.5rem] border border-orange-100 dark:border-orange-500/10">
                      <div className="space-y-0.5">
                        <p className="text-sm font-black text-gray-900 dark:text-white">Exam Eligibility</p>
                        <p className="text-xs text-gray-500 font-medium">Allow student to verify for exams immediately.</p>
                      </div>
                      <input
                        type="checkbox"
                        id="exam-clearance"
                        checked={manualStudent.isClearedForExam}
                        onChange={(e) => setManualStudent({...manualStudent, isClearedForExam: e.target.checked})}
                        className="w-6 h-6 rounded-lg border-2 border-gray-300 text-orange-500 focus:ring-orange-500 transition-all cursor-pointer"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={uploading}
                    className="w-full py-5 bg-orange-500 text-white rounded-2xl font-black text-lg hover:bg-orange-600 transition-all disabled:opacity-50 flex items-center justify-center gap-3 shadow-xl shadow-orange-500/20"
                  >
                    {uploading ? <Loader2 className="animate-spin" /> : <UserPlus size={22} />}
                    Submit Student Record
                  </button>
                </form>
              )}
            </div>
          </div>

          <div className="lg:col-span-4 space-y-6">
            <div className="bg-white dark:bg-gray-900 rounded-[2.5rem] border border-gray-100 dark:border-gray-800 p-8 shadow-xl shadow-gray-200/50 dark:shadow-none">
              <h3 className="text-lg font-black text-gray-900 dark:text-white mb-6 flex items-center gap-2">
                <CheckCircle className="text-green-500" size={20} />
                Recently Added
              </h3>
              <div className="space-y-4">
                {recentlyAdded.length > 0 ? (
                  recentlyAdded.map((s, idx) => (
                    <div key={idx} className="p-4 bg-gray-50 dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-800 group hover:border-orange-500/30 transition-all">
                      <p className="text-sm font-black text-gray-900 dark:text-white truncate">{s.fullName}</p>
                      <p className="text-xs text-gray-500 flex items-center gap-1 mt-1 font-bold">
                        {s.studentId} • <span className="text-orange-500">{s.department}</span>
                      </p>
                    </div>
                  ))
                ) : (
                  <div className="py-12 text-center space-y-3">
                    <Users size={32} className="mx-auto text-gray-200 dark:text-gray-800" />
                    <p className="text-xs text-gray-400 font-bold uppercase tracking-widest italic">No entries yet</p>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-orange-500 rounded-[2.5rem] p-8 text-white relative overflow-hidden shadow-xl shadow-orange-500/20">
              <div className="absolute top-0 right-0 -mr-16 -mt-16 w-48 h-48 bg-white/10 rounded-full blur-3xl"></div>
              <h3 className="text-lg font-black mb-2 flex items-center gap-2">
                <AlertCircle size={20} />
                Pro Tip
              </h3>
              <p className="text-sm font-medium opacity-90 leading-relaxed">
                Use batch upload for initial database population, and single entry for onboarding new students during registration periods.
              </p>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
