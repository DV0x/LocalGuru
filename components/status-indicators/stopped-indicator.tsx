"use client";

import { BaseIndicator, BaseIndicatorProps } from './base-indicator';
import { Square } from 'lucide-react';

interface StoppedIndicatorProps extends Omit<BaseIndicatorProps, 'icon'> {
  detailedMessage?: string;
}

export function StoppedIndicator({
  message = "Search Stopped",
  detailedMessage = "Search was cancelled by user",
  className = "",
  backgroundColor = "bg-red-50",
  textColor = "text-red-700",
  iconBackgroundColor = "bg-red-500",
  iconColor = "text-white",
  ...props
}: StoppedIndicatorProps) {
  return (
    <BaseIndicator
      className={`py-8 ${className}`}
      backgroundColor={backgroundColor}
      textColor={textColor}
      iconBackgroundColor={iconBackgroundColor}
      iconColor={iconColor}
      message={message}
      icon={<Square className="h-6 w-6" />}
      {...props}
    >
      {detailedMessage && (
        <p className="text-sm text-red-600 mt-1">{detailedMessage}</p>
      )}
    </BaseIndicator>
  );
} 