import React, { useEffect, useState } from 'react';
import { supabase } from '@/services/supabaseClient'; // Ensure this path matches your setup
import { Button } from '@/components/ui/button';

type Watchlist = {
  id: string | number;
  name: string;
  watchlist_items?: any[];
};

export default function Watchlists() {
  const [watchlists, setWatchlists] = useState<Watchlist[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchWatchlists();
  }, []);

  const fetchWatchlists = async () => {
    setIsLoading(true);
    
    // 1. Get the currently authenticated user
    const { data: authData } = await supabase.auth.getUser();
    
    if (authData?.user) {
      // 2. Fetch watchlists specific to this user ID
      const { data, error } = await supabase
        .from('watchlists')
        .select('*, watchlist_items(*)')
        .eq('user_id', authData.user.id);

      if (!error && data) {
        setWatchlists(data);
      } else {
        console.error("Error fetching watchlists:", error);
      }
    }
    
    setIsLoading(false);
  };

  const handleCreateWatchlist = async () => {
    // Boilerplate for inserting a new watchlist tied to the user
    const { data: authData } = await supabase.auth.getUser();
    if (!authData?.user) return;

    const { data, error } = await supabase
      .from('watchlists')
      .insert([
        { 
          user_id: authData.user.id, 
          name: 'My New Watchlist' 
        }
      ])
      .select();

    if (!error && data) {
      setWatchlists([...watchlists, ...data]);
    }
  };

  if (isLoading) {
    return <div className="p-8 text-center">Loading watchlists...</div>;
  }

  // EMPTY STATE
  if (watchlists.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] border-2 border-dashed rounded-lg m-8">
        <h2 className="text-2xl font-semibold mb-2">Nothing to show here</h2>
        <p className="text-gray-500 mb-6">Create a watchlist to start tracking stocks.</p>
        <Button onClick={handleCreateWatchlist}>
          Add into Watchlist
        </Button>
      </div>
    );
  }

  // REAL DATA STATE
  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Your Watchlists</h1>
        <Button onClick={handleCreateWatchlist}>Create New</Button>
      </div>
      
      <div className="grid gap-4">
        {watchlists.map((list) => (
          <div key={list.id} className="p-4 border rounded shadow-sm">
            <h3 className="font-semibold text-lg">{list.name}</h3>
            <p className="text-sm text-gray-500">
              {list.watchlist_items?.length || 0} items
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}