'use server';

import { revalidatePath } from 'next/cache';

export async function refreshAnalyticsData() {
  // Revalidate the search-analytics path to clear the cache
  revalidatePath('/search-analytics');
  return { success: true, timestamp: new Date().toISOString() };
} 