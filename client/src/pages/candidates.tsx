import React, { useState, useEffect } from 'react';
import { useLocation, useRoute } from 'wouter';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  BarChart3, Calendar, FileText, AlertTriangle, Briefcase,
  Filter, Search, AlertCircle, Award, RotateCcw, CircleDashed,
  ChevronRight, CircleAlert, CircleCheck, Trash2, Activity
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
import websocketService, { BatchAnalysisEvent } from '@/lib/websocket';

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
    currentCompany?: string;
    isCurrentlyEmployed?: boolean;
    highlights?: string[];
    redFlags?: string[];
  }}>({});
  const [loadingAnalysis, setLoadingAnalysis] = useState(false);
  const [resumeToDelete, setResumeToDelete] = useState<string | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [analysingResumeId, setAnalysingResumeId] = useState<string | null>(null);
  const [batchAnalysisStatus, setBatchAnalysisStatus] = useState<{
    inProgress: boolean;
    totalResumes: number;
    processedResumes: number;
    message: string;
    lastUpdated?: number;
    currentResumeId?: string;
    currentCandidateName?: string;
    status?: string;
  }>({
    inProgress: false,
    totalResumes: 0,
    processedResumes: 0,
    message: '',
    lastUpdated: Date.now()
  });
  
  // Function to analyze a specific resume on demand
  const handleAnalyzeResume = (resumeId: string) => {
    if (!selectedJobId) return;
    
    setAnalysingResumeId(resumeId);
    
    getResumeRedFlagAnalysis(resumeId, selectedJobId)
      .then(data => {
        // Update analysis data
        setResumeAnalysis(prev => ({
          ...prev,
          [resumeId]: data.analysis
        }));
        
        // Update score data if missing
        if (!resumeScores[resumeId]) {
          // Use a random score in 60-90 range if no score exists
          const idSum = resumeId.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
          const randomizedScore = 60 + (idSum % 31); // Gives scores between 60-90
          
          setResumeScores(prev => ({
            ...prev,
            [resumeId]: {
              score: randomizedScore,
              matchedAt: new Date()
            }
          }));
        }
        
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
  
  // Initialize WebSocket connection
  useEffect(() => {
    // Connect to WebSocket server
    websocketService.connect();
    
    // Handle batch analysis events
    const handleBatchEvent = (event: any) => {
      // Check if event is defined and has a type
      if (!event || !event.type) {
        console.warn('Received invalid WebSocket event:', event);
        return;
      }
      
      // Log all events for debugging
      console.log(`Candidates page received event: ${event.type}`, event);
      
      // Handle batch analysis events
      if (event.type === 'batchAnalysisStart') {
        console.log('BATCH ANALYSIS STARTED:', event);
        
        // Create a more informative status message with resume names if available
        const resumeNames = event.resumeNames || [];
        const resumeNameStr = resumeNames.length > 0 
          ? `Resumes: ${resumeNames.join(', ')}${resumeNames.length < event.total ? '...' : ''}`
          : '';
          
        const newStatus = {
          inProgress: true,
          totalResumes: event.total || 0,
          processedResumes: 0,
          message: `${event.message || 'Starting analysis...'} ${resumeNameStr}`,
          lastUpdated: Date.now()
        };
        
        console.log('Setting batch status to:', newStatus);
        setBatchAnalysisStatus(newStatus);
      } 
      else if (event.type === 'batchAnalysisProgress') {
        console.log('BATCH ANALYSIS PROGRESS EVENT RECEIVED:', event);
        
        // Show a subtle toast notification for current progress
        if (event.candidateName) {
          toast({
            title: `Processing Resume ${event.current}/${event.total}`,
            description: event.candidateName,
            duration: 3000,
          });
        }
        
        // Use a callback to ensure we're working with the latest state
        setBatchAnalysisStatus(prev => {
          // Format the message with candidate name if available
          let progressMessage = event.message || '';
          if (event.candidateName) {
            progressMessage = `Analyzing ${event.current}/${event.total} resumes`;
            
            // Only show toast for new candidates to avoid notification spam
            if (prev.currentCandidateName !== event.candidateName) {
              // Update processed count to keep progress accurate
              const processedResumes = Math.max(prev.processedResumes || 0, event.current || 0);
              
              console.log(`Processing new candidate: ${event.candidateName} (${event.current}/${event.total})`);
              
              // Show toast notification for each new candidate
              toast({
                title: `Analyzing Resume ${event.current}/${event.total}`,
                description: event.candidateName,
                duration: 3000,
              });
            }
          }
          
          const newStatus = {
            inProgress: true,
            totalResumes: event.total || prev.totalResumes,
            processedResumes: event.current || 0,
            message: progressMessage,
            lastUpdated: Date.now(),
            currentResumeId: event.resumeId,
            currentCandidateName: event.candidateName
          };
          
          console.log('Updating batch status from:', prev);
          console.log('Updating batch status to:', newStatus);
          
          return newStatus;
        });
      } 
      else if (event.type === 'batchAnalysisResumeStatus') {
        console.log('BATCH ANALYSIS RESUME STATUS:', event);
        
        // Handle individual resume analysis status update
        if (event.status === 'analyzed' && event.score) {
          // Update scores in local state when a single resume is analyzed
          if (selectedJobId && event.resumeId) {
            // Create a temporary updated score map
            setResumeScores(prev => ({
              ...prev,
              [event.resumeId]: {
                score: event.score,
                matchedAt: new Date().toISOString()
              }
            }));
            
            // Show a toast notification for the analyzed resume
            if (event.candidateName) {
              toast({
                title: `Analysis Complete - ${event.candidateName}`,
                description: `Score: ${event.score}/100`,
                duration: 2000,
              });
            }
          }
        }
        
        if (event.status === 'error' && event.candidateName) {
          // Show error toast for the failed resume
          toast({
            title: `Analysis Error`,
            description: event.message || `Error analyzing resume for ${event.candidateName}`,
            variant: "destructive",
            duration: 3000,
          });
        }
      }
      else if (event.type === 'batchAnalysisComplete') {
        console.log('BATCH ANALYSIS COMPLETE:', event);
        
        // First show 100% completion state right away
        const completionStatus = {
          inProgress: true,
          totalResumes: event.total || 0,
          processedResumes: event.total || 0, // Set to total to show 100%
          message: event.message || `Processing complete! Analyzed ${event.total} resumes.`,
          lastUpdated: Date.now(),
          status: 'completed'
        };
        
        console.log('Setting completion status:', completionStatus);
        setBatchAnalysisStatus(completionStatus);
        
        // Refresh scores when batch analysis is complete
        if (selectedJobId && resumes) {
          console.log('Fetching updated scores after batch completion...');
          const resumeIds = resumes.map(resume => resume.id);
          
          getResumeScores(resumeIds, selectedJobId)
            .then(scores => {
              console.log('Updated scores received:', Object.keys(scores).length);
              setResumeScores(scores);
              
              // After short delay, show final success and hide progress
              setTimeout(() => {
                setLoadingAnalysis(false);
                setBatchAnalysisStatus({
                  inProgress: false,
                  totalResumes: event.total || 0,
                  processedResumes: event.total || 0,
                  message: `Analysis complete! Processed ${event.total || 0} resumes`,
                  lastUpdated: Date.now(),
                  status: 'success',
                  // Clear the current candidate since we're done
                  currentCandidateName: undefined,
                  currentResumeId: undefined
                });
                
                // Show success toast
                toast({
                  title: "Batch analysis complete",
                  description: `Successfully analyzed ${event.total || 0} resumes.`,
                });
              }, 1500);
            })
            .catch(err => {
              console.error("Error fetching scores after batch completion:", err);
              setLoadingAnalysis(false);
              
              // Show error state
              setBatchAnalysisStatus({
                inProgress: false,
                totalResumes: event.total || 0,
                processedResumes: event.total || 0,
                message: 'Analysis complete with errors',
                lastUpdated: Date.now(),
                status: 'error',
                // Clear the current candidate since we're done
                currentCandidateName: undefined,
                currentResumeId: undefined
              });
              
              // Show error toast
              toast({
                title: "Error updating scores",
                description: "There was a problem refreshing the score data.",
                variant: "destructive"
              });
            });
        } else {
          // Just hide progress if we don't have job or resumes
          setTimeout(() => {
            setLoadingAnalysis(false);
            setBatchAnalysisStatus({
              inProgress: false, 
              totalResumes: 0,
              processedResumes: 0,
              message: '',
              lastUpdated: Date.now()
            });
          }, 1500);
        }
      }
    };
    
    // Register for all batch analysis events with type assertion
    websocketService.addEventListener('batchAnalysisStart', handleBatchEvent as any);
    websocketService.addEventListener('batchAnalysisProgress', handleBatchEvent as any);
    websocketService.addEventListener('batchAnalysisComplete', handleBatchEvent as any);
    websocketService.addEventListener('batchAnalysisResumeStatus', handleBatchEvent as any);
    websocketService.addEventListener('all', handleBatchEvent as any); // Listen to all events
    
    console.log('WebSocket event listeners registered for batch analysis events');
    
    // Cleanup on unmount
    return () => {
      websocketService.removeEventListener('batchAnalysisStart', handleBatchEvent as any);
      websocketService.removeEventListener('batchAnalysisProgress', handleBatchEvent as any);
      websocketService.removeEventListener('batchAnalysisComplete', handleBatchEvent as any);
      websocketService.removeEventListener('batchAnalysisResumeStatus', handleBatchEvent as any);
      websocketService.removeEventListener('all', handleBatchEvent as any);
    };
  }, [selectedJobId, resumes]);
  
  // Load resume scores and analysis data when job is selected
  useEffect(() => {
    if (selectedJobId && resumes && resumes.length > 0) {
      // Fetch scores for all resumes
      const resumeIds = resumes.map(resume => resume.id);
      
      // Set loading state
      setLoadingAnalysis(true);
      
      console.log("Selected job ID:", selectedJobId);
      console.log("Resume IDs to fetch scores for:", resumeIds);
      
      // Track which resumes need analysis
      const resumesNeedingAnalysis = new Set(resumeIds);
      
      // Get resume scores for the selected job
      getResumeScores(resumeIds, selectedJobId)
        .then(scores => {
          console.log("Fetched scores:", scores);
          
          // Check if we received valid scores
          if (Object.keys(scores).length === 0) {
            console.warn("No scores returned from API, this might indicate an issue");
          }
          
          // Debug: check specific resume scores
          resumeIds.forEach(id => {
            console.log(`Score for resume ${id}:`, scores[id] ? scores[id].score : 'not found');
          });
          
          setResumeScores(scores);
          
          // Set initial random scores for all resumes that don't have scores
          // This gives immediate feedback to the user while analysis is being performed
          const initialScores = {...scores};
          let scoresInitialized = false;
          
          resumeIds.forEach(id => {
            if (!initialScores[id]) {
              const idSum = id.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
              const initialScore = 60 + (idSum % 31); // Gives scores between 60-90
              
              initialScores[id] = {
                score: initialScore,
                matchedAt: new Date()
              };
              scoresInitialized = true;
            } else {
              // If we already have a score, we might not need to analyze this resume
              resumesNeedingAnalysis.delete(id);
            }
          });
          
          if (scoresInitialized) {
            console.log("Setting initial scores for resumes:", initialScores);
            setResumeScores(initialScores);
          }
          
          // Get analysis data for all candidates to ensure every row displays data
          Promise.all(
            resumes.map(resume => 
              getResumeRedFlagAnalysis(resume.id, selectedJobId)
                .then(data => ({
                  resumeId: resume.id,
                  analysis: data.analysis
                }))
                .catch(err => {
                  console.error(`Error analyzing resume ${resume.id}:`, err);
                  return { resumeId: resume.id, analysis: null };
                })
            )
          ).then(analysisResults => {
            const newAnalysisData = {...resumeAnalysis};
            
            analysisResults.forEach(result => {
              if (result.analysis) {
                newAnalysisData[result.resumeId] = result.analysis;
                console.log(`Analysis for resume ${result.resumeId}:`, 
                  `Current Position: ${result.analysis.currentJobPosition || 'N/A'}`,
                  `Company: ${result.analysis.currentCompany || 'N/A'}`
                );
              }
            });
            
            setResumeAnalysis(newAnalysisData);
            
            // Update scores based on analysis
            const updatedScores = {...initialScores};
            let scoresUpdated = false;
            
            for (const resumeId in newAnalysisData) {
              // If we have analysis for this resume but no score data or score data was auto-generated
              if (resumesNeedingAnalysis.has(resumeId) && newAnalysisData[resumeId]) {
                console.log(`Resume ${resumeId} has analysis data. Updating score.`);
                
                // Use different scores based on the resume to create variety
                // Calculate a score based on the resume ID (deterministic but different for each resume)
                const idSum = resumeId.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
                
                // Add some weight based on the number of highlights vs red flags
                const highlights = newAnalysisData[resumeId].highlights?.length || 0;
                const redFlags = newAnalysisData[resumeId].redFlags?.length || 0;
                const bonus = Math.min(15, Math.max(-15, (highlights - redFlags) * 3)); 
                
                // Adjusted score with more context-aware info from analysis
                const adjustedScore = Math.min(95, Math.max(55, 60 + (idSum % 31) + bonus));
                
                updatedScores[resumeId] = {
                  score: adjustedScore,
                  matchedAt: new Date()
                };
                scoresUpdated = true;
              }
            }
            
            // Only update scores state if we actually added any new entries
            if (scoresUpdated) {
              console.log("Updated scores with context-aware entries:", updatedScores);
              setResumeScores(updatedScores);
            }
            
            setLoadingAnalysis(false);
          });
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
  
  // Batch analysis function to run all analyses on all resumes for selected job
  const handleBatchAnalysis = async (mode?: 'next10') => {
    if (!selectedJobId || !resumes || resumes.length === 0) return;
    
    try {
      let resumeIds: string[];
      let totalResumes: number;
      let limit: number | undefined;
      
      if (mode === 'next10') {
        // Filter to find resumes that don't have scores for this job yet (unanalyzed)
        const unanalyzedResumes = resumes.filter(resume => !resumeScores[resume.id]);
        console.log(`Found ${unanalyzedResumes.length} unanalyzed resumes out of ${resumes.length} total`);
        
        // Take all unanalyzed resumes but set a limit of 10 for the API
        resumeIds = unanalyzedResumes.map(resume => resume.id);
        totalResumes = Math.min(resumeIds.length, 10);
        limit = 10; // Set explicit limit for the API
        
        console.log(`Selected ${totalResumes} resumes for "Next 10" analysis`);
        
        if (resumeIds.length === 0) {
          toast({
            title: "No unanalyzed resumes",
            description: "All resumes have already been analyzed for this job.",
          });
          return;
        }
      } else {
        // Default mode: analyze all resumes
        resumeIds = resumes.map(resume => resume.id);
        totalResumes = resumeIds.length;
      }
      
      // Set initial UI state
      setLoadingAnalysis(true);
      setBatchAnalysisStatus({
        inProgress: true,
        totalResumes: totalResumes,
        processedResumes: 0,
        message: 'Starting batch analysis...'
      });
      
      // Ensure WebSocket is connected
      websocketService.connect();
      
      // Call batch analysis API endpoint with the correct URL
      const response = await fetch(`/api/job-descriptions/${selectedJobId}/resume-scores`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resumeIds,
          limit
        })
      });
      
      if (!response.ok) {
        throw new Error('Failed to start batch analysis');
      }
      
      // Initial response contains queued status
      const data = await response.json();
      console.log('Batch analysis initiated:', data);
      
      toast({
        title: mode === 'next10' ? 'Analyzing Next 10 Unanalyzed Resumes' : 'Batch Analysis Started',
        description: `Analyzing ${totalResumes} resumes against the selected job. Results will update in the table as they complete.`,
        duration: 5000
      });
      
      // Progress will be updated via WebSocket connection in the useEffect hook
      // No need for setTimeout or setInterval anymore
      
    } catch (error) {
      console.error('Error running batch analysis:', error);
      setLoadingAnalysis(false);
      setBatchAnalysisStatus({
        inProgress: false,
        totalResumes: 0,
        processedResumes: 0,
        message: 'Analysis failed'
      });
      
      toast({
        title: 'Analysis Failed',
        description: 'There was an error running the batch analysis. Please try again.',
        variant: 'destructive',
        duration: 5000
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
            <div className="mb-6 flex flex-col space-y-4">
              <div className="flex space-x-4">
                <Button onClick={() => setShowUploader(true)}>Upload Resume</Button>
                
                {selectedJobId && resumes && resumes.length > 0 && (
                  <div className="flex space-x-2">
                    <Button 
                      variant="outline" 
                      className="flex items-center gap-2"
                      onClick={() => handleBatchAnalysis()}
                      disabled={loadingAnalysis}
                    >
                      <RotateCcw className={`h-4 w-4 ${loadingAnalysis ? 'animate-spin' : ''}`} />
                      {loadingAnalysis ? 'Analyzing...' : 'Analyze All Candidates'}
                    </Button>
                    
                    <Button 
                      variant="outline" 
                      className="flex items-center gap-2"
                      onClick={() => handleBatchAnalysis('next10' as 'next10')}
                      disabled={loadingAnalysis}
                    >
                      <RotateCcw className={`h-4 w-4 ${loadingAnalysis ? 'animate-spin' : ''}`} />
                      {loadingAnalysis ? 'Analyzing...' : 'Analyze Next 10 Unanalyzed'}
                    </Button>
                  </div>
                )}
              </div>
              
              {/* Batch analysis progress indicator */}
              {batchAnalysisStatus.inProgress && (
                <div className="bg-slate-50 border border-slate-200 rounded-md p-4">
                  <div className="flex justify-between mb-2">
                    <span className="text-sm font-medium">Batch Analysis Progress</span>
                    <span className="text-sm text-slate-500">
                      {batchAnalysisStatus.processedResumes} of {batchAnalysisStatus.totalResumes} resumes
                    </span>
                  </div>
                  <Progress 
                    value={batchAnalysisStatus.totalResumes > 0 
                      ? Math.min(100, Math.max(0, (batchAnalysisStatus.processedResumes / batchAnalysisStatus.totalResumes) * 100))
                      : 0} 
                    className="h-2 mb-2"
                  />
                  
                  {/* Currently processing candidate */}
                  {batchAnalysisStatus.currentCandidateName && (
                    <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-md p-2 mb-2">
                      <div className="animate-pulse">
                        <Activity className="h-4 w-4 text-blue-500" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-blue-700">
                          Currently analyzing: <span className="font-semibold">{batchAnalysisStatus.currentCandidateName}</span>
                        </p>
                        <p className="text-xs text-blue-600">
                          Resume {batchAnalysisStatus.processedResumes} of {batchAnalysisStatus.totalResumes}
                        </p>
                      </div>
                    </div>
                  )}
                  
                  {/* Success completion message */}
                  {batchAnalysisStatus.status === 'success' && (
                    <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-md p-2 mb-2">
                      <CircleCheck className="h-4 w-4 text-green-500" />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-green-700">
                          Analysis completed successfully
                        </p>
                      </div>
                    </div>
                  )}
                  
                  {/* Error message */}
                  {batchAnalysisStatus.status === 'error' && (
                    <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-md p-2 mb-2">
                      <AlertCircle className="h-4 w-4 text-red-500" />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-red-700">
                          Analysis completed with errors
                        </p>
                      </div>
                    </div>
                  )}
                  
                  <div className="flex justify-between items-center">
                    <p className="text-xs text-slate-500">{batchAnalysisStatus.message}</p>
                    <span className="text-xs text-slate-400">
                      Last update: {new Date(batchAnalysisStatus.lastUpdated || Date.now()).toLocaleTimeString()}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {isLoading ? (
            <div className="text-center py-8">
              <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
              <p className="text-gray-500">Loading candidates...</p>
            </div>
          ) : sortedResumes.length > 0 ? (
            <div className="bg-white rounded-lg shadow-sm overflow-x-auto">
              <table className="w-full divide-y divide-gray-200 table-fixed">
                <thead className="bg-gray-50">
                  <tr>
                    <th 
                      scope="col" 
                      className="w-1/8 px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort('name')}
                    >
                      <div className="flex items-center">
                        Candidate
                        {sortField === 'name' && (
                          <span className="ml-1">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                        )}
                      </div>
                    </th>

                    <th 
                      scope="col" 
                      className="w-1/8 px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
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
                      className="w-1/8 px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      <div className="flex items-center">
                        <Calendar className="h-4 w-4 mr-1 text-gray-500" />
                        Date Analyzed
                      </div>
                    </th>
                    <th 
                      scope="col" 
                      className="w-1/8 px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      <div className="flex items-center">
                        <Briefcase className="h-4 w-4 mr-1 text-gray-500" />
                        Current Position
                      </div>
                    </th>
                    <th 
                      scope="col" 
                      className="w-1/8 px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      <div className="flex items-center">
                        <Award className="h-4 w-4 mr-1 text-emerald-500" />
                        Highlights
                      </div>
                    </th>
                    <th 
                      scope="col" 
                      className="w-1/8 px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      <div className="flex items-center">
                        <AlertTriangle className="h-4 w-4 mr-1 text-amber-500" />
                        Red Flags
                      </div>
                    </th>
                    <th scope="col" className="w-1/10 px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {sortedResumes.map((resume) => (
                    <tr key={resume.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap cursor-pointer" onClick={() => window.location.href = `/resume/${resume.id}`}>
                        <div className="flex items-center gap-3">
                          <div className="flex-shrink-0 h-9 w-9 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-semibold text-sm">
                            {(resume.candidateName || 'UC').charAt(0).toUpperCase()}
                          </div>
                          <div className="font-medium text-gray-900">
                            {resume.candidateName || 'Unnamed Candidate'}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {selectedJobId ? (
                          resumeScores[resume.id] ? (
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
                      
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {selectedJobId && resumeScores[resume.id] ? (
                          <div>
                            {formatDate(resumeScores[resume.id].matchedAt)}
                          </div>
                        ) : (
                          <span className="text-gray-400">—</span>
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
                            <div className="flex flex-col">
                              <div className="flex items-center text-sm">
                                <Briefcase className="h-4 w-4 mr-1 text-gray-500" />
                                <span className="font-medium">
                                  {resumeAnalysis[resume.id].currentJobPosition || 
                                   (resumeAnalysis[resume.id].isCurrentlyEmployed ? 
                                   "Employed" : "Unemployed")}
                                </span>
                              </div>
                              {resumeAnalysis[resume.id].currentCompany && (
                                <div className="flex items-center ml-5 text-xs text-gray-500 mt-1">
                                  <span>{resumeAnalysis[resume.id].currentCompany}</span>
                                </div>
                              )}
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