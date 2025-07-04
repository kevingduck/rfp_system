import { useState, useEffect } from 'react';

export function useFirstTimeUser() {
  const [isFirstTime, setIsFirstTime] = useState(false);
  const [hasChecked, setHasChecked] = useState(false);

  useEffect(() => {
    // Check if user has seen the walkthrough before
    const hasSeenWalkthrough = localStorage.getItem('hasSeenWalkthrough');
    
    if (!hasSeenWalkthrough) {
      setIsFirstTime(true);
    }
    
    setHasChecked(true);
  }, []);

  const markWalkthroughSeen = () => {
    localStorage.setItem('hasSeenWalkthrough', 'true');
    setIsFirstTime(false);
  };

  const resetWalkthrough = () => {
    localStorage.removeItem('hasSeenWalkthrough');
    setIsFirstTime(true);
  };

  return {
    isFirstTime: hasChecked ? isFirstTime : false,
    markWalkthroughSeen,
    resetWalkthrough,
    hasChecked
  };
}