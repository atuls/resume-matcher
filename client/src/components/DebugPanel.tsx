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
  const [isProcessing, setIsProcessing] = React.useState(false);
  const [foundAnalysisId, setFoundAnalysisId] = React.useState<string | null>(null);
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

  // Function to save parsed results to the database
  const saveAnalysisResults = async (analysisId: string) => {
    try {
      const response = await fetch(`/api/analysis-results/${analysisId}/process`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error(`Failed to save analysis results: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log("Analysis results saved successfully:", data);
      
      // Invalidate queries to refresh the UI
      queryClient.invalidateQueries({ queryKey: [`/api/resumes/${resumeId}/analysis`] });
      
      toast({
        title: "Analysis processed",
        description: "Raw response has been parsed and saved to the database.",
      });
      
      return true;
    } catch (error) {
      console.error("Error saving analysis results:", error);
      toast({
        title: "Processing failed",
        description: error instanceof Error ? error.message : "Failed to save analysis results",
        variant: "destructive",
      });
      return false;
    }
  };

  const debugResponse = async () => {
    try {
      console.log("Debug - Raw Response:", actualRawResponse);
      let info = "";
      
      // Type check
      info += `Raw response type: ${typeof actualRawResponse}\n`;
      
      // Special handling for array responses - very important based on the screenshot
      if (Array.isArray(actualRawResponse)) {
        info += `Raw response is an array with ${actualRawResponse.length} items\n`;
        
        // If it's an array with at least one item, examine the first item
        if (actualRawResponse.length > 0) {
          info += `Examining first array item with keys: ${Object.keys(actualRawResponse[0]).join(', ')}\n\n`;
        }
      } else {
        info += "\n";
      }
      
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
      
      // If this is an analysis result with an ID, add a button to process and save it
      let analysisId = '';
      if (typeof actualRawResponse === 'object' && actualRawResponse !== null) {
        if (Array.isArray(actualRawResponse) && actualRawResponse.length > 0 && actualRawResponse[0].id) {
          analysisId = actualRawResponse[0].id;
        } else if (actualRawResponse.id) {
          analysisId = actualRawResponse.id;
        }
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
        
        // We're focusing specifically on finding and using the parsedJson object 
        // as a single source of truth
        
        let parsedJson: any = null;
        
        // First check if the object has a parsedJson property directly
        if (actualRawResponse.parsedJson) {
          info += "✅ Found parsedJson field at top level\n";
          parsedJson = actualRawResponse.parsedJson;
        } 
        // Next check if it has a nested rawResponse.parsedJson
        else if (actualRawResponse.rawResponse && actualRawResponse.rawResponse.parsedJson) {
          info += "✅ Found parsedJson in nested rawResponse object\n";
          parsedJson = actualRawResponse.rawResponse.parsedJson;
        }
        // Check if it has a deeply nested rawResponse.rawResponse.parsedJson
        // (based on the structure seen in screenshots)
        else if (actualRawResponse.rawResponse && 
                 actualRawResponse.rawResponse.rawResponse && 
                 actualRawResponse.rawResponse.rawResponse.parsedJson) {
          info += "✅ Found parsedJson in deeply nested rawResponse.rawResponse object\n";
          parsedJson = actualRawResponse.rawResponse.rawResponse.parsedJson;
        }
        // Handle extracted sections pattern seen in screenshot
        else if (actualRawResponse.rawResponse && 
                 actualRawResponse.rawResponse.extractedSections && 
                 actualRawResponse.rawResponse.extractedSections.parsedJson) {
          info += "✅ Found parsedJson in rawResponse.extractedSections\n";
          parsedJson = actualRawResponse.rawResponse.extractedSections.parsedJson;
        }
        
        // If we found parsedJson, extract all the fields we need using the exact keys
        // (this matches our server-side parser)
        if (parsedJson) {
          info += `parsedJson keys: ${Object.keys(parsedJson).join(', ')}\n\n`;
          
          // TARGET FIELDS (exact matches as a priority)
          // - matching_score for score
          // - summary for summary
          // - work_history for work history
          // - red_flags for red flags
          // - skills for skills
          
          // Extract fields from parsedJson with exact keys first
          let fieldsFound = 0;
          
          // Extract matching_score
          if (parsedJson.matching_score !== undefined) {
            score = parsedJson.matching_score;
            info += `✅ Found matching_score in parsedJson: ${score}\n`;
            fieldsFound++;
          }
          
          // Extract summary
          if (parsedJson.summary) {
            summary = parsedJson.summary;
            info += `✅ Found summary in parsedJson\n`;
            fieldsFound++;
          }
          
          // Extract work_history
          if (parsedJson.work_history && Array.isArray(parsedJson.work_history)) {
            workHistory = parsedJson.work_history;
            info += `✅ Found work_history array in parsedJson with ${workHistory.length} items\n`;
            fieldsFound++;
          }
          
          // Extract red_flags
          if (parsedJson.red_flags && Array.isArray(parsedJson.red_flags)) {
            redFlags = parsedJson.red_flags;
            info += `✅ Found red_flags array in parsedJson with ${redFlags.length} items\n`;
            fieldsFound++;
          }
          
          // Extract skills
          if (parsedJson.skills && Array.isArray(parsedJson.skills)) {
            skills = parsedJson.skills;
            info += `✅ Found skills array in parsedJson with ${skills.length} items\n`;
            fieldsFound++;
          }
          
          // If we didn't find any of the exact fields, try case-insensitive and alternative names
          if (fieldsFound === 0) {
            info += "⚠️ Did not find any fields with exact names (matching_score, summary, work_history, red_flags, skills)\n";
            info += "⚠️ Trying case variations as a fallback\n";
            
            // Extract score (case variations)
            if (parsedJson.Score !== undefined || parsedJson.score !== undefined) {
              score = parsedJson.Score || parsedJson.score;
              info += `✅ Found Score/score in parsedJson: ${score}\n`;
            }
            
            // Extract summary (case variations)
            if (parsedJson.Summary) {
              summary = parsedJson.Summary;
              info += `✅ Found Summary in parsedJson\n`;
            }
            
            // Extract work history (case variations)
            if (parsedJson.Work_History && Array.isArray(parsedJson.Work_History)) {
              workHistory = parsedJson.Work_History;
              info += `✅ Found Work_History array in parsedJson with ${workHistory.length} items\n`;
            }
            
            // Extract red flags (case variations)
            if (parsedJson.Red_Flags && Array.isArray(parsedJson.Red_Flags)) {
              redFlags = parsedJson.Red_Flags;
              info += `✅ Found Red_Flags array in parsedJson with ${redFlags.length} items\n`;
            }
            
            // Extract skills (case variations)
            if (parsedJson.Skills && Array.isArray(parsedJson.Skills)) {
              skills = parsedJson.Skills;
              info += `✅ Found Skills array in parsedJson with ${skills.length} items\n`;
            }
          }
        } else {
          info += "⚠️ No parsedJson field found in the response - server parsing might fail\n";
        }
        
        // Check for nested rawResponse property (this is an additional path to check)
        if (!parsedJson && actualRawResponse.rawResponse && typeof actualRawResponse.rawResponse === 'object') {
          info += "⚠️ No parsedJson found, checking nested rawResponse for a consistent data source\n";
          
          // Look for nested properties inside rawResponse
          const nestedRawResponse = actualRawResponse.rawResponse;
          
          // Check if it has the expected fields from our single source of truth pattern
          const hasNestedFields = 
            nestedRawResponse.matching_score !== undefined || 
            nestedRawResponse.skills !== undefined ||
            nestedRawResponse.work_history !== undefined ||
            nestedRawResponse.red_flags !== undefined ||
            nestedRawResponse.summary !== undefined;
          
          if (hasNestedFields) {
            info += "✅ Found consistent field names directly in nested rawResponse\n";
            
            // Extract fields using the same names for consistency with our server parser
            if (nestedRawResponse.matching_score !== undefined) {
              score = nestedRawResponse.matching_score;
              info += `✅ Found matching_score in nested rawResponse: ${score}\n`;
            }
            
            if (nestedRawResponse.summary) {
              summary = nestedRawResponse.summary;
              info += `✅ Found summary in nested rawResponse\n`;
            }
            
            if (nestedRawResponse.work_history && Array.isArray(nestedRawResponse.work_history)) {
              workHistory = nestedRawResponse.work_history;
              info += `✅ Found work_history array in nested rawResponse with ${workHistory.length} items\n`;
            }
            
            if (nestedRawResponse.red_flags && Array.isArray(nestedRawResponse.red_flags)) {
              redFlags = nestedRawResponse.red_flags;
              info += `✅ Found red_flags array in nested rawResponse with ${redFlags.length} items\n`;
            }
            
            if (nestedRawResponse.skills && Array.isArray(nestedRawResponse.skills)) {
              skills = nestedRawResponse.skills;
              info += `✅ Found skills array in nested rawResponse with ${skills.length} items\n`;
            }
          } else {
            info += "⚠️ Nested rawResponse does not have expected field names\n";
          }
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
      
      // Add information about saving to database if an analysis ID was found
      if (analysisId) {
        info += "\n\nAnalysis ID found: " + analysisId;
        info += "\nClick 'Save & Process Analysis' to save these results to the database.";
      }
      
      setDebugInfo(info);
      
      // Return the analysis ID if found
      return analysisId;
    } catch (e: any) {
      setDebugInfo(`Error analyzing raw response: ${e.message}`);
      return null;
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
          
          <div className="flex space-x-2">
            <Button 
              variant="outline" 
              size="sm"
              onClick={async () => {
                const analysisId = await debugResponse();
                setFoundAnalysisId(analysisId);
              }}
              className="flex items-center"
            >
              <Code className="h-4 w-4 mr-2" />
              Analyze Raw Response
            </Button>
            
            {foundAnalysisId && (
              <Button 
                variant="outline" 
                size="sm"
                disabled={isProcessing}
                onClick={async () => {
                  setIsProcessing(true);
                  try {
                    await saveAnalysisResults(foundAnalysisId);
                    setDebugInfo(prev => prev + "\n\n✅ Analysis processed and saved to database!");
                  } finally {
                    setIsProcessing(false);
                  }
                }}
                className="flex items-center bg-green-50 hover:bg-green-100 border-green-200 hover:border-green-300 text-green-700"
              >
                {isProcessing ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Code className="h-4 w-4 mr-2" />
                    Save & Process Analysis
                  </>
                )}
              </Button>
            )}
          </div>
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