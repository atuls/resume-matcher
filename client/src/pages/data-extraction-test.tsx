import React, { useState } from 'react';
import { extractResumeData } from '@/lib/resume-data-extractor';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, FileText, Code, Briefcase, Check, MoreHorizontal } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ResumeSkillsTab } from "@/components/ResumeSkillsTab";
import { ResumeWorkHistoryTab } from "@/components/ResumeWorkHistoryTab";

export default function DataExtractionTest() {
  const [jsonInput, setJsonInput] = useState('');
  const [extractedData, setExtractedData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const handleExtract = () => {
    try {
      setError(null);
      
      // Try to parse the input as JSON
      const parsedData = JSON.parse(jsonInput);
      
      // Use our extraction function
      const extracted = extractResumeData(parsedData);
      
      // Set the result
      setExtractedData(extracted);
      
      console.log("Extracted data:", extracted);
    } catch (err: any) {
      setError(err.message || "An error occurred during extraction");
      console.error("Error during extraction:", err);
    }
  };

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-2xl font-bold mb-6">Resume Data Extraction Test</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>JSON Input</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea 
              className="min-h-[400px] font-mono text-sm"
              value={jsonInput}
              onChange={(e) => setJsonInput(e.target.value)}
              placeholder='Paste AI response JSON here...'
            />
            
            <div className="mt-4 flex justify-end">
              <Button onClick={handleExtract}>
                Extract Data
              </Button>
            </div>
            
            {error && (
              <Alert className="mt-4 border-red-200 bg-red-50">
                <AlertCircle className="h-4 w-4 text-red-600" />
                <AlertDescription className="text-red-800">
                  {error}
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>Extracted Data</CardTitle>
          </CardHeader>
          <CardContent>
            {extractedData ? (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="font-medium text-lg">Extraction Results</h3>
                  <Badge variant="outline" className="ml-2">
                    Score: {extractedData.score}
                  </Badge>
                </div>
                
                <Tabs defaultValue="summary">
                  <TabsList className="mb-4">
                    <TabsTrigger value="summary">
                      <Check className="h-4 w-4 mr-2" />
                      Summary
                    </TabsTrigger>
                    <TabsTrigger value="skills">
                      <Code className="h-4 w-4 mr-2" />
                      Skills
                    </TabsTrigger>
                    <TabsTrigger value="work-history">
                      <Briefcase className="h-4 w-4 mr-2" />
                      Work History
                    </TabsTrigger>
                    <TabsTrigger value="raw">
                      <MoreHorizontal className="h-4 w-4 mr-2" />
                      Raw Data
                    </TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="summary">
                    <div className="border rounded-md p-4 overflow-auto max-h-[400px]">
                      <h4 className="font-medium mb-2">Summary</h4>
                      <p className="whitespace-pre-wrap">{extractedData.summary || "No summary extracted"}</p>
                      
                      <h4 className="font-medium mt-4 mb-2">Red Flags</h4>
                      {extractedData.redFlags && extractedData.redFlags.length > 0 ? (
                        <ul className="list-disc pl-5 space-y-1">
                          {extractedData.redFlags.map((flag: string, i: number) => (
                            <li key={i} className="text-red-600">{flag}</li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-gray-500 italic">No red flags extracted</p>
                      )}
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="skills">
                    <div className="border rounded-md p-4 overflow-auto max-h-[400px]">
                      {extractedData.skills && extractedData.skills.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {extractedData.skills.map((skill: string, i: number) => (
                            <Badge key={i} variant="secondary">{skill}</Badge>
                          ))}
                        </div>
                      ) : (
                        <p className="text-gray-500 italic">No skills extracted</p>
                      )}
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="work-history">
                    <div className="border rounded-md p-4 overflow-auto max-h-[400px]">
                      {extractedData.workHistory && extractedData.workHistory.length > 0 ? (
                        <div className="space-y-4">
                          {extractedData.workHistory.map((job: any, i: number) => (
                            <div key={i} className="border-b pb-3 last:border-b-0 last:pb-0">
                              <h4 className="font-medium">{job.company || job.title || 'Unnamed Role'}</h4>
                              {job.title && job.company && <p className="text-sm">{job.title} at {job.company}</p>}
                              {job.dates && <p className="text-sm text-gray-500">{job.dates}</p>}
                              {job.description && <p className="text-sm mt-2">{job.description}</p>}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-gray-500 italic">No work history extracted</p>
                      )}
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="raw">
                    <div className="border rounded-md p-4 bg-gray-50 overflow-auto max-h-[400px]">
                      <pre className="text-xs font-mono whitespace-pre-wrap">
                        {JSON.stringify(extractedData, null, 2)}
                      </pre>
                    </div>
                  </TabsContent>
                </Tabs>
              </div>
            ) : (
              <div className="flex items-center justify-center h-40 text-gray-400">
                <p>No data extracted yet. Paste JSON and click "Extract Data".</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}