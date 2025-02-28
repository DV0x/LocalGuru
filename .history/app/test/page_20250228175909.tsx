'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { CheckCircle, XCircle, AlertCircle } from 'lucide-react';

export default function TestPage() {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  async function runTest() {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/test');
      
      if (!response.ok) {
        throw new Error(`API responded with status: ${response.status}`);
      }
      
      const data = await response.json();
      setResults(data);
    } catch (err: any) {
      setError(err.message || 'An unknown error occurred');
      setResults(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="container mx-auto py-10 px-4">
      <h1 className="text-3xl font-bold mb-6">API Connection Test</h1>
      <p className="text-gray-500 dark:text-gray-400 mb-6">
        This page tests the connections to external APIs (Reddit and OpenAI) to ensure your credentials are working correctly.
      </p>
      
      <div className="mb-6">
        <Button 
          onClick={runTest} 
          disabled={loading}
          size="lg"
        >
          {loading ? 'Testing APIs...' : 'Run API Tests'}
        </Button>
      </div>
      
      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      
      {loading && (
        <Card className="mb-6">
          <CardHeader>
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-24 w-full mb-2" />
            <Skeleton className="h-24 w-full" />
          </CardContent>
        </Card>
      )}
      
      {results && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Test Results</CardTitle>
              <CardDescription>
                Timestamp: {new Date(results.timestamp).toLocaleString()}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {/* Reddit API Test Results */}
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="text-lg font-semibold">Reddit API</h3>
                    {results.results.reddit.success ? (
                      <CheckCircle className="h-5 w-5 text-green-500" />
                    ) : (
                      <XCircle className="h-5 w-5 text-red-500" />
                    )}
                  </div>
                  
                  {results.results.reddit.success ? (
                    <div>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
                        Successfully connected to Reddit API and retrieved posts.
                      </p>
                      <div className="bg-gray-100 dark:bg-gray-800 p-3 rounded-md overflow-auto max-h-60">
                        <pre className="text-xs">
                          {JSON.stringify(results.results.reddit.data, null, 2)}
                        </pre>
                      </div>
                    </div>
                  ) : (
                    <div className="text-red-500">
                      Error: {results.results.reddit.error}
                    </div>
                  )}
                </div>
                
                <Separator />
                
                {/* OpenAI API Test Results */}
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="text-lg font-semibold">OpenAI API</h3>
                    {results.results.openai.success ? (
                      <CheckCircle className="h-5 w-5 text-green-500" />
                    ) : (
                      <XCircle className="h-5 w-5 text-red-500" />
                    )}
                  </div>
                  
                  {results.results.openai.success ? (
                    <div>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
                        Successfully connected to OpenAI API and generated a response.
                      </p>
                      <div className="bg-gray-100 dark:bg-gray-800 p-3 rounded-md">
                        <p className="text-sm">{results.results.openai.data}</p>
                      </div>
                    </div>
                  ) : (
                    <div className="text-red-500">
                      Error: {results.results.openai.error}
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
            <CardFooter>
              <p className="text-sm text-gray-500">
                If all tests pass, your API credentials are configured correctly.
              </p>
            </CardFooter>
          </Card>
        </div>
      )}
    </div>
  );
} 