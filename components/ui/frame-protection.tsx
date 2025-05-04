'use client';

import { useEffect } from 'react';

/**
 * FrameProtection - A component that implements frame-busting techniques to prevent clickjacking
 * 
 * This script prevents the site from being loaded in an iframe on another domain,
 * which is a common method used in clickjacking attacks.
 * 
 * It uses multiple techniques:
 * 1. JavaScript frame-busting to break out of frames
 * 2. Checking if the window is a top-level window
 * 3. Verifying that the origin matches
 */
export function FrameProtection() {
  useEffect(() => {
    // Method 1: Basic frame-busting - forces the site to be the top window
    if (window.self !== window.top && window.top) {
      window.top.location = window.self.location;
    }

    // Method 2: More advanced detection and prevention
    function preventFraming() {
      // If we're in a frame
      if (window.self !== window.top) {
        try {
          // Try to access the parent frame's location - will throw an error if cross-origin
          const parentUrl = window.parent.location.href;
          const selfUrl = window.location.href;
          
          // If parent URL's origin doesn't match our origin, break out
          if (window.top && new URL(parentUrl).origin !== new URL(selfUrl).origin) {
            window.top.location = window.self.location;
          }
        } catch (e) {
          // Error accessing parent's location - means we're in a cross-origin frame
          // Break out of the frame
          if (window.top) {
            window.top.location = window.self.location;
          }
        }
      }
    }

    // Run our protection immediately
    preventFraming();

    // Also add a MutationObserver to detect if the site is framed after initial load
    // Some sophisticated attacks try to frame the site after it's loaded
    const observer = new MutationObserver(() => {
      preventFraming();
    });

    observer.observe(document, { childList: true, subtree: true });

    // Cleanup
    return () => {
      observer.disconnect();
    };
  }, []);

  // This component doesn't render anything visible
  return null;
}

export default FrameProtection; 