import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Plus, ChevronLeft, Briefcase, Users, BarChart2 } from "lucide-react";
import { getJobDescriptions, getJobDescription, getJobRequirements } from "@/lib/api";
import JobDescriptionPreview from "@/components/job-description/preview";
import JobDescriptionUploader from "@/components/job-description/uploader";
import { useState } from "react";
import { useRoute, Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { formatDistance } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// The main job listing component
function JobListing({ onJobSelect }: { onJobSelect: (id: string) => void }) {
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
              <div className="mt-4 flex justify-end space-x-2">
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => onJobSelect(jobDescription.id)}
                >
                  View Details
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

// Job detail component
function JobDetail({ jobId }: { jobId: string }) {
  // Get the root URL for navigation
  const [, navigate] = useRoute("/jobs/:id");
  
  // Fetch job details
  const { data: job, isLoading: jobLoading, refetch: refetchJob } = useQuery({
    queryKey: [`/api/job-descriptions/${jobId}`],
    queryFn: () => getJobDescription(jobId),
    enabled: !!jobId
  });
  
  // Fetch job requirements
  const { data: requirements } = useQuery({
    queryKey: [`/api/job-descriptions/${jobId}/requirements`],
    queryFn: () => getJobRequirements(jobId),
    enabled: !!jobId
  });
  
  // Import the sync button
  const { SyncParsedJsonButton } = require('../components/SyncParsedJsonButton');
  
  if (jobLoading) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
        <p className="text-gray-500">Loading job details...</p>
      </div>
    );
  }
  
  if (!job) {
    return (
      <div className="text-center py-8">
        <p className="text-red-500">Job not found</p>
        <Link href="/jobs">
          <Button variant="outline" className="mt-4">
            <ChevronLeft className="mr-2 h-4 w-4" />
            Back to Jobs
          </Button>
        </Link>
      </div>
    );
  }
  
  const formatDate = (date: Date) => {
    return formatDistance(new Date(date), new Date(), { addSuffix: true });
  };
  
  return (
    <>
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center">
          <Link href="/jobs">
            <Button variant="ghost" size="sm" className="mr-2">
              <ChevronLeft className="h-4 w-4 mr-1" />
              Back
            </Button>
          </Link>
          <h1 className="text-2xl font-bold">{job.title}</h1>
        </div>
        <div className="text-sm text-gray-500">
          Added {formatDate(job.createdAt)}
        </div>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Job Overview</CardTitle>
            <CardDescription>
              {job.company || "Unknown Company"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <h3 className="font-medium">Description</h3>
                <p className="mt-2 text-gray-700 whitespace-pre-line">{job.description}</p>
              </div>
              
              <div>
                <h3 className="font-medium mt-4">Requirements</h3>
                <div className="mt-2 space-y-2">
                  {requirements && requirements.length > 0 ? (
                    requirements.map((req) => (
                      <div key={req.id} className="flex items-start gap-2 p-2 border-b">
                        <div className="flex-1">
                          <p className="text-gray-800">{req.requirement}</p>
                          <div className="flex gap-1 mt-1">
                            {req.tags?.map((tag) => (
                              <Badge key={tag} variant="outline" className="text-xs">
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        </div>
                        <Badge className={
                          req.importance === "high" ? "bg-red-100 text-red-800" : 
                          req.importance === "medium" ? "bg-yellow-100 text-yellow-800" : 
                          "bg-blue-100 text-blue-800"
                        }>
                          {req.importance}
                        </Badge>
                      </div>
                    ))
                  ) : (
                    <p className="text-gray-500 italic">No specific requirements defined.</p>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Link href={`/jobs/${jobId}/candidates`}>
                <Button className="w-full justify-start">
                  <Users className="mr-2 h-4 w-4" />
                  View Candidates
                </Button>
              </Link>
              
              <Link href={`/jobs/${jobId}/analytics`}>
                <Button className="w-full justify-start" variant="outline">
                  <BarChart2 className="mr-2 h-4 w-4" />
                  View Analytics
                </Button>
              </Link>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Job Details</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-500">Job Title</span>
                  <span className="font-medium">{job.title}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Company</span>
                  <span className="font-medium">{job.company || "Unknown"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Job Type</span>
                  <span className="font-medium">Full-time</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Uploaded</span>
                  <span className="font-medium">{formatDate(job.createdAt)}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}

export default function JobsPage() {
  // Check if we're on a job detail page
  const [match, params] = useRoute("/jobs/:id");
  const jobId = match ? params.id : null;
  
  // Route helper
  const navigateToJob = (id: string) => {
    window.location.href = `/jobs/${id}`;
  };
  
  return jobId ? (
    <JobDetail jobId={jobId} />
  ) : (
    <JobListing onJobSelect={navigateToJob} />
  );
}