import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import type { Resume } from "@shared/schema";
import { 
  Plus, Calendar, FileText, Trash2, AlertCircle, Filter, Search, 
  Briefcase, BarChart3, CircleDashed, CheckCircle, XCircle,
  ChevronLeft, Award, AlertTriangle, ChevronRight, CircleAlert, CircleCheck, Activity,
  RefreshCw
} from "lucide-react";
import { 
  getResumes, 
  getJobDescriptions, 
  deleteResume, 
  getResumeScores, 
  getJobDescription,
  getResumeRedFlagAnalysis,
  processRawAnalysisForJob,
  RedFlagAnalysis
} from "@/lib/api";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { formatDistanceToNow } from "date-fns";
import ResumeUploader from "@/components/resume/uploader";
import BatchMatchDialog from "@/components/resume/batch-match-dialog";
import { useState, useEffect } from "react";
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription 
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useRoute, Link, useLocation } from "wouter";

export default function CandidatesPage() {
  const [showUploader, setShowUploader] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [resumeToDelete, setResumeToDelete] = useState<string | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [resumeScores, setResumeScores] = useState<{
    [resumeId: string]: { 
      score: number, 
      matchedAt: Date,
      skills?: string[],
      redFlags?: string[],
      currentPosition?: { title: string, company: string } | null,
      parsingStatus?: string
    }
  }>({});
  
  // Loading state for data
  const [loadingAnalysis, setLoadingAnalysis] = useState<boolean>(false);
  
  // State for raw analysis processing
  const [processingRawAnalysis, setProcessingRawAnalysis] = useState<boolean>(false);
  const [sortField, setSortField] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  
  // Check if we're on a job-specific route
  const [jobMatch, jobParams] = useRoute("/jobs/:id/candidates");
  const jobId = jobMatch ? jobParams.id : null;
  const [selectedJobId, setSelectedJobId] = useState<string | null>(jobId);
  
  // Current page for pagination (1-based index)
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 50; // Number of items per page
  
  // Set selected job and default sort when route changes
  useEffect(() => {
    if (jobId) {
      setSelectedJobId(jobId);
      setSortField('score');
      setSortDirection('desc');
    }
  }, [jobId]);

  // Fetch resumes with pagination
  const {
    data: resumeData,
    isLoading,
    refetch: refetchResumes
  } = useQuery({
    queryKey: ['/api/resumes', currentPage, pageSize],
    queryFn: async () => {
      const data = await getResumes(currentPage, pageSize);
      return data;
    }
  });
  
  // Safely extract resume data with pagination
  const resumes = resumeData?.resumes || [];
  const totalResumes = resumeData?.pagination?.total || 0;
  const totalPages = Math.ceil(totalResumes / pageSize);

  // Fetch job descriptions for filter
  const { data: jobDescriptions } = useQuery({
    queryKey: ['/api/job-descriptions'],
    queryFn: getJobDescriptions
  });
  
  // Delete resume mutation
  const deleteResumeMutation = useMutation({
    mutationFn: (id: string) => deleteResume(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/resumes'] });
      toast({
        title: "Resume deleted",
        description: "The resume has been permanently removed."
      });
      setShowDeleteDialog(false);
      setResumeToDelete(null);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: `Failed to delete resume: ${error.message}`,
        variant: "destructive"
      });
    }
  });
  
  const handleDeleteClick = (id: string) => {
    setResumeToDelete(id);
    setShowDeleteDialog(true);
  };
  
  const handleDelete = () => {
    if (resumeToDelete) {
      deleteResumeMutation.mutate(resumeToDelete);
    }
  };

  const handleResumeUpload = () => {
    refetchResumes();
    setShowUploader(false);
    toast({
      title: "Resume uploaded",
      description: "Your resume has been successfully uploaded and is ready for analysis.",
    });
  };

  // Handle job selection from dropdown
  const handleJobSelect = (value: string) => {
    if (value === "all") {
      setSelectedJobId(null);
      setLocation("/candidates");
    } else {
      setSelectedJobId(value);
      setLocation(`/jobs/${value}/candidates`);
    }
  };

  // Format file size for display
  const formatFileSize = (sizeInBytes: number): string => {
    if (sizeInBytes < 1024) {
      return `${sizeInBytes} B`;
    } else if (sizeInBytes < 1024 * 1024) {
      return `${(sizeInBytes / 1024).toFixed(1)} KB`;
    } else {
      return `${(sizeInBytes / (1024 * 1024)).toFixed(1)} MB`;
    }
  };
  
  // Handle pagination
  const handleNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };
  
  const handlePrevPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };
  
  // Effect to fetch scores when job selection or resumes change
  useEffect(() => {
    const fetchScores = async () => {
      if (selectedJobId) {
        try {
          const data = await getResumeScores(null, selectedJobId, true);
          setResumeScores(data);
        } catch (error) {
          console.error("Error fetching scores:", error);
          setResumeScores({});
          // Show error toast for better user feedback
          toast({
            title: "Error loading match scores",
            description: "Unable to load candidate match scores. Please try again.",
            variant: "destructive"
          });
        }
      } else {
        setResumeScores({});
      }
    };
    
    fetchScores();
  }, [selectedJobId, resumes, toast, currentPage]);

  // Handle processing of raw analysis
  const handleProcessRawAnalysis = async () => {
    if (!selectedJobId) return;
    
    try {
      setProcessingRawAnalysis(true);
      
      const result = await processRawAnalysisForJob(selectedJobId);
      
      toast({
        title: "Processing complete",
        description: `${result.processed || 0} analyses processed successfully. ${result.skipped || 0} skipped. ${result.errors || 0} errors.`,
        variant: "default"
      });
      
      // Refresh the data after processing
      if (result.processed > 0) {
        console.log("Raw analysis processing completed successfully, refreshing data...");
        
        // Fetch updated scores
        const updatedScores = await getResumeScores(null, selectedJobId, true);
        setResumeScores(updatedScores);
      }
    } catch (error) {
      console.error("Error processing raw analysis:", error);
      toast({
        title: "Processing error",
        description: "Failed to process analysis data. Please try again.",
        variant: "destructive"
      });
    } finally {
      setProcessingRawAnalysis(false);
    }
  };
  
  // Handle sorting toggle
  const handleSort = (field: string) => {
    if (sortField === field) {
      // Toggle direction if clicking the same field
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // Set new field and default to descending for score (highest first)
      setSortField(field);
      setSortDirection(field === 'score' ? 'desc' : 'asc');
    }
  };

  // Filter resumes based on search query
  const filteredResumes = resumes.filter(resume => {
    // Apply name filter
    const nameMatch = !searchQuery || 
      (resume.candidateName?.toLowerCase().includes(searchQuery.toLowerCase()) || 
       resume.fileName.toLowerCase().includes(searchQuery.toLowerCase()));
    return nameMatch;
  });
  
  // Sort resumes if sorting is enabled
  const sortedResumes = [...filteredResumes].sort((a, b) => {
    if (!sortField) return 0;
    
    if (sortField === 'score') {
      const scoreA = resumeScores[a.id]?.score || 0;
      const scoreB = resumeScores[b.id]?.score || 0;
      return sortDirection === 'asc' ? scoreA - scoreB : scoreB - scoreA;
    }
    
    if (sortField === 'name') {
      const nameA = a.candidateName || '';
      const nameB = b.candidateName || '';
      return sortDirection === 'asc' 
        ? nameA.localeCompare(nameB) 
        : nameB.localeCompare(nameA);
    }
    
    if (sortField === 'date') {
      const dateA = new Date(a.createdAt).getTime();
      const dateB = new Date(b.createdAt).getTime();
      return sortDirection === 'asc' ? dateA - dateB : dateB - dateA;
    }
    
    return 0;
  });

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
        <h1 className="text-2xl font-bold">Candidates</h1>
        
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            onClick={() => setLocation("/job-match")}
          >
            <Briefcase className="mr-2 h-4 w-4" /> 
            Match All with Job
          </Button>
          <Button onClick={() => setShowUploader(true)}>
            <Plus className="mr-2 h-4 w-4" /> Add Candidate
          </Button>
        </div>
      </div>
      
      <div className="bg-white p-6 rounded-lg shadow-sm mb-6">
        <div className="flex flex-col md:flex-row gap-4 items-start mb-4">
          {/* Search bar */}
          <div className="relative w-full md:w-auto flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search by name or filename..."
              className="pl-9 w-full"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          
          {/* Job selection filter */}
          <div className="w-full md:w-auto">
            <Select
              value={selectedJobId || "all"}
              onValueChange={handleJobSelect}
            >
              <SelectTrigger className="w-full md:w-[300px]">
                <div className="flex items-center">
                  <Filter className="mr-2 h-4 w-4 text-gray-500" />
                  <SelectValue placeholder="Select a job to filter resumes" />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all"># All Candidates</SelectItem>
                {jobDescriptions && jobDescriptions.map(job => (
                  <SelectItem key={job.id} value={job.id}>
                    # {job.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!selectedJobId && (
              <p className="text-xs text-amber-600 mt-2 flex items-center">
                <AlertTriangle className="h-3 w-3 mr-1" />
                Select a job to see match scores, red flags, and candidate highlights
              </p>
            )}
          </div>
        </div>
        
        {selectedJobId && (
          <div className="flex justify-end mb-4">
            <Button 
              variant="outline"
              size="sm"
              className="flex items-center"
              onClick={handleProcessRawAnalysis}
              disabled={processingRawAnalysis}
            >
              {processingRawAnalysis ? (
                <>
                  <div className="animate-spin w-4 h-4 border-2 border-primary border-t-transparent rounded-full mr-2"></div>
                  Processing...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 mr-1.5" />
                  Reprocess Analysis Data
                </>
              )}
            </Button>
          </div>
        )}
      </div>

      {!selectedJobId && (
        <div className="bg-amber-50 border border-amber-200 rounded-md px-4 py-3 mb-6">
          <div className="flex">
            <div className="flex-shrink-0">
              <AlertCircle className="h-5 w-5 text-amber-400" />
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-amber-800">
                Job selection needed
              </h3>
              <div className="mt-1 text-sm text-amber-700">
                <p>To see additional columns (Match Score, Current Position, Skills, and Red Flags), please select a job from the dropdown menu above.</p>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {showUploader ? (
        <div className="mb-8">
          <ResumeUploader onSuccess={handleResumeUpload} buttonText="Upload Resume" />
          <div className="mt-4">
            <Button variant="outline" onClick={() => setShowUploader(false)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : null}

      {/* Sorting and Pagination Controls */}
      {totalResumes > 0 && (
        <div className="flex flex-col md:flex-row justify-between items-center mb-4 text-sm text-gray-500 gap-3">
          <div className="flex items-center">
            <div className="mr-4">
              Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, totalResumes)} of {totalResumes} candidates
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrevPage}
              disabled={currentPage <= 1}
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleNextPage}
              disabled={currentPage >= totalPages}
            >
              Next
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="text-center py-8">
          <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-gray-500">Loading candidates...</p>
        </div>
      ) : sortedResumes.length > 0 ? (
        <div className="overflow-x-auto bg-white rounded-lg shadow-sm">
          {/* Table layout for candidates */}
          <table className="w-full min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                   onClick={() => handleSort('name')}>
                  <div className="flex items-center">
                    Candidate
                    {sortField === 'name' && (
                      <span className="ml-1">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </div>
                </th>
                {selectedJobId && (
                  <>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                        onClick={() => handleSort('score')}>
                      <div className="flex items-center">
                        Match Score
                        {sortField === 'score' && (
                          <span className="ml-1">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                        )}
                      </div>
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Current Position
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Skills
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Red Flags
                    </th>
                  </>
                )}
                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {sortedResumes.map(resume => {
                // Get resume score data and enhanced data from our API
                const scoreData = resumeScores[resume.id];
                const scoreValue = scoreData?.score || 0;
                const currentPosition = scoreData?.currentPosition || null;
                const skills = scoreData?.skills || [];
                const redFlags = scoreData?.redFlags || [];
                const parsingStatus = scoreData?.parsingStatus || 'pending';
                
                return (
                  <tr key={resume.id} className="hover:bg-gray-50">
                    {/* Candidate Name */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-start">
                        <div className="ml-0">
                          <div className="text-sm font-medium text-gray-900">
                            {resume.candidateName || 'Unnamed Candidate'}
                          </div>
                          <div className="text-xs text-gray-500">
                            {resume.fileName} • {formatFileSize(resume.fileSize)}
                          </div>
                          <div className="text-xs text-gray-500">
                            Uploaded {formatDistanceToNow(new Date(resume.createdAt), { addSuffix: true })}
                          </div>
                        </div>
                      </div>
                    </td>
                    
                    {/* Score and other columns only visible when job selected */}
                    {selectedJobId && (
                      <>
                        {/* Match Score */}
                        <td className="px-6 py-4 whitespace-nowrap">
                          {scoreData ? (
                            <div className="flex items-center">
                              <div className={`text-sm font-medium px-2.5 py-0.5 rounded-full 
                                ${scoreValue >= 80 ? 'bg-green-100 text-green-800' : 
                                scoreValue >= 60 ? 'bg-blue-100 text-blue-800' : 
                                scoreValue >= 40 ? 'bg-yellow-100 text-yellow-800' : 
                                'bg-red-100 text-red-800'}`}>
                                {scoreValue}%
                              </div>
                            </div>
                          ) : parsingStatus === 'pending' ? (
                            <Button 
                              variant="outline" 
                              size="sm" 
                              onClick={handleProcessRawAnalysis}
                              className="text-xs"
                            >
                              Process Data
                            </Button>
                          ) : (
                            <span className="text-gray-400 text-sm">Not analyzed</span>
                          )}
                        </td>
                        
                        {/* Current Position */}
                        <td className="px-6 py-4">
                          {currentPosition ? (
                            <div className="text-sm text-gray-900">
                              <div className="font-medium">{currentPosition.title}</div>
                              <div className="text-gray-500">{currentPosition.company}</div>
                            </div>
                          ) : (
                            <span className="text-gray-400 text-sm">No data available</span>
                          )}
                        </td>
                        
                        {/* Skills */}
                        <td className="px-6 py-4">
                          <div className="flex flex-wrap gap-1 max-w-xs">
                            {skills && skills.length > 0 ? 
                              skills.slice(0, 3).map((skill, idx) => (
                                <span key={idx} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                                  {skill}
                                </span>
                              )) : (
                                <span className="text-gray-400 text-sm">No skills data</span>
                              )
                            }
                            {skills && skills.length > 3 && (
                              <span className="text-xs text-blue-600">+{skills.length - 3} more</span>
                            )}
                          </div>
                        </td>
                        
                        {/* Red Flags */}
                        <td className="px-6 py-4">
                          <ul className="space-y-1 text-sm max-w-xs">
                            {redFlags && redFlags.length > 0 ? 
                              redFlags.slice(0, 2).map((flag, idx) => (
                                <li key={idx} className="flex items-start">
                                  <XCircle className="h-4 w-4 mr-1 text-red-500 mt-0.5 flex-shrink-0" />
                                  <span className="text-xs">{flag.length > 60 ? `${flag.substring(0, 60)}...` : flag}</span>
                                </li>
                              )) : (
                                <span className="text-gray-400 text-sm">No red flags</span>
                              )
                            }
                            {redFlags && redFlags.length > 2 && (
                              <li className="text-xs text-blue-600">+{redFlags.length - 2} more</li>
                            )}
                          </ul>
                        </td>
                      </>
                    )}
                    
                    {/* Actions */}
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex justify-end space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setLocation(`/resume/${resume.id}`)}
                        >
                          View
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-500 hover:text-red-700 hover:bg-red-50"
                          onClick={() => handleDeleteClick(resume.id)}
                        >
                          Delete
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="text-center py-8 bg-white rounded-lg shadow-sm">
          <CircleDashed className="h-12 w-12 mx-auto text-gray-400 mb-4" />
          <h3 className="text-lg font-medium mb-2">No resumes found</h3>
          <p className="text-gray-500 mb-4">
            {searchQuery ? `No matches found for "${searchQuery}"` : 'Upload resumes to get started'}
          </p>
          <Button onClick={() => setShowUploader(true)}>
            <Plus className="mr-2 h-4 w-4" /> Upload Resume
          </Button>
        </div>
      )}

      {/* Delete confirmation dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Resume</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this resume? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setShowDeleteDialog(false)}
            >
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleDelete} 
              disabled={deleteResumeMutation.isPending}
            >
              {deleteResumeMutation.isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
