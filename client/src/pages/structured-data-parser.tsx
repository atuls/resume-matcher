import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, RefreshCw, FileJson, Database } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { SyncParsedJsonButton } from '@/components/SyncParsedJsonButton';

export default function StructuredDataParser() {
  const [syncStatus, setSyncStatus] = useState<{
    total: number;
    processed: number;
    remaining: number;
    percentComplete: number;
  } | null>(null);
  
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  
  const fetchSyncStatus = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/sync-parsed-json/status');
      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }
      
      const data = await response.json();
      if (data.success) {
        setSyncStatus(data);
      }
    } catch (error) {
      console.error('Error fetching sync status:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch sync status information',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  useEffect(() => {
    fetchSyncStatus();
  }, []);
  
  const handleRefresh = () => {
    fetchSyncStatus();
  };
  
  return (
    <div className="container max-w-7xl mx-auto py-8 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Structured Data Parser</h1>
          <p className="text-muted-foreground">
            Process raw AI responses into structured parsedJson data for easy querying and visualization
          </p>
        </div>
      </div>
      
      <Tabs defaultValue="status">
        <TabsList>
          <TabsTrigger value="status">Sync Status</TabsTrigger>
          <TabsTrigger value="tools">Parser Tools</TabsTrigger>
        </TabsList>
        
        <TabsContent value="status" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>ParsedJSON Status</CardTitle>
              <CardDescription>
                View the current status of parsedJson field population and trigger sync operations
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {isLoading ? (
                <div className="flex items-center justify-center h-32">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : syncStatus ? (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-lg">Total Records</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-3xl font-bold">{syncStatus.total}</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-lg">Processed</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-3xl font-bold">{syncStatus.processed}</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-lg">Remaining</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-3xl font-bold">{syncStatus.remaining}</p>
                      </CardContent>
                    </Card>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h3 className="font-medium">Sync Progress</h3>
                      <Badge variant={syncStatus.percentComplete === 100 ? "default" : "secondary"}>
                        {syncStatus.percentComplete}% Complete
                      </Badge>
                    </div>
                    <Progress value={syncStatus.percentComplete} />
                  </div>
                </>
              ) : (
                <div className="text-center p-4">
                  <p>No status information available</p>
                </div>
              )}
            </CardContent>
            <CardFooter className="flex justify-between">
              <Button variant="outline" onClick={handleRefresh} className="flex items-center gap-2">
                <RefreshCw className="h-4 w-4" />
                Refresh Status
              </Button>
              <SyncParsedJsonButton onComplete={fetchSyncStatus} />
            </CardFooter>
          </Card>
        </TabsContent>
        
        <TabsContent value="tools" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Parser Tools</CardTitle>
              <CardDescription>
                Manage and process structured data from AI responses
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Process by Job</CardTitle>
                    <CardDescription>
                      Sync parsedJson for analysis results related to a specific job description
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">
                      Go to the job details page and use the "Sync Parsed Data" button to process
                      all analysis results for that job description.
                    </p>
                  </CardContent>
                  <CardFooter>
                    <Button variant="outline" className="w-full" asChild>
                      <a href="/jobs">
                        <Database className="mr-2 h-4 w-4" />
                        Go to Jobs Page
                      </a>
                    </Button>
                  </CardFooter>
                </Card>
                
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Process All Data</CardTitle>
                    <CardDescription>
                      Sync parsedJson for all analysis results in the database
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">
                      Process all analysis results. This operation runs in batches of 50 records at a time
                      to avoid overloading the database.
                    </p>
                  </CardContent>
                  <CardFooter>
                    <SyncParsedJsonButton onComplete={fetchSyncStatus} />
                  </CardFooter>
                </Card>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}