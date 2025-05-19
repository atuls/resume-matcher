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
    fetch('/api_response.json')
      .then(response => {
        if (!response.ok) {
          throw new Error('Failed to load example data');
        }
        return response.json();
      })
      .then(data => {
        // Set the example data in the textarea
        setJsonInput(JSON.stringify(data, null, 2));
        // Also parse it right away
        setParsedResponse(data);
        // Clear any errors
        setError(null);
      })
      .catch(error => {
        setError(`Error loading example data: ${error.message}`);
      });
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