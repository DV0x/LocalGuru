'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export default function SupabaseExample() {
  const [isConfigured, setIsConfigured] = useState<boolean | null>(null);
  const [envStatus, setEnvStatus] = useState({ url: false, key: false });

  useEffect(() => {
    // Check if environment variables are defined
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    setEnvStatus({
      url: !!supabaseUrl,
      key: !!supabaseKey
    });
    
    console.log('Supabase URL defined:', !!supabaseUrl);
    console.log('Supabase Key defined:', !!supabaseKey);
    
    // Check if Supabase is properly configured
    const checkConfig = async () => {
      try {
        // Try a simpler query first
        const { error } = await supabase.auth.getSession();
        if (error) {
          console.error('Supabase error:', error);
          setIsConfigured(false);
        } else {
          setIsConfigured(true);
        }
      } catch (error) {
        console.error('Supabase connection error:', error);
        setIsConfigured(false);
      }
    };

    checkConfig();
  }, []);

  return (
    <div className="p-4 border rounded-lg mb-4 bg-white">
      <h2 className="text-lg font-semibold mb-2">Supabase Connection Status</h2>
      
      <div className="mb-4">
        <h3 className="text-sm font-medium">Environment Variables:</h3>
        <p className={envStatus.url ? "text-green-600" : "text-red-600"}>
          {envStatus.url ? "✅" : "❌"} NEXT_PUBLIC_SUPABASE_URL
        </p>
        <p className={envStatus.key ? "text-green-600" : "text-red-600"}>
          {envStatus.key ? "✅" : "❌"} NEXT_PUBLIC_SUPABASE_ANON_KEY
        </p>
      </div>
      
      {isConfigured === null ? (
        <p className="text-gray-600">Checking Supabase connection...</p>
      ) : isConfigured ? (
        <p className="text-green-600">✅ Supabase is properly configured</p>
      ) : (
        <div className="text-red-600">
          <p>❌ Supabase configuration error</p>
          <p className="text-sm mt-2">
            Make sure you have set up the .env.local file with your Supabase credentials.
          </p>
        </div>
      )}
    </div>
  );
} 