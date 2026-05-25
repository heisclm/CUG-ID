'use client';

import React, { useState, useRef, useEffect } from 'react';
import DashboardLayout from '@/components/dashboard-layout';
import { Bell, Shield, Key, Image as ImageIcon, Upload, Loader2, CheckCircle2 } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { db } from '@/lib/firebase';
import { doc, setDoc, onSnapshot } from 'firebase/firestore';
import Image from 'next/image';

export default function SettingsPage() {
  const { profile } = useAuth();
  const [isUploading, setIsUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [currentLogo, setCurrentLogo] = useState('/cug-logo.jpg');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'settings', 'general'), (doc) => {
      if (doc.exists() && doc.data().schoolLogoUrl) {
        setCurrentLogo(doc.data().schoolLogoUrl);
      }
    });
    return () => unsub();
  }, []);

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setUploadSuccess(false);

    try {
      // Create a form data to upload the image
      const formData = new FormData();
      formData.append('file', file);
      
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });
      
      if (!res.ok) throw new Error('Upload failed');
      const data = await res.json();
      
      // Update global settings
      await setDoc(doc(db, 'settings', 'general'), {
        schoolLogoUrl: data.url,
        updatedAt: new Date().toISOString()
      }, { merge: true });
      
      setUploadSuccess(true);
      setTimeout(() => setUploadSuccess(false), 3000);
    } catch (error) {
      console.error('Error uploading logo:', error);
      alert('Failed to upload logo.');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Settings</h1>
          <p className="text-gray-500 dark:text-gray-400 font-medium">Manage your app preferences.</p>
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-3xl border border-gray-100 dark:border-gray-800 overflow-hidden">
          <div className="p-6 sm:p-8 space-y-8">
            {/* Notifications */}
            <div className="space-y-4">
              <h2 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                <Bell size={16} className="text-orange-500" /> Notifications
              </h2>
              <div className="space-y-2">
                {[
                  { title: 'Push Notifications', desc: 'Receive alerts on your device' },
                  { title: 'Email Notifications', desc: 'Receive updates via email' },
                  { title: 'Application Updates', desc: 'Get notified about your ID status' }
                ].map((item, i) => (
                  <div key={i} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800/50 rounded-2xl">
                    <div>
                      <div className="font-bold text-gray-900 dark:text-white">{item.title}</div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">{item.desc}</div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" className="sr-only peer" defaultChecked />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-orange-500"></div>
                    </label>
                  </div>
                ))}
              </div>
            </div>

            {/* Security */}
            <div className="space-y-4">
              <h2 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                <Shield size={16} className="text-orange-500" /> Security
              </h2>
              <div className="space-y-2">
                <button className="w-full flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800/50 rounded-2xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-left">
                  <div>
                    <div className="font-bold text-gray-900 dark:text-white">Change Password</div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">Update your account password</div>
                  </div>
                  <Key size={20} className="text-gray-400" />
                </button>
              </div>
            </div>

            {/* Admin Settings */}
            {profile?.role === 'ADMIN' && (
              <div className="space-y-4 pt-6 border-t border-gray-100 dark:border-gray-800">
                <h2 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                  <Shield size={16} className="text-purple-500" /> Admin Settings
                </h2>
                <div className="space-y-2">
                  <div className="flex flex-col sm:flex-row gap-6 p-4 sm:p-6 bg-gray-50 dark:bg-gray-800/50 rounded-2xl">
                    <div className="flex-1">
                      <div className="font-bold text-gray-900 dark:text-white mb-1">School Logo</div>
                      <div className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                        Update the university logo displayed on student ID cards. Replaces the default logo for all users.
                      </div>
                      
                      <input 
                        type="file"
                        ref={fileInputRef}
                        onChange={handleLogoUpload}
                        className="hidden"
                        accept="image/*"
                      />
                      <button 
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isUploading}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors font-medium text-sm text-gray-700 dark:text-gray-300 disabled:opacity-50"
                      >
                        {isUploading ? (
                          <Loader2 size={16} className="animate-spin text-orange-500" />
                        ) : uploadSuccess ? (
                          <CheckCircle2 size={16} className="text-green-500" />
                        ) : (
                          <Upload size={16} className="text-gray-400" />
                        )}
                        {isUploading ? 'Uploading...' : uploadSuccess ? 'Upload Complete' : 'Upload New Logo'}
                      </button>
                    </div>
                    
                    {/* Logo Preview */}
                    <div className="shrink-0 space-y-2">
                      <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-widest px-1">Preview</div>
                      <div className="w-24 h-24 bg-white shadow-sm border border-gray-100 dark:border-gray-700 rounded-xl p-2 flex items-center justify-center relative overflow-hidden">
                        <Image src={currentLogo} alt="Logo preview" fill className="object-contain p-2" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
