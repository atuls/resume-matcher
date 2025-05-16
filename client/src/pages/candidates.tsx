import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import type { Resume } from "@shared/schema";
import { 
  Plus, Calendar, FileText, Trash2, AlertCircle, Filter, Search, 
  Briefcase, BarChart3, CircleDashed, CheckCircle, XCircle,
  ChevronLeft, Award, AlertTriangle, ChevronRight, CircleAlert, CircleCheck, Activity
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
    [resumeId: string]: { score: number, matchedAt: Date }
  }>({});
  // State for red flag analysis
  const [resumeAnalysis, setResumeAnalysis] = useState<{
    [resumeId: string]: RedFlagAnalysis
  }>({});
  
  // Loading state for red flag analysis
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
  
  // Set selected job when route changes
  useEffect(() => {
    if (jobId) {
      setSelectedJobId(jobId);
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
  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteResume(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/resumes'] });
      toast({
        title: "Resume deleted",
        description: "The resume has been successfully deleted."
      });
      setShowDeleteDialog(false);
    },
    onError: (error) => {
      toast({
        title: "Error deleting resume",
        description: "Failed to delete resume. Please try again.",
        variant: "destructive"
      });
    }
  });

  // Handle successful resume upload
  const handleResumeUpload = (data: Resume | Resume[]) => {
    setShowUploader(false);
    refetchResumes();
    if (Array.isArray(data)) {
      toast({
        title: `${data.length} resumes uploaded`,
        description: "Multiple candidate resumes have been successfully uploaded.",
      });
    } else {
      toast({
        title: "Resume uploaded",
        description: "The candidate resume has been successfully uploaded.",
      });
    }
  };

  // Format date for display
  const formatDate = (dateInput: Date | string) => {
    try {
      if (!dateInput) return 'Unknown date';
      
      // Ensure we have a Date object
      const date = dateInput instanceof Date ? dateInput : new Date(dateInput);
      
      // Validate the date
      if (isNaN(date.getTime())) return 'Invalid date';
      
      return formatDistanceToNow(date, { addSuffix: true });
    } catch (error) {
      console.warn('Date formatting error:', error, dateInput);
      return 'Invalid date';
    }
  };

  // Format file size for display
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1048576).toFixed(1) + ' MB';
  };
  
  // Effect to fetch scores when job selection or resumes change
  useEffect(() => {
    const fetchScores = async () => {
      if (selectedJobId && resumes.length > 0) {
        try {
          console.log("Fetching scores for job:", selectedJobId);
          
          // First try to get all existing scores for this job (faster approach)
          let scores = await getResumeScores(
            null, 
            selectedJobId,
            true // Only get existing scores
          );
          
          // Debug the scores received
          console.log("Scores for current set of resumes:", scores);
          console.log("Sample score for debugging:", 
            Object.keys(scores).length > 0 ? 
            scores[Object.keys(scores)[0]] : 
            "No scores found");
          
          // If that doesn't return data for the current visible resumes,
          // make a targeted request for just the current page of resumes
          if (Object.keys(scores).length === 0) {
            console.log("No existing scores found, fetching specific resume scores");
            const resumeIds = resumes.map(r => r.id);
            scores = await getResumeScores(resumeIds, selectedJobId);
          }
          
          console.log(`Loaded ${Object.keys(scores).length} scores for job ${selectedJobId}`);
          
          // Ensure each score is properly formatted
          const formattedScores: {[id: string]: {score: number, matchedAt: Date}} = {};
          for (const [id, scoreData] of Object.entries(scores)) {
            if (scoreData && typeof scoreData === 'object') {
              if ('score' in scoreData) {
                formattedScores[id] = {
                  score: Number(scoreData.score),
                  matchedAt: scoreData.matchedAt instanceof Date ? 
                    scoreData.matchedAt : 
                    new Date(scoreData.matchedAt as any)
                };
              }
            }
          }
          
          console.log("Formatted scores for display:", formattedScores);
          setResumeScores(formattedScores);
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
  
  // Effect to fetch red flag analysis when job selection or resumes change
  useEffect(() => {
    const fetchAnalysis = async () => {
      if (selectedJobId && resumes.length > 0) {
        try {
          setLoadingAnalysis(true);
          // Create a temporary object to store analysis results
          const tempAnalysis: {[resumeId: string]: RedFlagAnalysis} = {};
          
          // Process only visible resumes (current page)
          const visibleResumes = resumes.slice(0, Math.min(resumes.length, 20));
          
          console.log("Fetching analysis for", visibleResumes.length, "visible resumes");
          
          // Create an array of promises to fetch analysis for each resume
          const promises = visibleResumes.map(async (resume) => {
            try {
              // Add timestamp to prevent caching
              const timestamp = Date.now();
              
              // Always fetch fresh data from the server with cache-busting
              const result = await getResumeRedFlagAnalysis(resume.id, selectedJobId);
              
              console.log(`Got analysis for ${resume.id}:`, result.analysis);
              
              if (result.analysis) {
                tempAnalysis[resume.id] = result.analysis;
              }
            } catch (err) {
              console.error(`Error analyzing resume ${resume.id}:`, err);
              // Continue with other resumes even if one fails
            }
          });
          
          // Wait for all promises to resolve
          await Promise.all(promises);
          
          console.log("Setting analysis data for", Object.keys(tempAnalysis).length, "resumes");
          setResumeAnalysis(tempAnalysis);
        } catch (error) {
          console.error("Error fetching red flag analysis:", error);
          // Don't show a toast here as we're already showing one for scores if they fail
        } finally {
          setLoadingAnalysis(false);
        }
      } else {
        setResumeAnalysis({});
      }
    };
    
    // Always fetch analysis when the job selection changes, regardless of scores
    fetchAnalysis();
    
  }, [selectedJobId, resumes, currentPage]);
  
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
  
  // Handler for processing raw analysis
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
      
      // Refresh the analysis data after processing
      if (result.processed > 0) {
        console.log("Raw analysis processing completed successfully, refreshing data...");
        
        // Reset the analysis state
        setResumeAnalysis({});
        
        // Invalidate queries to force refetching data
        queryClient.invalidateQueries({
          queryKey: [`/api/job-descriptions/${selectedJobId}/candidates`]
        });
        
        // Create a small delay to allow the server to process all the changes
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Use the same fetch mechanism we use in the useEffect to refresh data
        // Re-fetch analysis for visible resumes
        const tempAnalysis: Record<string, RedFlagAnalysis> = {};
        setLoadingAnalysis(true);
        
        const promises = resumes.map(async (resume) => {
          try {
            const result = await getResumeRedFlagAnalysis(resume.id, selectedJobId);
            tempAnalysis[resume.id] = result.analysis;
          } catch (err) {
            console.error(`Error analyzing resume ${resume.id}:`, err);
          }
        });
        
        await Promise.all(promises);
        setResumeAnalysis(tempAnalysis);
        setLoadingAnalysis(false);
        
        // Force trigger a re-render rather than reloading the whole page
        if (selectedJobId) {
          // Update state to trigger useEffect hooks to run again
          setCurrentPage(1); // Reset to first page
          
          // Invalidate score data to force refresh
          queryClient.invalidateQueries({
            queryKey: [`/api/job-descriptions/${selectedJobId}/resume-scores`]
          });
        }
      }
    } catch (error) {
      console.error("Error processing raw analysis:", error);
      toast({
        title: "Error processing analysis",
        description: error instanceof Error ? error.message : "An unknown error occurred",
        variant: "destructive"
      });
    } finally {
      setProcessingRawAnalysis(false);
    }
  };

  // Handle delete confirmation
  const handleDeleteClick = (id: string) => {
    setResumeToDelete(id);
    setShowDeleteDialog(true);
  };
  
  // Execute delete
  const confirmDelete = () => {
    if (resumeToDelete) {
      deleteMutation.mutate(resumeToDelete);
    }
  };

  // Navigation controls for pagination
  const goToNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(prev => prev + 1);
    }
  };

  const goToPrevPage = () => {
    if (currentPage > 1) {
      setCurrentPage(prev => prev - 1);
    }
  };

  // Fetch job details if we're on a job-specific route
  const { data: jobDetail } = useQuery({
    queryKey: [`/api/job-descriptions/${jobId}`],
    queryFn: () => jobId ? getJobDescription(jobId) : null,
    enabled: !!jobId,
  });

  return (
    <>
      <div className="flex justify-between items-center mb-6">
        {jobId && jobDetail ? (
          <div className="flex items-center">
            <Link href="/jobs">
              <Button variant="ghost" size="sm" className="mr-2">
                <ChevronLeft className="h-4 w-4 mr-1" />
                Back to Jobs
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold">Candidates for {jobDetail.title}</h1>
              <p className="text-gray-500">{jobDetail.company}</p>
            </div>
          </div>
        ) : (
          <h1 className="text-2xl font-bold">Candidates</h1>
        )}
        
        <div className="flex space-x-2">
          {filteredResumes.length > 0 && (
            <BatchMatchDialog 
              resumes={resumes}
              filteredResumeIds={filteredResumes.map(r => r.id)}
              buttonVariant="outline"
              preselectedJobId={jobId || undefined}
            />
          )}
          <Button onClick={() => setShowUploader(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Candidate
          </Button>
        </div>
      </div>
      
      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <div className="flex-1 relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
          <Input 
            placeholder="Search by name or filename..." 
            className="pl-9"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        
        <div className="w-full md:w-64">
          <Select value={selectedJobId || "all"} onValueChange={(val) => setSelectedJobId(val === "all" ? null : val)}>
            <SelectTrigger>
              <div className="flex items-center">
                <Filter className="h-4 w-4 mr-2 text-gray-400" />
                <SelectValue placeholder="Filter by job" />
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Jobs</SelectItem>
              {jobDescriptions?.map(job => (
                <SelectItem key={job.id} value={job.id}>
                  {job.title}
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
                <p>To see additional columns (Match Score, Current Position, Highlights, and Red Flags), please select a job from the dropdown menu above.</p>
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
            
            <div className="flex items-center gap-2">
              {selectedJobId && (
                <div className="flex items-center bg-white rounded-md border p-1.5 shadow-sm">
                  <span className="mr-2 font-medium">Sort by:</span>
                  <div className="flex bg-gray-100 rounded p-0.5">
                    <button
                      className={`px-3 py-1 rounded text-sm ${sortField !== 'score' ? 'bg-white shadow-sm' : ''}`}
                      onClick={() => handleSort('name')}
                    >
                      Name
                    </button>
                    <button
                      className={`px-3 py-1 rounded text-sm ${sortField === 'score' ? 'bg-white shadow-sm' : ''}`}
                      onClick={() => handleSort('score')}
                    >
                      Match Score
                    </button>
                  </div>
                  <button 
                    className="ml-2 p-1 rounded hover:bg-gray-100"
                    onClick={() => setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')}
                    title={sortDirection === 'asc' ? 'Ascending' : 'Descending'}
                  >
                    {sortDirection === 'asc' ? '↑' : '↓'}
                  </button>
                </div>
              )}
              
              {selectedJobId && (
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
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={goToPrevPage} 
              disabled={currentPage === 1}
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>
            <span>Page {currentPage} of {totalPages}</span>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={goToNextPage} 
              disabled={currentPage === totalPages}
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
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          {/* Revised display layout - simpler card layout for each candidate */}
          <div className="space-y-0">
            {sortedResumes.map(resume => (
              <div key={resume.id} className="p-4 border-b hover:bg-gray-50 relative">
                <div className="flex justify-between items-start">
                  {/* Main content - candidate info */}
                  <div className="flex-1">
                    <h3 className="text-lg font-medium">
                      {resume.candidateName || 'Unnamed Candidate'}
                    </h3>
                    {resume.candidateTitle && (
                      <p className="text-gray-600">{resume.candidateTitle}</p>
                    )}
                    
                    {/* File info */}
                    <div className="flex items-center mt-2 text-sm text-gray-500">
                      <FileText className="h-4 w-4 mr-1.5" />
                      <span>{resume.fileName} ({formatFileSize(resume.fileSize)})</span>
                      <span className="mx-2">•</span>
                      <Calendar className="h-4 w-4 mr-1.5" />
                      <span>Uploaded {formatDate(resume.createdAt)}</span>
                    </div>
                    
                    {/* Score display */}
                    {selectedJobId && (
                      <div className="mt-3">
                        {loadingAnalysis ? (
                          <div className="h-5 w-32 bg-gray-200 animate-pulse rounded"></div>
                        ) : resumeScores[resume.id] ? (
                          <div className="flex items-center">
                            <BarChart3 className="h-5 w-5 mr-2 text-primary" />
                            <div>
                              <div className="font-semibold">
                                {resumeScores[resume.id].score}% Match
                              </div>
                              <div className="text-xs text-gray-500">
                                Matched {formatDate(resumeScores[resume.id].matchedAt)}
                              </div>
                            </div>
                            <Progress 
                              value={resumeScores[resume.id].score} 
                              className="w-24 h-2 ml-3"
                            />
                          </div>
                        ) : (
                          <div className="flex items-center text-gray-400">
                            <CircleDashed className="h-5 w-5 mr-2" />
                            <span>Not matched</span>
                          </div>
                        )}
                      </div>
                    )}
                    
                    {/* Current Position + Highlights & Red Flags */}
                    {selectedJobId && (
                      <div className="grid grid-cols-3 gap-4 mt-4">
                        {/* Current Position */}
                        <div>
                          <div className="text-sm font-medium mb-1 flex items-center">
                            <Briefcase className="h-4 w-4 mr-1 text-gray-500" />
                            Current Position
                          </div>
                          {loadingAnalysis ? (
                            <div className="h-4 w-24 bg-gray-200 animate-pulse rounded"></div>
                          ) : resumeAnalysis[resume.id] ? (
                            <div className="text-sm">
                              {resumeAnalysis[resume.id].currentJobPosition || 
                               (resumeAnalysis[resume.id].isCurrentlyEmployed ? 
                                 "Employed" : "Unemployed") || 
                                "Unknown"}
                            </div>
                          ) : (
                            <div className="text-sm text-gray-400">Loading data...</div>
                          )}
                        </div>
                        
                        {/* Highlights */}
                        <div>
                          <div className="text-sm font-medium mb-1 flex items-center">
                            <Award className="h-4 w-4 mr-1 text-gray-500" />
                            Highlights
                          </div>
                          {loadingAnalysis ? (
                            <div>
                              <div className="h-3 w-32 bg-gray-200 animate-pulse rounded mb-1"></div>
                              <div className="h-3 w-24 bg-gray-200 animate-pulse rounded"></div>
                            </div>
                          ) : resumeAnalysis[resume.id] && resumeAnalysis[resume.id].highlights?.length > 0 ? (
                            <div className="space-y-1">
                              {resumeAnalysis[resume.id].highlights.slice(0, 2).map((highlight, idx) => (
                                <div key={idx} className="text-sm flex items-center">
                                  <CheckCircle className="h-3.5 w-3.5 mr-1 text-emerald-500 flex-shrink-0" />
                                  <span className="text-xs line-clamp-1">{highlight}</span>
                                </div>
                              ))}
                              {resumeAnalysis[resume.id].highlights.length > 2 && (
                                <div className="text-xs text-primary">
                                  +{resumeAnalysis[resume.id].highlights.length - 2} more
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="text-sm text-gray-400">None identified</div>
                          )}
                        </div>
                        
                        {/* Red Flags */}
                        <div>
                          <div className="text-sm font-medium mb-1 flex items-center">
                            <AlertCircle className="h-4 w-4 mr-1 text-gray-500" />
                            Red Flags
                          </div>
                          {loadingAnalysis ? (
                            <div>
                              <div className="h-3 w-32 bg-gray-200 animate-pulse rounded mb-1"></div>
                              <div className="h-3 w-24 bg-gray-200 animate-pulse rounded"></div>
                            </div>
                          ) : resumeAnalysis[resume.id] && resumeAnalysis[resume.id].redFlags?.length ? (
                            <div className="space-y-1">
                              {resumeAnalysis[resume.id].redFlags.slice(0, 2).map((flag, idx) => (
                                <div key={idx} className="text-sm flex items-center">
                                  <XCircle className="h-3.5 w-3.5 mr-1 text-red-500 flex-shrink-0" />
                                  <span className="text-xs line-clamp-1">{flag}</span>
                                </div>
                              ))}
                              {resumeAnalysis[resume.id].redFlags.length > 2 && (
                                <div className="text-xs text-primary">
                                  +{resumeAnalysis[resume.id].redFlags.length - 2} more
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="text-sm text-gray-400">None identified</div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                  
                  {/* Actions */}
                  <div className="flex space-x-2 ml-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setLocation(`/resume/${resume.id}`)}
                    >
                      <Activity className="h-4 w-4 mr-1" />
                      View
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDeleteClick(resume.id)}
                    >
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="text-center py-12 bg-white rounded-lg shadow-sm">
          <FileText className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-1">No candidates found</h3>
          <p className="text-gray-500 mb-4">
            {searchQuery ? 'No candidates match your search criteria' : 'No candidate resumes have been uploaded yet'}
          </p>
          <Button onClick={() => setShowUploader(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Candidate
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
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>Cancel</Button>
            <Button variant="destructive" onClick={confirmDelete}>
              {deleteMutation.isPending ? (
                <>
                  <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full mr-2"></div>
                  Deleting...
                </>
              ) : (
                'Delete'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}