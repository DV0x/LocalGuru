import { supabaseAdmin } from '@/app/lib/supabase/client-server';
import { formatDistance } from 'date-fns';
import RefreshButton from '@/app/search-analytics/refresh-button';
import ResizableTable from '@/app/search-analytics/resizable-table';

// This ensures the data is always fresh, not cached
export const revalidate = 0;

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
  const { data: dailyStats, error: statsError } = await supabaseAdmin.rpc(
    'get_search_statistics_by_day',
    { 
      days_to_include: 7 
    }
  );

  if (statsError) {
    console.error('Error fetching daily statistics:', statsError);
  }

  // Get most recent 50 searches
  const { data: recentSearches, error: searchesError } = await supabaseAdmin
    .from('search_performance_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50);

  if (searchesError) {
    console.error('Error fetching recent searches:', searchesError);
  }

  // Get error stats
  const { data: errorStats, error: errorStatsError } = await supabaseAdmin
    .from('search_performance_logs')
    .select('*')
    .not('error_message', 'is', null)
    .order('created_at', { ascending: false })
    .limit(20);

  if (errorStatsError) {
    console.error('Error fetching error stats:', errorStatsError);
  }

  return {
    dailyStats: (dailyStats || []) as DailyStats[],
    recentSearches: (recentSearches || []) as SearchLog[],
    errorStats: (errorStats || []) as SearchLog[]
  };
}

export default async function SearchAnalyticsPage() {
  const { dailyStats, recentSearches, errorStats } = await getSearchAnalytics();

  // Define column headers for recent searches
  const searchColumns = [
    { id: 'query', label: 'Query', minWidth: 150 },
    { id: 'intent', label: 'Intent', minWidth: 120 },
    { id: 'duration', label: 'Duration', minWidth: 100 },
    { id: 'results', label: 'Results', minWidth: 80 },
    { id: 'time', label: 'Time', minWidth: 120 }
  ];

  // Define column headers for errors
  const errorColumns = [
    { id: 'query', label: 'Query', minWidth: 150 },
    { id: 'error', label: 'Error', minWidth: 250 },
    { id: 'time', label: 'Time', minWidth: 120 }
  ];

  // Prepare search data
  const searchData = recentSearches.map(search => ({
    id: search.id,
    cells: [
      { id: 'query', content: search.query },
      { id: 'intent', content: search.intent },
      { 
        id: 'duration', 
        content: `${search.duration_ms}ms${search.timed_out ? ' ⚠️' : ''}`,
        className: search.timed_out ? 'has-warning' : ''
      },
      { id: 'results', content: String(search.result_count) },
      { 
        id: 'time', 
        content: formatDistance(new Date(search.created_at), new Date(), { addSuffix: true }) 
      }
    ]
  }));

  // Prepare error data
  const errorData = errorStats.map(error => ({
    id: error.id,
    cells: [
      { id: 'query', content: error.query },
      { id: 'error', content: error.error_message || '', className: 'text-red-600' },
      { 
        id: 'time', 
        content: formatDistance(new Date(error.created_at), new Date(), { addSuffix: true }) 
      }
    ]
  }));

  return (
    <div className="container mx-auto p-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Search Analytics Dashboard</h1>
        <RefreshButton />
      </div>
      
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
          <ResizableTable 
            columns={searchColumns} 
            data={searchData} 
            emptyMessage="No recent searches found" 
          />
        </div>
        
        <div className="bg-white p-4 rounded shadow">
          <h2 className="text-lg font-semibold mb-4">Recent Errors</h2>
          <ResizableTable 
            columns={errorColumns} 
            data={errorData} 
            emptyMessage="No errors found" 
          />
        </div>
      </div>
    </div>
  );
} 