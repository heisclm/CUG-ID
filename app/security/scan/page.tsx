'use client';

import dynamic from 'next/dynamic';

// Dynamically import the security scanner component with SSR disabled
const SecurityScanner = dynamic(() => import('@/components/security-scanner'), { 
  ssr: false,
  loading: () => (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center select-none">
      <div className="text-center space-y-4 animate-pulse">
        <div className="w-16 h-16 bg-orange-500/20 rounded-2xl flex items-center justify-center mx-auto">
          <div className="w-8 h-8 rounded-full border-4 border-orange-500 border-t-transparent animate-spin" />
        </div>
        <p className="text-gray-500 dark:text-gray-400 font-medium tracking-tight">Loading verification module...</p>
      </div>
    </div>
  )
});

export default function SecurityScanPage() {
  return <SecurityScanner />;
}
