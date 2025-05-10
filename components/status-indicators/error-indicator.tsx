"use client";

import { BaseIndicator, BaseIndicatorProps } from './base-indicator';
import { AlertTriangle } from 'lucide-react';

interface ErrorIndicatorProps extends Omit<BaseIndicatorProps, 'icon'> {
  detailedMessage?: string;
}

export function ErrorIndicator({
  message = "Something went wrong",
  detailedMessage,
  className = "",
  backgroundColor = "bg-red-50",
  textColor = "text-red-700",
  iconColor = "text-red-500",
  ...props
}: ErrorIndicatorProps) {
  return (
    <BaseIndicator
      className={`py-10 ${className}`}
      backgroundColor={backgroundColor}
      textColor={textColor}
      message={message}
      icon={<AlertTriangle className="h-12 w-12" />}
      iconColor={iconColor}
      {...props}
    >
      {detailedMessage && (
        <p className="text-sm text-red-600 mt-2">{detailedMessage}</p>
      )}
    </BaseIndicator>
  );
} 