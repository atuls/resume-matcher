import React from 'react';
import { Button } from "@/components/ui/button";
import { parseRawResponse } from "@/lib/raw-response-parser";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Code, AlertTriangle } from "lucide-react";

interface DebugPanelProps {
  rawResponse: any;
}

export function DebugPanel({ rawResponse }: DebugPanelProps) {
  const [debugInfo, setDebugInfo] = React.useState<string | null>(null);

  const debugResponse = () => {
    try {
      console.log("Debug - Raw Response:", rawResponse);
      let info = "";
      
      // Type check
      info += `Raw response type: ${typeof rawResponse}\n\n`;
      
      if (typeof rawResponse === 'string') {
        // Check if it's a string that contains our known fields
        if (rawResponse.includes('"Skills":') || 
            rawResponse.includes('"Work_History":') || 
            rawResponse.includes('"Red_Flags":')) {
          info += "✅ String contains expected fields (Skills, Work_History, Red_Flags)\n";
        } else {
          info += "❌ String does not contain expected fields\n";
        }
        
        info += `String length: ${rawResponse.length}\n`;
        info += `First 100 chars: ${rawResponse.substring(0, 100)}...\n\n`;
        
        // Try to parse it
        try {
          const parsed = JSON.parse(rawResponse);
          info += "✅ Successfully parsed as JSON\n";
          info += `JSON keys: ${Object.keys(parsed).join(', ')}\n`;
          
          // Check for specific fields
          if (parsed.Skills) info += `✅ Found Skills array with ${parsed.Skills.length} items\n`;
          if (parsed.Work_History) info += `✅ Found Work_History array with ${parsed.Work_History.length} items\n`;
          if (parsed.Red_Flags) info += `✅ Found Red_Flags array with ${parsed.Red_Flags.length} items\n`;
          if (parsed.Summary) info += `✅ Found Summary\n`;
          if (parsed.matching_score) info += `✅ Found matching_score: ${parsed.matching_score}\n`;
        } catch (e) {
          info += `❌ Failed to parse as JSON: ${e.message}\n`;
        }
      } else if (typeof rawResponse === 'object' && rawResponse !== null) {
        info += `Object keys: ${Object.keys(rawResponse).join(', ')}\n\n`;
        
        // Check if it has parsedJson
        if (rawResponse.parsedJson) {
          info += "Object has parsedJson property\n";
          info += `parsedJson keys: ${Object.keys(rawResponse.parsedJson).join(', ')}\n\n`;
          
          // Check for specific fields
          if (rawResponse.parsedJson.Skills) 
            info += `✅ Found Skills array in parsedJson with ${rawResponse.parsedJson.Skills.length} items\n`;
          if (rawResponse.parsedJson.Work_History) 
            info += `✅ Found Work_History array in parsedJson with ${rawResponse.parsedJson.Work_History.length} items\n`;
          if (rawResponse.parsedJson.Red_Flags) 
            info += `✅ Found Red_Flags array in parsedJson with ${rawResponse.parsedJson.Red_Flags.length} items\n`;
          if (rawResponse.parsedJson.Summary) 
            info += `✅ Found Summary in parsedJson\n`;
          if (rawResponse.parsedJson.matching_score) 
            info += `✅ Found matching_score in parsedJson: ${rawResponse.parsedJson.matching_score}\n`;
        }
        
        // Check for direct properties
        if (rawResponse.Skills) 
          info += `✅ Found Skills array directly with ${rawResponse.Skills.length} items\n`;
        if (rawResponse.Work_History) 
          info += `✅ Found Work_History array directly with ${rawResponse.Work_History.length} items\n`;
        if (rawResponse.Red_Flags) 
          info += `✅ Found Red_Flags array directly with ${rawResponse.Red_Flags.length} items\n`;
        if (rawResponse.Summary) 
          info += `✅ Found Summary directly\n`;
        if (rawResponse.matching_score) 
          info += `✅ Found matching_score directly: ${rawResponse.matching_score}\n`;
      } else {
        info += "Unable to analyze this response type";
      }
      
      // Try to parse it with our parser
      try {
        const parsed = parseRawResponse(rawResponse);
        info += "\n\nPARSER RESULTS:\n";
        info += `Work History: ${parsed.workHistory.length} items\n`;
        info += `Skills: ${parsed.skills.length} items\n`;
        info += `Red Flags: ${parsed.redFlags.length} items\n`;
        info += `Summary: ${parsed.summary ? "Found" : "Not found"}\n`;
        info += `Score: ${parsed.score}\n`;
      } catch (e) {
        info += `\n\nParser error: ${e.message}\n`;
      }
      
      setDebugInfo(info);
    } catch (e) {
      setDebugInfo(`Error analyzing raw response: ${e.message}`);
    }
  };

  return (
    <div className="space-y-4 mt-4 border-t pt-4">
      <div className="flex items-center space-x-2">
        <Code className="h-5 w-5 text-blue-500" />
        <h3 className="text-sm font-medium">Response Debugger</h3>
        <Button 
          variant="outline" 
          size="sm"
          onClick={debugResponse}
        >
          Analyze Raw Response
        </Button>
      </div>
      
      {debugInfo && (
        <Alert className="bg-slate-50">
          <AlertTriangle className="h-4 w-4 text-blue-500" />
          <AlertDescription>
            <pre className="whitespace-pre-wrap text-xs font-mono bg-slate-100 p-2 rounded mt-2 max-h-96 overflow-auto">
              {debugInfo}
            </pre>
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}