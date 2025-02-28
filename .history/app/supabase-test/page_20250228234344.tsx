import SupabaseExample from '../../components/supabase-example'
import SupabaseServerExample from '../../components/supabase-server-example'

export default function SupabaseTestPage() {
  return (
    <div className="container mx-auto p-8">
      <h1 className="text-3xl font-bold mb-8">Supabase Integration Test</h1>
      
      <div className="mb-8">
        <h2 className="text-2xl font-semibold mb-4">Client-Side Integration</h2>
        <SupabaseExample />
      </div>
      
      <div>
        <h2 className="text-2xl font-semibold mb-4">Server-Side Integration</h2>
        <SupabaseServerExample />
      </div>
      
      <div className="mt-12 p-4 bg-gray-100 rounded-md">
        <h3 className="text-lg font-semibold mb-2">Next Steps</h3>
        <ul className="list-disc pl-6">
          <li className="mb-2">Create the necessary Supabase functions and tables as outlined in your search engine plan</li>
          <li className="mb-2">Enable the pgvector extension in Supabase for semantic search</li>
          <li className="mb-2">Implement the data fetching and embedding generation functionality</li>
          <li className="mb-2">Build the RAG pipeline with OpenAI integration</li>
        </ul>
      </div>
    </div>
  )
} 