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
  
  return (
    <div>
    
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
        
        {/* Re-analyze Button */}
        <div className="flex justify-end mt-4">
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              setAnalysisLoading(true);
              try {
                await runSkillsAnalysis();
                toast({
                  title: "Analysis complete",
                  description: "Skills have been analyzed and updated.",
                });
              } catch (error) {
                toast({
                  title: "Analysis failed",
                  description: error instanceof Error ? error.message : "An unexpected error occurred",
                  variant: "destructive",
                });
              } finally {
                setAnalysisLoading(false);
              }
            }}
          >
            Run Skills Analysis
          </Button>
        </div>
      </div>
    </div>
  );
}