import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getCandidateJobConnections,
  createCandidateJobConnection,
  updateCandidateJobConnection,
  deleteCandidateJobConnection,
  getJobDescriptions
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from "@/components/ui/dialog";
import { 
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue 
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { CandidateJobConnection, JobDescription } from "@shared/schema";

interface JobConnectionManagerProps {
  resumeId: string;
  onConnectionsChange?: () => void;
}

export default function JobConnectionManager({ resumeId, onConnectionsChange }: JobConnectionManagerProps) {
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [selectedJobId, setSelectedJobId] = useState<string>("");
  const [connectionNotes, setConnectionNotes] = useState<string>("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch existing connections for this resume
  const {
    data: connections,
    isLoading: isLoadingConnections,
    refetch: refetchConnections
  } = useQuery({
    queryKey: [`/api/resumes/${resumeId}/job-connections`],
    queryFn: () => getCandidateJobConnections(resumeId)
  });

  // Fetch all available jobs
  const { data: jobs, isLoading: isLoadingJobs } = useQuery({
    queryKey: ['/api/job-descriptions'],
    queryFn: getJobDescriptions
  });

  // Create connection mutation
  const createConnectionMutation = useMutation({
    mutationFn: createCandidateJobConnection,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/resumes/${resumeId}/job-connections`] });
      setShowAddDialog(false);
      setSelectedJobId("");
      setConnectionNotes("");
      toast({
        title: "Resume connected to job",
        description: "This candidate has been connected to the selected job position."
      });
      if (onConnectionsChange) onConnectionsChange();
    },
    onError: (error: any) => {
      toast({
        title: "Connection failed",
        description: error.message || "Failed to connect resume to job",
        variant: "destructive"
      });
    }
  });

  // Update connection mutation
  const updateConnectionMutation = useMutation({
    mutationFn: (data: { id: string, status: string, notes?: string }) => 
      updateCandidateJobConnection(data.id, { status: data.status, notes: data.notes }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/resumes/${resumeId}/job-connections`] });
      toast({
        title: "Connection updated",
        description: "The candidate's job connection has been updated."
      });
      if (onConnectionsChange) onConnectionsChange();
    }
  });

  // Delete connection mutation
  const deleteConnectionMutation = useMutation({
    mutationFn: deleteCandidateJobConnection,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/resumes/${resumeId}/job-connections`] });
      toast({
        title: "Connection removed",
        description: "The candidate has been disconnected from this job."
      });
      if (onConnectionsChange) onConnectionsChange();
    }
  });

  // Handle adding a new connection
  const handleAddConnection = () => {
    if (!selectedJobId) {
      toast({
        title: "No job selected",
        description: "Please select a job to connect with this candidate.",
        variant: "destructive"
      });
      return;
    }

    createConnectionMutation.mutate({
      resumeId,
      jobDescriptionId: selectedJobId,
      notes: connectionNotes || undefined
    });
  };

  // Handle updating connection status
  const handleUpdateStatus = (connectionId: string, newStatus: string) => {
    updateConnectionMutation.mutate({
      id: connectionId,
      status: newStatus
    });
  };

  // Get job title by ID
  const getJobTitle = (jobId: string) => {
    return jobs?.find(job => job.id === jobId)?.title || "Unknown Job";
  };

  // Render connected jobs list
  return (
    <div className="mt-4">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-medium">Connected Job Positions</h3>
        <Button 
          size="sm" 
          onClick={() => setShowAddDialog(true)}
          disabled={isLoadingJobs || isLoadingConnections}
        >
          Connect to Job
        </Button>
      </div>

      {isLoadingConnections ? (
        <div className="text-center py-4">Loading connections...</div>
      ) : connections && connections.length > 0 ? (
        <div className="space-y-3">
          {connections.map(connection => (
            <div 
              key={connection.id} 
              className="border rounded-md p-3 flex justify-between items-center"
            >
              <div>
                <div className="font-medium">{getJobTitle(connection.jobDescriptionId)}</div>
                <div className="text-sm text-gray-500">
                  Status: 
                  <span 
                    className={`ml-1 inline-block px-2 py-0.5 rounded text-xs font-medium ${
                      connection.status === 'matched' ? 'bg-green-100 text-green-800' :
                      connection.status === 'shortlisted' ? 'bg-blue-100 text-blue-800' :
                      connection.status === 'rejected' ? 'bg-red-100 text-red-800' :
                      'bg-gray-100 text-gray-800'
                    }`}
                  >
                    {connection.status.charAt(0).toUpperCase() + connection.status.slice(1)}
                  </span>
                </div>
                {connection.notes && (
                  <div className="text-xs text-gray-500 mt-1">{connection.notes}</div>
                )}
              </div>
              <div className="flex space-x-2">
                <Select 
                  value={connection.status} 
                  onValueChange={(val) => handleUpdateStatus(connection.id, val)}
                >
                  <SelectTrigger className="w-[140px] h-8">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="matched">Matched</SelectItem>
                    <SelectItem value="shortlisted">Shortlisted</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                  </SelectContent>
                </Select>
                <Button 
                  size="sm" 
                  variant="destructive"
                  className="h-8"
                  onClick={() => deleteConnectionMutation.mutate(connection.id)}
                >
                  Remove
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-6 border rounded-md border-dashed">
          <p className="text-gray-500">This candidate is not connected to any job positions.</p>
        </div>
      )}

      {/* Add Connection Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Connect to Job Position</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Select Job Position</label>
              <Select value={selectedJobId} onValueChange={setSelectedJobId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a job position" />
                </SelectTrigger>
                <SelectContent>
                  {jobs?.map(job => (
                    <SelectItem key={job.id} value={job.id}>
                      {job.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Notes (Optional)</label>
              <Textarea
                placeholder="Add notes about this connection..."
                value={connectionNotes}
                onChange={(e) => setConnectionNotes(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>Cancel</Button>
            <Button onClick={handleAddConnection} disabled={createConnectionMutation.isPending}>
              {createConnectionMutation.isPending ? "Connecting..." : "Connect"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}