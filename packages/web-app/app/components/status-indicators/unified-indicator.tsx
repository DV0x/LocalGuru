"use client";

import { useEffect, useState } from 'react';
import { BaseIndicator, BaseIndicatorProps } from './base-indicator';

// Define the list of rotating verbs for each phase
const SEARCH_VERBS = [
  "Scouting locations…",
  "Mapping neighborhoods…", 
  "Finding hotspots…",
  "Scanning districts…",
  "Locating venues…"
];

const GENERATE_VERBS = [
  "Synthesizing insights from results...",
  "Ranking vibes…",
  "Cross-checking locals…",
  "Crafting insights…",
  "Analyzing recommendations…",
  "Curating experiences…"
];

interface UnifiedIndicatorProps extends Omit<BaseIndicatorProps, 'icon' | 'message'> {
  phase: 'searching' | 'generating';
  customMessage?: string;
}

export function UnifiedIndicator({
  phase = 'searching',
  customMessage,
  className = "",
  backgroundColor = "bg-white",
  textColor = "text-purple-600",
  ...props
}: UnifiedIndicatorProps) {
  const [message, setMessage] = useState<string>("");

  // Select verbs based on phase
  const verbs = phase === 'searching' ? SEARCH_VERBS : GENERATE_VERBS;
  
  // Set up the message rotation effect
  useEffect(() => {
    if (customMessage) {
      setMessage(customMessage);
      return;
    }

    // Rotate through verbs
    let index = 0;
    
    const rotateVerbs = () => {
      setMessage(verbs[index]);
      index = (index + 1) % verbs.length;
    };
    
    // Initialize with first verb
    rotateVerbs();
    
    // Set up interval to rotate through verbs
    const interval = setInterval(rotateVerbs, 3000);
    
    return () => clearInterval(interval);
  }, [customMessage, phase, verbs]);

  return (
    <BaseIndicator
      className={`py-4 ${className}`}
      backgroundColor={backgroundColor}
      textColor={textColor}
      message={message}
      {...props}
    >
      <div className="indicator-container w-full h-20 mt-2 mb-2 relative flex items-center justify-center">
        <svg 
          width="100" 
          height="60" 
          viewBox="0 0 100 60" 
          className="animate-pulse" 
          fill="none" 
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Define Purple Gradients */}
          <defs>
            <linearGradient id="purpleGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#c084fc" />
              <stop offset="100%" stopColor="#8b5cf6" />
            </linearGradient>
            <linearGradient id="purpleLightGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#ddd6fe" />
              <stop offset="100%" stopColor="#c4b5fd" />
            </linearGradient>
          </defs>
          
          {/* Explorer/Binoculars SVG Animation */}
          <g className="binoculars">
            {/* Left Lens */}
            <circle
              cx="30"
              cy="30"
              r="15"
              fill="url(#purpleLightGradient)"
              stroke="url(#purpleGradient)"
              strokeWidth="2"
              className="lens"
            >
              <animate
                attributeName="r"
                values="15;17;15"
                dur="3s"
                repeatCount="indefinite"
              />
            </circle>
            
            {/* Right Lens */}
            <circle
              cx="70"
              cy="30"
              r="15"
              fill="url(#purpleLightGradient)"
              stroke="url(#purpleGradient)"
              strokeWidth="2"
              className="lens"
            >
              <animate
                attributeName="r"
                values="15;17;15"
                dur="3s"
                repeatCount="indefinite"
                begin="0.5s"
              />
            </circle>
            
            {/* Center Bridge */}
            <rect
              x="30"
              y="25"
              width="40"
              height="10"
              fill="url(#purpleGradient)"
              rx="5"
              ry="5"
              className="bridge"
            />
            
            {/* Left Handle */}
            <rect
              x="20"
              y="30"
              width="5"
              height="20"
              fill="url(#purpleGradient)"
              rx="2.5"
              ry="2.5"
              className="handle"
            >
              <animate
                attributeName="height"
                values="20;24;20"
                dur="2s"
                repeatCount="indefinite"
              />
            </rect>
            
            {/* Right Handle */}
            <rect
              x="75"
              y="30"
              width="5"
              height="20"
              fill="url(#purpleGradient)"
              rx="2.5"
              ry="2.5"
              className="handle"
            >
              <animate
                attributeName="height"
                values="20;24;20"
                dur="2s"
                repeatCount="indefinite"
                begin="0.3s"
              />
            </rect>
            
            {/* Left Eyepiece Detail */}
            <circle
              cx="30"
              cy="30"
              r="7"
              fill="white"
              opacity="0.5"
              className="eyepiece-detail"
            >
              <animate
                attributeName="opacity"
                values="0.5;0.8;0.5"
                dur="4s"
                repeatCount="indefinite"
              />
            </circle>
            
            {/* Right Eyepiece Detail */}
            <circle
              cx="70"
              cy="30"
              r="7"
              fill="white"
              opacity="0.5"
              className="eyepiece-detail"
            >
              <animate
                attributeName="opacity"
                values="0.5;0.8;0.5"
                dur="4s"
                repeatCount="indefinite"
                begin="0.7s"
              />
            </circle>
            
            {/* Scanning Lines (Left) */}
            <line
              x1="15"
              y1="15"
              x2="45"
              y2="45"
              stroke="url(#purpleGradient)"
              strokeWidth="1"
              strokeDasharray="3,3"
              className="scan-line"
            >
              <animate
                attributeName="y2"
                values="45;40;45"
                dur="3s"
                repeatCount="indefinite"
              />
              <animate
                attributeName="x2"
                values="45;50;45"
                dur="3s"
                repeatCount="indefinite"
              />
            </line>
            
            {/* Scanning Lines (Right) */}
            <line
              x1="85"
              y1="15"
              x2="55"
              y2="45"
              stroke="url(#purpleGradient)"
              strokeWidth="1"
              strokeDasharray="3,3"
              className="scan-line"
            >
              <animate
                attributeName="y2"
                values="45;40;45"
                dur="3s"
                repeatCount="indefinite"
              />
              <animate
                attributeName="x2"
                values="55;50;55"
                dur="3s"
                repeatCount="indefinite"
              />
            </line>
            
            {/* Search Target (Pulsing Circle) */}
            <circle
              cx="50"
              cy="50"
              r="3"
              fill="transparent"
              stroke="url(#purpleGradient)"
              strokeWidth="1"
              className="target"
            >
              <animate
                attributeName="r"
                values="3;8;3"
                dur="2s"
                repeatCount="indefinite"
              />
              <animate
                attributeName="opacity"
                values="1;0.3;1"
                dur="2s"
                repeatCount="indefinite"
              />
            </circle>
          </g>
        </svg>
      </div>
    </BaseIndicator>
  );
} 