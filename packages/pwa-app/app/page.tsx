import SupabaseExample from './components/supabase-example';
import { Home, Search, Bookmark, User, MapPin } from 'lucide-react';
import { Button } from './components/ui/button';

export default function PwaHomePage() {
  return (
    <main className="px-4 py-6">
      <header className="mb-6">
        <h1 className="text-2xl font-bold mb-2">LocalGuru Mobile</h1>
        <p className="text-sm text-gray-600">Your mobile companion for local recommendations</p>
        
        <div className="mt-4">
          <Button className="flex items-center gap-2 text-sm" variant="outline" size="sm">
            <MapPin className="h-4 w-4" />
            <span>San Francisco</span>
          </Button>
        </div>
      </header>
      
      <SupabaseExample />
      
      {/* Mobile-optimized navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-2 flex justify-around items-center mt-8">
        <button className="p-2 flex flex-col items-center text-primary">
          <Home className="h-6 w-6" />
          <span className="text-xs mt-1">Home</span>
        </button>
        <button className="p-2 flex flex-col items-center text-gray-500">
          <Search className="h-6 w-6" />
          <span className="text-xs mt-1">Search</span>
        </button>
        <button className="p-2 flex flex-col items-center text-gray-500">
          <Bookmark className="h-6 w-6" />
          <span className="text-xs mt-1">Saves</span>
        </button>
        <button className="p-2 flex flex-col items-center text-gray-500">
          <User className="h-6 w-6" />
          <span className="text-xs mt-1">Profile</span>
        </button>
      </nav>
      
      {/* Bottom padding to account for fixed nav */}
      <div className="pb-20"></div>
    </main>
  );
} 