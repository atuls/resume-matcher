import React from 'react';
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AlertCircle, Code } from "lucide-react";
import { extractSkillsFromAnalysis, categorizeSkills } from "@/lib/debug-utils";
import { extractResumeData } from "@/lib/resume-data-extractor";
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

  // Get skills using our new robust data extractor
  const extractedData = extractResumeData(analysis);
  // Fall back to old method if our extractor doesn't find skills
  const skillsList = extractedData.skills.length > 0 
    ? extractedData.skills 
    : extractSkillsFromAnalysis(analysis);
  
  const { technicalSkills, softSkills } = categorizeSkills(skillsList);
  
  // Check if there are any warning flags in the analysis
  const hasAnalysisWarning = analysis && analysis.analysis_warning;
  
  return (
    <div>
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