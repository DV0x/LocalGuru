"use client";

import * as React from "react";
import { ThemeProvider as NextThemesProvider } from "next-themes";

export function ThemeProvider({ 
  children, 
  ...props 
}: { 
  children: React.ReactNode;
  [key: string]: any;
}) {
  const [mounted, setMounted] = React.useState(false);

  // Ensure we only render theme-dependent components after hydration
  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <>{children}</>;
  }

  return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
} 