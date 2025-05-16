"use client";

import { ThemeProvider } from "next-themes";
import { MapProvider } from "./contexts/map-context";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="dark">
      <MapProvider>
        {children}
      </MapProvider>
    </ThemeProvider>
  );
} 