import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Info, AlertCircle, FileJson, FileText } from "lucide-react";
import { extractParsedJson } from '../utils/responseParser';
import { ParsedJsonDisplay } from './ParsedJsonDisplay';

interface RawResponseViewerProps {
  rawResponse: any;
  title?: string;
  filterText?: string;
}

export function RawResponseViewer({ rawResponse, title = "Response Analysis", filterText = "" }: RawResponseViewerProps) {
  const [activeTab, setActiveTab] = useState("structured");
  
  // If no raw response provided
  if (!rawResponse) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Raw response missing</AlertTitle>
        <AlertDescription>
          No raw response data is available to parse.
        </AlertDescription>
      </Alert>
    );
  }
  
  // Extract the structured data
  const parsedData = extractParsedJson(rawResponse);
  
  // Check if we were able to parse any meaningful data
  const hasParsedData = 
    (parsedData.skills && parsedData.skills.length > 0) ||
    (parsedData.workHistory && parsedData.workHistory.length > 0) ||
    (parsedData.redFlags && parsedData.redFlags.length > 0) ||
    parsedData.summary;
  
  // Format the raw response JSON for display
  const formattedRawResponse = JSON.stringify(rawResponse, null, 2);
  
  return (
    <Card className="w-full shadow-sm">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="structured" className="flex items-center">
              <FileJson className="h-4 w-4 mr-2" />
              Structured Data
            </TabsTrigger>
            <TabsTrigger value="raw" className="flex items-center">
              <FileText className="h-4 w-4 mr-2" />
              Raw JSON
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="structured" className="mt-0">
            {hasParsedData ? (
              <ParsedJsonDisplay data={parsedData} />
            ) : (
              <Alert className="bg-yellow-50 border-yellow-200">
                <Info className="h-4 w-4 text-yellow-600" />
                <AlertTitle className="text-yellow-800">No structured data found</AlertTitle>
                <AlertDescription className="text-yellow-700">
                  The parser couldn't extract structured data from the raw response.
                  Try viewing the raw JSON to see the original response format.
                </AlertDescription>
              </Alert>
            )}
          </TabsContent>
          
          <TabsContent value="raw" className="mt-0">
            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
              <pre className="text-xs font-mono whitespace-pre-wrap break-all">
                {formattedRawResponse}
              </pre>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
      
      <CardFooter className="flex justify-end bg-gray-50 border-t">
        <div className="text-xs text-gray-500">
          {hasParsedData ? (
            <span className="flex items-center">
              <Info className="h-3 w-3 mr-1" />
              Successfully extracted structured data
            </span>
          ) : (
            <span className="flex items-center">
              <AlertCircle className="h-3 w-3 mr-1" />
              Unable to extract structured data
            </span>
          )}
        </div>
      </CardFooter>
    </Card>
  );
}