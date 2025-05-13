import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import { runAllTests } from '@/lib/analysis-test';

export default function AnalysisTestPage() {
  const [resumeId, setResumeId] = useState<string>('395a8706-7c15-4238-82ea-9823cedb824f');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<any>(null);

  const runTest = async () => {
    if (!resumeId) {
      setError('Please enter a resume ID');
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      const testResults = await runAllTests(resumeId);
      setResults(testResults);
      console.log('Test results:', testResults);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred while running tests');
      console.error('Test error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Run the test on initial load
  useEffect(() => {
    runTest();
  }, []);

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-2xl font-bold mb-4">Analysis Data Path Test</h1>
      
      <div className="mb-6">
        <div className="flex gap-2 mb-4">
          <Input 
            value={resumeId}
            onChange={(e) => setResumeId(e.target.value)}
            placeholder="Enter resume ID"
            className="flex-1"
          />
          <Button 
            onClick={runTest}
            disabled={isLoading}
          >
            {isLoading ? 'Running...' : 'Run Test'}
          </Button>
        </div>
        
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
      </div>
      
      {results && (
        <Tabs defaultValue="skills">
          <TabsList>
            <TabsTrigger value="skills">Skills</TabsTrigger>
            <TabsTrigger value="workHistory">Work History</TabsTrigger>
            <TabsTrigger value="redFlags">Red Flags</TabsTrigger>
            <TabsTrigger value="score">Score & Summary</TabsTrigger>
            <TabsTrigger value="rawPaths">All Data Paths</TabsTrigger>
          </TabsList>
          
          <TabsContent value="skills">
            <Card>
              <CardHeader>
                <CardTitle>Skills Data</CardTitle>
                <CardDescription>
                  Found at path: <code>{results.analysis.skills.foundPath}</code>
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="bg-gray-100 p-4 rounded-md overflow-auto max-h-[600px]">
                  <pre>{JSON.stringify(results.analysis.skills.data, null, 2)}</pre>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="workHistory">
            <Card>
              <CardHeader>
                <CardTitle>Work History Data</CardTitle>
                <CardDescription>
                  <div>Analysis Path: <code>{results.analysis.workHistory.foundPath}</code></div>
                  <div>Red Flag Path: <code>{results.redFlagAnalysis.workHistory.foundPath}</code></div>
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="analysis">
                  <TabsList className="mb-4">
                    <TabsTrigger value="analysis">From Analysis</TabsTrigger>
                    <TabsTrigger value="redFlag">From Red Flag Analysis</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="analysis">
                    <div className="bg-gray-100 p-4 rounded-md overflow-auto max-h-[600px]">
                      <pre>{JSON.stringify(results.analysis.workHistory.data, null, 2)}</pre>
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="redFlag">
                    <div className="bg-gray-100 p-4 rounded-md overflow-auto max-h-[600px]">
                      <pre>{JSON.stringify(results.redFlagAnalysis.workHistory.data, null, 2)}</pre>
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="redFlags">
            <Card>
              <CardHeader>
                <CardTitle>Red Flags Data</CardTitle>
                <CardDescription>
                  <div>Analysis Path: <code>{results.analysis.redFlags.foundPath}</code></div>
                  <div>Red Flag Path: <code>{results.redFlagAnalysis.redFlags.foundPath}</code></div>
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="analysis">
                  <TabsList className="mb-4">
                    <TabsTrigger value="analysis">From Analysis</TabsTrigger>
                    <TabsTrigger value="redFlag">From Red Flag Analysis</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="analysis">
                    <div className="bg-gray-100 p-4 rounded-md overflow-auto max-h-[600px]">
                      <pre>{JSON.stringify(results.analysis.redFlags.data, null, 2)}</pre>
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="redFlag">
                    <div className="bg-gray-100 p-4 rounded-md overflow-auto max-h-[600px]">
                      <pre>{JSON.stringify(results.redFlagAnalysis.redFlags.data, null, 2)}</pre>
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="score">
            <Card>
              <CardHeader>
                <CardTitle>Score & Summary</CardTitle>
                <CardDescription>
                  <div>Score Path: <code>{results.analysis.matchingScore.foundPath}</code></div>
                  <div>Summary Path: <code>{results.analysis.summary.foundPath}</code></div>
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h3 className="text-lg font-medium mb-2">Matching Score</h3>
                  <div className="bg-gray-100 p-4 rounded-md">
                    <span className="text-2xl font-bold">
                      {results.analysis.matchingScore.score}
                    </span>
                  </div>
                </div>
                
                <div>
                  <h3 className="text-lg font-medium mb-2">Summary</h3>
                  <div className="bg-gray-100 p-4 rounded-md overflow-auto max-h-[400px]">
                    <p className="whitespace-pre-wrap">{results.analysis.summary.text}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="rawPaths">
            <Card>
              <CardHeader>
                <CardTitle>All Data Paths</CardTitle>
                <CardDescription>
                  All attempted data paths and their values
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="skills">
                  <TabsList className="mb-4">
                    <TabsTrigger value="skills">Skills</TabsTrigger>
                    <TabsTrigger value="workHistory">Work History</TabsTrigger>
                    <TabsTrigger value="redFlags">Red Flags</TabsTrigger>
                    <TabsTrigger value="score">Score</TabsTrigger>
                    <TabsTrigger value="summary">Summary</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="skills">
                    <div className="bg-gray-100 p-4 rounded-md overflow-auto max-h-[600px]">
                      <pre>{JSON.stringify(results.analysis.allPaths.skills, null, 2)}</pre>
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="workHistory">
                    <div className="bg-gray-100 p-4 rounded-md overflow-auto max-h-[600px]">
                      <pre>{JSON.stringify(results.analysis.allPaths.workHistory, null, 2)}</pre>
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="redFlags">
                    <div className="bg-gray-100 p-4 rounded-md overflow-auto max-h-[600px]">
                      <pre>{JSON.stringify(results.analysis.allPaths.redFlags, null, 2)}</pre>
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="score">
                    <div className="bg-gray-100 p-4 rounded-md overflow-auto max-h-[600px]">
                      <pre>{JSON.stringify(results.analysis.allPaths.score, null, 2)}</pre>
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="summary">
                    <div className="bg-gray-100 p-4 rounded-md overflow-auto max-h-[600px]">
                      <pre>{JSON.stringify(results.analysis.allPaths.summary, null, 2)}</pre>
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}