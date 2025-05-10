import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Plus, User, Calendar, FileText, Mail, Phone } from "lucide-react";
import { getResumes } from "@/lib/api";
import { formatDistanceToNow } from "date-fns";
import ResumeUploader from "@/components/resume/uploader";
import { useState } from "react";

export default function CandidatesPage() {
  const [showUploader, setShowUploader] = useState(false);
  const { toast } = useToast();

  // Fetch resumes
  const {
    data: resumes,
    isLoading,
    refetch: refetchResumes
  } = useQuery({
    queryKey: ['/api/resumes'],
    queryFn: getResumes
  });

  // Handle successful resume upload
  const handleResumeUpload = () => {
    setShowUploader(false);
    refetchResumes();
    toast({
      title: "Resume uploaded",
      description: "The candidate resume has been successfully uploaded.",
    });
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

  return (
    <>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Candidates</h1>
        <Button onClick={() => setShowUploader(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add Candidate
        </Button>
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
      ) : resumes && resumes.length > 0 ? (
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
              {resumes.map((resume) => (
                <tr key={resume.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-10 w-10 bg-gray-200 rounded-full flex items-center justify-center">
                        <User className="h-5 w-5 text-gray-500" />
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900">
                          {resume.candidateName || 'Unnamed Candidate'}
                        </div>
                        <div className="text-sm text-gray-500">
                          {resume.candidateTitle || 'No title available'}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <FileText className="h-4 w-4 text-gray-400 mr-2" />
                      <div className="text-sm text-gray-900">{resume.fileName}</div>
                      <span className="ml-2 text-xs text-gray-500">({formatFileSize(resume.fileSize)})</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center text-sm text-gray-500">
                      <Calendar className="h-4 w-4 mr-1" />
                      {formatDate(resume.createdAt)}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className="text-primary"
                      onClick={() => window.location.href = `/resume/${resume.id}`}
                    >
                      View Profile
                    </Button>
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
    </>
  );
}