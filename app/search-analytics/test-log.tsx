'use client';

import { useState } from 'react';

export default function TestSearchLog() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const handleTestLog = async () => {
    setIsSubmitting(true);
    setResult(null);
    
    try {
      const response = await fetch('/api/test-search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: 'test analytics query',
          intent: 'test',
          vectorWeight: 0.7,
          textWeight: 0.3,
          efSearch: 300,
          durationMs: 150,
          resultCount: 5,
          timedOut: false,
          source: 'analytics-test'
        }),
      });
      
      if (response.ok) {
        setResult('Test search log successfully recorded. Refresh the page to see it in results.');
      } else {
        const errorText = await response.text();
        setResult(`Error: ${errorText}`);
      }
    } catch (error) {
      setResult(`Error: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsSubmitting(false);
    }
  };
  
  return (
    <div className="mt-6 p-4 bg-white rounded shadow">
      <h2 className="text-lg font-semibold mb-4">Test Search Logging</h2>
      <p className="mb-4 text-gray-600">
        Use this to test if search logging is working correctly. 
        It will add a test record to the search_performance_logs table.
      </p>
      
      <button 
        onClick={handleTestLog}
        disabled={isSubmitting}
        className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md disabled:opacity-50"
      >
        {isSubmitting ? 'Submitting...' : 'Add Test Search Log'}
      </button>
      
      {result && (
        <div className={`mt-4 p-3 rounded ${result.startsWith('Error') ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
          {result}
        </div>
      )}
    </div>
  );
} 