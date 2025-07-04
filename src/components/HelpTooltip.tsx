import { ReactNode, useState } from 'react';
import { HelpCircle } from 'lucide-react';

interface HelpTooltipProps {
  content: string;
  children?: ReactNode;
  className?: string;
}

export function HelpTooltip({ content, children, className = '' }: HelpTooltipProps) {
  const [showTooltip, setShowTooltip] = useState(false);

  return (
    <div className={`relative inline-block ${className}`}>
      <div
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        className="cursor-help"
      >
        {children || <HelpCircle className="h-4 w-4 text-gray-400" />}
      </div>
      
      {showTooltip && (
        <div className="absolute z-50 bottom-full left-1/2 transform -translate-x-1/2 mb-2">
          <div className="bg-gray-900 text-white text-sm rounded-lg p-3 max-w-xs shadow-lg">
            <div className="relative">
              {content}
              <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-1">
                <div className="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[6px] border-t-gray-900"></div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}