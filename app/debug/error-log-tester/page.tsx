'use client';

import { useState, useEffect } from 'react';
import { generateTestError, getErrorLogHealth, logClientError } from '@/app/lib/utils/error-logger';

/**
 * Utility page for testing error logging functionality
 * Access at /debug/error-log-tester
 */
export default function ErrorLogTester() {
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [customMessage, setCustomMessage] = useState('Test error from debug tool');
  const [logs, setLogs] = useState<any[]>([]);
  const [directTestResult, setDirectTestResult] = useState<any>(null);
  
  // Load recent logs on mount
  useEffect(() => {
    fetchLogs();
  }, []);
  
  const fetchLogs = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/error-log');
      const data = await response.json();
      setLogs(data.recent_logs || []);
    } catch (error) {
      console.error('Error fetching logs:', error);
    } finally {
      setLoading(false);
    }
  };
  
  // Generate test error using utility function
  const runTest = async () => {
    try {
      setLoading(true);
      const response = await generateTestError(customMessage);
      setResult(response);
      await fetchLogs();
    } catch (error) {
      console.error('Error generating test:', error);
      setResult({ error: String(error) });
    } finally {
      setLoading(false);
    }
  };
  
  // Check health of error logging system
  const checkHealth = async () => {
    try {
      setLoading(true);
      const health = await getErrorLogHealth();
      setResult(health);
    } catch (error) {
      console.error('Error checking health:', error);
      setResult({ error: String(error) });
    } finally {
      setLoading(false);
    }
  };
  
  // Log client error using utility
  const logError = async () => {
    try {
      setLoading(true);
      const success = await logClientError({
        query: 'UI-TEST-QUERY',
        errorMessage: customMessage,
        source: 'ui-debug-tool'
      });
      setResult({ success });
      await fetchLogs();
    } catch (error) {
      console.error('Error logging client error:', error);
      setResult({ error: String(error) });
    } finally {
      setLoading(false);
    }
  };
  
  // Test direct call to API endpoint
  const testDirectCall = async () => {
    try {
      setLoading(true);
      
      // Manual fetch to error log endpoint
      const response = await fetch('/api/error-log', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          query: 'DIRECT-API-CALL',
          error_message: `Direct API call at ${new Date().toISOString()}`,
          source: 'direct-test-call'
        })
      });
      
      const data = await response.json();
      setDirectTestResult(data);
      await fetchLogs();
    } catch (error) {
      console.error('Error with direct API call:', error);
      setDirectTestResult({ error: String(error) });
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Error Logging Debug Tool</h1>
      
      <div className="mb-6">
        <label className="block mb-2 font-medium">Custom Error Message</label>
        <input 
          type="text" 
          value={customMessage} 
          onChange={(e) => setCustomMessage(e.target.value)}
          className="w-full p-2 border rounded"
        />
      </div>
      
      <div className="flex flex-wrap gap-4 mb-8">
        <button 
          onClick={runTest}
          disabled={loading}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
        >
          Generate Test Error
        </button>
        
        <button 
          onClick={checkHealth}
          disabled={loading}
          className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50"
        >
          Check System Health
        </button>
        
        <button 
          onClick={logError}
          disabled={loading}
          className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 disabled:opacity-50"
        >
          Log Client Error
        </button>
        
        <button 
          onClick={testDirectCall}
          disabled={loading}
          className="px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600 disabled:opacity-50"
        >
          Test Direct API Call
        </button>
        
        <button 
          onClick={fetchLogs}
          disabled={loading}
          className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 disabled:opacity-50"
        >
          Refresh Logs
        </button>
      </div>
      
      {loading && <p className="mb-4">Loading...</p>}
      
      {result && (
        <div className="mb-8">
          <h2 className="text-xl font-bold mb-2">Test Result</h2>
          <div className="p-4 bg-gray-100 rounded overflow-auto max-h-60">
            <pre>{JSON.stringify(result, null, 2)}</pre>
          </div>
        </div>
      )}
      
      {directTestResult && (
        <div className="mb-8">
          <h2 className="text-xl font-bold mb-2">Direct API Call Result</h2>
          <div className="p-4 bg-gray-100 rounded overflow-auto max-h-60">
            <pre>{JSON.stringify(directTestResult, null, 2)}</pre>
          </div>
        </div>
      )}
      
      <div>
        <h2 className="text-xl font-bold mb-2">Recent Error Logs</h2>
        {logs.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full bg-white border">
              <thead>
                <tr>
                  <th className="py-2 px-4 border">Time</th>
                  <th className="py-2 px-4 border">Error Message</th>
                  <th className="py-2 px-4 border">Query</th>
                  <th className="py-2 px-4 border">Source</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id}>
                    <td className="py-2 px-4 border">{new Date(log.created_at).toLocaleString()}</td>
                    <td className="py-2 px-4 border">{log.error_message}</td>
                    <td className="py-2 px-4 border">{log.query}</td>
                    <td className="py-2 px-4 border">{log.source}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p>No error logs found</p>
        )}
      </div>
    </div>
  );
} 