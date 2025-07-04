import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { HelpCircle } from 'lucide-react';
import { HelpWalkthrough } from './HelpWalkthrough';

interface HelpButtonProps {
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'sm' | 'default' | 'lg';
  className?: string;
  startTab?: string;
}

export function HelpButton({ 
  variant = 'ghost', 
  size = 'sm', 
  className = '',
  startTab = 'overview'
}: HelpButtonProps) {
  const [showHelp, setShowHelp] = useState(false);

  return (
    <>
      <Button
        variant={variant}
        size={size}
        onClick={() => setShowHelp(true)}
        className={`flex items-center gap-2 ${className}`}
        title="Help & Walkthrough"
      >
        <HelpCircle className="h-4 w-4" />
        <span className="hidden sm:inline">Help</span>
      </Button>
      
      <HelpWalkthrough
        isOpen={showHelp}
        onClose={() => setShowHelp(false)}
        startTab={startTab}
      />
    </>
  );
}