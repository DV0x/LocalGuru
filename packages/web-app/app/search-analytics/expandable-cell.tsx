'use client';

import { useState } from 'react';

interface ExpandableCellProps {
  content: string;
  maxLength?: number;
  className?: string;
}

export default function ExpandableCell({ 
  content, 
  maxLength = 40,
  className = '' 
}: ExpandableCellProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  
  // If content is short enough, no need for expansion
  if (!content || content.length <= maxLength) {
    return <span className={className}>{content}</span>;
  }
  
  return (
    <div className="relative">
      {isExpanded ? (
        <div className="relative">
          <div className={`${className} break-words whitespace-pre-wrap`}>
            {content}
          </div>
          <button
            onClick={() => setIsExpanded(false)}
            className="text-blue-500 hover:text-blue-700 text-xs mt-1 font-medium"
          >
            Show less
          </button>
        </div>
      ) : (
        <div>
          <span className={`${className} truncate block`}>
            {content.substring(0, maxLength)}...
          </span>
          <button
            onClick={() => setIsExpanded(true)}
            className="text-blue-500 hover:text-blue-700 text-xs mt-1 font-medium"
          >
            Show more
          </button>
        </div>
      )}
    </div>
  );
} 