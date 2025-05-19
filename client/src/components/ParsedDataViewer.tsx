import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RawResponseViewer } from './RawResponseViewer';
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Info } from 'lucide-react';

/**
 * A component that allows users to paste raw response JSON and view the parsed structured data
 */
export function ParsedDataViewer() {
  const [jsonInput, setJsonInput] = useState('');
  const [parsedResponse, setParsedResponse] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Handle the parsing of the input JSON
  const handleParseJson = () => {
    try {
      // Clear any previous errors
      setError(null);
      
      // Parse the input JSON
      const parsedJson = JSON.parse(jsonInput);
      
      // Set the parsed response for display
      setParsedResponse(parsedJson);
    } catch (e) {
      // If there's an error parsing the JSON
      setError('Invalid JSON format. Please check your input and try again.');
      setParsedResponse(null);
    }
  };
  
  // Load the example data
  const loadExampleData = () => {
    try {
      // Fallback to static example data if fetch fails
      const exampleData = {
        "parsedData": {
          "skills": [
            "B2B sales",
            "Quota achievement",
            "Full sales cycle management",
            "Influencer marketing",
            "Social media management",
            "Martech solutions",
            "Consumer insights",
            "Social data analysis",
            "Pipeline management",
            "Client relationship building",
            "Team leadership",
            "Sales training",
            "Product demonstrations",
            "Outbound prospecting",
            "Strategic selling"
          ],
          "workHistory": [
            {
              "title": "Sr Growth Account Executive",
              "company": "Meltwater News, Inc",
              "endDate": "current",
              "location": "San Francisco, CA",
              "startDate": "April 2024",
              "description": "Team revenue lead in Q2 2024 after promotion. Organized team of 8 account managers to drive upsells across martech products. Led cross-functional workshops, managed end-to-end sales cycle, hit monthly quotas (110%+).",
              "isCurrentRole": "true",
              "durationMonths": 2
            },
            {
              "title": "Account Executive",
              "company": "Meltwater News, Inc",
              "endDate": "March 2024",
              "location": "San Francisco, CA",
              "startDate": "July 2023",
              "description": "Increased personal sales revenue 30% month over month. Attained 120% of monthly quota. Built sales pipe focused on net new logo across verticals. Led product demos and managed full sales cycle.",
              "isCurrentRole": "false",
              "durationMonths": 9
            },
            {
              "title": "Account Executive",
              "company": "Skeepers",
              "endDate": "June 2023",
              "location": "Remote",
              "startDate": "May 2022",
              "description": "Spearheaded sales strategy for new SAAS product. Increased client onboarding by 100% per quarter. Led SDR training sessions increasing demo bookings by 20%.",
              "isCurrentRole": "false",
              "durationMonths": 14
            }
          ],
          "redFlags": [
            "Employment gap from March 2020 to January 2021 (approximately 10 months) with no explanation provided",
            "Current role at Meltwater starting in April 2024 is very recent (only 2 months)",
            "No specific mention of experience with CRM systems as required in the job description"
          ],
          "summary": "This candidate is a strong match for the Brand Partnerships Manager position. With 6 years of quota-carrying sales experience in B2B revenue, they have consistently demonstrated high performance in sales roles related to influencer marketing, social media management, and martech solutions."
        },
        "scoreData": {
          "score": 85,
          "jobDescriptionId": "sample-job-id",
          "matchedAt": "2025-05-15T18:30:29.247Z"
        }
      };
      
      // Set the example data in the textarea
      setJsonInput(JSON.stringify(exampleData, null, 2));
      // Also parse it right away
      setParsedResponse(exampleData);
      // Clear any errors
      setError(null);
    } catch (error) {
      setError(`Error loading example data: ${error.message}`);
    }
  };
  
  return (
    <div className="container mx-auto p-4 max-w-4xl">
      <h1 className="text-2xl font-bold mb-6">Response Data Parser</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <Card>
          <CardHeader>
            <CardTitle>Input Raw Response JSON</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <Alert className="bg-blue-50 border-blue-200">
                <Info className="h-4 w-4 text-blue-600" />
                <AlertDescription className="text-blue-700">
                  Paste raw response JSON from the AI analysis or load an example.
                </AlertDescription>
              </Alert>
              
              <div className="space-y-2">
                <Label htmlFor="json-input">Raw Response JSON</Label>
                <Textarea
                  id="json-input"
                  value={jsonInput}
                  onChange={(e) => setJsonInput(e.target.value)}
                  placeholder="Paste raw response JSON here..."
                  className="font-mono text-xs h-[300px]"
                />
              </div>
              
              <div className="flex space-x-2">
                <Button onClick={handleParseJson}>
                  Parse JSON
                </Button>
                <Button variant="outline" onClick={loadExampleData}>
                  Load Example
                </Button>
              </div>
              
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
            </div>
          </CardContent>
        </Card>
        
        <div>
          <h2 className="text-lg font-semibold mb-4">Parsed Output</h2>
          {parsedResponse ? (
            <RawResponseViewer rawResponse={parsedResponse} title="Parsed Data" />
          ) : (
            <Card className="bg-gray-50">
              <CardContent className="p-6 text-center text-gray-500">
                <p>No data to display. Please parse some JSON first.</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}