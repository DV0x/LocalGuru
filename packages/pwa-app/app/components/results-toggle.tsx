'use client';

import React from 'react';
import { ListFilter, Users } from 'lucide-react';
import { cn } from '../lib/utils';

interface ResultsToggleProps {
  activeTab: 'structured' | 'social';
  onToggle: (tab: 'structured' | 'social') => void;
  structuredCount: number;
  socialCount: number;
}

export function ResultsToggle({
  activeTab,
  onToggle,
  structuredCount,
  socialCount
}: ResultsToggleProps) {
  return (
    <div className="mb-4">
      <div className="w-full border rounded-lg overflow-hidden grid grid-cols-2">
        <button 
          onClick={() => onToggle('structured')} 
          className={cn(
            "flex items-center justify-center gap-2 py-2 transition-colors",
            activeTab === 'structured' 
              ? "bg-primary/10 text-primary border-b-2 border-primary" 
              : "hover:bg-muted text-muted-foreground"
          )}
          aria-label="Show official results"
        >
          <ListFilter size={16} />
          <span>Official</span>
          <span className="ml-1 text-xs bg-secondary text-secondary-foreground rounded-full px-2 py-0.5">
            {structuredCount}
          </span>
        </button>
        
        <button 
          onClick={() => onToggle('social')} 
          className={cn(
            "flex items-center justify-center gap-2 py-2 transition-colors",
            activeTab === 'social' 
              ? "bg-primary/10 text-primary border-b-2 border-primary" 
              : "hover:bg-muted text-muted-foreground"
          )}
          aria-label="Show social recommendations"
        >
          <Users size={16} />
          <span>Social</span>
          <span className="ml-1 text-xs bg-secondary text-secondary-foreground rounded-full px-2 py-0.5">
            {socialCount}
          </span>
        </button>
      </div>
    </div>
  );
} 