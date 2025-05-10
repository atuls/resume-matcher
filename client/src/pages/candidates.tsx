import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { 
  Plus, Calendar, FileText, Trash2, AlertCircle, Filter, Search 
} from "lucide-react";
import { getResumes, getJobDescriptions, deleteResume } from "@/lib/api";
import { formatDistanceToNow } from "date-fns";
import ResumeUploader from "@/components/resume/uploader";
import { useState } from "react";
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription 
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";

export default function CandidatesPage() {
  const [showUploader, setShowUploader] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [resumeToDelete, setResumeToDelete] = useState<string | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

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
  const formatDate = (dateString: Date) => {
    try {
      const date = new Date(dateString);
      return formatDistanceToNow(date, { addSuffix: true });
    } catch (error) {
      return 'Invalid date';
    }
  };

  // Format file size for display
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1048576).toFixed(1) + ' MB';
  };
  
  // Filter resumes based on search query and selected job
  const filteredResumes = resumes?.filter(resume => {
    // Apply name filter
    const nameMatch = !searchQuery || 
      (resume.candidateName?.toLowerCase().includes(searchQuery.toLowerCase()) || 
       resume.fileName.toLowerCase().includes(searchQuery.toLowerCase()));
       
    // Apply job filter if a job is selected
    // Note: In a real app, we would query for resumes that were matched with this job
    // For now, we'll just show all resumes when a job is selected
    return nameMatch;
  }) || [];
  
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

  return (
    <>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Candidates</h1>
        <Button onClick={() => setShowUploader(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add Candidate
        </Button>
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
        </div>
      </div>

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

      {isLoading ? (
        <div className="text-center py-8">
          <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-gray-500">Loading candidates...</p>
        </div>
      ) : filteredResumes.length > 0 ? (
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Candidate
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  File
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Uploaded
                </th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredResumes.map((resume) => (
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
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex items-center justify-end gap-2">
                      <Button 
                        size="sm" 
                        variant="outline" 
                        className="text-primary"
                        onClick={() => window.location.href = `/resume/${resume.id}`}
                      >
                        View Profile
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50"
                        onClick={() => handleDeleteClick(resume.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="text-center py-12 bg-gray-50 rounded-lg border border-gray-200">
          <h3 className="text-lg font-medium mb-2">No Candidates Found</h3>
          <p className="text-gray-600 mb-4">
            Upload candidate resumes to start analyzing them against job descriptions.
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
          <div className="mt-4">
            {deleteMutation.isPending ? (
              <div className="flex items-center justify-center p-4">
                <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full mr-2"></div>
                <span>Deleting...</span>
              </div>
            ) : deleteMutation.isError ? (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Failed to delete resume. Please try again.
                </AlertDescription>
              </Alert>
            ) : null}
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setShowDeleteDialog(false)} 
              disabled={deleteMutation.isPending}
            >
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={confirmDelete}
              disabled={deleteMutation.isPending}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}