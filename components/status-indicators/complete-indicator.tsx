"use client";

import { BaseIndicator, BaseIndicatorProps } from './base-indicator';
import { Check } from 'lucide-react';

interface CompleteIndicatorProps extends Omit<BaseIndicatorProps, 'icon'> {
  resultCount?: number;
  secondaryMessage?: string;
}

export function CompleteIndicator({
  message,
  resultCount,
  secondaryMessage = "Generating insights...",
  className = "",
  backgroundColor = "bg-white",
  iconBackgroundColor = "bg-[rgb(var(--accent))]",
  textColor = "text-black",
  iconColor = "text-white",
  ...props
}: CompleteIndicatorProps) {
  // Generate default message if not provided
  const defaultMessage = resultCount !== undefined ? `Found ${resultCount} results` : "Search complete";
  const displayMessage = message || defaultMessage;
  
  return (
    <BaseIndicator
      className={`py-10 ${className}`}
      backgroundColor={backgroundColor}
      textColor={textColor}
      iconBackgroundColor={iconBackgroundColor}
      iconColor={iconColor}
      message={displayMessage}
      icon={<Check className="h-8 w-8" />}
      {...props}
    >
      {secondaryMessage && (
        <p className="text-gray-600 text-sm mt-2">{secondaryMessage}</p>
      )}
    </BaseIndicator>
  );
} 