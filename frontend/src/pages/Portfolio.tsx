import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button'; // Assuming you use shadcn/ui based on your component list

export default function Portfolio() {
  const [portfolioData, setPortfolioData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchPortfolio = async () => {
      try {
        setIsLoading(true);
        // This will now hit your newly created backend endpoint
        const response = await fetch('/api/portfolio'); 
        
        if (!response.ok) {
          throw new Error('Failed to fetch portfolio');
        }
        
        const data = await response.json();
        setPortfolioData(data);
      } catch (err) {
        setError(err.message);
        console.error("Frontend Fetch Error:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchPortfolio();
  }, []);

  if (isLoading) {
    return <div className="p-8 text-center">Loading your portfolio...</div>;
  }

  // EMPTY STATE: If no portfolio data exists
  if (!portfolioData || portfolioData.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] border-2 border-dashed rounded-lg m-8 bg-gray-50/50">
        <h2 className="text-2xl font-semibold mb-2">No Portfolio Found</h2>
        <p className="text-gray-500 mb-6">You haven't uploaded any portfolio data yet.</p>
        <Button onClick={() => console.log("Open upload modal")}>
          Upload Portfolio
        </Button>
      </div>
    );
  }

  // REAL DATA STATE: If portfolio exists
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-6">Your Portfolio</h1>
      {/* Map through your actual portfolio data here */}
      <div className="grid gap-4">
        {portfolioData.map((item, index) => (
          <div key={index} className="p-4 border rounded shadow-sm">
            {/* Render real data fields based on your DB schema */}
            <p>{item.name}</p> 
          </div>
        ))}
      </div>
    </div>
  );
}