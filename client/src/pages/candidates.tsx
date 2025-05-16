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
          
          // Create an array of promises to fetch analysis for each resume
          const promises = visibleResumes.map(async (resume) => {
            try {
              const result = await getResumeRedFlagAnalysis(resume.id, selectedJobId);
              tempAnalysis[resume.id] = result.analysis;
            } catch (err) {
              console.error(`Error analyzing resume ${resume.id}:`, err);
              // Continue with other resumes even if one fails
            }
          });
          
          // Wait for all promises to resolve
          await Promise.all(promises);
          
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
    
    // Only fetch analysis if we have scores (to prevent duplicate API calls)
    if (Object.keys(resumeScores).length > 0) {
      fetchAnalysis();
    }
  }, [selectedJobId, resumes, resumeScores, currentPage]);
  
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

      {/* Pagination information */}
      {totalResumes > 0 && (
        <div className="flex justify-between items-center mb-4 text-sm text-gray-500">
          <div>
            Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, totalResumes)} of {totalResumes} candidates
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
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th 
                  scope="col" 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('name')}
                >
                  <div className="flex items-center">
                    Candidate
                    {sortField === 'name' && (
                      <span className="ml-1">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </div>
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  File
                </th>
                <th 
                  scope="col" 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('date')}
                >
                  <div className="flex items-center">
                    Uploaded
                    {sortField === 'date' && (
                      <span className="ml-1">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </div>
                </th>
                <th 
                  scope="col" 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('score')}
                >
                  <div className="flex items-center">
                    <BarChart3 className="h-4 w-4 mr-1 text-primary" />
                    Match Score
                    {sortField === 'score' && (
                      <span className="ml-1">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </div>
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <div className="flex items-center">
                    <Briefcase className="h-4 w-4 mr-1 text-gray-500" />
                    Current Position
                  </div>
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <div className="flex items-center">
                    <Award className="h-4 w-4 mr-1 text-gray-500" />
                    Highlights
                  </div>
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <div className="flex items-center">
                    <AlertCircle className="h-4 w-4 mr-1 text-gray-500" />
                    Red Flags
                  </div>
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {sortedResumes.map(resume => (
                <tr key={resume.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-start">
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900">
                          {resume.candidateName || 'Unnamed Candidate'}
                        </div>
                        {resume.candidateTitle && (
                          <div className="text-sm text-gray-500">
                            {resume.candidateTitle}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <FileText className="h-4 w-4 mr-2 text-gray-400" />
                      <div className="text-sm text-gray-900">
                        {resume.fileName}
                        <div className="text-xs text-gray-500">
                          {formatFileSize(resume.fileSize)}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {formatDate(resume.createdAt)}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {!selectedJobId ? (
                      <div className="text-sm text-gray-400 italic">
                        Select a job
                      </div>
                    ) : loadingAnalysis ? (
                      <div className="h-5 w-16 bg-gray-200 animate-pulse rounded"></div>
                    ) : resumeScores[resume.id] ? (
                      <div className="flex items-center">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="flex items-center">
                                <Progress 
                                  value={resumeScores[resume.id].score} 
                                  className="w-16 h-2 mr-2"
                                />
                                <span className="text-sm font-medium">
                                  {resumeScores[resume.id].score}%
                                </span>
                                <div className="text-xs text-gray-500 ml-2">
                                  {formatDate(resumeScores[resume.id].matchedAt)}
                                </div>
                              </div>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Match score: {resumeScores[resume.id].score}%</p>
                              <p>Matched {formatDate(resumeScores[resume.id].matchedAt)}</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                    ) : (
                      <div className="flex items-center text-gray-400">
                        <CircleDashed className="h-4 w-4 mr-1" />
                        <span className="text-sm">Not matched</span>
                      </div>
                    )}
                  </td>
                  
                  {/* Current Position column */}
                  <td className="px-6 py-4">
                    {loadingAnalysis ? (
                      <div className="h-4 w-24 bg-gray-200 animate-pulse rounded"></div>
                    ) : resumeAnalysis[resume.id] ? (
                      <div className="flex items-center text-sm">
                        <Briefcase className="h-4 w-4 mr-1 text-gray-500" />
                        <span className="font-medium">
                          {resumeAnalysis[resume.id].currentJobPosition || 
                           (resumeAnalysis[resume.id].isCurrentlyEmployed ? 
                             "Employed" : "Unemployed")}
                        </span>
                      </div>
                    ) : !selectedJobId ? (
                      <div className="text-sm text-gray-400 italic">
                        Select a job
                      </div>
                    ) : (
                      <div className="flex items-center text-gray-400">
                        <CircleDashed className="h-4 w-4 mr-1" />
                        <span className="text-sm">Not analyzed</span>
                      </div>
                    )}
                  </td>
                  
                  {/* Highlights column */}
                  <td className="px-6 py-4">
                    {loadingAnalysis ? (
                      <div className="space-y-1">
                        <div className="h-3 w-32 bg-gray-200 animate-pulse rounded"></div>
                        <div className="h-3 w-24 bg-gray-200 animate-pulse rounded"></div>
                      </div>
                    ) : resumeAnalysis[resume.id] && resumeAnalysis[resume.id].highlights?.length ? (
                      <div className="space-y-1">
                        {resumeAnalysis[resume.id].highlights.slice(0, 2).map((highlight, idx) => (
                          <div key={idx} className="flex items-center text-sm">
                            <CheckCircle className="h-3.5 w-3.5 mr-1 text-emerald-500" />
                            <span className="text-xs">{highlight}</span>
                          </div>
                        ))}
                        {resumeAnalysis[resume.id].highlights.length > 2 && (
                          <div className="text-xs text-primary">
                            +{resumeAnalysis[resume.id].highlights.length - 2} more
                          </div>
                        )}
                      </div>
                    ) : !selectedJobId ? (
                      <div className="text-sm text-gray-400 italic">
                        Select a job
                      </div>
                    ) : (
                      <div className="flex items-center text-gray-400">
                        <CircleDashed className="h-4 w-4 mr-1" />
                        <span className="text-sm">None identified</span>
                      </div>
                    )}
                  </td>
                  
                  {/* Red Flags column */}
                  <td className="px-6 py-4">
                    {loadingAnalysis ? (
                      <div className="space-y-1">
                        <div className="h-3 w-32 bg-gray-200 animate-pulse rounded"></div>
                        <div className="h-3 w-24 bg-gray-200 animate-pulse rounded"></div>
                      </div>
                    ) : resumeAnalysis[resume.id] && resumeAnalysis[resume.id].redFlags?.length ? (
                      <div className="space-y-1">
                        {resumeAnalysis[resume.id].redFlags.slice(0, 2).map((flag, idx) => (
                          <div key={idx} className="flex items-center text-sm">
                            <XCircle className="h-3.5 w-3.5 mr-1 text-red-500" />
                            <span className="text-xs">{flag}</span>
                          </div>
                        ))}
                        {resumeAnalysis[resume.id].redFlags.length > 2 && (
                          <div className="text-xs text-primary">
                            +{resumeAnalysis[resume.id].redFlags.length - 2} more
                          </div>
                        )}
                      </div>
                    ) : !selectedJobId ? (
                      <div className="text-sm text-gray-400 italic">
                        Select a job
                      </div>
                    ) : (
                      <div className="flex items-center text-gray-400">
                        <CircleDashed className="h-4 w-4 mr-1" />
                        <span className="text-sm">None identified</span>
                      </div>
                    )}
                  </td>
                  
                  {/* Actions column */}
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex space-x-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setLocation(`/resumes/${resume.id}`)}
                      >
                        <Activity className="h-4 w-4 mr-1" />
                        View
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteClick(resume.id)}
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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