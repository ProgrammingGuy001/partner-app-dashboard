// components/CacheDebugger.tsx
import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';

export const CacheDebugger: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const queryClient = useQueryClient();
  
  const printCache = () => {
    const cache = queryClient.getQueryCache();
    const queries = cache.getAll();
    
    console.log('=== React Query Cache Debug ===');
    console.log(`Total cached queries: ${queries.length}`);
    
    queries.forEach((query, index) => {
      console.log(`\nQuery ${index + 1}:`);
      console.log('Key:', query.queryKey);
      console.log('State:', query.state);
      console.log('Data:', query.state.data);
      console.log('Updated at:', new Date(query.state.dataUpdatedAt).toLocaleTimeString());
      console.log('Stale:', query.isStale());
    });
  };
  
  const clearCache = () => {
    queryClient.clear();
    console.log('Cache cleared');
  };
  
  if (!isOpen) {
    return (
      <Button 
        onClick={() => setIsOpen(true)}
        variant="outline"
        size="sm"
        className="fixed bottom-4 right-4 z-50"
      >
        Debug Cache
      </Button>
    );
  }
  
  return (
    <Card className="fixed bottom-4 right-4 w-96 max-h-96 z-50">
      <CardHeader className="pb-3">
        <div className="flex justify-between items-center">
          <CardTitle className="text-sm">Cache Debugger</CardTitle>
          <Button 
            onClick={() => setIsOpen(false)} 
            size="sm" 
            variant="ghost"
          >
            ✕
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex gap-2 mb-4">
          <Button onClick={printCache} size="sm" variant="outline">
            Log Cache
          </Button>
          <Button onClick={clearCache} size="sm" variant="destructive">
            Clear Cache
          </Button>
        </div>
        
        <ScrollArea className="h-48">
          <pre className="text-xs">
            {JSON.stringify(
              queryClient.getQueryCache().getAll().map(q => ({
                key: q.queryKey,
                stale: q.isStale(),
                updated: new Date(q.state.dataUpdatedAt).toLocaleTimeString(),
              })),
              null,
              2
            )}
          </pre>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};