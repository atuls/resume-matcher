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
  
  // Safely extract raw response from various possible locations and formats
  const getRawResponse = () => {
    // Check if rawResponse is directly provided
    if (rawResponse) {
      console.log("Using directly provided rawResponse");
      return rawResponse;
    }
    
    // Check if analysis has a rawResponse field
    if (analysis?.rawResponse) {
      console.log("Using analysis.rawResponse");
      return analysis.rawResponse;
    }
    
    // Check alternative fields that might contain the raw response
    if (analysis?.raw_response) {
      console.log("Using analysis.raw_response");
      return analysis.raw_response;
    }
    
    // If analysis contains a direct response field
    if (analysis?.response) {
      console.log("Using analysis.response");
      return analysis.response;
    }
    
    // Fall back to using the entire analysis object as a last resort
    if (analysis) {
      console.log("Using entire analysis object as fallback");
      return analysis;
    }
    
    // Nothing found
    console.log("No raw response found in any location");
    return null;
  };
  
  const actualRawResponse = getRawResponse();

  const debugResponse = () => {
    try {
      console.log("Debug - Raw Response:", actualRawResponse);
      let info = "";
      
      // Type check
      info += `Raw response type: ${typeof actualRawResponse}\n\n`;
      
      // Handle case where actualRawResponse is undefined or null
      if (!actualRawResponse) {
        info += `No raw response data available\n\n`;
        info += "PARSER RESULTS:\n";
        info += "Work History: 0 items\n";
        info += "Skills: 0 items\n";
        info += "Red Flags: 0 items\n";
        info += "Summary: Not found\n";
        info += "Score: 0\n";
        
        setDebugInfo(info);
        return;
      }
      
      if (typeof actualRawResponse === 'string') {
        // Check if it's a string that contains our known fields (case insensitive)
        const lowerCaseStr = actualRawResponse.toLowerCase();
        if (lowerCaseStr.includes('"skills":') || 
            lowerCaseStr.includes('"work_history":') || 
            lowerCaseStr.includes('"red_flags":')) {
          info += "✅ String contains expected fields (skills, work_history, red_flags)\n";
        } else {
          info += "❌ String does not contain expected fields\n";
        }
        
        info += `String length: ${actualRawResponse.length}\n`;
        info += `First 100 chars: ${actualRawResponse.substring(0, 100)}...\n\n`;
        
        // Try to parse it
        try {
          // Normalize the string to handle common JSON issues
          const cleanJson = actualRawResponse.replace(/```json\s*|\s*```/g, '');
          
          const parsed = JSON.parse(cleanJson);
          info += "✅ Successfully parsed as JSON\n";
          info += `JSON keys: ${Object.keys(parsed).join(', ')}\n`;
          
          // Check for specific fields (case insensitive)
          const skills = parsed.Skills || parsed.skills || [];
          const workHistory = parsed.Work_History || parsed.work_history || parsed.workHistory || [];
          const redFlags = parsed.Red_Flags || parsed.red_flags || parsed.redFlags || [];
          const summary = parsed.Summary || parsed.summary || '';
          const score = parsed.matching_score || parsed.matchingScore || parsed.score || 0;
          
          if (skills.length) info += `✅ Found Skills array with ${skills.length} items\n`;
          if (workHistory.length) info += `✅ Found Work History array with ${workHistory.length} items\n`;
          if (redFlags.length) info += `✅ Found Red Flags array with ${redFlags.length} items\n`;
          if (summary) info += `✅ Found Summary\n`;
          if (score) info += `✅ Found score: ${score}\n`;
          
          info += "\nPARSER RESULTS:\n";
          info += `Work History: ${workHistory.length} items\n`;
          info += `Skills: ${skills.length} items\n`;
          info += `Red Flags: ${redFlags.length} items\n`;
          info += `Summary: ${summary ? 'Found' : 'Not found'}\n`;
          info += `Score: ${score}\n`;
        } catch (e: any) {
          info += `❌ Failed to parse as JSON: ${e.message}\n`;
          info += "\nPARSER RESULTS:\n";
          info += "Work History: 0 items\n";
          info += "Skills: 0 items\n";
          info += "Red Flags: 0 items\n";
          info += "Summary: Not found\n";
          info += "Score: 0\n";
        }
      } else if (typeof actualRawResponse === 'object' && actualRawResponse !== null) {
        info += `Object keys: ${Object.keys(actualRawResponse).join(', ')}\n\n`;
        
        // Extract fields using multiple possible property names
        let skills = [];
        let workHistory = [];
        let redFlags = [];
        let summary = '';
        let score = 0;
        
        // Check if it has parsedJson
        if (actualRawResponse.parsedJson) {
          info += "Object has parsedJson property\n";
          info += `parsedJson keys: ${Object.keys(actualRawResponse.parsedJson).join(', ')}\n\n`;
          
          const parsedJson = actualRawResponse.parsedJson;
          
          // Check for specific fields
          if (parsedJson.Skills || parsedJson.skills) {
            skills = parsedJson.Skills || parsedJson.skills;
            info += `✅ Found Skills array in parsedJson with ${skills.length} items\n`;
          }
          
          if (parsedJson.Work_History || parsedJson.work_history || parsedJson.workHistory) {
            workHistory = parsedJson.Work_History || parsedJson.work_history || parsedJson.workHistory;
            info += `✅ Found Work History array in parsedJson with ${workHistory.length} items\n`;
          }
          
          if (parsedJson.Red_Flags || parsedJson.red_flags || parsedJson.redFlags) {
            redFlags = parsedJson.Red_Flags || parsedJson.red_flags || parsedJson.redFlags;
            info += `✅ Found Red Flags array in parsedJson with ${redFlags.length} items\n`;
          }
          
          if (parsedJson.Summary || parsedJson.summary) {
            summary = parsedJson.Summary || parsedJson.summary;
            info += `✅ Found Summary in parsedJson\n`;
          }
          
          if (parsedJson.matching_score || parsedJson.matchingScore || parsedJson.score) {
            score = parsedJson.matching_score || parsedJson.matchingScore || parsedJson.score;
            info += `✅ Found score in parsedJson: ${score}\n`;
          }
        }
        
        // Check for direct properties with case-insensitive handling
        if (actualRawResponse.Skills || actualRawResponse.skills) {
          const skillsArray = actualRawResponse.Skills || actualRawResponse.skills;
          skills = skillsArray;
          info += `✅ Found Skills array directly with ${skillsArray.length} items\n`;
        }
        
        if (actualRawResponse.Work_History || actualRawResponse.work_history || actualRawResponse.workHistory) {
          const workHistoryArray = actualRawResponse.Work_History || actualRawResponse.work_history || actualRawResponse.workHistory;
          workHistory = workHistoryArray;
          info += `✅ Found Work History array directly with ${workHistoryArray.length} items\n`;
        }
        
        if (actualRawResponse.Red_Flags || actualRawResponse.red_flags || actualRawResponse.redFlags) {
          const redFlagsArray = actualRawResponse.Red_Flags || actualRawResponse.red_flags || actualRawResponse.redFlags;
          redFlags = redFlagsArray;
          info += `✅ Found Red Flags array directly with ${redFlagsArray.length} items\n`;
        }
        
        if (actualRawResponse.Summary || actualRawResponse.summary) {
          summary = actualRawResponse.Summary || actualRawResponse.summary;
          info += `✅ Found Summary directly\n`;
        }
        
        if (actualRawResponse.matching_score || actualRawResponse.matchingScore || actualRawResponse.score) {
          score = actualRawResponse.matching_score || actualRawResponse.matchingScore || actualRawResponse.score;
          info += `✅ Found score directly: ${score}\n`;
        }
        
        // Check if any results were found
        if (skills.length || workHistory.length || redFlags.length || summary || score) {
          info += "\nPARSER RESULTS:\n";
          info += `Work History: ${Array.isArray(workHistory) ? workHistory.length : 0} items\n`;
          info += `Skills: ${Array.isArray(skills) ? skills.length : 0} items\n`;
          info += `Red Flags: ${Array.isArray(redFlags) ? redFlags.length : 0} items\n`;
          info += `Summary: ${summary ? "Found" : "Not found"}\n`;
          info += `Score: ${score || 0}\n`;
        } else {
          info += "\nNo data found in any expected location\n";
          
          // Try the general parser as a fallback
          try {
            const parsed = parseRawResponse(actualRawResponse);
            info += "\nPARSER RESULTS (via fallback parser):\n";
            info += `Work History: ${parsed.workHistory.length} items\n`;
            info += `Skills: ${parsed.skills.length} items\n`;
            info += `Red Flags: ${parsed.redFlags.length} items\n`;
            info += `Summary: ${parsed.summary ? "Found" : "Not found"}\n`;
            info += `Score: ${parsed.score}\n`;
          } catch (e: any) {
            info += `\nFallback parser error: ${e.message}\n`;
            info += "\nPARSER RESULTS:\n";
            info += "Work History: 0 items\n";
            info += "Skills: 0 items\n";
            info += "Red Flags: 0 items\n";
            info += "Summary: Not found\n";
            info += "Score: 0\n";
          }
        }
      } else {
        info += "Unable to analyze this response type\n";
        info += "\nPARSER RESULTS:\n";
        info += "Work History: 0 items\n";
        info += "Skills: 0 items\n";
        info += "Red Flags: 0 items\n";
        info += "Summary: Not found\n";
        info += "Score: 0\n";
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
      console.log("Starting re-analysis for resume:", resumeId);
      
      // Use the fetch API directly with the correct URL and method
      const response = await fetch(`/api/resumes/${resumeId}/analysis?forceRerun=true`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        credentials: "include"
      });
      
      if (!response.ok) {
        throw new Error(`Analysis failed with status: ${response.status} ${response.statusText}`);
      }
      
      // Invalidate queries to refresh the UI
      queryClient.invalidateQueries({ queryKey: [`/api/resumes/${resumeId}/analysis`] });
      queryClient.invalidateQueries({ queryKey: [`/api/resumes/${resumeId}/red-flag-analysis`] });
      
      toast({
        title: "Re-analysis complete",
        description: "Resume analysis has been refreshed with the latest AI model and prompts.",
      });
      
      setDebugInfo("Re-analysis triggered. The page data will refresh momentarily.");
    } catch (error: any) {
      console.error("Re-analysis error:", error);
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
      {!debugInfo && (
        <div className="mt-4">
          <div className="text-sm font-medium mb-2">Raw Response Data</div>
          
          {actualRawResponse ? (
            <div className="bg-slate-900 rounded-md overflow-auto max-h-96 p-3">
              <pre className="text-xs whitespace-pre-wrap font-mono text-green-400">
                {typeof actualRawResponse === 'string' 
                  ? actualRawResponse 
                  : JSON.stringify(actualRawResponse, null, 2)}
              </pre>
            </div>
          ) : (
            <div className="p-4 border border-yellow-300 bg-yellow-50 rounded-md">
              <p className="text-yellow-700 text-sm">
                No raw response data available. Use the "Re-analyze Resume" button to generate 
                a fresh analysis with structured data.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}