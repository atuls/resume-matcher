import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { AlertCircle, Check, RotateCw } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { ScrollArea } from '@/components/ui/scroll-area';

interface BatchProcessingResult {
  message: string;
  successful: number;
  failed: number;
  total: number;
  totalPending?: number;
  totalUnprocessed?: number;
  processedIds: string[];
  failedIds: string[];
  nextOffset?: number;
}

export default function AdminBatchProcessing() {
  const [batchSize, setBatchSize] = useState(10);
  const [offset, setOffset] = useState(0);
  const [isPendingProcessing, setIsPendingProcessing] = useState(false);
  const [isUnprocessedProcessing, setIsUnprocessedProcessing] = useState(false);
  const [pendingResult, setPendingResult] = useState<BatchProcessingResult | null>(null);
  const [unprocessedResult, setUnprocessedResult] = useState<BatchProcessingResult | null>(null);
  const [activeTab, setActiveTab] = useState('pending');

  // Process a batch of pending analyses (with status="pending")
  const processPendingBatch = async () => {
    setIsPendingProcessing(true);
    try {
      const result = await apiRequest<BatchProcessingResult>('/api/admin/process-all-analysis', {
        method: 'POST',
        body: JSON.stringify({ limit: batchSize, offset }),
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      setPendingResult(result);
      // Update offset for next batch
      if (result.nextOffset) {
        setOffset(result.nextOffset);
      }
    } catch (error) {
      console.error('Error processing pending analyses:', error);
    } finally {
      setIsPendingProcessing(false);
    }
  };

  // Process a batch of unprocessed analyses (with raw response but no parsed fields)
  const processUnprocessedBatch = async () => {
    setIsUnprocessedProcessing(true);
    try {
      const result = await apiRequest<BatchProcessingResult>('/api/admin/batch-process-unprocessed', {
        method: 'POST',
        body: JSON.stringify({ limit: batchSize }),
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      setUnprocessedResult(result);
    } catch (error) {
      console.error('Error processing unprocessed analyses:', error);
    } finally {
      setIsUnprocessedProcessing(false);
    }
  };

  const calculateProgress = (result: BatchProcessingResult | null, type: 'pending' | 'unprocessed') => {
    if (!result) return 0;
    
    if (type === 'pending' && result.totalPending) {
      return Math.floor((result.successful / result.totalPending) * 100);
    } else if (type === 'unprocessed' && result.totalUnprocessed) {
      return Math.floor((result.successful / result.totalUnprocessed) * 100);
    }
    
    return 0;
  };

  const renderResults = (result: BatchProcessingResult | null, type: 'pending' | 'unprocessed') => {
    if (!result) return null;
    
    const totalRemaining = type === 'pending' 
      ? (result.totalPending || 0) - result.successful 
      : (result.totalUnprocessed || 0) - result.successful;
    
    return (
      <div className="space-y-4">
        <Alert variant={result.failed > 0 ? "destructive" : "default"}>
          <AlertTitle className="flex items-center">
            {result.failed > 0 ? <AlertCircle className="h-4 w-4 mr-2" /> : <Check className="h-4 w-4 mr-2" />}
            Batch Processing Result
          </AlertTitle>
          <AlertDescription>
            {result.message}
          </AlertDescription>
        </Alert>
        
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-gray-500">
            <span>Progress</span>
            <span>{calculateProgress(result, type)}%</span>
          </div>
          <Progress value={calculateProgress(result, type)} className="h-2" />
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-green-50 p-3 rounded border border-green-200">
            <div className="text-sm font-medium text-green-800">Successful</div>
            <div className="text-2xl font-bold text-green-600">{result.successful}</div>
          </div>
          
          <div className="bg-red-50 p-3 rounded border border-red-200">
            <div className="text-sm font-medium text-red-800">Failed</div>
            <div className="text-2xl font-bold text-red-600">{result.failed}</div>
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-blue-50 p-3 rounded border border-blue-200">
            <div className="text-sm font-medium text-blue-800">Total Processed</div>
            <div className="text-2xl font-bold text-blue-600">{result.total}</div>
          </div>
          
          <div className="bg-amber-50 p-3 rounded border border-amber-200">
            <div className="text-sm font-medium text-amber-800">Remaining</div>
            <div className="text-2xl font-bold text-amber-600">{totalRemaining}</div>
          </div>
        </div>
        
        {result.failedIds.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-sm font-medium">Failed IDs ({result.failedIds.length})</h3>
            <ScrollArea className="h-32 rounded-md border p-2">
              <div className="text-xs font-mono">
                {result.failedIds.map((id, index) => (
                  <div key={index} className="py-1 border-b border-gray-100 last:border-b-0">
                    {id}
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}
        
        {type === 'pending' && result.totalPending && result.totalPending > 0 && result.nextOffset !== undefined && (
          <Button 
            onClick={processPendingBatch} 
            disabled={isPendingProcessing}
            variant="outline"
            className="w-full"
          >
            {isPendingProcessing ? (
              <>
                <RotateCw className="mr-2 h-4 w-4 animate-spin" />
                Processing Next Batch...
              </>
            ) : (
              <>
                Process Next Batch (Offset: {result.nextOffset})
              </>
            )}
          </Button>
        )}
      </div>
    );
  };

  return (
    <div className="container mx-auto p-4 max-w-5xl">
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Admin Batch Processing</h1>
        <p className="text-gray-600">Process analysis records in batches with controls for batch size and pagination.</p>

        <Tabs defaultValue="pending" className="w-full" onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="pending">Process Pending Records</TabsTrigger>
            <TabsTrigger value="unprocessed">Process Unprocessed Records</TabsTrigger>
          </TabsList>
          
          <TabsContent value="pending" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Process Pending Analysis Records</CardTitle>
                <CardDescription>
                  Process analysis records with "pending" parsing status in batches
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center space-x-4">
                  <div className="flex-1">
                    <label className="text-sm font-medium mb-1 block">Batch Size</label>
                    <Input 
                      type="number" 
                      value={batchSize} 
                      onChange={(e) => setBatchSize(Number(e.target.value))}
                      min={1}
                      max={100}
                    />
                  </div>
                  <div className="flex-1">
                    <label className="text-sm font-medium mb-1 block">Offset</label>
                    <Input 
                      type="number" 
                      value={offset} 
                      onChange={(e) => setOffset(Number(e.target.value))}
                      min={0}
                    />
                  </div>
                </div>
                
                {renderResults(pendingResult, 'pending')}
              </CardContent>
              <CardFooter>
                <Button 
                  onClick={processPendingBatch} 
                  disabled={isPendingProcessing}
                  className="w-full"
                >
                  {isPendingProcessing ? (
                    <>
                      <RotateCw className="mr-2 h-4 w-4 animate-spin" />
                      Processing Batch...
                    </>
                  ) : (
                    'Process Batch of Pending Records'
                  )}
                </Button>
              </CardFooter>
            </Card>
          </TabsContent>
          
          <TabsContent value="unprocessed" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Process Unprocessed Analysis Records</CardTitle>
                <CardDescription>
                  Process analysis records with raw response but no parsed fields
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-1 block">Batch Size</label>
                  <Input 
                    type="number" 
                    value={batchSize} 
                    onChange={(e) => setBatchSize(Number(e.target.value))}
                    min={1}
                    max={100}
                  />
                </div>
                
                {renderResults(unprocessedResult, 'unprocessed')}
              </CardContent>
              <CardFooter>
                <Button 
                  onClick={processUnprocessedBatch} 
                  disabled={isUnprocessedProcessing}
                  className="w-full"
                >
                  {isUnprocessedProcessing ? (
                    <>
                      <RotateCw className="mr-2 h-4 w-4 animate-spin" />
                      Processing Batch...
                    </>
                  ) : (
                    'Process Batch of Unprocessed Records'
                  )}
                </Button>
              </CardFooter>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}