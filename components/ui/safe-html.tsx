'use client';

import DOMPurify from 'dompurify';
import { useEffect, useRef, memo } from 'react';
import { twMerge } from 'tailwind-merge';

// Import the types separately if needed
import type { Config as DOMPurifyConfig } from 'dompurify';

export interface SafeHtmlProps {
  /**
   * The HTML content to sanitize and render
   */
  html: string;
  
  /**
   * Optional CSS class name to apply to the container
   */
  className?: string;
  
  /**
   * Optional allowed tags (overrides default configuration)
   */
  allowedTags?: string[];
  
  /**
   * Optional allowed attributes (overrides default configuration)
   */
  allowedAttributes?: string[];
}

/**
 * Safely renders HTML content by sanitizing it with DOMPurify
 * Prevents XSS attacks from user-generated content
 */
function SafeHtml({ 
  html, 
  className, 
  allowedTags,
  allowedAttributes 
}: SafeHtmlProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    // Configure DOMPurify with secure defaults
    const config: DOMPurifyConfig = {
      ALLOWED_TAGS: allowedTags || [
        // Text formatting
        'p', 'b', 'i', 'em', 'strong', 'a', 'br', 'hr',
        // Lists
        'ul', 'ol', 'li',
        // Headings (limited to h3 and below for semantic hierarchy)
        'h3', 'h4', 'h5', 'h6',
        // Other safe elements
        'blockquote', 'code', 'pre', 'span'
      ],
      ALLOWED_ATTR: allowedAttributes || [
        'href', 'target', 'rel', 'class', 'title'
      ],
      // Explicitly forbidden tags for clarity
      FORBID_TAGS: [
        'script', 'style', 'iframe', 'object', 'embed', 'form',
        'input', 'button', 'textarea', 'select', 'option',
        'noscript', 'svg', 'math', 'head', 'meta'
      ],
      // Add security attributes to links
      ADD_ATTR: ['target', 'rel'],
      // Remove all URI schemes that could potentially execute code
      ALLOWED_URI_REGEXP: /^(?:(?:(?:f|ht)tps?|mailto):|[^a-z]|[a-z+.-]+(?:[^a-z+.:-]|$))/i,
      // Don't return the input if sanitization fails completely
      RETURN_DOM_FRAGMENT: false,
      RETURN_DOM: false,
    };
    
    // Add hook to make all links open in new tab with security attributes
    DOMPurify.addHook('afterSanitizeAttributes', (node: Element) => {
      if (node.tagName === 'A') {
        // Add security attributes to all links
        node.setAttribute('target', '_blank');
        node.setAttribute('rel', 'noopener noreferrer');
        
        // Ensure all links have https or http scheme
        if (node.getAttribute('href') && 
            !node.getAttribute('href')?.match(/^https?:\/\//i) &&
            !node.getAttribute('href')?.startsWith('/') &&
            !node.getAttribute('href')?.startsWith('#') &&
            !node.getAttribute('href')?.startsWith('mailto:')) {
          node.setAttribute('href', 'https://' + node.getAttribute('href'));
        }
      }
    });
    
    // Clean up by removing hook when component unmounts
    return () => {
      DOMPurify.removeHook('afterSanitizeAttributes');
    };
  }, [allowedTags, allowedAttributes]);
  
  // Sanitize the HTML
  const sanitizedHtml = DOMPurify.sanitize(html || '');
  
  return (
    <div 
      ref={containerRef}
      className={twMerge('prose prose-sm max-w-none', className)} 
      dangerouslySetInnerHTML={{ __html: sanitizedHtml }} 
    />
  );
}

// Memo for performance when rendering many items
export default memo(SafeHtml); 