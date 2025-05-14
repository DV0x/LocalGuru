"use client";

import { useState, useRef, useEffect, forwardRef, useImperativeHandle } from "react";
import { motion, PanInfo, useMotionValue, useSpring, useTransform, useDragControls } from "framer-motion";
import { SearchResult, SearchStatus } from "../lib/types/search";
import { ChevronUp, Loader2, AlertCircle } from "lucide-react";
import { cn } from "../lib/utils";

interface DraggableContentOverlayProps {
  content: string;
  results: SearchResult[];
  isLoading: boolean;
  error: string | null;
  status: SearchStatus;
}

// Define the ref interface
export interface DraggableContentOverlayRef {
  expand: () => void;
}

export const DraggableContentOverlay = forwardRef<DraggableContentOverlayRef, DraggableContentOverlayProps>(({
  content,
  results,
  isLoading,
  error,
  status
}, ref) => {
  const [position, setPosition] = useState<"collapsed" | "partial" | "expanded">("partial");
  const [lastActivePosition, setLastActivePosition] = useState<"partial" | "expanded">("partial");
  const dragY = useMotionValue(0);
  const dragYSpring = useSpring(dragY, { damping: 30, stiffness: 350, mass: 0.5 });
  const overlayRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [previousContentLength, setPreviousContentLength] = useState(0);
  const [stabilizedStatus, setStabilizedStatus] = useState<SearchStatus>(status);
  const statusTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [isStreamingInitiated, setIsStreamingInitiated] = useState(false);
  const positionLockTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastPositionChangeRef = useRef<{position: string, timestamp: number, source: string}>({
    position: "partial", 
    timestamp: Date.now(),
    source: "initial"
  });
  
  // Track position changes for debugging
  const trackPositionChange = (newPosition: "collapsed" | "partial" | "expanded", source: string) => {
    const now = Date.now();
    const timeSinceLastChange = now - lastPositionChangeRef.current.timestamp;
    console.log(`Position change: ${lastPositionChangeRef.current.position} -> ${newPosition} (source: ${source}, after ${timeSinceLastChange}ms)`);
    lastPositionChangeRef.current = {
      position: newPosition,
      timestamp: now,
      source
    };
  };
  
  // Override setPosition to track changes
  const setPositionWithTracking = (newPosition: "collapsed" | "partial" | "expanded", source: string) => {
    if (position !== newPosition) {
      trackPositionChange(newPosition, source);
    }
    setPosition(newPosition);
  };
  
  // Define snap points (percentage of screen height)
  const snapPoints = {
    collapsed: 0.2, // Keep 20% of the overlay visible at all times
    partial: 0.5,   // 50% of screen height
    expanded: 0.9   // 90% of screen height
  };
  
  // Initialize with default values to avoid SSR issues
  const [windowHeight, setWindowHeight] = useState(700); // Reasonable default
  const [isDragging, setIsDragging] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  
  // Ensure we never hide the header completely - absolute minimum height in pixels
  const MIN_VISIBLE_HEIGHT_PX = 60;
  
  // Expose methods to parent component
  useImperativeHandle(ref, () => ({
    expand: () => {
      console.log("Expand method called directly");
      
      // Force immediate expansion, cancel any ongoing animations
      if (positionLockTimeoutRef.current) {
        clearTimeout(positionLockTimeoutRef.current);
        positionLockTimeoutRef.current = null;
      }
      
      // Create a tracked expansion ID to prevent race conditions
      const expansionId = Date.now();
      console.log(`Starting expansion ${expansionId}`);
      
      // Ensure we capture the correct window height
      const currentWindowHeight = windowHeight || window.innerHeight;
      
      // Force position update synchronously
      setPositionWithTracking("partial", "expand-method");
      
      // Set the dragY directly to match the "partial" position
      const targetY = currentWindowHeight * (1 - snapPoints.partial);
      dragY.set(targetY);
      
      // Apply animation directly to the DOM element for immediacy
      if (overlayRef.current) {
        // Force a reflow
        overlayRef.current.getBoundingClientRect();
        
        // Apply animation with higher priority
        window.requestAnimationFrame(() => {
          if (overlayRef.current) {
            console.log(`Applying direct animation to y=${targetY} (expansion ${expansionId})`);
            
            // Use Framer Motion's built-in animate function if available
            if (typeof overlayRef.current.animate === 'function') {
              overlayRef.current.animate(
                { y: targetY },
                { 
                  duration: 300,
                  easing: 'cubic-bezier(0.33, 1, 0.68, 1)',
                  fill: 'forwards'
                }
              );
            } else {
              // Fallback to direct style manipulation if animate isn't available
              overlayRef.current.style.transform = `translateY(${targetY}px)`;
              overlayRef.current.style.transition = 'transform 300ms cubic-bezier(0.33, 1, 0.68, 1)';
            }
            
            console.log(`Expansion ${expansionId} animation applied`);
          }
        });
      }
    }
  }));
  
  // Use stabilized status to prevent flickering between states
  useEffect(() => {
    // Clear any existing timeout
    if (statusTimeoutRef.current) {
      clearTimeout(statusTimeoutRef.current);
    }
    
    // For transitions to streaming or error, update immediately
    if (status === 'streaming' || status === 'error' || status === 'complete') {
      setStabilizedStatus(status);
      if (status === 'streaming') {
        setIsStreamingInitiated(true);
      }
    } else {
      // For other transitions, add a small delay to prevent flickering
      statusTimeoutRef.current = setTimeout(() => {
        setStabilizedStatus(status);
        if (status === 'idle') {
          setIsStreamingInitiated(false);
        }
      }, 300);
    }
    
    return () => {
      if (statusTimeoutRef.current) {
        clearTimeout(statusTimeoutRef.current);
      }
    };
  }, [status]);
  
  // Auto-scroll content when new content is streamed in
  useEffect(() => {
    if (content && content.length > previousContentLength && contentRef.current && !isDragging) {
      // Disabled auto-scroll to see if it fixes expansion issues
      // Only auto-scroll if we're not in collapsed state and not currently dragging
      // if (position !== "collapsed") {
      //   contentRef.current.scrollTop = contentRef.current.scrollHeight;
      // }
      
      // Just update the content length without scrolling
      setPreviousContentLength(content.length);
      console.log('Auto-scroll disabled, content length updated:', content.length);
    }
  }, [content, previousContentLength, position, isDragging]);
  
  // Transform mapping with improved precision
  const height = useTransform(
    dragYSpring, 
    [0, windowHeight], 
    ["90vh", `${snapPoints.collapsed * 100}vh`]
  );
  
  // Update window dimensions after component mounts
  useEffect(() => {
    const updateWindowDimensions = () => {
      const newHeight = window.innerHeight;
      setWindowHeight(newHeight);
    };
    
    updateWindowDimensions();
    window.addEventListener("resize", updateWindowDimensions);
    
    return () => window.removeEventListener("resize", updateWindowDimensions);
  }, []);
  
  // Handle position changes programmatically with smoother animation
  const setPositionWithAnimation = (newPosition: "collapsed" | "partial" | "expanded", source = "unknown") => {
    console.log(`Animation triggered: ${position} -> ${newPosition} (source: ${source})`);
    
    // Force position update immediately with tracking
    setPositionWithTracking(newPosition, `animation-${source}`);
    
    // Keep track of the last non-collapsed position
    if (newPosition !== "collapsed") {
      setLastActivePosition(newPosition);
    }
    
    // Ensure window height is available
    const currentWindowHeight = windowHeight || window.innerHeight;
    
    // Force immediate layout update
    if (overlayRef.current) {
      // Read layout to force a reflow
      overlayRef.current.getBoundingClientRect();
    }
    
    // Calculate the appropriate dragY value based on the desired position
    let targetY;
    switch (newPosition) {
      case "expanded":
        targetY = 0; // Top of the screen (full height)
        break;
      case "partial":
        targetY = currentWindowHeight * (1 - snapPoints.partial); 
        break;
      case "collapsed":
        // Never collapse beyond the minimum visible height
        targetY = Math.min(
          currentWindowHeight * (1 - snapPoints.collapsed),
          currentWindowHeight - MIN_VISIBLE_HEIGHT_PX
        );
        break;
    }
    
    // Make sure we never go below the threshold (beyond collapsed state)
    const maxAllowedY = Math.min(
      currentWindowHeight * (1 - snapPoints.collapsed),
      currentWindowHeight - MIN_VISIBLE_HEIGHT_PX
    );
    
    if (targetY > maxAllowedY) {
      console.log(`Correcting target position: ${targetY.toFixed(2)} -> ${maxAllowedY.toFixed(2)}`);
      targetY = maxAllowedY;
    }
    
    // Animate to the new position with spring physics
    dragY.set(targetY);
    
    // Use direct animation with framer motion
    if (overlayRef.current) {
      const animate = {
        y: newPosition === "collapsed" 
          ? Math.min(currentWindowHeight * (1 - snapPoints.collapsed), currentWindowHeight - MIN_VISIBLE_HEIGHT_PX) 
          : newPosition === "partial" 
          ? currentWindowHeight * (1 - snapPoints.partial) 
          : 0
      };
      
      // Safety check to never animate beyond collapse position
      if (animate.y > currentWindowHeight - MIN_VISIBLE_HEIGHT_PX) {
        animate.y = currentWindowHeight - MIN_VISIBLE_HEIGHT_PX;
      }
      
      const transition = { 
        type: "spring", 
        damping: 30, 
        stiffness: 350, 
        mass: 0.5,
        duration: 0.3
      };
      
      console.log(`Applying animation to y position: ${animate.y}`);
      
      // @ts-ignore - Access Framer Motion's animate API
      overlayRef.current.animate && overlayRef.current.animate(animate, transition);
    }
  };
  
  // Handle drag start to prevent conflicts
  const handleDragStart = () => {
    setIsDragging(true);
    console.log("Drag started");
  };
  
  // Handle drag end to snap to positions with improved calculations
  const handleDragEnd = (event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    setIsDragging(false);
    const velocity = info.velocity.y;
    const currentY = dragY.get();
    
    console.log(`Drag ended: velocity=${velocity.toFixed(2)}, currentY=${currentY.toFixed(2)}`);
    
    // Don't allow collapsing during active search or streaming
    const isSearchActive = status === 'searching' || status === 'streaming';
    
    // Calculate the absolute maximum Y position to ensure minimum visibility
    const absoluteMaxY = Math.min(
      windowHeight * (1 - snapPoints.collapsed),
      windowHeight - MIN_VISIBLE_HEIGHT_PX
    );
    
    // Ensure we never go beyond the collapsed position
    if (currentY > absoluteMaxY) {
      console.log(`Correcting position: ${currentY.toFixed(2)} -> ${absoluteMaxY.toFixed(2)} (beyond collapse limit)`);
      dragY.set(absoluteMaxY);
    }
    
    // Use velocity for quick flick gestures (with improved thresholds)
    // Clamp extreme velocities to prevent overshooting
    const clampedVelocity = Math.max(Math.min(velocity, 2000), -2000);
    
    if (clampedVelocity < -150) {
      // Fast upward swipe - expand
      setPositionWithAnimation("expanded", "drag-up-flick");
    } else if (clampedVelocity > 150 && !isSearchActive) {
      // Fast downward swipe - collapse, but only if not searching
      // Ensure we animate to collapsed position, not beyond
      setPositionWithAnimation("collapsed", "drag-down-flick");
    } else {
      // Otherwise snap to closest position based on current height
      const currentHeight = windowHeight - currentY;
      const currentHeightRatio = currentHeight / windowHeight;
      
      console.log(`Drag ended: height ratio=${currentHeightRatio.toFixed(2)}`);
      
      if (currentHeightRatio < (snapPoints.collapsed + snapPoints.partial) / 2 && !isSearchActive) {
        setPositionWithAnimation("collapsed", "drag-snap");
      } else if (currentHeightRatio < (snapPoints.partial + snapPoints.expanded) / 2) {
        setPositionWithAnimation("partial", "drag-snap");
      } else {
        setPositionWithAnimation("expanded", "drag-snap");
      }
    }
  };
  
  // Handle clicks on the header to toggle positions
  const handleHeaderClick = (e: React.MouseEvent) => {
    // Only trigger if we're not coming from a drag operation
    if (!isDragging) {
      console.log('Header clicked, current position:', position);
      
      // Modified to ensure one-step transitions
      switch (position) {
        case "collapsed":
          setPositionWithAnimation("partial", "header-click-up");
          break;
        case "partial":
          setPositionWithAnimation("expanded", "header-click-up");
          break;
        case "expanded":
          setPositionWithAnimation("partial", "header-click-down");
          break;
      }
    }
    
    // Reset dragging state as a safety measure
    setIsDragging(false);
  };

  // Handle chevron click specifically 
  const handleChevronClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent header click from also firing
    
    // Don't trigger if we're in the middle of a drag
    if (!isDragging) {
      console.log('Chevron clicked, current position:', position);
      
      // Always go one step at a time
      switch (position) {
        case "collapsed":
          setPositionWithAnimation("partial", "chevron-click-up");
          break;
        case "partial":
          // Chevron points up in partial state, so go up to expanded
          setPositionWithAnimation("expanded", "chevron-click-up");
          break;
        case "expanded":
          // Chevron points down in expanded state, so go down to partial
          setPositionWithAnimation("partial", "chevron-click-down");
          break;
      }
    }
  };
  
  // Set initial position with a slight delay for better animation
  useEffect(() => {
    if (windowHeight > 0 && !isInitialized) {
      console.log('Setting initial position with window height:', windowHeight);
      
      // Short delay to ensure component is fully mounted
      setTimeout(() => {
        setPositionWithAnimation("partial", "initial-mount");
        setIsInitialized(true);
      }, 100);
    }
  }, [windowHeight, isInitialized]);

  // Expand the panel automatically when search starts or streaming begins and keep it open
  useEffect(() => {
    // Log to debug what's happening
    console.log(`Status changed: ${status}, Position: ${position}`);
    
    // Clear any existing timeout
    if (positionLockTimeoutRef.current) {
      clearTimeout(positionLockTimeoutRef.current);
      positionLockTimeoutRef.current = null;
    }
    
    if (status === 'searching' || status === 'streaming') {
      console.log('Search active, expanding overlay via status change');
      
      // Only expand if we're currently collapsed
      // This prevents overriding a manual expansion
      if (position === 'collapsed') {
        // Force immediate expansion to prevent race conditions
        setPositionWithTracking('partial', 'status-change');
        
        // Then ensure smooth animation follows
        requestAnimationFrame(() => {
          setPositionWithAnimation('partial', 'status-auto-expand');
        });
      }
      
      // Prevent collapsing while searching/streaming is active
    } else if (status === 'complete' || status === 'error') {
      // Allow normal overlay behavior after a short delay when search completes
      positionLockTimeoutRef.current = setTimeout(() => {
        // No action needed, just releasing the position lock
        console.log('Search complete, releasing position lock');
      }, 500);
    }
    
    return () => {
      if (positionLockTimeoutRef.current) {
        clearTimeout(positionLockTimeoutRef.current);
      }
    };
  }, [status, position]); // Added position to dependencies

  return (
    <motion.div
      ref={overlayRef}
      className="fixed inset-x-0 bottom-0 z-50 rounded-t-xl bg-card shadow-lg touch-none select-none"
      style={{ 
        height,
        backgroundColor: 'var(--card)',
        boxShadow: '0 -4px 20px rgba(0, 0, 0, 0.25)',
        minHeight: `${MIN_VISIBLE_HEIGHT_PX}px`, // Add explicit min-height
      }}
      drag="y"
      dragListener={true} // Enable dragging on the entire component
      dragConstraints={{ 
        top: 0, // Allow dragging to the top of the screen
        bottom: Math.min(windowHeight * (1 - snapPoints.collapsed), windowHeight - MIN_VISIBLE_HEIGHT_PX) // Ensure min height is visible
      }}
      dragElastic={0.05} // Reduced elasticity to prevent overscrolling
      dragMomentum={false} // Disable momentum for more precise control
      dragTransition={{ 
        bounceStiffness: 500, // Increased for less bounce
        bounceDamping: 50, // Increased for less bounce
        power: 0.1, // Reduced power for more gentle movement
        timeConstant: 300, // Increased for slower momentum
        restDelta: 1, // Smaller rest delta for more precise stopping
        modifyTarget: (target) => {
          // Prevent the overlay from going below the collapsed position
          // Ensure minimum height is always visible
          const maxY = Math.min(windowHeight * (1 - snapPoints.collapsed), windowHeight - MIN_VISIBLE_HEIGHT_PX);
          return Math.min(target, maxY);
        }
      }}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      whileTap={{ cursor: "grabbing" }}
      animate={{ 
        y: position === "collapsed" 
          ? Math.min(windowHeight * (1 - snapPoints.collapsed), windowHeight - MIN_VISIBLE_HEIGHT_PX)
          : position === "partial" 
          ? windowHeight * (1 - snapPoints.partial) 
          : 0
      }}
      transition={{ type: "spring", damping: 30, stiffness: 350, mass: 0.5, duration: 0.3 }}
    >
      {/* Visual indicator for drag - always visible even when collapsed */}
      <div className="absolute inset-x-0 -top-1 h-2 flex items-center justify-center pointer-events-none">
        <div className="w-12 h-1 bg-white/20 rounded-full"></div>
      </div>
        
      {/* Large drag handle area for better touch target */}
      <div 
        className="h-12 w-full flex items-center justify-center cursor-grab active:cursor-grabbing"
        onClick={isDragging ? undefined : handleHeaderClick}
      >
        <div className="w-16 h-1.5 bg-muted rounded-full my-2"></div>
      </div>
      
      {/* Header with status indicator and expand/collapse chevron */}
      <div 
        className="px-4 pb-3 flex items-center justify-between cursor-pointer border-b"
        onClick={isDragging ? undefined : handleHeaderClick}
      >
        <div className="flex items-center gap-2">
          {/* Status indicator icon */}
          {stabilizedStatus === 'searching' && (
            <Loader2 className="h-4 w-4 text-primary animate-spin" />
          )}
          {stabilizedStatus === 'streaming' && (
            <div className="h-2 w-2 rounded-full bg-primary animate-pulse"></div>
          )}
          {stabilizedStatus === 'error' && (
            <AlertCircle className="h-4 w-4 text-destructive" />
          )}
          
          <h2 className="text-base font-medium select-none">
            {position === "collapsed" 
              ? "Results (drag up to view)" 
              : stabilizedStatus === 'searching'
                ? "Searching..."
                : stabilizedStatus === 'streaming'
                  ? "Generating insights..."
                  : stabilizedStatus === 'error'
                    ? "Error"
                    : results.length > 0
                      ? `Results (${results.length})`
                      : "Results"}
          </h2>
        </div>
        
        <ChevronUp 
          className={cn(
            "h-5 w-5 text-muted-foreground transition-transform duration-200 select-none",
            position === "expanded" ? "rotate-180" : "",
            position === "partial" ? "rotate-0" : "",
            position === "collapsed" ? "rotate-0" : ""
          )}
          onClick={handleChevronClick}
        />
      </div>
      
      {/* Content scroll area - improved for better scrollability */}
      <div 
        ref={contentRef}
        className={cn(
          "overflow-y-auto overscroll-contain p-4 bg-card", 
          position === "collapsed" ? "max-h-16 opacity-80" : "h-[calc(100%-4rem)]"
        )}
        style={{
          WebkitOverflowScrolling: 'touch', // Smoother scrolling on iOS
        }}
        onClick={(e) => e.stopPropagation()} // Prevent clicks in content from triggering header actions
      >
        {/* Different views based on search status */}
        {(stabilizedStatus === 'searching' || status === 'searching') ? (
          <div className="flex flex-col items-center justify-center p-6 text-center">
            <div className="h-12 w-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
            <p className="mt-4 text-sm text-muted-foreground">Searching for information...</p>
          </div>
        ) : (stabilizedStatus === 'streaming' || status === 'streaming' || isStreamingInitiated) ? (
          <>
            {content ? (
              <div className="prose prose-sm max-w-none">
                {content.split('\n').map((paragraph, i) => (
                  paragraph.trim() ? (
                    <p key={i} className="mb-4 text-card-foreground">{paragraph}</p>
                  ) : <br key={i} />
                ))}
                
                {/* Show a spinner at the bottom when actively streaming */}
                {(stabilizedStatus === 'streaming' || status === 'streaming') && (
                  <div className="flex items-center justify-center py-4">
                    <div className="h-4 w-4 border-2 border-primary border-t-transparent rounded-full animate-spin mr-2"></div>
                    <span className="text-xs text-muted-foreground">Loading more...</span>
                  </div>
                )}
                
                {/* Add extra space at the bottom for comfortable scrolling */}
                <div className="h-16"></div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center p-6 text-center">
                <div className="h-10 w-10 border-4 border-primary/70 border-t-transparent rounded-full animate-spin"></div>
                <p className="mt-4 text-sm text-muted-foreground">Generating insights...</p>
              </div>
            )}
          </>
        ) : (stabilizedStatus === 'error' || status === 'error') ? (
          <div className="rounded-lg bg-destructive/20 p-4 text-center text-destructive">
            <p>{error || 'An error occurred while searching. Please try again.'}</p>
          </div>
        ) : content ? (
          <div className="prose prose-sm max-w-none">
            {content.split('\n').map((paragraph, i) => (
              paragraph.trim() ? (
                <p key={i} className="mb-4 text-card-foreground">{paragraph}</p>
              ) : <br key={i} />
            ))}
            
            {/* Add extra space at the bottom for comfortable scrolling */}
            <div className="h-16"></div>
          </div>
        ) : (stabilizedStatus === 'idle' && status === 'idle') ? (
          <div className="text-center text-muted-foreground p-4">
            <p>Enter a search query to see results</p>
          </div>
        ) : (status === 'complete' && !content) ? (
          <div className="text-center text-muted-foreground p-4">
            <p>No results available</p>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center p-6 text-center">
            <div className="h-10 w-10 border-4 border-primary/70 border-t-transparent rounded-full animate-spin"></div>
            <p className="mt-4 text-sm text-muted-foreground">Processing results...</p>
          </div>
        )}
      </div>
      
      {/* Visual indicator when overlay is collapsed */}
      {position === "collapsed" && (
        <div className="absolute bottom-0 inset-x-0 h-6 bg-gradient-to-t from-card to-transparent pointer-events-none" />
      )}
    </motion.div>
  );
}); 