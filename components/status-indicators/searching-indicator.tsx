"use client";

import { BaseIndicator, BaseIndicatorProps } from './base-indicator';
import { Search } from 'lucide-react';

interface SearchingIndicatorProps extends Omit<BaseIndicatorProps, 'icon'> {
  spinnerSize?: string;
  spinnerColor?: string;
  spinnerBorderColor?: string;
}

export function SearchingIndicator({
  message = "Searching for local gems...",
  className = "",
  backgroundColor = "bg-white",
  textColor = "text-black",
  spinnerSize = "h-12 w-12",
  spinnerColor = "border-black",
  spinnerBorderColor = "border-gray-200",
  ...props
}: SearchingIndicatorProps) {
  return (
    <BaseIndicator
      className={`py-10 ${className}`}
      backgroundColor={backgroundColor}
      textColor={textColor}
      message={message}
      {...props}
    >
      <div className={`inline-block ${spinnerSize} border-4 ${spinnerColor} border-t-transparent rounded-full animate-spin mb-4`}></div>
    </BaseIndicator>
  );
} 