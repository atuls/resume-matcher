import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface SyncParsedJsonButtonProps {
  jobId?: string;
  onComplete?: () => void;
}

export function SyncParsedJsonButton({ jobId, onComplete }: SyncParsedJsonButtonProps) {
  const [isSyncing, setIsSyncing] = useState(false);
  const { toast } = useToast();
  
  const handleSync = async () => {
    setIsSyncing(true);
    
    try {
      // Determine the API endpoint based on whether a job ID was provided
      const endpoint = jobId 
        ? `/api/sync-parsed-json/${jobId}`
        : '/api/sync-parsed-json';
      
      // Call the API to start the sync process
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ limit: 50 }) // Process up to 50 records at a time
      });
      
      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }
      
      const data = await response.json();
      
      // Show success message
      toast({
        title: 'Sync Complete',
        description: `Successfully synced ${data.processed} records (${data.skipped} skipped).`,
      });
      
      // Call the completion callback if provided
      if (onComplete) {
        onComplete();
      }
    } catch (error) {
      console.error('Error syncing parsed JSON:', error);
      
      // Show error message
      toast({
        title: 'Sync Failed',
        description: 'There was an error syncing the parsed JSON data.',
        variant: 'destructive'
      });
    } finally {
      setIsSyncing(false);
    }
  };
  
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleSync}
      disabled={isSyncing}
      className="flex items-center gap-2"
    >
      {isSyncing ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          Syncing Data...
        </>
      ) : (
        <>Sync Parsed Data</>
      )}
    </Button>
  );
}