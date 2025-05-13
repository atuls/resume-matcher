import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { extractResumeData, extractRedFlagData, ExtractedResumeData } from '@/lib/resume-data-extractor';
import { ScrollArea } from '@/components/ui/scroll-area';

const DataExtractionTestPage: React.FC = () => {
  const [resumeId, setResumeId] = useState('395a8706-7c15-4238-82ea-9823cedb824f');
  const [loading, setLoading] = useState(false);
  const [extractedData, setExtractedData] = useState<ExtractedResumeData | null>(null);
  const [redFlags, setRedFlags] = useState<string[]>([]);
  const [rawAnalysisData, setRawAnalysisData] = useState<any>(null);
  const [rawRedFlagData, setRawRedFlagData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const handleTest = async () => {
    if (!resumeId) return;
    
    setLoading(true);
    setError(null);
    
    try {
      // Fetch analysis data
      const analysisResponse = await fetch(`/api/resumes/${resumeId}/analysis`, {
        method: 'GET',
        credentials: 'include'
      });
      
      if (!analysisResponse.ok) {
        throw new Error(`Failed to fetch analysis: ${analysisResponse.status} ${analysisResponse.statusText}`);
      }
      
      const analysisData = await analysisResponse.json();
      setRawAnalysisData(analysisData);
      
      // Fetch red flag data
      const redFlagResponse = await fetch(`/api/resumes/${resumeId}/red-flag-analysis`, {
        method: 'GET',
        credentials: 'include'
      });
      
      if (!redFlagResponse.ok) {
        throw new Error(`Failed to fetch red flag analysis: ${redFlagResponse.status} ${redFlagResponse.statusText}`);
      }
      
      const redFlagData = await redFlagResponse.json();
      setRawRedFlagData(redFlagData);
      
      // Extract structured data
      const extractedResumeData = extractResumeData(analysisData);
      setExtractedData(extractedResumeData);
      
      // Extract red flags
      const extractedRedFlags = extractRedFlagData(redFlagData);
      setRedFlags(extractedRedFlags);
      
    } catch (error: any) {
      console.error("Error extracting data:", error);
      setError(error.message || 'Unknown error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Resume Data Extraction Test</h1>
      <p className="text-gray-600 mb-4">This page tests the extraction of structured data from the resume analysis API</p>
      
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
          <Button onClick={handleTest} disabled={loading}>
            {loading ? 'Testing...' : 'Test Extraction'}
          </Button>
        </div>
      </div>
      
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          <p><strong>Error:</strong> {error}</p>
        </div>
      )}
      
      {extractedData && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <Card>
            <CardHeader>
              <CardTitle>Extracted Skills</CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[200px]">
                {extractedData.skills.length > 0 ? (
                  <ul className="list-disc pl-6">
                    {extractedData.skills.map((skill, index) => (
                      <li key={index}>{skill}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-gray-500">No skills extracted</p>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle>Red Flags</CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[200px]">
                {redFlags.length > 0 ? (
                  <ul className="list-disc pl-6">
                    {redFlags.map((flag, index) => (
                      <li key={index} className="text-red-600">{flag}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-gray-500">No red flags extracted</p>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
          
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle>Work History</CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[200px]">
                {Array.isArray(extractedData.workHistory) && extractedData.workHistory.length > 0 ? (
                  <pre className="text-sm">{JSON.stringify(extractedData.workHistory, null, 2)}</pre>
                ) : (
                  <div>
                    <p className="font-semibold">Summary:</p>
                    <p className="whitespace-pre-line">{extractedData.summary}</p>
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
          
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle>Matching Score: {extractedData.score}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="w-full bg-gray-200 rounded-full h-4 mb-4">
                <div 
                  className="bg-blue-600 h-4 rounded-full"
                  style={{ width: `${extractedData.score}%` }}
                ></div>
              </div>
              
              <p className="text-sm text-gray-500 mt-2">Extracted from the analysis API</p>
            </CardContent>
          </Card>
        </div>
      )}
      
      {/* Debug section for raw data */}
      <div className="mt-8">
        <h2 className="text-xl font-bold mb-2">Raw API Responses (For Debugging)</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Raw Analysis Data</CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[300px]">
                {rawAnalysisData && (
                  <pre className="text-xs">{JSON.stringify(rawAnalysisData, null, 2)}</pre>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle>Raw Red Flag Data</CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[300px]">
                {rawRedFlagData && (
                  <pre className="text-xs">{JSON.stringify(rawRedFlagData, null, 2)}</pre>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default DataExtractionTestPage;