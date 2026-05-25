'use client';

import React, { useEffect, useState } from 'react';
import { 
  CreditCard, 
  Clock, 
  CheckCircle2, 
  TrendingUp,
  GraduationCap,
  UserCircle,
  QrCode,
  ArrowRight,
  Loader2
} from 'lucide-react';
import { motion } from 'framer-motion';
import Image from 'next/image';
import { QRCodeSVG } from 'qrcode.react';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot, addDoc, serverTimestamp, doc, updateDoc } from 'firebase/firestore';
import Link from 'next/link';
import { usePaystackPayment } from 'react-paystack';
import { useAuth } from '@/lib/auth-context';
import { sendNotification } from '@/lib/notifications';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

const StatCard = ({ title, value, icon: Icon, color, trend }: any) => (
  <motion.div 
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    className="bg-white dark:bg-gray-900 p-6 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-sm shadow-gray-500/5 space-y-4 transition-colors"
  >
    <div className="flex items-center justify-between">
      <div className={`p-3 rounded-2xl ${color} bg-opacity-10 text-opacity-100`}>
        <Icon size={24} className={color.replace('bg-', 'text-')} />
      </div>
      {trend && (
        <div className="flex items-center gap-1 text-green-500 text-xs font-bold bg-green-50 dark:bg-green-500/10 px-2 py-1 rounded-lg">
          <TrendingUp size={12} />
          {trend}
        </div>
      )}
    </div>
    <div>
      <div className="text-sm font-medium text-gray-400 dark:text-gray-500">{title}</div>
      <div className="text-2xl font-bold text-gray-800 dark:text-white mt-1">{value}</div>
    </div>
  </motion.div>
);

const useCurrentTime = () => {
  const [time, setTime] = useState<number | null>(null);
  useEffect(() => {
    const raf = requestAnimationFrame(() => setTime(Date.now()));
    const interval = setInterval(() => setTime(Date.now()), 1000 * 60 * 60);
    return () => {
      cancelAnimationFrame(raf);
      clearInterval(interval);
    };
  }, []);
  return time;
};

