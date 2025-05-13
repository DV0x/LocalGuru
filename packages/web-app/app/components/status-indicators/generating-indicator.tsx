"use client";

import { BaseIndicator, BaseIndicatorProps } from './base-indicator';
import { Sparkles } from 'lucide-react';

interface GeneratingIndicatorProps extends Omit<BaseIndicatorProps, 'icon'> {
  showDots?: boolean;
  primaryColor?: string;
  accentColor?: string;
  secondaryColor?: string;
}

export function GeneratingIndicator({
  message = "AI is synthesizing insights...",
  className = "",
  backgroundColor = "bg-gray-50",
  textColor = "text-[rgb(var(--primary))]",
  iconBackgroundColor = "bg-[rgb(var(--primary))]",
  iconColor = "text-white",
  showDots = true,
  primaryColor = "bg-[rgb(var(--primary))]",
  accentColor = "bg-[rgb(var(--accent))]",
  secondaryColor = "bg-[rgb(var(--secondary))]",
  ...props
}: GeneratingIndicatorProps) {
  return (
    <BaseIndicator
      className={className}
      backgroundColor={backgroundColor}
      textColor={textColor}
      message={message}
      icon={<Sparkles className="h-5 w-5" />}
      iconBackgroundColor={iconBackgroundColor}
      iconColor={iconColor}
      {...props}
    >
      {showDots && (
        <div className="flex space-x-2 mt-3">
          <div className={`w-2 h-2 ${primaryColor} rounded-full animate-pulse delay-100`}></div>
          <div className={`w-2 h-2 ${accentColor} rounded-full animate-pulse delay-300`}></div>
          <div className={`w-2 h-2 ${secondaryColor} rounded-full animate-pulse delay-500`}></div>
        </div>
      )}
    </BaseIndicator>
  );
} 