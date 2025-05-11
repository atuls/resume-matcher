import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger, DialogDescription 
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Briefcase, ChevronRight, Search, FileText, X, Users, Loader2 } from "lucide-react";
import { getJobDescriptions, analyzeResumes } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
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
  buttonVariant = "default" 
}: BatchMatchDialogProps) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  // Determine which resume IDs to use
  const resumeIds = filteredResumeIds || resumes.map(r => r.id);
  const resumeCount = resumeIds.length;

  // Get job descriptions
  const { data: jobDescriptions, isLoading } = useQuery({
    queryKey: ['/api/job-descriptions'],
    queryFn: getJobDescriptions
  });
  
  // Mutation for batch matching
  const matchMutation = useMutation({
    mutationFn: async () => {
      if (!selectedJobId) throw new Error("No job selected");
      setProgress(0);
      
      // For UX, simulate progress during the initial API call
      const progressInterval = setInterval(() => {
        setProgress(prev => {
          // Only increment up to 80% to leave room for actual completion
          const next = prev + Math.floor(Math.random() * 5);
          return Math.min(next, 80);
        });
      }, 600);
      
      try {
        const result = await analyzeResumes(selectedJobId, resumeIds);
        clearInterval(progressInterval);
        return result;
      } catch (error) {
        clearInterval(progressInterval);
        throw error;
      }
    },
    onSuccess: (data) => {
      setProgress(100);
      const resultCount = data.results.length;
      toast({
        title: "Batch analysis complete",
        description: `${resultCount} ${resultCount === 1 ? 'resume has' : 'resumes have'} been matched with the selected job description.`
      });
      
      // Invalidate queries to refresh the data
      queryClient.invalidateQueries({ queryKey: [`/api/job-descriptions/${selectedJobId}/results`] });
      queryClient.invalidateQueries({ queryKey: ['/api/resumes'] });
      
      setTimeout(() => {
        setOpen(false);
        setProgress(0);
      }, 1000);
    },
    onError: (error) => {
      setProgress(0);
      toast({
        title: "Error matching resumes",
        description: error.message,
        variant: "destructive"
      });
    }
  });
  
  // Filter jobs based on search query
  const filteredJobs = jobDescriptions?.filter(job => 
    job.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    job.company?.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];
  
  // Handle match button click
  const handleBatchMatch = () => {
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
            Match {resumeCount} {resumeCount === 1 ? 'resume' : 'resumes'} with a job description
          </DialogDescription>
        </DialogHeader>
        
        <div className="mt-4 space-y-4">
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
          
          {matchMutation.isPending && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>Processing...</span>
                <span>{progress}%</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>
          )}
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={matchMutation.isPending}>
            Cancel
          </Button>
          <Button 
            onClick={handleBatchMatch}
            disabled={!selectedJobId || matchMutation.isPending || resumeIds.length === 0}
          >
            {matchMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Matching {resumeIds.length} {resumeIds.length === 1 ? 'resume' : 'resumes'}...
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