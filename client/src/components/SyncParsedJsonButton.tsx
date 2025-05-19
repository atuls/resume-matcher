import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from '@/lib/queryClient';

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
      // Different endpoints based on whether we have a job ID
      const endpoint = jobId 
        ? `/api/sync-parsed-json/${jobId}` 
        : '/api/sync-parsed-json';
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          limit: 50 // Process 50 records at a time
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        toast({
          title: "Sync complete",
          description: data.message,
          variant: "default"
        });
        
        // Call the onComplete callback if provided
        if (onComplete) {
          onComplete();
        }
      } else {
        toast({
          title: "Sync failed",
          description: data.message || "Failed to sync parsed JSON data",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error("Error syncing parsed JSON:", error);
      toast({
        title: "Sync error",
        description: "An error occurred while syncing parsed JSON data",
        variant: "destructive"
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
    >
      {isSyncing ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Syncing...
        </>
      ) : (
        <>
          Sync Parsed Data
        </>
      )}
    </Button>
  );
}