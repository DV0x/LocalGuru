"use client";

import { ThemeProvider } from "next-themes";
import { MapProvider } from "./contexts/map-context";
import { AuthProvider } from "./contexts/auth-context";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="dark">
      <AuthProvider>
        <MapProvider>
          {children}
        </MapProvider>
      </AuthProvider>
    </ThemeProvider>
  );
} 