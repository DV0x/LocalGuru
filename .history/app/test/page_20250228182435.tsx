'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { Input } from '@/components/ui/input';

export default function TestPage() {
  const [loading, setLoading] = useState(false);
  const [openaiResult, setOpenaiResult] = useState<any>(null);
  const [redditResult, setRedditResult] = useState<any>(null);
  const [vectorResult, setVectorResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [helloTest, setHelloTest] = useState<{ success: boolean; message?: string; error?: string } | null>(null);
  const [vectorQuery, setVectorQuery] = useState<string>('best places to visit in Italy');

  // Test the simple hello endpoint
  async function testHelloEndpoint() {
    try {
      const response = await fetch('/api/hello');
      if (!response.ok) {
        throw new Error(`API responded with status: ${response.status}`);
      }
      const data = await response.json();
      setHelloTest({ success: true, message: data.message });
    } catch (err: any) {
      console.error('Error testing hello API:', err);
      setHelloTest({ success: false, error: err.message });
    }
  }

  // Run the hello test on component mount
  useEffect(() => {
    testHelloEndpoint();
  }, []);

  async function testOpenAI() {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/openai-test');
      
      if (!response.ok) {
        throw new Error(`API responded with status: ${response.status}`);
      }
      
      const data = await response.json();
      setOpenaiResult(data);
    } catch (err: any) {
      console.error('Error testing OpenAI API:', err);
      setError(err.message || 'An unknown error occurred');
      setOpenaiResult(null);
    } finally {
      setLoading(false);
    }
  }

  async function testReddit() {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/reddit-test');
      
      if (!response.ok) {
        throw new Error(`API responded with status: ${response.status}`);
      }
      
      const data = await response.json();
      setRedditResult(data);
    } catch (err: any) {
      console.error('Error testing Reddit API:', err);
      setError(err.message || 'An unknown error occurred');
      setRedditResult(null);
    } finally {
      setLoading(false);
    }
  }

  async function testVectorSearch() {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/vector-test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: vectorQuery }),
      });
      
      if (!response.ok) {
        throw new Error(`API responded with status: ${response.status}`);
      }
      
      const data = await response.json();
      setVectorResult(data);
    } catch (err: any) {
      console.error('Error testing vector search:', err);
      setError(err.message || 'An unknown error occurred');
      setVectorResult(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="container mx-auto py-10 px-4">
      <h1 className="text-3xl font-bold mb-6">API Connection Test</h1>
      <p className="text-gray-500 dark:text-gray-400 mb-6">
        This page tests the connections to external APIs and database functionality to ensure everything is working correctly.
      </p>
      
      {/* Hello API Test */}
      {helloTest && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg">Basic API Test</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <p>API Routing:</p>
              {helloTest.success ? (
                <>
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  <span className="text-green-500">Working! Response: {helloTest.message}</span>
                </>
              ) : (
                <>
                  <XCircle className="h-5 w-5 text-red-500" />
                  <span className="text-red-500">Error: {helloTest.error}</span>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      )}
      
      <div className="flex gap-4 mb-6">
        <Button 
          onClick={testOpenAI} 
          disabled={loading}
          size="lg"
        >
          {loading ? 'Testing...' : 'Test OpenAI API'}
        </Button>
        
        <Button 
          onClick={testReddit} 
          disabled={loading}
          size="lg"
          variant="outline"
        >
          {loading ? 'Testing...' : 'Test Reddit API'}
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
          </CardHeader>
          <CardContent>
            <Skeleton className="h-24 w-full" />
          </CardContent>
        </Card>
      )}
      
      {openaiResult && (
        <div className="space-y-6 mb-6">
          <Card>
            <CardHeader>
              <CardTitle>OpenAI API Test Results</CardTitle>
              <CardDescription>
                Timestamp: {new Date(openaiResult.timestamp).toLocaleString()}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {/* OpenAI API Test Results */}
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="text-lg font-semibold">OpenAI API</h3>
                    {openaiResult.success ? (
                      <CheckCircle className="h-5 w-5 text-green-500" />
                    ) : (
                      <XCircle className="h-5 w-5 text-red-500" />
                    )}
                  </div>
                  
                  {openaiResult.success ? (
                    <div>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
                        Successfully connected to OpenAI API and generated a response.
                      </p>
                      <div className="bg-gray-100 dark:bg-gray-800 p-3 rounded-md">
                        <p className="text-sm">{openaiResult.data}</p>
                      </div>
                    </div>
                  ) : (
                    <div className="text-red-500">
                      Error: {openaiResult.error}
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
            <CardFooter>
              <p className="text-sm text-gray-500">
                {openaiResult.success 
                  ? "OpenAI API is working correctly!"
                  : "OpenAI API is not working. Please check your API key in the .env.local file."}
              </p>
            </CardFooter>
          </Card>
        </div>
      )}
      
      {redditResult && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Reddit API Test Results</CardTitle>
              <CardDescription>
                Timestamp: {new Date(redditResult.timestamp).toLocaleString()}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {/* Reddit API Test Results */}
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="text-lg font-semibold">Reddit API</h3>
                    {redditResult.success ? (
                      <CheckCircle className="h-5 w-5 text-green-500" />
                    ) : (
                      <XCircle className="h-5 w-5 text-red-500" />
                    )}
                  </div>
                  
                  {redditResult.success ? (
                    <div>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
                        Successfully connected to Reddit API and retrieved posts.
                      </p>
                      <div className="bg-gray-100 dark:bg-gray-800 p-3 rounded-md overflow-auto max-h-60">
                        <pre className="text-xs">
                          {JSON.stringify(redditResult.data, null, 2)}
                        </pre>
                      </div>
                    </div>
                  ) : (
                    <div className="text-red-500">
                      Error: {redditResult.error}
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
            <CardFooter>
              <p className="text-sm text-gray-500">
                {redditResult.success 
                  ? "Reddit API is working correctly!"
                  : "Reddit API is not working. Please check your credentials in the .env.local file."}
              </p>
            </CardFooter>
          </Card>
        </div>
      )}
      
      {openaiResult?.success && redditResult?.success && (
        <Alert className="mt-6">
          <CheckCircle className="h-4 w-4" />
          <AlertTitle>All APIs are working!</AlertTitle>
          <AlertDescription>
            You can now proceed with setting up the Supabase database for your project.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
} 