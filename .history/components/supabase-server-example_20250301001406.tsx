import { getServerSupabaseClient } from '../utils/supabase/server'

export default async function SupabaseServerExample() {
  let connectionStatus: 'connected' | 'error' = 'error'
  let errorMessage: string | null = null
  let timestamp: string | null = null

  try {
    const supabase = getServerSupabaseClient()
    
    // Test the connection by querying the current timestamp
    // Note: You'll need to create this function in Supabase, or use another query
    const { data, error } = await supabase.rpc('get_timestamp')
    
    if (error) {
      throw error
    }
    
    connectionStatus = 'connected'
    timestamp = data
  } catch (error) {
    connectionStatus = 'error'
    errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
  }

  return (
    <div className="p-4 border rounded-md shadow-sm mt-8">
      <h2 className="text-xl font-bold mb-4">Supabase Server Connection Test</h2>
      
      {connectionStatus === 'connected' ? (
        <div className="bg-green-100 p-4 rounded-md">
          <p className="text-green-800">Successfully connected to Supabase from the server!</p>
          {timestamp && <p className="mt-2 text-sm">Current timestamp: {timestamp}</p>}
        </div>
      ) : (
        <div className="bg-red-100 p-4 rounded-md">
          <p className="text-red-800">Failed to connect to Supabase from the server.</p>
          {errorMessage && <p className="mt-2 text-sm">{errorMessage}</p>}
          <p className="mt-4 text-sm">Make sure your .env.local file has the correct Supabase credentials.</p>
        </div>
      )}
    </div>
  )
} 