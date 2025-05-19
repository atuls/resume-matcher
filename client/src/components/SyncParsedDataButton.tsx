import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface SyncParsedDataButtonProps {
  jobId?: string;
  onComplete?: () => void;
}

export function SyncParsedDataButton({ jobId, onComplete }: SyncParsedDataButtonProps) {
  const [isSyncing, setIsSyncing] = useState(false);
  const { toast } = useToast();

  const handleSync = async () => {
    setIsSyncing(true);
    
    try {
      const response = await fetch('/api/sync-parsed-data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          jobId: jobId || 'all'
        })
      });
      
      const data = await response.json();
      
      if (response.ok) {
        toast({
          title: "Sync complete",
          description: data.message || "Successfully synced parsed data",
          variant: "default"
        });
        
        if (onComplete) {
          onComplete();
        }
      } else {
        toast({
          title: "Sync failed",
          description: data.message || "Failed to sync parsed data",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error("Error syncing parsed data:", error);
      toast({
        title: "Sync error",
        description: "An error occurred while syncing parsed data",
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
          Syncing data...
        </>
      ) : (
        <>
          Sync Parsed Data
        </>
      )}
    </Button>
  );
}