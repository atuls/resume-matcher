import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Settings, Plus } from "lucide-react";
import { getJobDescriptions, getJobRequirements, analyzeResumes, deleteJobDescription } from "@/lib/api";
import JobDescriptionUploader from "@/components/job-description/uploader";
import JobDescriptionPreview from "@/components/job-description/preview";
import ResumeUploader from "@/components/resume/uploader";
import ResumeList from "@/components/resume/list";
import RequirementsConfirmation from "@/components/analysis/requirements-confirmation";
import AnalysisResults from "@/components/analysis/results";
import { JobDescription } from "@shared/schema";
import { AnalysisStatus } from "@/types";

export default function Dashboard() {
  const [selectedJobDescription, setSelectedJobDescription] = useState<JobDescription | null>(null);
  const [selectedResumeIds, setSelectedResumeIds] = useState<string[]>([]);
  const [requirementsConfirmed, setRequirementsConfirmed] = useState(false);
  const [analysisStatus, setAnalysisStatus] = useState<AnalysisStatus>({ status: 'idle' });
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch job descriptions
  const {
    data: jobDescriptions,
    isLoading: isLoadingJobs,
    refetch: refetchJobs
  } = useQuery({
    queryKey: ['/api/job-descriptions'],
    queryFn: getJobDescriptions
  });

  // Use the first job description if none is selected
  if (!selectedJobDescription && jobDescriptions && jobDescriptions.length > 0) {
    setSelectedJobDescription(jobDescriptions[0]);
  }

  // Check if requirements exist for the selected job
  const {
    data: requirements,
    isLoading: isLoadingRequirements,
  } = useQuery({
    queryKey: [`/api/job-descriptions/${selectedJobDescription?.id}/requirements`],
    queryFn: () => getJobRequirements(selectedJobDescription!.id),
    enabled: !!selectedJobDescription,
  });

  // Handle successful job description upload
  const handleJobDescriptionUpload = (jobDescription: JobDescription) => {
    setSelectedJobDescription(jobDescription);
    refetchJobs();
    setRequirementsConfirmed(false);
  };

  // Handle requirements confirmation
  const handleRequirementsConfirmed = () => {
    setRequirementsConfirmed(true);
  };

  // Handle resume selection
  const handleResumeSelection = (resumeIds: string[]) => {
    setSelectedResumeIds(resumeIds);
  };
  
  // Delete job description mutation
  const deleteJobMutation = useMutation({
    mutationFn: deleteJobDescription,
    onSuccess: () => {
      toast({
        title: "Job description deleted",
        description: "The job description has been successfully deleted",
      });
      setSelectedJobDescription(null);
      queryClient.invalidateQueries({ queryKey: ['/api/job-descriptions'] });
    },
    onError: (error) => {
      toast({
        title: "Failed to delete job description",
        description: error instanceof Error ? error.message : "An unknown error occurred",
        variant: "destructive",
      });
    },
  });
  
  // Handle job description deletion
  const handleDeleteJobDescription = async (id: string) => {
    deleteJobMutation.mutate(id);
  };

  // Start analysis process
  const handleStartAnalysis = async () => {
    if (!selectedJobDescription || selectedResumeIds.length === 0) {
      toast({
        title: "Cannot analyze",
        description: "Please select both a job description and at least one resume.",
        variant: "destructive"
      });
      return;
    }

    setAnalysisStatus({ status: 'loading', message: 'Analyzing resumes...' });

    try {
      await analyzeResumes(selectedJobDescription.id, selectedResumeIds);
      setAnalysisStatus({ status: 'success' });
    } catch (error) {
      setAnalysisStatus({ 
        status: 'error', 
        message: error instanceof Error ? error.message : 'Failed to analyze resumes' 
      });
      
      toast({
        title: "Analysis failed",
        description: error instanceof Error ? error.message : 'An unknown error occurred',
        variant: "destructive"
      });
    }
  };

  return (
    <>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Resume Analysis</h1>
        <div className="flex space-x-2">
          <Button variant="outline" className="text-gray-700">
            <Settings className="mr-2 h-4 w-4" />
            Settings
          </Button>
          <Button onClick={() => setSelectedJobDescription(null)}>
            <Plus className="mr-2 h-4 w-4" />
            New Analysis
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-7 gap-6">
        {/* Left Column: Document Management */}
        <div className="lg:col-span-3 space-y-6">
          {/* Job Description Section */}
          {!selectedJobDescription ? (
            <JobDescriptionUploader onSuccess={handleJobDescriptionUpload} />
          ) : (
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-lg font-semibold mb-4">Job Description</h2>
              <JobDescriptionPreview 
                jobDescription={selectedJobDescription} 
                onDelete={() => handleDeleteJobDescription(selectedJobDescription.id)} 
              />
            </div>
          )}

          {/* Resume Section */}
          {selectedJobDescription && (
            requirementsConfirmed ? (
              <div className="bg-white rounded-lg shadow-sm p-6">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-lg font-semibold">Candidate Resumes</h2>
                  <Button 
                    variant="ghost" 
                    className="text-primary hover:text-blue-700 text-sm font-medium"
                  >
                    <Plus className="mr-1.5 h-4 w-4" /> Add Resumes
                  </Button>
                </div>
                <ResumeList 
                  onSelect={handleResumeSelection}
                  selectedResumeIds={selectedResumeIds}
                />
                
                {selectedResumeIds.length > 0 && (
                  <div className="mt-4">
                    <Button 
                      className="w-full"
                      onClick={handleStartAnalysis}
                      disabled={analysisStatus.status === 'loading'}
                    >
                      {analysisStatus.status === 'loading' ? (
                        <>
                          <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Analyzing Resumes...
                        </>
                      ) : 'Analyze Resumes'}
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              <ResumeUploader onSuccess={() => {}} />
            )
          )}
        </div>
        
        {/* Right Column: Analysis Results */}
        <div className="lg:col-span-4 space-y-6">
          {selectedJobDescription && !requirementsConfirmed && (
            <RequirementsConfirmation 
              jobDescriptionId={selectedJobDescription.id}
              onRequirementsConfirmed={handleRequirementsConfirmed}
            />
          )}
          
          {selectedJobDescription && requirementsConfirmed && (
            <AnalysisResults 
              jobDescriptionId={selectedJobDescription.id}
              analysisStatus={analysisStatus}
            />
          )}
        </div>
      </div>
    </>
  );
}
