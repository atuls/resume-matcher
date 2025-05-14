import React from 'react';
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AlertCircle, Briefcase, AlertTriangle, CheckCircle } from "lucide-react";
import { extractWorkHistory } from "@/lib/debug-utils";
import { extractResumeData, extractRedFlagData } from "@/lib/resume-data-extractor";

interface ResumeWorkHistoryTabProps {
  redFlagData: any;
  redFlagLoading: boolean;
  isRedFlagLoading: boolean;
  redFlagError: any;
  analysis?: any; // Analysis data
}

export function ResumeWorkHistoryTab({
  redFlagData,
  redFlagLoading,
  isRedFlagLoading,
  redFlagError,
  analysis
}: ResumeWorkHistoryTabProps) {
  if (redFlagLoading || isRedFlagLoading) {
    return (
      <div className="flex justify-center items-center h-36">
        <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full"></div>
        <span className="ml-3 text-sm">Analyzing work history...</span>
      </div>
    );
  }
  
  if (redFlagError) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Failed to analyze work history. Please try again later.
        </AlertDescription>
      </Alert>
    );
  }

  // Important: 
  // We need to prioritize extracting everything from the same data source for consistency
  // Order of priority:
  // 1. Direct from Work_History in raw response (as seen in screenshot)
  // 2. From main analysis data (for consistency with Skills tab)
  // 3. From red flag analysis data (fallback) 
  // 4. From legacy extractWorkHistory method (last resort)
  
  // Check for raw LLM response with Work_History field (high priority)
  let rawResponseWorkHistory: any[] = [];
  let directWorkHistoryFound = false;
  
  // Try to extract directly from rawResponse if it exists (best source according to screenshot)
  if (analysis?.rawResponse) {
    try {
      // If rawResponse is a string, parse it as JSON
      if (typeof analysis.rawResponse === 'string') {
        const parsedResponse = JSON.parse(analysis.rawResponse);
        if (Array.isArray(parsedResponse.Work_History)) {
          rawResponseWorkHistory = parsedResponse.Work_History;
          directWorkHistoryFound = true;
          console.log("SUCCESS: Found Work_History array directly in raw response JSON", rawResponseWorkHistory.length, "entries");
        }
      } 
      // If rawResponse is already an object, check if it has Work_History
      else if (typeof analysis.rawResponse === 'object' && analysis.rawResponse) {
        if (Array.isArray(analysis.rawResponse.Work_History)) {
          rawResponseWorkHistory = analysis.rawResponse.Work_History;
          directWorkHistoryFound = true;
          console.log("SUCCESS: Found Work_History array in raw response object", rawResponseWorkHistory.length, "entries");
        }
      }
    } catch (e) {
      console.error("Error parsing raw response:", e);
    }
  }
  
  // Get work history from regular extractors as fallback
  const analysisExtractedData = analysis ? extractResumeData(analysis) : {
    workHistory: [],
    skills: [],
    redFlags: [],
    summary: ""
  };
  
  const rfExtractedData = extractResumeData(redFlagData);
  
  // For logging and debugging
  console.log("Source priority order: 1) direct Work_History, 2) main analysis, 3) red flag analysis, 4) legacy method");
  
  if (directWorkHistoryFound) {
    console.log("Work history from direct Work_History (source 1):", rawResponseWorkHistory);
  } else {
    console.log("Work history from direct Work_History (source 1): Not found");
  }
  
  console.log("Work history from analysis (source 2):", analysisExtractedData.workHistory);
  console.log("Work history from red flags (source 3):", rfExtractedData.workHistory);
  console.log("Legacy work history method result (source 4):", extractWorkHistory(redFlagData));
  
  // Determine which source we're using (for potential indicators in the UI)
  let dataSource = "";
  let workHistory = [];
  
  // Prioritize direct Work_History from raw response first
  if (directWorkHistoryFound && rawResponseWorkHistory.length > 0) {
    workHistory = rawResponseWorkHistory;
    dataSource = "direct_work_history";
    console.log("Using work history directly from LLM response Work_History field (source 1) - MATCH SCREENSHOT");
  }
  // Then use main analysis
  else if (analysisExtractedData.workHistory && analysisExtractedData.workHistory.length > 0) {
    workHistory = analysisExtractedData.workHistory;
    dataSource = "main_analysis";
    console.log("Using work history from main analysis (source 2) for consistency");
  } 
  // Then use red flag analysis
  else if (rfExtractedData.workHistory && rfExtractedData.workHistory.length > 0) {
    workHistory = rfExtractedData.workHistory;
    dataSource = "red_flag_analysis";
    console.log("Using work history from red flag analysis (source 3)");
  } 
  // Finally, fall back to legacy method
  else {
    workHistory = extractWorkHistory(redFlagData);
    dataSource = "legacy_method";
    console.log("Using work history from legacy extraction method (source 4)");
  }
  
  console.log("Final work history source:", dataSource);
  console.log("Final work history:", workHistory);
    
  // Extract red flags using the same source priority order for consistency
  // First try using main analysis data if available (matching Skills tab source)
  const analysisRedFlags = analysisExtractedData.redFlags;
  // Then try red flag data
  const rfRedFlags = extractRedFlagData(redFlagData);
  // Finally fall back to old method if needed
  
  console.log("Red flags from analysis (source 1):", analysisRedFlags);
  console.log("Red flags from red flag analysis (source 2):", rfRedFlags);
  console.log("Legacy red flags (source 3):", redFlagData?.analysis?.potentialRedFlags || []);
  
  // Determine red flag source based on same priority ordering
  let redFlagSource = "";
  let redFlags = [];
  
  if (analysisRedFlags && analysisRedFlags.length > 0) {
    redFlags = analysisRedFlags;
    redFlagSource = "main_analysis";
    console.log("Using red flags from main analysis (source 1) for consistency");
  } else if (rfRedFlags && rfRedFlags.length > 0) {
    redFlags = rfRedFlags;
    redFlagSource = "red_flag_analysis";
    console.log("Using red flags from red flag analysis (source 2)");
  } else {
    redFlags = redFlagData?.analysis?.potentialRedFlags || [];
    redFlagSource = "legacy_method";
    console.log("Using red flags from legacy extraction method (source 3)");
  }
  
  console.log("Final red flags source:", redFlagSource);
  console.log("Final red flags:", redFlags);
  
  // Format for UI display - ensure consistent structure regardless of source
  const potentialRedFlags = redFlags.map(flag => {
    if (typeof flag === 'string') {
      return { description: flag };
    } else if (typeof flag === 'object') {
      return {
        title: flag.title || flag.category || "Potential Issue",
        description: flag.description || flag.issue || flag.text || JSON.stringify(flag)
      };
    }
    return { description: JSON.stringify(flag) };
  });
  
  // Check if there are any warning flags in the analysis
  const hasAnalysisWarning = analysis && analysis.analysis_warning;

  return (
    <div className="space-y-6">
      {/* Warning for potentially inconsistent analysis */}
      {hasAnalysisWarning && (
        <Alert className="mb-4 bg-amber-50 border-amber-200">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-amber-800 flex items-center justify-between">
            <span>{analysis.analysis_warning}</span>
            <Button 
              variant="outline" 
              size="sm"
              className="ml-2 text-amber-800 border-amber-300 hover:bg-amber-100"
              onClick={() => {
                // Typescript-safe way to trigger click on an element
                const element = document.querySelector('button[value="raw-text"]');
                if (element) {
                  (element as HTMLElement).click();
                }
              }}
            >
              View Raw Resume Text
            </Button>
          </AlertDescription>
        </Alert>
      )}
      
      {/* Red Flags Section */}
      <div className="rounded-md border p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            <h3 className="font-medium">Potential Red Flags</h3>
          </div>
          
          {/* Source indicator for transparency */}
          <div className="flex items-center">
            <div className={`px-2 py-1 rounded-md text-xs ${
              redFlagSource === "main_analysis" 
                ? "bg-blue-100 text-blue-800" 
                : redFlagSource === "red_flag_analysis" 
                  ? "bg-amber-100 text-amber-800" 
                  : "bg-gray-100 text-gray-800"
            }`}>
              {redFlagSource === "main_analysis" 
                ? "Using main analysis data" 
                : redFlagSource === "red_flag_analysis" 
                  ? "Using red flag analysis data" 
                  : "Using legacy data format"}
            </div>
          </div>
        </div>
        
        {potentialRedFlags.length > 0 ? (
          <div className="space-y-4">
            {potentialRedFlags.map((flag: any, index: number) => (
              <div key={index} className="p-3 bg-amber-50 text-amber-800 rounded-md">
                <div className="font-medium mb-1">
                  {flag.title || (typeof flag === 'string' ? "Potential Issue" : "Potential Issue")}
                </div>
                <p className="text-sm">
                  {flag.description || flag.issue || (typeof flag === 'string' ? flag : JSON.stringify(flag))}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-3 px-4 bg-green-50 text-green-800 rounded-md flex items-center">
            <CheckCircle className="h-5 w-5 mr-2" />
            <p>No red flags detected in work history</p>
          </div>
        )}
      </div>
      
      {/* Work History Roles */}
      <div className="rounded-md border p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <Briefcase className="h-5 w-5 text-blue-500" />
            <h3 className="font-medium">Work History</h3>
          </div>
          
          {/* Source indicator for transparency */}
          <div className="flex items-center">
            <div className={`px-2 py-1 rounded-md text-xs ${
              dataSource === "main_analysis" 
                ? "bg-blue-100 text-blue-800" 
                : dataSource === "red_flag_analysis" 
                  ? "bg-amber-100 text-amber-800" 
                  : "bg-gray-100 text-gray-800"
            }`}>
              {dataSource === "main_analysis" 
                ? "Using main analysis data" 
                : dataSource === "red_flag_analysis" 
                  ? "Using red flag analysis data" 
                  : "Using legacy data format"}
            </div>
          </div>
        </div>
        
        {workHistory.length > 0 ? (
          <div className="space-y-4">
            {workHistory.map((role: any, index: number) => (
              <div key={index} className="p-4 border rounded-md">
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="font-medium">
                      {role.title || role.Title || role.position || role.Position || "Role"}
                    </h4>
                    <div className="text-sm text-gray-600">
                      {role.company || role.Company || role.organization || role.Organization || "Company"}
                      {(role.location || role.Location) && 
                        <span className="ml-1">• {role.location || role.Location}</span>
                      }
                    </div>
                  </div>
                  <div className="text-sm text-gray-500">
                    {role.startDate || role.StartDate || role.dates?.start || ""} - {role.endDate || role.EndDate || role.dates?.end || (role.isCurrentRole || role.isCurrentlyEmployed) ? "Present" : ""}
                  </div>
                </div>
                {(role.description || role.Description) && (
                  <p className="text-sm mt-2">{role.description || role.Description}</p>
                )}
                {(role.achievements || role.Achievements) && Array.isArray(role.achievements || role.Achievements) && (
                  <div className="mt-2">
                    <h5 className="text-sm font-medium">Key Achievements:</h5>
                    <ul className="list-disc pl-5 text-sm mt-1">
                      {(role.achievements || role.Achievements).map((achievement: string, i: number) => (
                        <li key={i}>{achievement}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-500">No work history information found</p>
        )}
      </div>
    </div>
  );
}