const CugLogoSVG = () => (
  <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
    {/* Shield Outer Outline with dual stroke */}
    <path d="M50 8C70 8 82 17 84 39C87 72 50 92 50 92C50 92 13 72 16 39C18 17 30 8 50 8Z" fill="#ffffff" />
    <path d="M50 11C67 11 78 19 80 40C82 68 50 87 50 87C50 87 18 68 20 40C22 19 33 11 50 11Z" fill="#0f172a" />
    
    {/* Ghana Flag Colors at top band */}
    <path d="M24 26C31 18 40 13 50 13C60 13 69 18 76 26V33H24V26Z" fill="#ef4444" />
    <rect x="24" y="33" width="52" height="6" fill="#fbbf24" />
    <rect x="24" y="39" width="52" height="6" fill="#22c55e" />
    
    {/* Black Star in Ghana Flag section */}
    <polygon points="50,33 52,37 56,37 53,40 54,44 50,42 46,44 47,40 44,37 48,37" fill="black" />

    {/* Elegant Golden cross in center */}
    <path d="M47 45H53V76H47V45Z" fill="#fbbf24" />
    <path d="M37 51H63V57H37V51Z" fill="#fbbf24" />

    {/* Central detailing inside the cross core */}
    <circle cx="50" cy="54" r="5.5" fill="#ef4444" />
    <circle cx="50" cy="54" r="3" fill="white" />
    
    {/* Small Book / Wisdom outline */}
    <path d="M41 66H59" stroke="white" strokeWidth="2" strokeLinecap="round" />
    <path d="M44 71H56" stroke="white" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

export default function StudentDashboard() {
  const { profile, idCard } = useAuth();
  const [latestApp, setLatestApp] = useState<any>(null);
  const [schoolLogoUrl, setSchoolLogoUrl] = useState('/cug-logo.jpg');
  const [logoError, setLogoError] = useState(false);
  const currentTime = useCurrentTime();
  
  useEffect(() => {
    const unsubParams = onSnapshot(doc(db, 'settings', 'general'), (doc) => {
      if (doc.exists() && doc.data().schoolLogoUrl) {
        setSchoolLogoUrl(doc.data().schoolLogoUrl);
      }
    }, (error) => {
      console.warn("Could not load general school settings: ", error);
    });

    if (!profile?.uid) return unsubParams;
    const q = query(
      collection(db, 'applications'), 
      where('studentUid', '==', profile.uid)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        const apps = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        apps.sort((a: any, b: any) => {
          const timeA = a.submittedAt?.toMillis() || 0;
          const timeB = b.submittedAt?.toMillis() || 0;
          return timeB - timeA;
        });
        setLatestApp(apps[0]);
      }
    });
    return () => unsubscribe();
  }, [profile]);

  const [isProcessing, setIsProcessing] = useState(false);
  const [processingTimeout, setProcessingTimeout] = useState(false);
  
  // Track if we are waiting for an ID card
  // We are "waiting" if the app is PAID but no ID card exists, OR if we just finished payment
  const isWaitingForId = latestApp?.status === 'PAID' && !idCard;

  const paystackConfig = React.useMemo(() => ({
    reference: `ref_${latestApp?.id || 'new'}_${Date.now()}`,
    email: profile?.email || '',
    amount: 5000,
    currency: 'GHS',
    publicKey: process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY || '',
    metadata: {
      applicationId: latestApp?.id,
      studentUid: profile?.uid,
      studentId: latestApp?.studentId,
      custom_fields: [
        {
          display_name: "Application ID",
          variable_name: "application_id",
          value: latestApp?.id
        },
        {
          display_name: "Student ID",
          variable_name: "student_id",
          value: latestApp?.studentId
        }
      ]
    },
  }), [latestApp, profile]);

  const initializePayment = usePaystackPayment(paystackConfig);

  const onSuccess = async (reference: any) => {
    console.log('Payment successful callback:', reference);
    setIsProcessing(true);
    setProcessingTimeout(false);
    
    if (profile?.uid) {
      try {
        await sendNotification(
          profile.uid,
          'Payment Received',
          'Your payment was successful. We are now finalizing your ID card generation. This usually takes less than 30 seconds.',
          'success'
        );
      } catch (e) {
        console.error('Notification error:', e);
      }
    }

    // Call our backend to verify the payment and generate the ID card
    try {
      const res = await fetch('/api/paystack/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ reference: reference.reference || reference }),
      });
      
      if (!res.ok) {
        console.error('Failed to verify payment on backend');
      } else {
        console.log('Payment verified successfully on backend');
      }
    } catch (error) {
      console.error('Error calling verify endpoint:', error);
    }
  };

  useEffect(() => {
    let timeout: NodeJS.Timeout;
    
    // If we are in a state where we expect an ID card soon
    if (isWaitingForId || isProcessing) {
      // If we have the ID card, we are done
      if (idCard) {
        setIsProcessing(false);
        setProcessingTimeout(false);
      } else {
        // Otherwise, set a timeout to show the refresh button if it takes too long
        timeout = setTimeout(() => {
          setProcessingTimeout(true);
        }, 15000); // 15 seconds
      }
    } else {
      setIsProcessing(false);
      setProcessingTimeout(false);
    }
    
    return () => clearTimeout(timeout);
  }, [isWaitingForId, isProcessing, idCard]);

  const onClose = () => {
    console.log('Payment closed');
  };

  const daysToExpiry = React.useMemo(() => {
    if (!idCard?.expiryDate || currentTime === null) return null;
    return Math.ceil((idCard.expiryDate.toDate().getTime() - currentTime) / (1000 * 60 * 60 * 24));
  }, [idCard, currentTime]);

  const [isDownloading, setIsDownloading] = useState(false);

  // Helper to convert modern CSS colors (oklch, oklab) to standard RGB/Hex values that html2canvas supports
  const cleanModernColors = React.useCallback((cssVal: string): string => {
    if (!cssVal) return cssVal;
    if (typeof cssVal !== 'string') return cssVal;
    if (!cssVal.includes('oklch(') && !cssVal.includes('oklab(')) {
      return cssVal;
    }

    // Lazy load canvas to avoid SSR issues or slow initialization
    let canvas: any = null;
    let ctx: any = null;
    if (typeof document !== 'undefined') {
      canvas = document.createElement('canvas');
      canvas.width = 1;
      canvas.height = 1;
      ctx = canvas.getContext('2d');
    }

    const cache = (cleanModernColors as any)._cache || new Map<string, string>();
    (cleanModernColors as any)._cache = cache;

    return cssVal.replace(/(oklch|oklab)\([^)]+\)/g, (match) => {
      if (cache.has(match)) {
        return cache.get(match)!;
      }
      
      let resolved = '';
      if (ctx) {
        try {
          ctx.fillStyle = match;
          resolved = ctx.fillStyle;
        } catch (e) {
          // Safe canvas fallback
        }
      }
      
      if (resolved && resolved !== '#000000' && resolved !== 'rgba(0,0,0,0)' && resolved !== 'rgba(0, 0, 0, 0)') {
        cache.set(match, resolved);
        return resolved;
      }
      
      // Smart theme fallbacks for orange branding and black/white colors
      const lower = match.toLowerCase();
      let fallback = '#f97316'; // Catholic University orange branding color
      if (lower.includes('white') || lower.includes('100%') || lower.includes('1 0') || lower.includes('0.99') || lower.includes(' 1 ') || lower.includes('/ 1)')) {
        fallback = '#ffffff';
      } else if (lower.includes('black') || lower.includes('0%') || lower.includes('0 0 0')) {
        fallback = '#000000';
      } else if (lower.includes('slate') || lower.includes('gray') || lower.includes('grey') || lower.includes('0.2') || lower.includes('0.1')) {
        fallback = '#475569';
      }
      
      cache.set(match, fallback);
      return fallback;
    });
  }, []);

  const downloadPDF = async () => {
    const input = document.getElementById('id-card-element');
    if (!input) return;

    setIsDownloading(true);
    let portal: HTMLDivElement | null = null;
    const activeStylesBackup: Array<{ el: Element; originalValue: any }> = [];
    let tempStyleBlock: HTMLStyleElement | null = null;
    
    try {
      // Create a temporary container for full-size desktop rendering
      portal = document.createElement('div');
      portal.style.position = 'fixed';
      portal.style.left = '-9999px';
      portal.style.top = '-9999px';
      portal.style.width = '480px';
      portal.style.height = '302px';
      document.body.appendChild(portal);

      // Clone the card for capture
      const clone = input.cloneNode(true) as HTMLElement;
      clone.style.width = '480px';
      clone.style.height = '302px';
      clone.style.aspectRatio = '1.586/1';
      clone.style.minHeight = '0px';

      // Bypass mobile display queries inside the clone by copying responsive styles as active styles
      const allElements = clone.querySelectorAll('*');
      allElements.forEach((el) => {
        const classes = Array.from(el.classList);
        classes.forEach((className) => {
          if (className.startsWith('sm:')) {
            el.classList.add(className.substring(3));
          }
        });
      });

      // Recursively clean inline styles of all cloned elements
      const cleanInlineStyles = (elem: HTMLElement) => {
        if (elem.style) {
          for (let i = 0; i < elem.style.length; i++) {
            const prop = elem.style[i];
            const val = elem.style.getPropertyValue(prop);
            if (val && (val.includes('oklch') || val.includes('oklab'))) {
              elem.style.setProperty(prop, cleanModernColors(val));
            }
          }
        }
        Array.from(elem.children).forEach(child => cleanInlineStyles(child as HTMLElement));
      };
      cleanInlineStyles(clone);

      portal.appendChild(clone);

      // Extract, clean, and consolidate all styles into a single temp stylesheet
      const styleElements = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'));
      let consolidatedCSSText = '';

      for (const styleEl of styleElements) {
        try {
          if (styleEl.tagName === 'STYLE') {
            const css = styleEl.textContent || '';
            consolidatedCSSText += '\n' + css;
            
            // Backup and disable
            activeStylesBackup.push({
              el: styleEl,
              originalValue: (styleEl as any).disabled
            });
            (styleEl as any).disabled = true;
          } else if (styleEl.tagName === 'LINK') {
            const sheet = (styleEl as any).sheet;
            if (sheet) {
              try {
                const rules = Array.from(sheet.cssRules || []);
                const css = rules.map((r: any) => r.cssText).join('\n');
                consolidatedCSSText += '\n' + css;
              } catch (e) {
                // Ignore CORS sheets or sheets we can't read rules from.
              }
            }
            
            activeStylesBackup.push({
              el: styleEl,
              originalValue: (styleEl as any).disabled
            });
            (styleEl as any).disabled = true;
          }
        } catch (err) {
          console.warn('Error processing style element:', err);
        }
      }

      // Add a cleaned consolidated style block
      const cleanedCSS = cleanModernColors(consolidatedCSSText);
      tempStyleBlock = document.createElement('style');
      tempStyleBlock.id = 'temp-cleaned-html2canvas-styles';
      tempStyleBlock.textContent = cleanedCSS;
      document.head.appendChild(tempStyleBlock);

      // 3. Render the card to canvas with html2canvas
      const canvas = await html2canvas(clone, {
        scale: 2.5, // Ultra sharp high resolution
        useCORS: true, 
        allowTaint: false, 
        backgroundColor: null,
      });

      // Restore all original stylesheets and delete the temp block immediately
      if (tempStyleBlock && tempStyleBlock.parentNode) {
        tempStyleBlock.parentNode.removeChild(tempStyleBlock);
        tempStyleBlock = null;
      }
      for (const backup of activeStylesBackup) {
        try {
          (backup.el as any).disabled = backup.originalValue;
        } catch (e) {}
      }
      activeStylesBackup.length = 0;

      // Cleanup portal DOM
      if (portal) {
        document.body.removeChild(portal);
        portal = null;
      }

      // Save PDF output
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'px',
        format: [canvas.width, canvas.height]
      });

      pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);
      pdf.save(`${idCard?.studentId || 'student'}_id_card.pdf`);
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Failed to generate PDF. Please try again.');
    } finally {
      // Emergency cleanups in case anything fails during the process
      if (tempStyleBlock && tempStyleBlock.parentNode) {
        try {
          tempStyleBlock.parentNode.removeChild(tempStyleBlock);
        } catch (err) {}
      }
      if (activeStylesBackup && activeStylesBackup.length > 0) {
        for (const backup of activeStylesBackup) {
          try {
            (backup.el as any).disabled = backup.originalValue;
          } catch (e) {}
        }
      }
      if (portal) {
        try {
          document.body.removeChild(portal);
        } catch (err) {}
      }
      setIsDownloading(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">Welcome back, {profile?.fullName?.split(' ')[0]}! 👋</h1>
          <p className="text-gray-500 dark:text-gray-400 font-medium mt-1">Here&apos;s what&apos;s happening with your digital ID.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
        {(isProcessing || isWaitingForId) && (
          <div className="col-span-1 sm:col-span-2 p-6 bg-blue-50 dark:bg-blue-500/10 border border-blue-100 dark:border-blue-500/20 rounded-3xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <Loader2 className="animate-spin text-blue-500 shrink-0" />
              <div>
                <p className="font-bold text-blue-700 dark:text-blue-400">
                  {isWaitingForId ? 'Processing Payment...' : 'Generating your ID Card...'}
                </p>
                <p className="text-xs text-blue-600 dark:text-blue-500">
                  {isWaitingForId 
                    ? 'Your payment was successful. We are generating your ID card.' 
                    : 'This will only take a moment. Please wait.'}
                </p>
              </div>
            </div>
            {processingTimeout && (
              <button 
                onClick={() => window.location.reload()}
                className="px-4 py-2 bg-blue-600 text-white text-sm font-bold rounded-xl hover:bg-blue-700 transition-colors shrink-0"
              >
                Refresh Page
              </button>
            )}
          </div>
        )}
        {latestApp?.status === 'APPROVED' && !idCard && !isProcessing && !isWaitingForId && (
          <motion.button 
            whileHover={{ y: -4 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => initializePayment({ onSuccess, onClose })}
            className="group relative overflow-hidden p-6 sm:p-8 bg-gradient-to-br from-green-500 to-green-600 rounded-[2.5rem] text-left text-white shadow-xl shadow-green-500/20 transition-all"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-2xl group-hover:bg-white/20 transition-all" />
            <div className="relative z-10 flex items-center gap-6">
              <div className="w-14 h-14 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center shrink-0">
                <CreditCard size={28} strokeWidth={2.5} />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-xl font-black tracking-tight leading-tight">Pay for ID</h3>
                <p className="text-sm font-bold text-white/80 mt-1">GHS 50.00 • Secure Payment</p>
              </div>
              <div className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center group-hover:bg-white/20 transition-all">
                <ArrowRight size={20} strokeWidth={3} />
              </div>
            </div>
          </motion.button>
        )}
        
        <Link href="/apply" className="block">
          <motion.button 
            whileHover={{ y: -4 }}
            whileTap={{ scale: 0.98 }}
            className="w-full group relative overflow-hidden p-6 sm:p-8 bg-gradient-to-br from-orange-500 to-orange-600 rounded-[2.5rem] text-left text-white shadow-xl shadow-orange-500/20 transition-all"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-2xl group-hover:bg-white/20 transition-all" />
            <div className="relative z-10 flex items-center gap-6">
              <div className="w-14 h-14 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center shrink-0">
                <GraduationCap size={28} strokeWidth={2.5} />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-xl font-black tracking-tight leading-tight">
                  {idCard ? 'Apply for Renewal' : 'Apply for New ID'}
                </h3>
                <p className="text-sm font-bold text-white/80 mt-1">Digital ID Application Process</p>
              </div>
              <div className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center group-hover:bg-white/20 transition-all">
                <ArrowRight size={20} strokeWidth={3} />
              </div>
            </div>
          </motion.button>
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <StatCard 
          title="ID Status" 
          value={idCard ? 'Active' : (latestApp?.status || 'No Active ID')} 
          icon={CheckCircle2} 
          color={idCard ? 'bg-green-500' : (latestApp?.status === 'PENDING' ? 'bg-orange-500' : 'bg-gray-500')} 
        />
        <StatCard title="Days to Expiry" value={daysToExpiry !== null ? `${daysToExpiry} Days` : 'N/A'} icon={Clock} color="bg-blue-500" />
        <StatCard title="Application Type" value={latestApp?.type || 'N/A'} icon={GraduationCap} color="bg-purple-500" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-white dark:bg-gray-900 rounded-3xl border border-gray-100 dark:border-gray-800 p-8 space-y-6 transition-colors">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-800 dark:text-white">Digital ID Preview</h2>
            {idCard && (
              <button 
                onClick={downloadPDF}
                disabled={isDownloading}
                className="text-orange-600 dark:text-orange-500 font-bold text-sm hover:underline disabled:opacity-50 flex items-center gap-2"
              >
                {isDownloading ? <Loader2 size={16} className="animate-spin" /> : null}
                {isDownloading ? 'Generating...' : 'Download PDF'}
              </button>
            )}
          </div>
          
          {idCard ? (
            <div 
              id="id-card-element" 
              className="relative aspect-[1.586/1] w-full max-w-[460px] mx-auto rounded-[24px] p-4 xs:p-5 sm:p-7 text-white overflow-hidden group shadow-2xl border border-white/20 select-none"
              style={{ 
                background: 'linear-gradient(135deg, #fb923c 0%, #f97316 45%, #ea580c 100%)',
              }}
            >
              {/* Subtle noise texture */}
              <div 
                className="absolute inset-0 opacity-[0.08] pointer-events-none mix-blend-overlay"
                style={{
                  backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.7' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
                }}
              />
              
              {/* Apple-like specular glassmorphism light bloom */}
              <div className="absolute top-0 right-0 w-[180%] h-[180%] bg-gradient-to-bl from-white/25 via-transparent to-transparent opacity-30 mix-blend-overlay pointer-events-none -translate-y-1/2 translate-x-1/4 transform rotate-12" />
              <div className="absolute bottom-0 left-0 w-48 h-48 bg-black/10 blur-2xl rounded-full mix-blend-multiply pointer-events-none -ml-16 -mb-16" />

              {idCard.isFinalYear && (
                <div className="absolute top-3 xs:top-4 sm:top-5 right-3 xs:right-4 sm:right-5 bg-white/10 backdrop-blur-md text-white text-[7px] xs:text-[8px] sm:text-[10px] font-black px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-full border border-white/30 z-20 shadow-sm uppercase tracking-wider">
                  FINAL YEAR
                </div>
              )}
              
              <div className="relative z-10 h-full flex flex-col justify-between">
                {/* Header */}
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-2 sm:gap-3.5">
                    {/* Compact Glassmorphic Box Wrapper for School Logo */}
                    <div className="relative w-8 h-8 xs:w-9 xs:h-9 sm:w-12 sm:h-12 flex-shrink-0 bg-white shadow-md rounded-[9px] sm:rounded-[12px] p-0.5 sm:p-1 overflow-hidden flex items-center justify-center border border-white/20">
                      {(schoolLogoUrl === '/cug-logo.jpg' || logoError) ? (
                        <CugLogoSVG />
                      ) : (
                        <img 
                           src={schoolLogoUrl} 
                           alt="School Logo" 
                           className="w-full h-full object-contain mix-blend-multiply" 
                           crossOrigin="anonymous"
                           onError={() => setLogoError(true)}
                        />
                      )}
                    </div>
                    <div className="space-y-0.5 mt-0.5 pr-14 sm:pr-0">
                      <div className="text-[7.5px] xs:text-[8.5px] sm:text-[10px] font-bold uppercase tracking-wider text-white/90 drop-shadow-sm leading-tight">Catholic University of Ghana</div>
                      <div className="text-sm xs:text-base sm:text-2xl font-black tracking-tight text-white drop-shadow-md leading-none mt-1">STUDENT ID</div>
                    </div>
                  </div>
                </div>

                {/* Body section */}
                <div className="flex gap-3 xs:gap-4 sm:gap-6 items-end mt-4 sm:mt-5">
                  {/* Photo area with Apple Rounded Corners */}
                  <div 
                    className="relative w-[72px] h-[96px] xs:w-20 xs:h-[108px] sm:w-28 sm:h-[135px] rounded-[10px] xs:rounded-[14px] sm:rounded-[18px] flex items-center justify-center overflow-hidden shrink-0 shadow-lg isolate"
                    style={{ 
                      backgroundColor: 'rgba(255, 255, 255, 0.08)',
                      boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.15)',
                      backdropFilter: 'blur(12px)',
                      WebkitBackdropFilter: 'blur(12px)',
                      border: '1.2px solid rgba(255, 255, 255, 0.25)'
                    }}
                  >
                    {idCard.photoUrl ? (
                      <img 
                        src={idCard.photoUrl} 
                        alt="Student" 
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                        crossOrigin="anonymous"
                      />
                    ) : (
                      <div className="text-white/40"><UserCircle className="w-10 h-10 sm:w-16 sm:h-16" /></div>
                    )}
                  </div>
                  
                  {/* Details area (Designed with scale-down responsive sizes to prevent layout overflow) */}
                  <div className="flex-1 space-y-1.5 xs:space-y-2 sm:space-y-3.5 min-w-0 pb-[2px]">
                    <div>
                      <div className="text-[7px] xs:text-[8px] sm:text-[10px] font-bold uppercase tracking-widest text-white/70 drop-shadow-sm">Full Name</div>
                      <div className="text-[11px] xs:text-[13px] sm:text-[1.25rem] font-extrabold leading-tight truncate drop-shadow-sm text-white">{idCard.fullName}</div>
                    </div>
                    <div>
                      <div className="text-[7px] xs:text-[8px] sm:text-[10px] font-bold uppercase tracking-widest text-white/70 drop-shadow-sm">Department</div>
                      <div className="text-[9px] xs:text-[10.5px] sm:text-[0.9rem] font-bold truncate drop-shadow-sm text-white/95">{idCard.department || 'N/A'}</div>
                    </div>
                    <div className="flex gap-5 xs:gap-8 sm:gap-12">
                      <div className="min-w-0 flex-1">
                        <div className="text-[7px] xs:text-[8px] sm:text-[10px] font-bold uppercase tracking-widest text-white/70 drop-shadow-sm">Student ID</div>
                        <div className="text-[9.5px] xs:text-[11px] sm:text-[0.9rem] font-extrabold truncate drop-shadow-sm text-white">{idCard.studentId}</div>
                      </div>
                      <div className="shrink-0">
                        <div className="text-[7px] xs:text-[8px] sm:text-[10px] font-bold uppercase tracking-widest text-white/70 drop-shadow-sm">Expiry</div>
                        <div className="text-[9.5px] xs:text-[11px] sm:text-[0.9rem] font-bold drop-shadow-sm text-white/95">{idCard.expiryDate?.toDate().toLocaleDateString('en-GB', { month: '2-digit', year: '2-digit' })}</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="aspect-[1.6/1] w-full max-w-md mx-auto bg-gray-50 dark:bg-gray-800 rounded-[2rem] border-2 border-dashed border-gray-200 dark:border-gray-700 flex flex-col items-center justify-center text-center p-8 space-y-4">
              <CreditCard size={48} className="text-gray-300 dark:text-gray-600" />
              <div>
                <h3 className="font-bold text-gray-800 dark:text-white">No Active Digital ID</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">Apply for an ID card to see your digital preview here.</p>
              </div>
            </div>
          )}
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-3xl border border-gray-100 dark:border-gray-800 p-8 space-y-6 text-center transition-colors">
          <h2 className="text-xl font-bold text-gray-800 dark:text-white">Verification QR</h2>
          <div className="aspect-square w-full max-w-[200px] mx-auto bg-gray-50 dark:bg-gray-800 rounded-3xl border-2 border-dashed border-gray-200 dark:border-gray-700 flex items-center justify-center p-4">
            {idCard?.qrPayload || idCard?.qrData ? (
              <div className="bg-white p-2 rounded-xl">
                <QRCodeSVG value={idCard.qrPayload || idCard.qrData} size={160} />
              </div>
            ) : (
              <div className="text-center space-y-2">
                <QrCode size={120} className="text-gray-300 dark:text-gray-600 mx-auto" />
                <p className="text-[10px] text-gray-400 dark:text-gray-500 font-bold uppercase">No Active ID</p>
              </div>
            )}
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 font-medium px-4">
            Present this QR code to security personnel for campus access.
          </p>
        </div>
      </div>
    </div>
  );
}
