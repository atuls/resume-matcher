import React, { useState, useEffect } from 'react';
import { useLocation, useRoute } from 'wouter';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  BarChart3, Calendar, FileText, AlertTriangle, Briefcase,
  Filter, Search, AlertCircle, Award, RotateCcw, CircleDashed,
  ChevronRight, CircleAlert, CircleCheck, Trash2
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { queryClient } from '@/lib/queryClient';

import ResumeUploader from '@/components/resume/uploader';
import {
  getJobDescriptions,
  getResumes,
  getResumeScores,
  getResumeRedFlagAnalysis,
  deleteResume
} from '@/lib/api';
import { formatDate, formatFileSize } from '@/lib/utils';

export default function CandidatesPage() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [candidatesMatch, candidatesParams] = useRoute('/candidates/:jobId?');
  const [jobsMatch, jobsParams] = useRoute('/jobs/:id/candidates');
  
  // Get jobId from either route pattern
  const jobId = jobsParams?.id || candidatesParams?.jobId;
  
  // Initialize with jobId from URL if available
  const initialJobId = typeof jobId === 'string' ? jobId : null;
  const [selectedJobId, setSelectedJobId] = useState<string | null>(initialJobId);
  const [showUploader, setShowUploader] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [resumeScores, setResumeScores] = useState<{[resumeId: string]: { score: number, matchedAt: Date }}>({});
  const [sortField, setSortField] = useState<'name' | 'date' | 'score'>('date');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [resumeAnalysis, setResumeAnalysis] = useState<{[resumeId: string]: {
    currentJobPosition?: string;
    isCurrentlyEmployed?: boolean;
    highlights?: string[];
    redFlags?: string[];
  }}>({});
  const [loadingAnalysis, setLoadingAnalysis] = useState(false);
  const [resumeToDelete, setResumeToDelete] = useState<string | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [analysingResumeId, setAnalysingResumeId] = useState<string | null>(null);
  
  // Function to analyze a specific resume on demand
  const handleAnalyzeResume = (resumeId: string) => {
    if (!selectedJobId) return;
    
    setAnalysingResumeId(resumeId);
    
    getResumeRedFlagAnalysis(resumeId, selectedJobId)
      .then(data => {
        setResumeAnalysis(prev => ({
          ...prev,
          [resumeId]: data.analysis
        }));
        toast({
          title: "Analysis complete",
          description: "Resume analysis has been successfully completed."
        });
      })
      .catch(err => {
        console.error("Error analyzing resume:", err);
        toast({
          title: "Analysis failed",
          description: "Failed to analyze the resume. Please try again later.",
          variant: "destructive"
        });
      })
      .finally(() => {
        setAnalysingResumeId(null);
      });
  };
  
  // Fetch resumes
  const {
    data: resumes,
    isLoading,
    refetch: refetchResumes
  } = useQuery({
    queryKey: ['/api/resumes'],
    queryFn: getResumes
  });
  
  // Fetch job descriptions for filter
  const { data: jobDescriptions } = useQuery({
    queryKey: ['/api/job-descriptions'],
    queryFn: getJobDescriptions
  });
  
  // Set selected job when route changes
  useEffect(() => {
    if (jobId) {
      setSelectedJobId(jobId);
    }
  }, [jobId]);
  
  // Load resume scores and analysis data when job is selected
  useEffect(() => {
    if (selectedJobId && resumes && resumes.length > 0) {
      // Fetch scores for all resumes
      const resumeIds = resumes.map(resume => resume.id);
      
      // Set loading state
      setLoadingAnalysis(true);
      
      // Get resume scores for the selected job
      getResumeScores(resumeIds, selectedJobId)
        .then(scores => {
          console.log("Fetched scores:", scores);
          setResumeScores(scores);
          
          // Don't automatically fetch red flag analysis for all resumes
          // This was causing hundreds of API calls and rate limiting
          setLoadingAnalysis(false);
        })
        .catch(err => {
          console.error("Error fetching resume data:", err);
          toast({
            title: "Error",
            description: "Failed to load resume scores",
            variant: "destructive"
          });
          setLoadingAnalysis(false);
        });
    } else {
      // Clear scores and analysis when no job is selected
      setResumeScores({});
      setResumeAnalysis({});
    }
  }, [selectedJobId, resumes, toast]);
  
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
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // Handle successful resume upload
  const handleResumeUpload = (data: any) => {
    setShowUploader(false);
    refetchResumes();
    if (Array.isArray(data)) {
      toast({
        title: `${data.length} resumes uploaded`,
        description: "The resumes have been successfully added."
      });
    } else {
      toast({
        title: "Resume uploaded",
        description: "The resume has been successfully added."
      });
    }
  };

  // Handle job selection
  const handleJobChange = (value: string) => {
    if (value === 'all') {
      setSelectedJobId(null);
      setLocation('/candidates');
    } else {
      setSelectedJobId(value);
      
      // Maintain the current URL structure pattern
      if (jobsMatch) {
        // If we're already on a /jobs/:id/candidates route, stay with that pattern
        setLocation(`/jobs/${value}/candidates`);
      } else {
        // Otherwise use the /candidates/:id pattern
        setLocation(`/candidates/${value}`);
      }
    }
  };

  // Handle sorting
  const handleSort = (field: 'name' | 'date' | 'score') => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection(field === 'date' ? 'desc' : 'asc');
    }
  };

  // Sort resumes
  const sortedResumes = resumes ? [...resumes].sort((a, b) => {
    if (sortField === 'name') {
      const aName = a.candidateName || '';
      const bName = b.candidateName || '';
      return sortDirection === 'asc'
        ? aName.localeCompare(bName)
        : bName.localeCompare(aName);
    } else if (sortField === 'date') {
      const aDate = new Date(a.createdAt).getTime();
      const bDate = new Date(b.createdAt).getTime();
      return sortDirection === 'asc'
        ? aDate - bDate
        : bDate - aDate;
    } else if (sortField === 'score') {
      const aScore = resumeScores[a.id]?.score || 0;
      const bScore = resumeScores[b.id]?.score || 0;
      return sortDirection === 'asc'
        ? aScore - bScore
        : bScore - aScore;
    }
    return 0;
  }).filter(resume => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    return (
      (resume.candidateName || '').toLowerCase().includes(searchLower) ||
      (resume.candidateTitle || '').toLowerCase().includes(searchLower) ||
      (resume.fileName || '').toLowerCase().includes(searchLower)
    );
  }) : [];

  // Confirm delete
  const confirmDelete = (id: string) => {
    setResumeToDelete(id);
    setShowDeleteDialog(true);
  };

  return (
    <>
      <div className="bg-white min-h-screen">
        <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-6">Candidates</h1>
          
          <div className="flex flex-col md:flex-row justify-between gap-4 mb-6">
            <div className="w-full md:w-1/3">
              <label htmlFor="search" className="block text-sm font-medium text-gray-700 mb-1">
                Search Candidates
              </label>
              <div className="relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="h-4 w-4 text-gray-400" />
                </div>
                <Input
                  type="text"
                  id="search"
                  className="pl-10"
                  placeholder="Search by name, title, or file name"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
            
            <div className="w-full md:w-1/3">
              <label htmlFor="job-filter" className="block text-sm font-medium text-gray-700 mb-1">
                Filter by Job
              </label>
              <Select 
                value={selectedJobId || 'all'} 
                onValueChange={handleJobChange}
              >
                <SelectTrigger id="job-filter">
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
                    <p>To see match scores and detailed candidate information, please select a job from the dropdown menu above. This will enable all data columns in the table below.</p>
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
          ) : (
            <div className="mb-6">
              <Button onClick={() => setShowUploader(true)}>Upload Resume</Button>
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
                    <th 
                      scope="col" 
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      <div className="flex items-center">
                        <Briefcase className="h-4 w-4 mr-1 text-gray-500" />
                        Current Position
                      </div>
                    </th>
                    <th 
                      scope="col" 
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      <div className="flex items-center">
                        <Award className="h-4 w-4 mr-1 text-emerald-500" />
                        Highlights
                      </div>
                    </th>
                    <th 
                      scope="col" 
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      <div className="flex items-center">
                        <AlertTriangle className="h-4 w-4 mr-1 text-amber-500" />
                        Red Flags
                      </div>
                    </th>
                    <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {sortedResumes.map((resume) => (
                    <tr key={resume.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap cursor-pointer" onClick={() => window.location.href = `/resume/${resume.id}`}>
                        <div className="flex items-center">
                          <div>
                            <div className="text-sm font-medium text-gray-900">
                              {resume.candidateName || 'Unnamed Candidate'}
                            </div>
                            <div className="text-sm text-gray-500">
                              {resume.candidateTitle || 'No title available'}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap cursor-pointer" onClick={() => window.location.href = `/resume/${resume.id}`}>
                        <div className="flex items-center">
                          <FileText className="h-4 w-4 text-gray-400 mr-2" />
                          <div className="text-sm text-gray-900">{resume.fileName}</div>
                          <span className="ml-2 text-xs text-gray-500">({formatFileSize(resume.fileSize)})</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap cursor-pointer" onClick={() => window.location.href = `/resume/${resume.id}`}>
                        <div className="flex items-center text-sm text-gray-500">
                          <Calendar className="h-4 w-4 mr-1" />
                          {formatDate(resume.createdAt)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {selectedJobId ? (
                          resumeScores[resume.id] ? (
                            <div className="flex flex-col space-y-1">
                              <div className="flex items-center">
                                <Badge 
                                  variant={
                                    resumeScores[resume.id].score >= 80 ? "secondary" :
                                    resumeScores[resume.id].score >= 60 ? "default" :
                                    "outline"
                                  } 
                                  className={`mr-2 ${
                                    resumeScores[resume.id].score >= 80 ? "bg-emerald-500" : ""
                                  }`}
                                >
                                  {resumeScores[resume.id].score}%
                                </Badge>
                                <span className="text-xs text-gray-500">
                                  {formatDate(resumeScores[resume.id].matchedAt)}
                                </span>
                              </div>
                              <Progress 
                                value={resumeScores[resume.id].score} 
                                max={100}
                                className={`h-1.5 ${
                                  resumeScores[resume.id].score >= 80 ? "bg-emerald-100" :
                                  resumeScores[resume.id].score >= 60 ? "bg-blue-100" :
                                  "bg-gray-100"
                                }`}
                              />
                            </div>
                          ) : (
                            <div className="flex items-center text-gray-400">
                              <CircleDashed className="h-4 w-4 mr-1" />
                              <span className="text-sm">Not matched</span>
                            </div>
                          )
                        ) : (
                          <div className="flex items-center text-gray-400">
                            <AlertCircle className="h-4 w-4 mr-1" />
                            <span className="text-sm">Select a job</span>
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {selectedJobId ? (
                          analysingResumeId === resume.id ? (
                            <div className="flex items-center">
                              <div className="animate-spin w-4 h-4 border-2 border-primary border-t-transparent rounded-full mr-2"></div>
                              <span className="text-sm text-gray-500">Analyzing...</span>
                            </div>
                          ) : resumeAnalysis[resume.id] ? (
                            <div className="flex items-center text-sm">
                              <Briefcase className="h-4 w-4 mr-1 text-gray-500" />
                              <span className="font-medium">
                                {resumeAnalysis[resume.id].currentJobPosition || 
                                 (resumeAnalysis[resume.id].isCurrentlyEmployed ? 
                                 "Employed" : "Unemployed")}
                              </span>
                            </div>
                          ) : (
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="text-xs h-7 px-2 text-primary"
                              onClick={() => handleAnalyzeResume(resume.id)}
                            >
                              <RotateCcw className="h-3 w-3 mr-1" />
                              Analyze
                            </Button>
                          )
                        ) : (
                          <div className="flex items-center text-gray-400">
                            <AlertCircle className="h-4 w-4 mr-1" />
                            <span className="text-sm">Select a job</span>
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {selectedJobId ? (
                          analysingResumeId === resume.id ? (
                            <div className="flex items-center">
                              <div className="animate-spin w-4 h-4 border-2 border-primary border-t-transparent rounded-full mr-2"></div>
                              <span className="text-sm text-gray-500">Analyzing...</span>
                            </div>
                          ) : resumeAnalysis[resume.id]?.highlights?.length ? (
                            <div className="flex flex-col gap-1">
                              {(resumeAnalysis[resume.id].highlights || []).slice(0, 2).map((highlight, i) => (
                                <div key={i} className="flex items-center text-sm text-emerald-700">
                                  <CircleCheck className="h-3 w-3 mr-1 text-emerald-500" />
                                  <span className="truncate max-w-[200px]">{highlight}</span>
                                </div>
                              ))}
                              {(resumeAnalysis[resume.id].highlights || []).length > 2 && (
                                <div className="text-xs text-gray-500 flex items-center">
                                  <ChevronRight className="h-3 w-3" />
                                  <span>{resumeAnalysis[resume.id].highlights!.length - 2} more</span>
                                </div>
                              )}
                            </div>
                          ) : resumeAnalysis[resume.id] ? (
                            <div className="text-gray-400 text-sm">No highlights found</div>
                          ) : (
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="text-xs h-7 px-2 text-primary"
                              onClick={() => handleAnalyzeResume(resume.id)}
                            >
                              <RotateCcw className="h-3 w-3 mr-1" />
                              Analyze
                            </Button>
                          )
                        ) : (
                          <div className="flex items-center text-gray-400">
                            <AlertCircle className="h-4 w-4 mr-1" />
                            <span className="text-sm">Select a job</span>
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {selectedJobId ? (
                          analysingResumeId === resume.id ? (
                            <div className="flex items-center">
                              <div className="animate-spin w-4 h-4 border-2 border-primary border-t-transparent rounded-full mr-2"></div>
                              <span className="text-sm text-gray-500">Analyzing...</span>
                            </div>
                          ) : resumeAnalysis[resume.id]?.redFlags?.length ? (
                            <div className="flex flex-col gap-1">
                              {(resumeAnalysis[resume.id].redFlags || []).slice(0, 2).map((flag, i) => (
                                <div key={i} className="flex items-center text-sm text-amber-700">
                                  <CircleAlert className="h-3 w-3 mr-1 text-amber-500" />
                                  <span className="truncate max-w-[200px]">{flag}</span>
                                </div>
                              ))}
                              {(resumeAnalysis[resume.id].redFlags || []).length > 2 && (
                                <div className="text-xs text-gray-500 flex items-center">
                                  <ChevronRight className="h-3 w-3" />
                                  <span>{resumeAnalysis[resume.id].redFlags!.length - 2} more</span>
                                </div>
                              )}
                            </div>
                          ) : resumeAnalysis[resume.id] ? (
                            <div className="text-gray-400 text-sm">No red flags found</div>
                          ) : (
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="text-xs h-7 px-2 text-primary"
                              onClick={() => handleAnalyzeResume(resume.id)}
                            >
                              <RotateCcw className="h-3 w-3 mr-1" />
                              Analyze
                            </Button>
                          )
                        ) : (
                          <div className="flex items-center text-gray-400">
                            <AlertCircle className="h-4 w-4 mr-1" />
                            <span className="text-sm">Select a job</span>
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-gray-500 hover:text-red-600"
                          onClick={() => confirmDelete(resume.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-8 border border-dashed border-gray-300 rounded-lg bg-gray-50">
              <div className="mx-auto w-16 h-16 flex items-center justify-center rounded-full bg-gray-100 mb-4">
                <FileText className="h-8 w-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-1">No resumes found</h3>
              <p className="text-gray-500 mb-4">Upload resumes to get started with candidate analysis.</p>
              <Button onClick={() => setShowUploader(true)}>
                Upload Resume
              </Button>
            </div>
          )}
        </div>
      </div>

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
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={() => resumeToDelete && deleteMutation.mutate(resumeToDelete)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}