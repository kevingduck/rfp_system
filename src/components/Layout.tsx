import { ReactNode, useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { HelpButton } from './HelpButton';
import { HelpWalkthrough } from './HelpWalkthrough';
import { Home, Settings, FolderOpen } from 'lucide-react';
import { useFirstTimeUser } from '@/hooks/useFirstTimeUser';

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const router = useRouter();
  const { isFirstTime, markWalkthroughSeen, hasChecked } = useFirstTimeUser();
  const [showWalkthrough, setShowWalkthrough] = useState(false);

  useEffect(() => {
    if (hasChecked && isFirstTime) {
      setShowWalkthrough(true);
    }
  }, [hasChecked, isFirstTime]);
  
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top Navigation Bar */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo and Navigation */}
            <div className="flex items-center gap-6">
              <Link href="/" className="text-xl font-bold text-gray-900">
                RFP System
              </Link>
              
              <nav className="hidden md:flex items-center gap-4">
                <Link
                  href="/"
                  className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium ${
                    router.pathname === '/' 
                      ? 'bg-gray-100 text-gray-900' 
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  }`}
                >
                  <Home className="h-4 w-4" />
                  Projects
                </Link>
                <Link
                  href="/settings"
                  className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium ${
                    router.pathname === '/settings' 
                      ? 'bg-gray-100 text-gray-900' 
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  }`}
                >
                  <Settings className="h-4 w-4" />
                  Settings
                </Link>
              </nav>
            </div>
            
            {/* Help Button */}
            <div className="flex items-center gap-2">
              <HelpButton />
            </div>
          </div>
        </div>
      </header>
      
      {/* Main Content */}
      <main className="flex-1">
        {children}
      </main>
      
      {/* Auto-show walkthrough for first-time users */}
      <HelpWalkthrough
        isOpen={showWalkthrough}
        onClose={() => {
          setShowWalkthrough(false);
          markWalkthroughSeen();
        }}
        startTab="overview"
      />
    </div>
  );
}