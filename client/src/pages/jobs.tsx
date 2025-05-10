import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Plus } from "lucide-react";
import { getJobDescriptions } from "@/lib/api";
import JobDescriptionPreview from "@/components/job-description/preview";
import JobDescriptionUploader from "@/components/job-description/uploader";
import { useState } from "react";

export default function JobsPage() {
  const [showUploader, setShowUploader] = useState(false);
  const { toast } = useToast();

  // Fetch job descriptions
  const {
    data: jobDescriptions,
    isLoading,
    refetch: refetchJobs
  } = useQuery({
    queryKey: ['/api/job-descriptions'],
    queryFn: getJobDescriptions
  });

  // Handle successful job description upload
  const handleJobDescriptionUpload = () => {
    setShowUploader(false);
    refetchJobs();
    toast({
      title: "Job description uploaded",
      description: "The job description has been successfully uploaded.",
    });
  };

  return (
    <>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Job Descriptions</h1>
        <Button onClick={() => setShowUploader(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add Job Description
        </Button>
      </div>

      {showUploader ? (
        <div className="mb-8">
          <JobDescriptionUploader onSuccess={handleJobDescriptionUpload} />
          <div className="mt-4">
            <Button variant="outline" onClick={() => setShowUploader(false)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : null}

      {isLoading ? (
        <div className="text-center py-8">
          <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-gray-500">Loading job descriptions...</p>
        </div>
      ) : jobDescriptions && jobDescriptions.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {jobDescriptions.map((jobDescription) => (
            <div key={jobDescription.id} className="bg-white rounded-lg shadow-sm p-6">
              <JobDescriptionPreview jobDescription={jobDescription} />
              <div className="mt-4 flex justify-end">
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={() => window.location.href = `/?jobId=${jobDescription.id}`}
                >
                  Analyze Resumes
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12 bg-gray-50 rounded-lg border border-gray-200">
          <h3 className="text-lg font-medium mb-2">No Job Descriptions Found</h3>
          <p className="text-gray-600 mb-4">
            Add your first job description to get started with resume analysis.
          </p>
          <Button onClick={() => setShowUploader(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Job Description
          </Button>
        </div>
      )}
    </>
  );
}