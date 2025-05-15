import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

const AnalysisParserPage = () => {
  const { toast } = useToast();
  const [isProcessingAll, setIsProcessingAll] = useState(false);
  const [processingResult, setProcessingResult] = useState<any>(null);

  // Define Resume type
  interface Resume {
    id: string;
    candidateName: string | null;
    fileName: string;
  }

  // Get all resumes
  const { data: resumes, isLoading: resumesLoading } = useQuery<Resume[]>({
    queryKey: ['/api/resumes'],
    refetchOnWindowFocus: false,
  });

  // Get all analysis results
  const { data: jobDescriptions, isLoading: jobsLoading } = useQuery({
    queryKey: ['/api/job-descriptions'],
    refetchOnWindowFocus: false,
  });

  const processAllAnalysis = async () => {
    setIsProcessingAll(true);
    try {
      const response = await apiRequest('POST', '/api/admin/process-all-analysis');
      const result = await response.json();
      
      setProcessingResult(result);
      toast({
        title: "Processing Complete",
        description: `Processed ${result.total} analysis results (${result.successful} successful, ${result.failed} failed)`,
      });
    } catch (error) {
      console.error("Error processing analysis results:", error);
      toast({
        title: "Processing Failed",
        description: "Failed to process analysis results. See console for details.",
        variant: "destructive",
      });
    } finally {
      setIsProcessingAll(false);
    }
  };

  const processForResume = async (resumeId: string) => {
    try {
      const response = await apiRequest('POST', `/api/resumes/${resumeId}/process-analysis`);
      const result = await response.json();
      
      toast({
        title: "Processing Complete",
        description: `Processed ${result.total} analysis results for resume (${result.successful} successful, ${result.failed} failed)`,
      });
    } catch (error) {
      console.error(`Error processing analysis for resume ${resumeId}:`, error);
      toast({
        title: "Processing Failed",
        description: "Failed to process analysis for resume. See console for details.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="container py-8">
      <h1 className="text-2xl font-bold mb-6">Analysis Parser Utility</h1>
      
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Process All Analysis Results</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-4">
            This will process all raw analysis results in the database and extract structured data
            (skills, work history, red flags, etc.) for consistent display in the UI.
          </p>
          
          <Button 
            onClick={processAllAnalysis} 
            disabled={isProcessingAll}
          >
            {isProcessingAll ? "Processing..." : "Process All Analysis Results"}
          </Button>
          
          {processingResult && (
            <div className="mt-4 p-4 bg-gray-100 rounded">
              <h3 className="font-medium mb-2">Processing Results:</h3>
              <p>Total: {processingResult.total}</p>
              <p>Successful: {processingResult.successful}</p>
              <p>Failed: {processingResult.failed}</p>
            </div>
          )}
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle>Process Analysis By Resume</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-4">
            Select a resume to process all analysis results for that resume.
          </p>
          
          {resumesLoading ? (
            <p>Loading resumes...</p>
          ) : !resumes || resumes.length === 0 ? (
            <p>No resumes found.</p>
          ) : (
            <div className="grid gap-4">
              {resumes.map((resume) => (
                <div key={resume.id} className="flex justify-between items-center p-3 border rounded">
                  <div>
                    <p className="font-medium">{resume.candidateName || "Unnamed Candidate"}</p>
                    <p className="text-sm text-gray-500">{resume.fileName}</p>
                  </div>
                  <Button 
                    size="sm" 
                    onClick={() => processForResume(resume.id)}
                  >
                    Process
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AnalysisParserPage;