"use client";

import { ReactNode } from 'react';

export interface BaseIndicatorProps {
  message?: string;
  icon?: ReactNode;
  className?: string;
  backgroundColor?: string;
  iconBackgroundColor?: string;
  textColor?: string;
  iconColor?: string;
  children?: ReactNode;
}

export function BaseIndicator({
  message,
  icon,
  className = "",
  backgroundColor = "bg-gray-50",
  iconBackgroundColor = "bg-[rgb(var(--primary))]",
  textColor = "text-black",
  iconColor = "text-white",
  children
}: BaseIndicatorProps) {
  return (
    <div className={`flex flex-col items-center justify-center py-4 mb-4 rounded-lg ${backgroundColor} ${className}`}>
      {icon && (
        <div className={`flex items-center justify-center h-10 w-10 rounded-full ${iconBackgroundColor} mb-3`}>
          <div className={iconColor}>{icon}</div>
        </div>
      )}
      {message && <p className={`font-bold ${textColor}`}>{message}</p>}
      {children}
    </div>
  );
} 