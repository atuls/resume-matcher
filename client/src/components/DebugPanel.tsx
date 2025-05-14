import React from 'react';
import { Button } from "@/components/ui/button";
import { parseRawResponse } from "@/lib/raw-response-parser";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Code, AlertTriangle, RefreshCw } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

interface DebugPanelProps {
  rawResponse?: any;
  resumeId?: string;
  analysis?: any;
  redFlagData?: any;
}

export function DebugPanel({ rawResponse, resumeId, analysis, redFlagData }: DebugPanelProps) {
  const [debugInfo, setDebugInfo] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Use the rawResponse prop, or extract it from analysis if not provided directly
  const actualRawResponse = rawResponse || (analysis?.rawResponse);

  const debugResponse = () => {
    try {
      console.log("Debug - Raw Response:", actualRawResponse);
      let info = "";
      
      // Type check
      info += `Raw response type: ${typeof actualRawResponse}\n\n`;
      
      if (typeof actualRawResponse === 'string') {
        // Check if it's a string that contains our known fields
        if (actualRawResponse.includes('"Skills":') || 
            actualRawResponse.includes('"Work_History":') || 
            actualRawResponse.includes('"Red_Flags":')) {
          info += "✅ String contains expected fields (Skills, Work_History, Red_Flags)\n";
        } else {
          info += "❌ String does not contain expected fields\n";
        }
        
        info += `String length: ${actualRawResponse.length}\n`;
        info += `First 100 chars: ${actualRawResponse.substring(0, 100)}...\n\n`;
        
        // Try to parse it
        try {
          const parsed = JSON.parse(actualRawResponse);
          info += "✅ Successfully parsed as JSON\n";
          info += `JSON keys: ${Object.keys(parsed).join(', ')}\n`;
          
          // Check for specific fields
          if (parsed.Skills) info += `✅ Found Skills array with ${parsed.Skills.length} items\n`;
          if (parsed.Work_History) info += `✅ Found Work_History array with ${parsed.Work_History.length} items\n`;
          if (parsed.Red_Flags) info += `✅ Found Red_Flags array with ${parsed.Red_Flags.length} items\n`;
          if (parsed.Summary) info += `✅ Found Summary\n`;
          if (parsed.matching_score) info += `✅ Found matching_score: ${parsed.matching_score}\n`;
        } catch (e: any) {
          info += `❌ Failed to parse as JSON: ${e.message}\n`;
        }
      } else if (typeof actualRawResponse === 'object' && actualRawResponse !== null) {
        info += `Object keys: ${Object.keys(actualRawResponse).join(', ')}\n\n`;
        
        // Check if it has parsedJson
        if (actualRawResponse.parsedJson) {
          info += "Object has parsedJson property\n";
          info += `parsedJson keys: ${Object.keys(actualRawResponse.parsedJson).join(', ')}\n\n`;
          
          // Check for specific fields
          if (actualRawResponse.parsedJson.Skills) 
            info += `✅ Found Skills array in parsedJson with ${actualRawResponse.parsedJson.Skills.length} items\n`;
          if (actualRawResponse.parsedJson.Work_History) 
            info += `✅ Found Work_History array in parsedJson with ${actualRawResponse.parsedJson.Work_History.length} items\n`;
          if (actualRawResponse.parsedJson.Red_Flags) 
            info += `✅ Found Red_Flags array in parsedJson with ${actualRawResponse.parsedJson.Red_Flags.length} items\n`;
          if (actualRawResponse.parsedJson.Summary) 
            info += `✅ Found Summary in parsedJson\n`;
          if (actualRawResponse.parsedJson.matching_score) 
            info += `✅ Found matching_score in parsedJson: ${actualRawResponse.parsedJson.matching_score}\n`;
        }
        
        // Check for direct properties
        if (actualRawResponse.Skills) 
          info += `✅ Found Skills array directly with ${actualRawResponse.Skills.length} items\n`;
        if (actualRawResponse.Work_History) 
          info += `✅ Found Work_History array directly with ${actualRawResponse.Work_History.length} items\n`;
        if (actualRawResponse.Red_Flags) 
          info += `✅ Found Red_Flags array directly with ${actualRawResponse.Red_Flags.length} items\n`;
        if (actualRawResponse.Summary) 
          info += `✅ Found Summary directly\n`;
        if (actualRawResponse.matching_score) 
          info += `✅ Found matching_score directly: ${actualRawResponse.matching_score}\n`;
      } else {
        info += "Unable to analyze this response type";
      }
      
      // Try to parse it with our parser
      try {
        const parsed = parseRawResponse(actualRawResponse);
        info += "\n\nPARSER RESULTS:\n";
        info += `Work History: ${parsed.workHistory.length} items\n`;
        info += `Skills: ${parsed.skills.length} items\n`;
        info += `Red Flags: ${parsed.redFlags.length} items\n`;
        info += `Summary: ${parsed.summary ? "Found" : "Not found"}\n`;
        info += `Score: ${parsed.score}\n`;
      } catch (e: any) {
        info += `\n\nParser error: ${e.message}\n`;
      }
      
      setDebugInfo(info);
    } catch (e: any) {
      setDebugInfo(`Error analyzing raw response: ${e.message}`);
    }
  };
  
  // Function to trigger a re-analysis of the resume
  const runReAnalysis = async () => {
    if (!resumeId) {
      setDebugInfo("Error: No resumeId provided");
      return;
    }
    
    setIsLoading(true);
    
    try {
      // Force a fresh analysis with forceRerun parameter
      await apiRequest(`/api/resumes/${resumeId}/analysis?forceRerun=true`, "POST");
      
      // Invalidate queries to refresh the UI
      queryClient.invalidateQueries({ queryKey: [`/api/resumes/${resumeId}/analysis`] });
      queryClient.invalidateQueries({ queryKey: [`/api/resumes/${resumeId}/red-flag-analysis`] });
      
      toast({
        title: "Re-analysis complete",
        description: "Resume analysis has been refreshed with the latest AI model and prompts.",
      });
      
      setDebugInfo("Re-analysis triggered. The page data will refresh momentarily.");
    } catch (error: any) {
      toast({
        title: "Analysis failed",
        description: error.message || "An unexpected error occurred",
        variant: "destructive",
      });
      
      setDebugInfo(`Error triggering re-analysis: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-4 mt-4 border-t pt-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Code className="h-5 w-5 text-blue-500" />
          <h3 className="text-sm font-medium">Response Debugger</h3>
        </div>
        
        <div className="flex items-center space-x-2">
          {resumeId && (
            <Button 
              variant="outline" 
              size="sm"
              onClick={runReAnalysis}
              disabled={isLoading}
              className="flex items-center bg-amber-50 hover:bg-amber-100 border-amber-200 hover:border-amber-300 text-amber-700"
            >
              {isLoading ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Running...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Re-analyze Resume
                </>
              )}
            </Button>
          )}
          
          <Button 
            variant="outline" 
            size="sm"
            onClick={debugResponse}
            className="flex items-center"
          >
            <Code className="h-4 w-4 mr-2" />
            Analyze Raw Response
          </Button>
        </div>
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
      
      {/* Raw Data Display */}
      {!debugInfo && actualRawResponse && (
        <div className="mt-4">
          <div className="text-sm font-medium mb-2">Raw Response Data</div>
          <div className="bg-slate-900 rounded-md overflow-auto max-h-96 p-3">
            <pre className="text-xs whitespace-pre-wrap font-mono text-green-400">
              {typeof actualRawResponse === 'string' 
                ? actualRawResponse 
                : JSON.stringify(actualRawResponse, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}