"use client";

import { AlertTriangle } from 'lucide-react';

interface WarningIndicatorProps {
  message?: string;
  className?: string;
  backgroundColor?: string;
  textColor?: string;
  iconColor?: string;
  borderColor?: string;
}

export function WarningIndicator({
  message = "No specific matches found in our database. Generating a response based on general knowledge.",
  className = "",
  backgroundColor = "bg-amber-50",
  textColor = "text-amber-800",
  iconColor = "text-amber-500",
  borderColor = "border-amber-200",
}: WarningIndicatorProps) {
  return (
    <div className="px-4 pt-2 pb-4">
      <div className={`flex items-center mb-4 ${backgroundColor} p-3 rounded-lg border ${borderColor} ${className}`}>
        <AlertTriangle className={`h-5 w-5 ${iconColor} mr-2 flex-shrink-0`} />
        <p className={`text-sm ${textColor}`}>
          {message}
        </p>
      </div>
    </div>
  );
} 