// Common types for search-related components

export interface SearchBarProps {
  onSearch: (query: string) => void;
  initialValue?: string;
  isLoading?: boolean;
  onStop?: () => void;
  onLocationChange?: (location: string) => void;
  initialLocation?: string;
}

export interface FloatingSearchBarProps {
  onSearch: (query: string) => void;
  visible: boolean;
  isLoading?: boolean;
  onStop?: () => void;
  onLocationChange?: (location: string) => void;
  initialLocation?: string;
}

export interface LocationSelectorProps {
  onLocationChange?: (location: string) => void;
  initialLocation?: string;
  variant?: "default" | "compact" | "ultra-compact";
} 