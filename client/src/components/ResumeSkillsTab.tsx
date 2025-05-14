import React from 'react';
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AlertCircle, Code, Zap } from "lucide-react";
import { extractSkillsFromAnalysis, categorizeSkills } from "@/lib/debug-utils";
import { extractResumeData } from "@/lib/resume-data-extractor";
import { parseRawResponse } from "@/lib/raw-response-parser";
import { useToast } from "@/hooks/use-toast";

interface ResumeSkillsTabProps {
  analysis: any;
  analysisLoading: boolean;
  analysisError: any;
  resumeId: string;
  runSkillsAnalysis: () => Promise<void>;
  setAnalysisLoading: (loading: boolean) => void;
}

export function ResumeSkillsTab({
  analysis,
  analysisLoading,
  analysisError,
  resumeId,
  runSkillsAnalysis,
  setAnalysisLoading
}: ResumeSkillsTabProps) {
  const { toast } = useToast();
  
  if (analysisLoading) {
    return (
      <div className="flex justify-center items-center h-36">
        <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full"></div>
        <span className="ml-3 text-sm">Analyzing skills...</span>
      </div>
    );
  }
  
  if (analysisError) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Failed to analyze skills. Please try again later.
        </AlertDescription>
      </Alert>
    );
  }

  // Use the direct parser first (highest priority)
  let skillsList: string[] = [];
  let extractionSource = "";
  let directDataFound = false;
  
  // First, check if we have a raw response in the debug panel format
  if (analysis?.rawResponse) {
    console.log("Skills Tab: Found rawResponse, attempting direct parsing");
    
    try {
      // Try to use the raw parser to extract the data
      const directData = parseRawResponse(analysis.rawResponse);
      
      if (directData && directData.skills && directData.skills.length > 0) {
        console.log("Skills Tab: Successfully parsed raw response. Found", directData.skills.length, "skills");
        skillsList = directData.skills;
        extractionSource = "direct_raw_parser";
        directDataFound = true;
      }
    } catch (error) {
      console.error("Skills Tab: Error parsing raw response:", error);
    }
  }
  
  // Check if we have a response field that might contain the data (as seen in the screenshots)
  if (!directDataFound && analysis?.response) {
    console.log("Skills Tab: Trying to extract from response field");
    
    try {
      // Try to parse the response field
      let responseData;
      
      if (typeof analysis.response === 'string') {
        try {
          responseData = JSON.parse(analysis.response);
        } catch (e) {
          console.log("Skills Tab: response field is not JSON");
          responseData = { text: analysis.response };
        }
      } else {
        responseData = analysis.response;
      }
      
      // Check if the response has a skills array
      if (responseData && Array.isArray(responseData.skills)) {
        console.log("Skills Tab: Found skills array in response field with", responseData.skills.length, "items");
        skillsList = responseData.skills;
        extractionSource = "response_field";
        directDataFound = true;
      } else if (responseData && Array.isArray(responseData.Skills)) {
        console.log("Skills Tab: Found Skills array in response field with", responseData.Skills.length, "items");
        skillsList = responseData.Skills;
        extractionSource = "response_field";
        directDataFound = true;
      }
    } catch (error) {
      console.error("Skills Tab: Error extracting from response field:", error);
    }
  }
  
  // If direct parser didn't find skills, fall back to the standard extractor
  if (!directDataFound) {
    console.log("Skills Tab: Direct parsing failed, falling back to standard extractor");
    const extractedData = extractResumeData(analysis);
    
    if (extractedData.skills.length > 0) {
      console.log("Skills Tab: Using skills from standard extractor, found", extractedData.skills.length, "skills");
      skillsList = extractedData.skills;
      extractionSource = "standard_extractor";
    } else {
      // Last resort - use the legacy extractor
      console.log("Skills Tab: Standard extractor failed, using legacy method");
      skillsList = extractSkillsFromAnalysis(analysis);
      extractionSource = "legacy_extractor";
    }
  }
  
  console.log("Skills Tab: Final source:", extractionSource, "with", skillsList.length, "skills");
  
  // Use the skills list to categorize skills
  const { technicalSkills, softSkills } = categorizeSkills(skillsList);
  
  // Check if there are any warning flags in the analysis
  const hasAnalysisWarning = analysis && analysis.analysis_warning;
  
  // Add button to re-run analysis directly from skills tab
  const handleReAnalyze = async () => {
    try {
      await runSkillsAnalysis();
      toast({
        title: "Analysis initiated",
        description: "Re-analyzing skills from resume..."
      });
    } catch (error) {
      console.error("Failed to run skills analysis:", error);
      toast({
        title: "Analysis failed",
        description: "Could not re-analyze skills. Please try again.",
        variant: "destructive"
      });
    }
  };
  
  return (
    <div>
      {/* Show data source indicator */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center" title="Data source indicator">
          {extractionSource === 'direct_raw_parser' ? (
            <span className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded-md flex items-center">
              <Zap className="h-3 w-3 mr-1" />
              Using Skills from direct LLM response
            </span>
          ) : (
            <span className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded-md flex items-center">
              <Code className="h-3 w-3 mr-1" />
              Using {extractionSource}
            </span>
          )}
        </div>
        
        <Button 
          variant="outline" 
          size="sm" 
          onClick={handleReAnalyze} 
          disabled={analysisLoading}
          className="text-xs"
        >
          {analysisLoading ? "Analyzing..." : "Re-analyze Skills"}
        </Button>
      </div>
      
      {/* Warning for potentially inconsistent analysis */}
      {hasAnalysisWarning && (
        <Alert className="mb-4 bg-amber-50 border-amber-200">
          <AlertCircle className="h-4 w-4 text-amber-600" />
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
      
      <div className="space-y-4">
        {/* Technical Skills Section */}
        <div className="rounded-md border p-4">
          <div className="flex items-center space-x-2 mb-4">
            <Code className="h-5 w-5 text-blue-500" />
            <h3 className="font-medium">Technical Skills</h3>
          </div>
          
          <div className="flex flex-wrap gap-2">
            {technicalSkills.length > 0 ? (
              technicalSkills.map((skill, index) => (
                <div key={index} className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">
                  {skill}
                </div>
              ))
            ) : (
              <p className="text-sm text-gray-500">No technical skills found</p>
            )}
          </div>
        </div>
        
        {/* Soft Skills Section */}
        <div className="rounded-md border p-4">
          <div className="flex items-center space-x-2 mb-4">
            <Code className="h-5 w-5 text-green-500" />
            <h3 className="font-medium">Soft Skills</h3>
          </div>
          
          <div className="flex flex-wrap gap-2">
            {softSkills.length > 0 ? (
              softSkills.map((skill, index) => (
                <div key={index} className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm">
                  {skill}
                </div>
              ))
            ) : (
              <p className="text-sm text-gray-500">No soft skills found</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}