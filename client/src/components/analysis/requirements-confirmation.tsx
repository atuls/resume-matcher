import { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { PenLine, Plus, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { getJobRequirements, analyzeJobRequirements, updateJobRequirement, deleteJobRequirement } from '@/lib/api';
import { JobRequirement } from '@shared/schema';

interface RequirementsConfirmationProps {
  jobDescriptionId: string;
  onRequirementsConfirmed?: () => void;
}

export default function RequirementsConfirmation({ 
  jobDescriptionId,
  onRequirementsConfirmed 
}: RequirementsConfirmationProps) {
  const [activeRequirements, setActiveRequirements] = useState<string[]>([]);
  const [editingRequirement, setEditingRequirement] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  const [newRequirement, setNewRequirement] = useState<string>('');
  
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Query to get all requirements for this job description
  const { 
    data: requirements, 
    isLoading: isLoadingRequirements,
    isError: isRequirementsError,
    refetch: refetchRequirements
  } = useQuery({
    queryKey: [`/api/job-descriptions/${jobDescriptionId}/requirements`],
    queryFn: () => getJobRequirements(jobDescriptionId),
    enabled: !!jobDescriptionId,
  });

  // Set all requirements as active initially
  useEffect(() => {
    if (requirements && requirements.length > 0) {
      setActiveRequirements(requirements.map(req => req.id));
    }
  }, [requirements]);

  // Mutation to analyze job description for requirements
  const analyzeMutation = useMutation({
    mutationFn: () => analyzeJobRequirements(jobDescriptionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ 
        queryKey: [`/api/job-descriptions/${jobDescriptionId}/requirements`] 
      });
      toast({
        title: 'Analysis complete',
        description: 'Job requirements have been extracted successfully.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Analysis failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Mutation to update a requirement
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string, data: Partial<JobRequirement> }) => 
      updateJobRequirement(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ 
        queryKey: [`/api/job-descriptions/${jobDescriptionId}/requirements`] 
      });
      setEditingRequirement(null);
      toast({
        title: 'Requirement updated',
        description: 'The requirement was successfully updated.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Update failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Mutation to delete a requirement
  const deleteMutation = useMutation({
    mutationFn: deleteJobRequirement,
    onSuccess: () => {
      queryClient.invalidateQueries({ 
        queryKey: [`/api/job-descriptions/${jobDescriptionId}/requirements`] 
      });
      toast({
        title: 'Requirement deleted',
        description: 'The requirement was successfully deleted.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Delete failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Toggle requirement selection
  const toggleRequirement = (id: string) => {
    setActiveRequirements(prev => 
      prev.includes(id)
        ? prev.filter(reqId => reqId !== id)
        : [...prev, id]
    );
  };

  // Handle importance change
  const handleImportanceChange = (id: string, importance: string) => {
    updateMutation.mutate({ id, data: { importance } });
  };

  // Start editing a requirement
  const handleEditClick = (req: JobRequirement) => {
    setEditingRequirement(req.id);
    setEditValue(req.requirement);
  };

  // Save edited requirement
  const handleSaveEdit = (id: string) => {
    if (editValue.trim()) {
      updateMutation.mutate({ 
        id, 
        data: { requirement: editValue.trim() }
      });
    }
  };

  // Add a new requirement
  const handleAddRequirement = async () => {
    if (!newRequirement.trim()) return;
    
    // Create a new requirement with default values
    try {
      const newReq = {
        jobDescriptionId,
        requirement: newRequirement.trim(),
        importance: 'Required',
        tags: [] as string[],
      };
      
      await updateMutation.mutate({ 
        id: 'new', // This is handled specially in the API
        data: newReq 
      });
      
      setNewRequirement('');
      refetchRequirements();
    } catch (error) {
      console.error('Error adding new requirement:', error);
    }
  };

  // Confirm requirements and move forward
  const handleConfirmRequirements = () => {
    // Filter out inactive requirements
    if (requirements) {
      const inactiveRequirements = requirements
        .filter(req => !activeRequirements.includes(req.id))
        .map(req => req.id);
      
      // Delete inactive requirements
      Promise.all(inactiveRequirements.map(id => deleteMutation.mutateAsync(id)))
        .then(() => {
          toast({
            title: 'Requirements confirmed',
            description: 'The selected requirements have been confirmed.',
          });
          if (onRequirementsConfirmed) {
            onRequirementsConfirmed();
          }
        })
        .catch(error => {
          toast({
            title: 'Confirmation failed',
            description: error.message,
            variant: 'destructive',
          });
        });
    }
  };

  // If we need to analyze the job description
  if (!requirements || requirements.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold">Job Requirements</h2>
        </div>
        
        <Card>
          <CardContent className="p-6 text-center">
            <h3 className="text-lg font-medium mb-2">No Requirements Found</h3>
            <p className="text-gray-600 mb-4">
              We need to analyze the job description to extract key requirements.
              This helps match candidates more accurately.
            </p>
            
            <Button
              onClick={() => analyzeMutation.mutate()}
              disabled={analyzeMutation.isPending}
              className="w-full"
            >
              {analyzeMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Analyzing Job Description...
                </>
              ) : 'Extract Requirements with AI'}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm p-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold">Extracted Job Requirements</h2>
        <Badge variant="outline" className="bg-blue-100 text-primary px-2 py-1 rounded-full">
          AI Generated
        </Badge>
      </div>
      
      <p className="text-sm text-gray-600 mb-4">
        Our AI has identified the following key requirements from the job description. 
        Please review and adjust if needed.
      </p>
      
      <div className="space-y-3 mb-5">
        {requirements.map(req => (
          <div 
            key={req.id}
            className="flex items-start space-x-3 bg-gray-50 rounded-lg p-3 border border-gray-200"
          >
            <Checkbox
              id={`req-${req.id}`}
              checked={activeRequirements.includes(req.id)}
              onCheckedChange={() => toggleRequirement(req.id)}
              className="mt-1 h-4 w-4"
            />
            <div className="flex-grow">
              <div className="flex justify-between items-start">
                {editingRequirement === req.id ? (
                  <div className="flex-grow pr-2">
                    <Input
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      className="text-sm"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleSaveEdit(req.id);
                        } else if (e.key === 'Escape') {
                          setEditingRequirement(null);
                        }
                      }}
                    />
                  </div>
                ) : (
                  <span className="font-medium text-sm">{req.requirement}</span>
                )}
                
                <div className="flex space-x-1 ml-2">
                  {editingRequirement === req.id ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 px-2 text-xs"
                      onClick={() => handleSaveEdit(req.id)}
                    >
                      Save
                    </Button>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 text-gray-400 hover:text-gray-600"
                      onClick={() => handleEditClick(req)}
                    >
                      <PenLine className="h-3.5 w-3.5" />
                      <span className="sr-only">Edit</span>
                    </Button>
                  )}
                  
                  <Select
                    value={req.importance}
                    onValueChange={(value) => handleImportanceChange(req.id, value)}
                  >
                    <SelectTrigger className="h-8 text-xs w-28">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Required">Required</SelectItem>
                      <SelectItem value="Preferred">Preferred</SelectItem>
                      <SelectItem value="Nice to have">Nice to have</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              {req.tags && req.tags.length > 0 && (
                <div className="mt-1">
                  <div className="flex flex-wrap gap-1">
                    {req.tags.map((tag, i) => (
                      <Badge
                        key={i}
                        variant="secondary"
                        className="bg-blue-100 text-blue-800 hover:bg-blue-200 text-xs px-2 py-0.5"
                      >
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
      
      <div className="flex flex-col space-y-3 sm:flex-row sm:space-y-0 sm:space-x-3">
        <div className="flex-grow flex items-center space-x-2">
          <Input
            placeholder="Add new requirement..."
            value={newRequirement}
            onChange={(e) => setNewRequirement(e.target.value)}
            className="flex-grow"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleAddRequirement();
              }
            }}
          />
          <Button
            variant="outline"
            className="shrink-0"
            onClick={handleAddRequirement}
          >
            <Plus className="h-4 w-4 mr-1" /> Add
          </Button>
        </div>
        
        <Button
          className="shrink-0"
          onClick={handleConfirmRequirements}
          disabled={updateMutation.isPending || deleteMutation.isPending}
        >
          Confirm Requirements
        </Button>
      </div>
    </div>
  );
}
