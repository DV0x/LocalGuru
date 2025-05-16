import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Debounce function to limit how often a function is called
 * @param func The function to debounce
 * @param wait Wait time in milliseconds
 * @returns Debounced function
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  
  return function(...args: Parameters<T>) {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

/**
 * Debounce an async function while preserving its Promise return type
 * @param func The async function to debounce
 * @param wait Wait time in milliseconds
 * @returns Debounced function that returns a Promise
 */
export function debounceAsync<T extends (...args: any[]) => Promise<any>>(
  func: T,
  wait: number
): (...args: Parameters<T>) => Promise<ReturnType<T>> {
  return function(...args: Parameters<T>): Promise<ReturnType<T>> {
    return new Promise((resolve) => {
      const debouncedFn = debounce(async () => {
        const result = await func(...args);
        resolve(result as ReturnType<T>);
      }, wait);
      debouncedFn();
    });
  };
} 