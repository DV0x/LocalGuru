'use client';

import { useState, FormEvent } from 'react';
import { useCsrfToken } from '@/hooks/use-csrf';

interface CsrfProtectedFormProps {
  endpoint: string;
  onSuccess?: (data: any) => void;
  onError?: (error: Error) => void;
  submitButtonText?: string;
  children: React.ReactNode;
}

/**
 * A form component that includes CSRF protection
 */
export function CsrfProtectedForm({
  endpoint,
  onSuccess,
  onError,
  submitButtonText = 'Submit',
  children
}: CsrfProtectedFormProps) {
  const { csrfToken, loading: csrfLoading, fetchWithCsrf } = useCsrfToken();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccess(false);
    
    try {
      // Get form data
      const formData = new FormData(e.currentTarget);
      const formValues = Object.fromEntries(formData.entries());
      
      // Submit form with CSRF token included
      const response = await fetchWithCsrf(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formValues),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Error: ${response.status}`);
      }
      
      // Handle success
      const data = await response.json();
      setSuccess(true);
      if (onSuccess) {
        onSuccess(data);
      }
    } catch (err) {
      // Handle error
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      if (onError && err instanceof Error) {
        onError(err);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="csrf-protected-form">
      {csrfLoading ? (
        <div className="text-gray-500">Loading security token...</div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Hidden field for developers to see the CSRF token (remove in production) */}
          {process.env.NODE_ENV === 'development' && (
            <div className="text-xs text-gray-500 mb-2 p-2 bg-gray-100 rounded overflow-hidden">
              <div>CSRF Token: {csrfToken ? `${csrfToken.substring(0, 10)}...` : 'Not loaded'}</div>
            </div>
          )}
          
          {/* Form content */}
          <div className="space-y-3">
            {children}
          </div>
          
          {/* Error message */}
          {error && (
            <div className="text-red-500 text-sm p-2 bg-red-50 rounded">
              {error}
            </div>
          )}
          
          {/* Success message */}
          {success && (
            <div className="text-green-500 text-sm p-2 bg-green-50 rounded">
              Form submitted successfully!
            </div>
          )}
          
          {/* Submit button */}
          <button
            type="submit"
            disabled={submitting || csrfLoading || !csrfToken}
            className={`px-4 py-2 rounded text-white ${
              submitting || csrfLoading || !csrfToken
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {submitting ? 'Submitting...' : submitButtonText}
          </button>
        </form>
      )}
    </div>
  );
} 