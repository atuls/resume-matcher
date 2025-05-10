import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Briefcase, ChevronRight, Search, FileText, X } from "lucide-react";
import { getJobDescriptions, analyzeResumes } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import type { Resume } from "@shared/schema";
import { Card } from "@/components/ui/card";

interface MatchJobDialogProps {
  resume: Resume;
}

export default function MatchJobDialog({ resume }: MatchJobDialogProps) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const { data: jobDescriptions, isLoading } = useQuery({
    queryKey: ['/api/job-descriptions'],
    queryFn: getJobDescriptions
  });
  
  const matchMutation = useMutation({
    mutationFn: () => {
      if (!selectedJobId) throw new Error("No job selected");
      return analyzeResumes(selectedJobId, [resume.id]);
    },
    onSuccess: () => {
      toast({
        title: "Analysis complete",
        description: "Resume has been matched with the selected job description."
      });
      queryClient.invalidateQueries({ queryKey: [`/api/job-descriptions/${selectedJobId}/results`] });
      setOpen(false);
    },
    onError: (error) => {
      toast({
        title: "Error matching resume",
        description: error.message,
        variant: "destructive"
      });
    }
  });
  
  const filteredJobs = jobDescriptions?.filter(job => 
    job.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    job.company?.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];
  
  const handleMatch = () => {
    if (!selectedJobId) {
      toast({
        title: "No job selected",
        description: "Please select a job description to match with this resume.",
        variant: "destructive"
      });
      return;
    }
    
    matchMutation.mutate();
  };
  
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="w-full" variant="outline">
          <Briefcase className="mr-2 h-4 w-4" /> 
          Match with Job
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[525px]">
        <DialogHeader>
          <DialogTitle>Match Resume with Job</DialogTitle>
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
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button 
            onClick={handleMatch}
            disabled={!selectedJobId || matchMutation.isPending}
          >
            {matchMutation.isPending ? (
              <>
                <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full mr-2"></div>
                Matching...
              </>
            ) : (
              'Match Resume'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}