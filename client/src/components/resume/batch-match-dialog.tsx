import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger, DialogDescription 
} from "@/components/ui/dialog";
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
      setProgress(0);
      setAlreadyAnalyzedCount(0);
      setTotalToProcess(resumeCount);
      
      // For UX, simulate progress during the initial API call
      const progressInterval = setInterval(() => {
        setProgress(prev => {
          // Only increment up to 40% to leave room for actual completion
          const next = prev + Math.floor(Math.random() * 3);
          return Math.min(next, 40);
        });
      }, 600);
      
      try {
        // First get the existing scores to determine which resumes to skip
        const existingScores = await getResumeScoresForJob(selectedJobId);
        const analyzedResumeIds = existingScores?.scores?.map(score => score.resumeId) || [];
        
        // Count how many are already analyzed
        const alreadyAnalyzed = resumeIds.filter(id => analyzedResumeIds.includes(id)).length;
        setAlreadyAnalyzedCount(alreadyAnalyzed);
        
        // Clear the progress interval
        clearInterval(progressInterval);
        
        // If all resumes on the current page are already analyzed, find and process the next batch
        if (alreadyAnalyzed === resumeIds.length) {
          // Set progress to show we're moving to next step
          setProgress(60);
          
          try {
            // Find the next batch of unanalyzed resumes (limit to 10)
            const batchResult = await analyzeUnanalyzedResumes(selectedJobId, 10);
            
            // If there are no unanalyzed resumes left in the system
            if (!batchResult || batchResult.resumeIds.length === 0) {
              setProgress(100);
              return {
                results: [],
                skippedCount: alreadyAnalyzed,
                message: "No unanalyzed resumes found in the system"
              };
            }
            
            // Set the number of resumes being processed
            setTotalToProcess(batchResult.resumeIds.length);
            setProgress(70);
            
            // Analyze the batch of unanalyzed resumes
            const result = await analyzeResumes(selectedJobId, batchResult.resumeIds);
          
            return {
              ...result,
              foundNewBatch: true,
              newBatchSize: batchResult.resumeIds.length,
              alreadyAnalyzedCount: alreadyAnalyzed,
              totalToProcess: batchResult.resumeIds.length
            };
          } catch (error) {
            console.error("Error finding or analyzing unanalyzed resumes:", error);
            setProgress(100);
            return {
              results: [],
              skippedCount: alreadyAnalyzed,
              error: true,
              message: "Error finding unanalyzed resumes"
            };
          }
        } else {
          // Handle the case when there are unanalyzed resumes on the current page
          const toProcess = resumeIds.length - alreadyAnalyzed;
          setTotalToProcess(toProcess);
          
          // Show progress at 50% after checking existing scores
          setProgress(50);
          
          // Process resumes from current page, skipping those already analyzed
          const result = await analyzeResumes(selectedJobId, resumeIds, false, true);
          
          // If we skipped all resumes, simulate completion
          if (result.results.length === 0 && alreadyAnalyzed > 0) {
            setProgress(100);
          }
          
          return { 
            ...result, 
            alreadyAnalyzedCount: alreadyAnalyzed,
            totalToProcess: toProcess 
          };
        }
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
      } else if (skippedCount > 0 && data.message === "No unanalyzed resumes found in the system") {
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
  
  // Handle match button click
  const handleBatchMatch = async () => {
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
    
    // Check AI service status before starting the batch match process
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
    
    // All checks passed, start the batch match process
    matchMutation.mutate();
  };
  
  return (
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
              <Info className="h-4 w-4 mr-2 text-blue-500" />
              <AlertDescription className="text-sm text-blue-700">
                {alreadyAnalyzedCount} out of {resumeCount} {resumeCount === 1 ? 'resume has' : 'resumes have'} already been analyzed for this job and will be skipped.
              </AlertDescription>
            </Alert>
          )}
          
          {matchMutation.isPending && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>Processing...</span>
                <span>{progress}%</span>
              </div>
              <Progress value={progress} className="h-2" />
              
              {alreadyAnalyzedCount > 0 && (
                <p className="text-xs text-gray-500 mt-1">
                  Skipping {alreadyAnalyzedCount} already analyzed {alreadyAnalyzedCount === 1 ? 'resume' : 'resumes'}. 
                  Processing {totalToProcess} new {totalToProcess === 1 ? 'resume' : 'resumes'}.
                </p>
              )}
            </div>
          )}
        </div>
        
        <DialogFooter className="flex justify-between">
          <Button 
            variant="outline" 
            onClick={() => {
              if (matchMutation.isPending) {
                // If a mutation is in progress, this will act as a cancel button
                matchMutation.reset();
                setProgress(0);
                toast({
                  title: "Operation cancelled",
                  description: "The batch matching process was cancelled."
                });
              } else {
                setOpen(false);
              }
            }} 
          >
            {matchMutation.isPending ? "Stop Processing" : "Cancel"}
          </Button>
          <Button 
            onClick={handleBatchMatch}
            disabled={
              !selectedJobId || 
              matchMutation.isPending || 
              resumeIds.length === 0 || 
              checkingAiStatus || 
              (aiStatus && !aiStatus.available)
            }
          >
            {matchMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing {progress}%
              </>
            ) : (
              `Match ${resumeIds.length} ${resumeIds.length === 1 ? 'Resume' : 'Resumes'}`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}