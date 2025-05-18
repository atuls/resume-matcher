import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger, DialogDescription 
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Briefcase, ChevronRight, Search, FileText, X, Users, Loader2, AlertTriangle, Info } from "lucide-react";
import { getJobDescriptions, analyzeResumes, checkAIStatus, getResumeScoresForJob, analyzeUnanalyzedResumes } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import type { Resume } from "@shared/schema";

interface BatchMatchDialogProps {
  resumes: Resume[];
  filteredResumeIds?: string[]; // Optional, to support filtered resumes
  buttonVariant?: "default" | "outline" | "secondary" | "destructive" | "ghost" | "link";
  preselectedJobId?: string; // Optional, to support preselected job from route
}

export default function BatchMatchDialog({ 
  resumes, 
  filteredResumeIds,
  buttonVariant = "default",
  preselectedJobId
}: BatchMatchDialogProps) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedJobId, setSelectedJobId] = useState<string | null>(preselectedJobId || null);
  const [progress, setProgress] = useState(0);
  const [aiStatus, setAiStatus] = useState<{available: boolean, message: string} | null>(null);
  const [checkingAiStatus, setCheckingAiStatus] = useState(false);
  
  // States for confirmation dialog
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [unanalyzedResumes, setUnanalyzedResumes] = useState<string[]>([]);
  const [unanalyzedCount, setUnanalyzedCount] = useState(0);
  const [totalUnanalyzedCount, setTotalUnanalyzedCount] = useState(0);
  const [loadingUnanalyzed, setLoadingUnanalyzed] = useState(false);
  const [processAll, setProcessAll] = useState(false);
  
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  // Check AI service status when dialog opens
  useEffect(() => {
    if (open && !aiStatus) {
      setCheckingAiStatus(true);
      checkAIStatus()
        .then(status => {
          setAiStatus(status);
        })
        .catch(error => {
          setAiStatus({ available: false, message: "Error checking AI service status" });
          console.error("Error checking AI status:", error);
        })
        .finally(() => {
          setCheckingAiStatus(false);
        });
    }
  }, [open, aiStatus]);
  
  // Determine which resume IDs to use
  const resumeIds = filteredResumeIds || resumes.map(r => r.id);
  const resumeCount = resumeIds.length;

  // Get job descriptions
  const { data: jobDescriptions, isLoading } = useQuery({
    queryKey: ['/api/job-descriptions'],
    queryFn: getJobDescriptions
  });
  
  // State for tracking analyzed resumes
  const [alreadyAnalyzedCount, setAlreadyAnalyzedCount] = useState(0);
  const [totalToProcess, setTotalToProcess] = useState(resumeCount);
  
  // Mutation for batch matching
  const matchMutation = useMutation({
    mutationFn: async () => {
      if (!selectedJobId) throw new Error("No job selected");
      if (unanalyzedResumes.length === 0) throw new Error("No resumes to analyze");
      
      setProgress(0);
      setTotalToProcess(unanalyzedResumes.length);
      
      // For UX, simulate progress during the initial API call
      const progressInterval = setInterval(() => {
        setProgress(prev => {
          // Only increment up to 40% to leave room for actual completion
          const next = prev + Math.floor(Math.random() * 3);
          return Math.min(next, 40);
        });
      }, 600);
      
      try {
        // Show progress at 50% before starting the analysis
        setProgress(50);
        
        // Process the batch of confirmed unanalyzed resumes
        const result = await analyzeResumes(selectedJobId, unanalyzedResumes);
        
        // Clear the progress interval
        clearInterval(progressInterval);
        
        return {
          ...result,
          foundNewBatch: true,
          newBatchSize: unanalyzedResumes.length,
          totalToProcess: unanalyzedResumes.length
        };
      } catch (error) {
        clearInterval(progressInterval);
        console.error("Error in batch matching:", error);
        throw error;
      }
    },
    onSuccess: (data) => {
      setProgress(100);
      // Safely access results array
      const resultCount = data.results ? data.results.length : 0;
      const skippedCount = data.skippedCount || 0;
      // Check if foundNewBatch property exists
      const foundNewBatch = data.foundNewBatch || false;
      const newBatchSize = data.newBatchSize || 0;
      
      // Create a more detailed success message including skipped resumes and new batch info
      let description = "";
      if (foundNewBatch && resultCount > 0) {
        // When we found and processed a new batch of previously unanalyzed resumes
        description = `Found and analyzed ${resultCount} new ${resultCount === 1 ? 'resume' : 'resumes'} that hadn't been analyzed for this job yet.`;
      } else if (resultCount > 0 && skippedCount > 0) {
        // When processing current page with some skipped
        description = `${resultCount} ${resultCount === 1 ? 'resume has' : 'resumes have'} been matched with the selected job. ${skippedCount} ${skippedCount === 1 ? 'resume was' : 'resumes were'} skipped (already analyzed).`;
      } else if (resultCount > 0) {
        // When processing current page with no skipped
        description = `${resultCount} ${resultCount === 1 ? 'resume has' : 'resumes have'} been matched with the selected job description.`;
      } else if (skippedCount > 0 && data.results?.length === 0) {
        // When all resumes in the system are already analyzed for this job
        description = `No new resumes to analyze. All resumes in the system have already been analyzed for this job.`;
      } else if (skippedCount > 0) {
        // When all selected resumes are already analyzed
        description = `No new resumes to analyze. ${skippedCount} ${skippedCount === 1 ? 'resume was' : 'resumes were'} already analyzed for this job.`;
      } else {
        // Fallback
        description = "Batch analysis complete, but no resumes were processed.";
      }
      
      toast({
        title: "Batch analysis complete",
        description
      });
      
      // Invalidate queries to refresh the data
      queryClient.invalidateQueries({ queryKey: [`/api/job-descriptions/${selectedJobId}/results`] });
      queryClient.invalidateQueries({ queryKey: ['/api/resumes'] });
      
      setTimeout(() => {
        setOpen(false);
        setProgress(0);
      }, 1000);
    },
    onError: (error: any) => {
      setProgress(0);
      // Show a more specific message for API key failures
      const errorMsg = error.message || "";
      if (errorMsg.includes("API key") || errorMsg.toLowerCase().includes("openai")) {
        toast({
          title: "OpenAI API Key Required",
          description: "Please add your OpenAI API key in the settings to use the matching feature.",
          variant: "destructive"
        });
      } else {
        toast({
          title: "Error matching resumes",
          description: errorMsg,
          variant: "destructive"
        });
      }
    }
  });
  
  // Filter jobs based on search query
  const filteredJobs = jobDescriptions?.filter(job => 
    job.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    job.company?.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];
  
  // Find unanalyzed resumes and show confirmation dialog
  const findUnanalyzedResumes = async () => {
    if (!selectedJobId) {
      toast({
        title: "No job selected",
        description: "Please select a job description to match with the resumes.",
        variant: "destructive"
      });
      return;
    }
    
    if (resumeIds.length === 0) {
      toast({
        title: "No resumes selected",
        description: "There are no resumes to match with the job description.",
        variant: "destructive"
      });
      return;
    }
    
    // First check AI service status
    if (!aiStatus) {
      try {
        setCheckingAiStatus(true);
        const status = await checkAIStatus();
        setAiStatus(status);
        
        if (!status.available) {
          toast({
            title: "AI Service Unavailable",
            description: status.message || "Please configure your OpenAI API key in settings.",
            variant: "destructive"
          });
          setCheckingAiStatus(false);
          return;
        }
        setCheckingAiStatus(false);
      } catch (error) {
        console.error("Error checking AI status:", error);
        toast({
          title: "AI Service Error",
          description: "Could not verify AI service status. Please try again.",
          variant: "destructive"
        });
        setCheckingAiStatus(false);
        return;
      }
    } else if (!aiStatus.available) {
      toast({
        title: "AI Service Unavailable",
        description: aiStatus.message || "Please configure your OpenAI API key in settings.",
        variant: "destructive"
      });
      return;
    }
    
    try {
      setLoadingUnanalyzed(true);
      
      // First check if any resumes on the current page need analysis
      const existingScores = await getResumeScoresForJob(selectedJobId);
      const analyzedResumeIds = existingScores?.scores?.map(score => score.resumeId) || [];
      const currentPageUnanalyzed = resumeIds.filter(id => !analyzedResumeIds.includes(id));
      
      if (currentPageUnanalyzed.length > 0) {
        // If there are unanalyzed resumes on the current page, use those
        setUnanalyzedResumes(currentPageUnanalyzed);
        setUnanalyzedCount(currentPageUnanalyzed.length);
        setShowConfirmDialog(true);
      } else {
        // Otherwise, find unanalyzed resumes in the entire database
        const batchResult = await analyzeUnanalyzedResumes(selectedJobId, 10);
        
        if (!batchResult || batchResult.resumeIds.length === 0) {
          toast({
            title: "No resumes to analyze",
            description: "All resumes in the system have already been analyzed for this job.",
          });
          return;
        }
        
        setUnanalyzedResumes(batchResult.resumeIds);
        setUnanalyzedCount(batchResult.resumeIds.length);
        setShowConfirmDialog(true);
      }
    } catch (error) {
      console.error("Error finding unanalyzed resumes:", error);
      toast({
        title: "Error",
        description: "Failed to find unanalyzed resumes. Please try again.",
        variant: "destructive"
      });
    } finally {
      setLoadingUnanalyzed(false);
    }
  };
  
  // Handle match button click - now just finds unanalyzed resumes
  const handleBatchMatch = async () => {
    await findUnanalyzedResumes();
  };
  
  // Process confirmed batch of unanalyzed resumes
  const processBatch = () => {
    if (unanalyzedResumes.length === 0) return;
    
    // Close the confirmation dialog
    setShowConfirmDialog(false);
    
    // Process the unanalyzed resumes
    matchMutation.mutate();
  };
  
  return (
    <>
      {/* Confirmation dialog for unanalyzed resumes */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Analyze {unanalyzedCount} Resumes</AlertDialogTitle>
            <AlertDialogDescription>
              {processAll && totalUnanalyzedCount > unanalyzedCount ? (
                <>
                  We found a total of {totalUnanalyzedCount} resumes that haven't been analyzed for this job yet.
                  {unanalyzedCount === totalUnanalyzedCount ? (
                    " We'll analyze all of them in one batch."
                  ) : (
                    ` We'll analyze all ${unanalyzedCount} of them in one batch.`
                  )}
                </>
              ) : (
                unanalyzedCount === 1 
                  ? "We found 1 resume that hasn't been analyzed for this job yet."
                  : `We found ${unanalyzedCount} resumes that haven't been analyzed for this job yet.`
              )}
              <br /><br />
              Do you want to run the analysis on {unanalyzedCount === 1 ? "this resume" : "these resumes"}?
              This will use your AI credits.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={processBatch}>
              Yes, Analyze {unanalyzedCount === 1 ? "1 Resume" : `${unanalyzedCount} Resumes`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant={buttonVariant} className="flex items-center">
            <Users className="mr-1 h-4 w-4" />
            <Briefcase className="mr-2 h-4 w-4" /> 
            Match All with Job
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-[525px]">
          <DialogHeader>
            <DialogTitle>Batch Match Resumes with Job</DialogTitle>
            <DialogDescription>
              Match {resumeCount} {resumeCount === 1 ? 'resume' : 'resumes'} with a job description.
              Already analyzed resumes will be skipped.
            </DialogDescription>
          </DialogHeader>
          
          <div className="mt-4 space-y-4">
            {/* AI Service Status Alert */}
            {aiStatus && !aiStatus.available && (
              <Alert variant="destructive" className="mb-4">
                <AlertTriangle className="h-4 w-4 mr-2" />
                <AlertDescription>
                  {aiStatus.message || "OpenAI API key is not configured. Resume matching will not work properly."}
                </AlertDescription>
              </Alert>
            )}
            
            {checkingAiStatus && (
              <div className="text-center py-2">
                <Loader2 className="h-4 w-4 animate-spin mx-auto mb-1" />
                <p className="text-xs text-gray-500">Checking AI service status...</p>
              </div>
            )}
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
              <Input 
                placeholder="Search job descriptions..." 
                className="pl-9"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            
            {isLoading ? (
              <div className="text-center py-4">
                <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full mx-auto"></div>
                <p className="text-sm text-gray-500 mt-2">Loading job descriptions...</p>
              </div>
            ) : filteredJobs.length > 0 ? (
              <div className="max-h-[300px] overflow-y-auto space-y-2 pr-1">
                {filteredJobs.map(job => (
                  <Card 
                    key={job.id}
                    className={`p-3 cursor-pointer border ${selectedJobId === job.id ? 'border-primary' : 'border-gray-200'}`}
                    onClick={() => setSelectedJobId(job.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className={`p-1.5 rounded-md ${selectedJobId === job.id ? 'bg-primary text-white' : 'bg-primary/10 text-primary'}`}>
                          <FileText className="h-4 w-4" />
                        </div>
                        <div>
                          <div className="font-medium">{job.title}</div>
                          <div className="text-xs text-gray-500">{job.company || 'No company'}</div>
                        </div>
                      </div>
                      <ChevronRight className={`h-4 w-4 ${selectedJobId === job.id ? 'text-primary' : 'text-gray-400'}`} />
                    </div>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 border rounded-md border-dashed">
                <p className="text-gray-500">No job descriptions found</p>
                {searchQuery && (
                  <div className="mt-2 flex justify-center">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => setSearchQuery("")}
                      className="text-xs"
                    >
                      <X className="h-3 w-3 mr-1" />
                      Clear search
                    </Button>
                  </div>
                )}
              </div>
            )}
            
            {/* Display info about analyzed vs total resumes */}
            {selectedJobId && alreadyAnalyzedCount > 0 && !matchMutation.isPending && (
              <Alert className="bg-blue-50 border-blue-200">
                <Info className="h-4 w-4 text-blue-600 mr-2" />
                <AlertDescription className="text-sm text-blue-600">
                  {alreadyAnalyzedCount} of {resumeCount} {resumeCount === 1 ? 'resume has' : 'resumes have'} already been analyzed for this job.
                </AlertDescription>
              </Alert>
            )}
            
            {/* Progress bar for batch analysis */}
            {(progress > 0 || matchMutation.isPending || loadingUnanalyzed) && (
              <div className="space-y-2">
                <div className="flex justify-between text-xs text-gray-500">
                  <span>Analyzing resumes...</span>
                  <span>{progress}%</span>
                </div>
                <Progress value={progress} className="h-2" />
                <p className="text-xs text-gray-500 text-center">
                  {loadingUnanalyzed 
                    ? "Finding unanalyzed resumes..." 
                    : `Processing ${totalToProcess} ${totalToProcess === 1 ? 'resume' : 'resumes'}`}
                </p>
              </div>
            )}
          </div>
          
          <DialogFooter className="flex flex-col sm:flex-row w-full gap-2">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => setOpen(false)}
              disabled={matchMutation.isPending || loadingUnanalyzed}
              className="mt-2 sm:mt-0"
            >
              Cancel
            </Button>
            <div className="flex flex-1 flex-col sm:flex-row gap-2 justify-end">
              <Button 
                type="button"
                variant="outline"
                onClick={() => {
                  if (selectedJobId) {
                    setLoadingUnanalyzed(true);
                    // Use process all flag when checking for unanalyzed resumes
                    analyzeUnanalyzedResumes(selectedJobId, 10, true)
                      .then(result => {
                        if (result.resumeIds.length > 0) {
                          setUnanalyzedResumes(result.resumeIds);
                          setUnanalyzedCount(result.resumeIds.length);
                          setTotalUnanalyzedCount(result.totalUnanalyzed || result.resumeIds.length);
                          setProcessAll(true);
                          setShowConfirmDialog(true);
                        } else {
                          toast({
                            title: "No unanalyzed resumes",
                            description: "All resumes have already been analyzed for this job description.",
                          });
                        }
                      })
                      .catch(error => {
                        console.error("Error finding all unanalyzed resumes:", error);
                        toast({
                          title: "Error",
                          description: "Failed to find unanalyzed resumes. Please try again.",
                          variant: "destructive"
                        });
                      })
                      .finally(() => {
                        setLoadingUnanalyzed(false);
                      });
                  }
                }}
                disabled={!selectedJobId || matchMutation.isPending || loadingUnanalyzed}
                className="min-w-[150px]"
              >
                {loadingUnanalyzed ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processing...</>
                ) : (
                  "Run on All Unanalyzed"
                )}
              </Button>
              <Button 
                type="button"
                onClick={handleBatchMatch}
                disabled={!selectedJobId || resumeIds.length === 0 || matchMutation.isPending || loadingUnanalyzed}
                className="min-w-[120px]"
              >
                {matchMutation.isPending || loadingUnanalyzed ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processing...</>
                ) : (
                  `Match ${resumeIds.length} ${resumeIds.length === 1 ? 'Resume' : 'Resumes'}`
                )}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}