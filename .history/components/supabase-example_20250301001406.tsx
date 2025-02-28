'use client'

import { useState, useEffect } from 'react'
import { getSupabaseClient } from '../utils/supabase/client'

export default function SupabaseExample() {
  const [isLoading, setIsLoading] = useState(true)
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'error' | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    async function testConnection() {
      try {
        setIsLoading(true)
        const supabase = getSupabaseClient()
        
        // Test connection by getting the current timestamp from Supabase
        const { data, error } = await supabase.rpc('get_timestamp')
        
        if (error) {
          throw error
        }
        
        setConnectionStatus('connected')
        setErrorMessage(null)
      } catch (error) {
        setConnectionStatus('error')
        setErrorMessage(error instanceof Error ? error.message : 'Unknown error occurred')
      } finally {
        setIsLoading(false)
      }
    }
    
    testConnection()
  }, [])

  return (
    <div className="p-4 border rounded-md shadow-sm">
      <h2 className="text-xl font-bold mb-4">Supabase Connection Test</h2>
      
      {isLoading ? (
        <p>Testing connection to Supabase...</p>
      ) : connectionStatus === 'connected' ? (
        <div className="bg-green-100 p-4 rounded-md">
          <p className="text-green-800">Successfully connected to Supabase!</p>
        </div>
      ) : (
        <div className="bg-red-100 p-4 rounded-md">
          <p className="text-red-800">Failed to connect to Supabase.</p>
          {errorMessage && <p className="mt-2 text-sm">{errorMessage}</p>}
          <p className="mt-4 text-sm">Make sure your .env.local file has the correct Supabase credentials.</p>
        </div>
      )}
    </div>
  )
} 