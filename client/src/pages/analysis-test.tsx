import React, { useState, useEffect } from 'react';
import { testAnalysisDataPaths, testRedFlagDataPaths, runAllTests } from '@/lib/analysis-test';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { JsonView, defaultStyles } from 'react-json-view-lite';
import 'react-json-view-lite/dist/index.css';

const AnalysisTestPage: React.FC = () => {
  const [resumeId, setResumeId] = useState('395a8706-7c15-4238-82ea-9823cedb824f');
  const [analysisResults, setAnalysisResults] = useState<any>(null);
  const [redFlagResults, setRedFlagResults] = useState<any>(null);
  const [allTestResults, setAllTestResults] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('analysis');

  const handleTest = async () => {
    if (!resumeId) return;
    
    setLoading(true);
    try {
      const results = await testAnalysisDataPaths(resumeId);
      setAnalysisResults(results);
    } catch (error) {
      console.error("Error testing analysis data paths:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleRedFlagTest = async () => {
    if (!resumeId) return;
    
    setLoading(true);
    try {
      const results = await testRedFlagDataPaths(resumeId);
      setRedFlagResults(results);
    } catch (error) {
      console.error("Error testing red flag data paths:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleAllTests = async () => {
    if (!resumeId) return;
    
    setLoading(true);
    try {
      const results = await runAllTests(resumeId);
      setAllTestResults({
        analysis: results.analysis,
        redFlags: results.redFlagAnalysis
      });
    } catch (error) {
      console.error("Test error:", error);
    } finally {
      setLoading(false);
    }
  };

  const jsonViewStyles = {
    ...defaultStyles,
    container: 'pt-4'
  };

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Analysis Data Path Tester</h1>
      <div className="mb-4">
        <Label htmlFor="resumeId">Resume ID</Label>
        <div className="flex gap-2">
          <Input 
            id="resumeId" 
            value={resumeId} 
            onChange={(e) => setResumeId(e.target.value)} 
            placeholder="Enter resume ID"
            className="max-w-md"
          />
          <Button onClick={handleAllTests} disabled={loading}>
            {loading ? 'Testing...' : 'Run All Tests'}
          </Button>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          Default ID is for testing purposes - this is pre-configured with a known working resume ID
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="analysis">Analysis Paths</TabsTrigger>
          <TabsTrigger value="redFlags">Red Flag Paths</TabsTrigger>
          <TabsTrigger value="all">All Test Results</TabsTrigger>
        </TabsList>

        <TabsContent value="analysis">
          <Card>
            <CardHeader>
              <CardTitle>Analysis Data Paths</CardTitle>
            </CardHeader>
            <CardContent>
              <Button onClick={handleTest} disabled={loading}>
                {loading ? 'Testing...' : 'Test Analysis Paths'}
              </Button>
              
              {analysisResults && (
                <div className="mt-4">
                  <h3 className="text-lg font-semibold mb-2">Skills Path Result:</h3>
                  <div className="bg-muted p-2 rounded">
                    <p><strong>Found Path:</strong> {analysisResults.skills.foundPath}</p>
                  </div>
                  
                  <h4 className="text-md font-semibold mt-4 mb-2">Skills Data:</h4>
                  <ScrollArea className="h-[200px] w-full rounded-md border">
                    <div className="p-4">
                      <pre>{JSON.stringify(analysisResults.skills.data, null, 2)}</pre>
                    </div>
                  </ScrollArea>
                  
                  <h3 className="text-lg font-semibold mt-6 mb-2">Work History Path Result:</h3>
                  <div className="bg-muted p-2 rounded">
                    <p><strong>Found Path:</strong> {analysisResults.workHistory.foundPath}</p>
                  </div>
                  
                  <h4 className="text-md font-semibold mt-4 mb-2">Work History Data:</h4>
                  <ScrollArea className="h-[200px] w-full rounded-md border">
                    <div className="p-4">
                      <pre>{JSON.stringify(analysisResults.workHistory.data, null, 2)}</pre>
                    </div>
                  </ScrollArea>
                  
                  <h3 className="text-lg font-semibold mt-6 mb-2">Summary Path Result:</h3>
                  <div className="bg-muted p-2 rounded">
                    <p><strong>Found Path:</strong> {analysisResults.summary.foundPath}</p>
                  </div>
                  
                  <h4 className="text-md font-semibold mt-4 mb-2">Summary Data:</h4>
                  <ScrollArea className="h-[100px] w-full rounded-md border">
                    <div className="p-4">
                      <pre>{analysisResults.summary.text}</pre>
                    </div>
                  </ScrollArea>
                  
                  <h3 className="text-lg font-semibold mt-6 mb-2">Matching Score Path Result:</h3>
                  <div className="bg-muted p-2 rounded">
                    <p><strong>Found Path:</strong> {analysisResults.matchingScore.foundPath}</p>
                    <p><strong>Score:</strong> {analysisResults.matchingScore.score}</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="redFlags">
          <Card>
            <CardHeader>
              <CardTitle>Red Flag Data Paths</CardTitle>
            </CardHeader>
            <CardContent>
              <Button onClick={handleRedFlagTest} disabled={loading}>
                {loading ? 'Testing...' : 'Test Red Flag Paths'}
              </Button>
              
              {redFlagResults && (
                <div className="mt-4">
                  <h3 className="text-lg font-semibold mb-2">Red Flags Path Result:</h3>
                  <div className="bg-muted p-2 rounded">
                    <p><strong>Found Path:</strong> {redFlagResults.redFlags.foundPath}</p>
                  </div>
                  
                  <h4 className="text-md font-semibold mt-4 mb-2">Red Flags Data:</h4>
                  <ScrollArea className="h-[200px] w-full rounded-md border">
                    <div className="p-4">
                      <pre>{JSON.stringify(redFlagResults.redFlags.data, null, 2)}</pre>
                    </div>
                  </ScrollArea>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="all">
          <Card>
            <CardHeader>
              <CardTitle>All Test Results</CardTitle>
            </CardHeader>
            <CardContent>
              <Button onClick={handleAllTests} disabled={loading}>
                {loading ? 'Testing...' : 'Run All Tests'}
              </Button>
              
              {allTestResults && (
                <div className="mt-4">
                  <h3 className="text-lg font-semibold mb-2">Raw Data Structure:</h3>
                  <div className="mt-4 bg-white rounded-md border">
                    <ScrollArea className="h-[400px] w-full">
                      {allTestResults.analysis && (
                        <div className="p-4">
                          <JsonView data={allTestResults} style={jsonViewStyles} />
                        </div>
                      )}
                    </ScrollArea>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AnalysisTestPage;