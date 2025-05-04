'use client';

import { useState } from 'react';
import SafeHtml from './safe-html';

interface ContentDisplayProps {
  title?: string;
  content: string;
  className?: string;
}

/**
 * Component to securely display user-generated content
 * Uses SafeHtml for XSS protection
 */
export default function ContentDisplay({ 
  title, 
  content, 
  className 
}: ContentDisplayProps) {
  const [showDetails, setShowDetails] = useState(false);
  
  return (
    <div className={`border rounded-lg p-4 ${className || ''}`}>
      {title && <h3 className="text-lg font-semibold mb-3">{title}</h3>}
      
      <div className="space-y-4">
        {/* Safely render the content with DOMPurify */}
        <SafeHtml 
          html={content} 
          className="text-sm text-gray-700"
        />
        
        {/* Example of conditional rendering */}
        <button
          onClick={() => setShowDetails(!showDetails)}
          className="text-xs text-blue-600 hover:underline mt-2"
        >
          {showDetails ? 'Hide details' : 'Show details'}
        </button>
        
        {showDetails && (
          <div className="mt-3 text-xs text-gray-500">
            <p>Content length: {content.length} characters</p>
            <p>Content rendered using DOMPurify for XSS protection</p>
          </div>
        )}
      </div>
    </div>
  );
} 