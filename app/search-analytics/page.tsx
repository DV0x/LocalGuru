import { supabaseAdmin } from '@/app/lib/supabase/client-server';
import { formatDistance } from 'date-fns';

// Define types for our analytics data
interface DailyStats {
  day: string;
  count: number;
  avg_duration: number;
  error_count: number;
  timeout_count: number;
}

interface SearchLog {
  id: string;
  query: string;
  intent: string;
  duration_ms: number;
  result_count: number;
  timed_out: boolean;
  created_at: string;
  error_message: string | null;
}

async function getSearchAnalytics() {
  // Get daily stats for the past 7 days
  const { data: dailyStats } = await supabaseAdmin.rpc(
    'get_search_statistics_by_day',
    { 
      days_to_include: 7 
    }
  );

  // Get most recent 50 searches
  const { data: recentSearches } = await supabaseAdmin
    .from('search_performance_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50);

  // Get error stats
  const { data: errorStats } = await supabaseAdmin
    .from('search_performance_logs')
    .select('*')
    .not('error_message', 'is', null)
    .order('created_at', { ascending: false })
    .limit(20);

  return {
    dailyStats: (dailyStats || []) as DailyStats[],
    recentSearches: (recentSearches || []) as SearchLog[],
    errorStats: (errorStats || []) as SearchLog[]
  };
}

export default async function SearchAnalyticsPage() {
  const { dailyStats, recentSearches, errorStats } = await getSearchAnalytics();

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-6">Search Analytics Dashboard</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-white p-4 rounded shadow">
          <h2 className="text-lg font-semibold mb-2">Total Searches (Last 7 Days)</h2>
          <p className="text-3xl font-bold">
            {dailyStats.reduce((sum: number, day: DailyStats) => sum + day.count, 0)}
          </p>
        </div>
        
        <div className="bg-white p-4 rounded shadow">
          <h2 className="text-lg font-semibold mb-2">Avg Duration (Last 24h)</h2>
          <p className="text-3xl font-bold">
            {Math.round(recentSearches.reduce((sum: number, search: SearchLog) => sum + search.duration_ms, 0) / 
              (recentSearches.length || 1))}ms
          </p>
        </div>
        
        <div className="bg-white p-4 rounded shadow">
          <h2 className="text-lg font-semibold mb-2">Error Rate (Last 24h)</h2>
          <p className="text-3xl font-bold">
            {Math.round((errorStats.length / (recentSearches.length || 1)) * 100)}%
          </p>
        </div>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-4 rounded shadow">
          <h2 className="text-lg font-semibold mb-4">Recent Searches</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="bg-gray-100">
                  <th className="px-4 py-2 text-left">Query</th>
                  <th className="px-4 py-2 text-left">Intent</th>
                  <th className="px-4 py-2 text-left">Duration</th>
                  <th className="px-4 py-2 text-left">Results</th>
                  <th className="px-4 py-2 text-left">Time</th>
                </tr>
              </thead>
              <tbody>
                {recentSearches.map((search) => (
                  <tr key={search.id} className="border-t">
                    <td className="px-4 py-2 max-w-[200px] truncate">{search.query}</td>
                    <td className="px-4 py-2">{search.intent}</td>
                    <td className="px-4 py-2">
                      {search.duration_ms}ms
                      {search.timed_out && <span className="ml-1 text-orange-500">⚠️</span>}
                    </td>
                    <td className="px-4 py-2">{search.result_count}</td>
                    <td className="px-4 py-2 text-gray-500">
                      {formatDistance(
                        new Date(search.created_at),
                        new Date(),
                        { addSuffix: true }
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        
        <div className="bg-white p-4 rounded shadow">
          <h2 className="text-lg font-semibold mb-4">Recent Errors</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="bg-gray-100">
                  <th className="px-4 py-2 text-left">Query</th>
                  <th className="px-4 py-2 text-left">Error</th>
                  <th className="px-4 py-2 text-left">Time</th>
                </tr>
              </thead>
              <tbody>
                {errorStats.map((error) => (
                  <tr key={error.id} className="border-t">
                    <td className="px-4 py-2 max-w-[200px] truncate">{error.query}</td>
                    <td className="px-4 py-2 max-w-[300px] truncate text-red-600">
                      {error.error_message}
                    </td>
                    <td className="px-4 py-2 text-gray-500">
                      {formatDistance(
                        new Date(error.created_at),
                        new Date(),
                        { addSuffix: true }
                      )}
                    </td>
                  </tr>
                ))}
                {errorStats.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-4 py-2 text-center text-gray-500">
                      No errors found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
} 