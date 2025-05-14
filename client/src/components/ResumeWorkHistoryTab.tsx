import React from 'react';
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AlertCircle, Briefcase, AlertTriangle, CheckCircle, Zap, Code } from "lucide-react";
import { extractWorkHistory } from "@/lib/debug-utils";
import { extractResumeData } from "@/lib/resume-data-extractor";
import { parseRawResponse } from "@/lib/raw-response-parser";
import { useToast } from "@/hooks/use-toast";

interface ResumeWorkHistoryTabProps {
  redFlagData: any;
  redFlagLoading: boolean;
  isRedFlagLoading: boolean;
  redFlagError: any;
  analysis?: any; // Analysis data
  runSkillsAnalysis?: () => Promise<void>; // Optional re-analysis function
  parsedData?: any; // Centralized parsed data
  dataSource?: string; // Source indicator for the data
}

export function ResumeWorkHistoryTab({
  redFlagData,
  redFlagLoading,
  isRedFlagLoading,
  redFlagError,
  analysis,
  runSkillsAnalysis
}: ResumeWorkHistoryTabProps) {
  const { toast } = useToast();
  
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
  // 1. Direct from raw response using the exact format from screenshots (Work_History, Skills, Red_Flags)
  // 2. From existing extractors as fallback
  
  // Initialize variables
  let dataSource = "";
  let workHistory: any[] = [];
  
  // Parse raw response directly (highest priority)
  // This handles the exact format seen in your screenshots with Work_History field
  let directData = { workHistory: [], skills: [], redFlags: [], summary: "", score: 0, rawData: null };
  let directDataAvailable = false;
  
  // Try to parse directly from rawResponse (best approach based on the screenshots)
  if (analysis?.rawResponse) {
    console.log("WorkHistory Tab: Found rawResponse field, attempting direct parsing");
    
    try {
      // First, try to use the raw parser to extract the data
      directData = parseRawResponse(analysis.rawResponse);
      
      if (directData && directData.workHistory && directData.workHistory.length > 0) {
        console.log("WorkHistory Tab: Successfully parsed raw response. Found", directData.workHistory.length, "work history entries");
        workHistory = directData.workHistory;
        dataSource = "direct_raw_parser";
        directDataAvailable = true;
      }
      // If rawResponse is an object with parsedJson field
      else if (typeof analysis.rawResponse === 'object' && analysis.rawResponse.parsedJson) {
        if (analysis.rawResponse.parsedJson.Work_History && 
            Array.isArray(analysis.rawResponse.parsedJson.Work_History)) {
          console.log("WorkHistory Tab: Found Work_History array in parsedJson with", 
            analysis.rawResponse.parsedJson.Work_History.length, "entries");
          workHistory = analysis.rawResponse.parsedJson.Work_History.map((item: any) => ({
            title: item.Title || item.title || '',
            company: item.Company || item.company || '',
            location: item.location || item.Location || '',
            startDate: item.startDate || item.StartDate || '',
            endDate: item.endDate || item.EndDate || '',
            description: item.description || item.Description || '',
            durationMonths: item.durationMonths || item.DurationMonths || 0,
            isCurrentRole: item.isCurrentRole || item.IsCurrentRole || false
          }));
          dataSource = "parsed_json_work_history";
          directDataAvailable = true;
        }
      }
      // If rawResponse directly has Work_History
      else if (typeof analysis.rawResponse === 'object' && 
              analysis.rawResponse.Work_History && 
              Array.isArray(analysis.rawResponse.Work_History)) {
        console.log("WorkHistory Tab: Found Work_History array directly in raw response object");
        workHistory = analysis.rawResponse.Work_History.map((item: any) => ({
          title: item.Title || item.title || '',
          company: item.Company || item.company || '',
          location: item.location || item.Location || '',
          startDate: item.startDate || item.StartDate || '',
          endDate: item.endDate || item.EndDate || '',
          description: item.description || item.Description || '',
          durationMonths: item.durationMonths || item.DurationMonths || 0,
          isCurrentRole: item.isCurrentRole || item.IsCurrentRole || false
        }));
        dataSource = "direct_object_work_history";
        directDataAvailable = true;
      }
    } catch (error) {
      console.error("WorkHistory Tab: Error parsing raw response:", error);
    }
  }
  
  // Fallbacks - get data from regular extractors if direct parsing failed 
  const analysisExtractedData = analysis ? extractResumeData(analysis) : {
    workHistory: [],
    skills: [],
    redFlags: [],
    summary: ""
  };
  
  const rfExtractedData = extractResumeData(redFlagData);
  
  // For logging and debugging
  console.log("Source priority order: 1) direct raw response parser, 2) existing extractors, 3) red flag analysis, 4) legacy method");
  
  // Determine which source we're using (for potential indicators in the UI)
  
  // Prioritize direct Work_History from raw response first (best match to screenshot)
  if (directDataAvailable && !workHistory.length) { // Only if we haven't already set workHistory earlier
    workHistory = directData.workHistory.map(item => ({
      title: item.Title || item.title || '',
      company: item.Company || item.company || '',
      location: item.location || item.Location || '',
      startDate: item.startDate || item.StartDate || '',
      endDate: item.endDate || item.EndDate || '',
      description: item.description || item.Description || '',
      durationMonths: item.durationMonths || item.DurationMonths || 0,
      isCurrentRole: item.isCurrentRole || item.IsCurrentRole || false
    }));
    dataSource = "direct_raw_parser";
    console.log("Using work history directly from raw response parser (source 1) - MATCH SCREENSHOT");
  }
  // Then try the regular extractor
  else if (analysisExtractedData.workHistory && analysisExtractedData.workHistory.length > 0) {
    workHistory = analysisExtractedData.workHistory;
    dataSource = "main_analysis";
    console.log("Using work history from main analysis (source 2)");
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
  const rfRedFlags = rfExtractedData.redFlags;
  // Finally fall back to old method if needed
  
  console.log("Red flags from analysis (source 1):", analysisRedFlags);
  console.log("Red flags from red flag analysis (source 2):", rfRedFlags);
  console.log("Legacy red flags (source 3):", redFlagData?.analysis?.potentialRedFlags || []);
  
  // Determine red flag source based on same priority ordering
  let redFlagSource = "";
  let redFlags = [];
  
  // Try to extract Red_Flags directly from parsedJson in raw response (highest priority)
  if (analysis?.rawResponse && typeof analysis.rawResponse === 'object' && 
      analysis.rawResponse.parsedJson && 
      analysis.rawResponse.parsedJson.Red_Flags && 
      Array.isArray(analysis.rawResponse.parsedJson.Red_Flags)) {
    
    redFlags = analysis.rawResponse.parsedJson.Red_Flags;
    redFlagSource = "parsed_json_red_flags";
    console.log("Using Red_Flags directly from parsedJson in raw response (highest priority)");
    
  } 
  // Try to extract Red_Flags directly from raw response object 
  else if (analysis?.rawResponse && typeof analysis.rawResponse === 'object' && 
           analysis.rawResponse.Red_Flags && 
           Array.isArray(analysis.rawResponse.Red_Flags)) {
    
    redFlags = analysis.rawResponse.Red_Flags;
    redFlagSource = "direct_red_flags";
    console.log("Using Red_Flags directly from raw response object");
    
  }
  // Then try from directData (from parseRawResponse)
  else if (directData && directData.redFlags && directData.redFlags.length > 0) {
    redFlags = directData.redFlags;
    redFlagSource = "direct_parser";
    console.log("Using red flags from direct parser");
  }
  // Then try from standard analysis extractor
  else if (analysisRedFlags && analysisRedFlags.length > 0) {
    redFlags = analysisRedFlags;
    redFlagSource = "main_analysis";
    console.log("Using red flags from main analysis for consistency");
  }
  // Then try from red flag analysis  
  else if (rfRedFlags && rfRedFlags.length > 0) {
    redFlags = rfRedFlags;
    redFlagSource = "red_flag_analysis";
    console.log("Using red flags from red flag analysis");
  } 
  // Use legacy method as last resort
  else {
    redFlags = redFlagData?.analysis?.potentialRedFlags || [];
    redFlagSource = "legacy_method";
    console.log("Using red flags from legacy extraction method (lowest priority)");
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

  // Add button to re-run analysis directly from work history tab
  const handleReAnalyze = async () => {
    if (!runSkillsAnalysis) return;
    
    try {
      await runSkillsAnalysis();
      toast({
        title: "Analysis initiated",
        description: "Re-analyzing resume with custom prompt..."
      });
    } catch (error) {
      console.error("Failed to run work history analysis:", error);
      toast({
        title: "Analysis failed",
        description: "Could not re-analyze resume. Please try again.",
        variant: "destructive"
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Show data source indicator */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center" title="Data source indicator">
          {dataSource === 'direct_raw_parser' ? (
            <span className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded-md flex items-center">
              <Zap className="h-3 w-3 mr-1" />
              Using Work_History from direct LLM response
            </span>
          ) : (
            <span className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded-md flex items-center">
              <Code className="h-3 w-3 mr-1" />
              Using {dataSource}
            </span>
          )}
        </div>
        
        {runSkillsAnalysis && (
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleReAnalyze} 
            disabled={redFlagLoading || isRedFlagLoading}
            className="text-xs"
          >
            {redFlagLoading || isRedFlagLoading ? "Analyzing..." : "Re-analyze Resume"}
          </Button>
        )}
      </div>
      
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