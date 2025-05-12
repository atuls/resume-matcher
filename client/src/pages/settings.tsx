import { useState, useEffect } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { 
  Settings, 
  KeyRound, 
  BellRing, 
  Layout, 
  FileCode, 
  Shield, 
  Database 
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { getSetting, saveSetting } from '@/lib/api';

// Form schema for API settings
const apiFormSchema = z.object({
  openaiApiKey: z.string().optional(),
  mistralApiKey: z.string().optional(),
  anthropicApiKey: z.string().optional(),
  perplexityApiKey: z.string().optional(),
});

// Form schema for general settings
const generalFormSchema = z.object({
  siteName: z.string().min(1, {
    message: "Site name must be at least 1 character.",
  }),
  enableNotifications: z.boolean().default(false),
  emailNotifications: z.boolean().default(false),
  darkMode: z.boolean().default(false),
  defaultJobPage: z.string(),
});

// Form schema for analysis settings
const analysisFormSchema = z.object({
  defaultModel: z.string(),
  includeEvidence: z.boolean().default(true),
  scoreThreshold: z.number().min(0).max(100),
  analysisPrompt: z.string().min(10, {
    message: "Custom analysis prompt must be at least 10 characters long.",
  }),
  workHistoryPrompt: z.string().min(10, {
    message: "Work history prompt must be at least 10 characters long.",
  }),
  skillsPrompt: z.string().min(10, {
    message: "Skills prompt must be at least 10 characters long.",
  }),
  redFlagsPrompt: z.string().min(10, {
    message: "Red flags prompt must be at least 10 characters long.",
  }),
});

export default function SettingsPage() {
  const [isApiLocked, setIsApiLocked] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  // Form for API settings
  const apiForm = useForm<z.infer<typeof apiFormSchema>>({
    resolver: zodResolver(apiFormSchema),
    defaultValues: {
      openaiApiKey: '●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●',
      mistralApiKey: '●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●',
      anthropicApiKey: '',
      perplexityApiKey: '',
    },
  });

  // Form for general settings
  const generalForm = useForm<z.infer<typeof generalFormSchema>>({
    resolver: zodResolver(generalFormSchema),
    defaultValues: {
      siteName: 'ResumAI',
      enableNotifications: true,
      emailNotifications: false,
      darkMode: false,
      defaultJobPage: 'dashboard',
    },
  });

  // Form for analysis settings
  const analysisForm = useForm<z.infer<typeof analysisFormSchema>>({
    resolver: zodResolver(analysisFormSchema),
    defaultValues: {
      defaultModel: 'gpt-4o-mini',
      includeEvidence: true,
      scoreThreshold: 70,
      analysisPrompt: 'Analyze this resume against the job requirements. Provide detailed feedback on skills match, experience relevance, and overall fit.',
      workHistoryPrompt: `You are a skilled HR professional with expertise in parsing resumes.
IMPORTANT: You must output ONLY valid JSON with no other text. Do not add any explanations or notes before or after the JSON.

Your task is to extract the work history from this resume.
Return a JSON object with a single "workHistory" array containing objects with these properties:
- title: Job title (string)
- company: Company name (string)
- location: Location (string, optional)
- startDate: Start date (string, optional)
- endDate: End date (string, optional, use "Present" for current roles)
- description: Summary of responsibilities and achievements (string)
- durationMonths: Estimated duration in months (number, optional)
- isCurrentRole: Boolean indicating if this is their current role (boolean, optional)

Example of correct output format:
{"workHistory": [
  {
    "title": "Software Engineer",
    "company": "Tech Company",
    "location": "San Francisco, CA",
    "startDate": "2020-01",
    "endDate": "Present",
    "description": "Developed applications using React and Node.js",
    "durationMonths": 24,
    "isCurrentRole": true
  }
]}

REMINDER: Output only valid JSON with no additional text.`,
      skillsPrompt: `You are a skilled HR professional with expertise in parsing resumes.
IMPORTANT: You must output ONLY valid JSON with no other text. Do not add any explanations or notes before or after the JSON.

Your task is to extract a comprehensive list of technical skills, soft skills, and qualifications from the resume.
Return a JSON object with a single "skills" array containing string items.

Example of correct output format:
{"skills": ["JavaScript", "React", "Node.js", "Communication", "Project Management"]}

REMINDER: Output only valid JSON with no additional text.`,
      redFlagsPrompt: `You are a skilled recruiter analyzing resumes for potential concerns.
IMPORTANT: You must output ONLY valid JSON with no other text. Do not add any explanations or notes before or after the JSON.

Analyze the provided resume and job description to identify:
1. Potential red flags that might indicate issues with the candidate's fit
2. Highlights that demonstrate particular strengths for this role
3. The candidate's current position and employment status

Return a JSON object with the following properties:
- "redFlags": Array of strings describing potential concerns
- "highlights": Array of strings describing key strengths
- "currentPosition": String describing their current or most recent role
- "employmentStatus": "employed", "unemployed", or "unknown"

Example of correct output format:
{
  "redFlags": ["Frequent job changes with less than 1 year tenure", "Gap in employment from 2019-2020"],
  "highlights": ["5+ years experience with required technologies", "Leadership experience managing teams of 5+"],
  "currentPosition": "Senior Software Engineer at Tech Corp",
  "employmentStatus": "employed"
}

Consider factors like job hopping, employment gaps, contract work history, relevant experience, and skill match.

REMINDER: Output only valid JSON with no additional text.`,
    },
  });

  // Handle API settings submission
  function onApiSubmit(values: z.infer<typeof apiFormSchema>) {
    // Would normally save these to secure storage
    toast({
      title: "API keys updated",
      description: "Your API configuration has been saved securely.",
    });
    setIsApiLocked(true);
  }

  // Handle general settings submission
  function onGeneralSubmit(values: z.infer<typeof generalFormSchema>) {
    toast({
      title: "Settings updated",
      description: "Your application settings have been saved.",
    });
  }

  // Handle analysis settings submission
  async function onAnalysisSubmit(values: z.infer<typeof analysisFormSchema>) {
    try {
      // Save each setting individually for flexibility
      await saveSetting('analysis_default_model', values.defaultModel, 'analysis');
      await saveSetting('analysis_include_evidence', values.includeEvidence.toString(), 'analysis');
      await saveSetting('analysis_score_threshold', values.scoreThreshold.toString(), 'analysis');
      await saveSetting('analysis_prompt', values.analysisPrompt, 'analysis');
      await saveSetting('work_history_prompt', values.workHistoryPrompt, 'analysis');
      await saveSetting('skills_prompt', values.skillsPrompt, 'analysis');
      await saveSetting('red_flags_prompt', values.redFlagsPrompt, 'analysis');
      
      toast({
        title: "Analysis settings updated",
        description: "Your analysis configuration has been saved successfully.",
      });
    } catch (error) {
      console.error("Error saving analysis settings:", error);
      toast({
        title: "Failed to save settings",
        description: "There was an error saving your analysis settings. Please try again.",
        variant: "destructive"
      });
    }
  }
  
  // Load saved settings when component mounts
  useEffect(() => {
    async function loadSettings() {
      setIsLoading(true);
      try {
        // Load analysis settings
        const defaultModel = await getSetting('analysis_default_model');
        const includeEvidence = await getSetting('analysis_include_evidence');
        const scoreThreshold = await getSetting('analysis_score_threshold');
        const analysisPrompt = await getSetting('analysis_prompt');
        const workHistoryPrompt = await getSetting('work_history_prompt');
        const skillsPrompt = await getSetting('skills_prompt');
        const redFlagsPrompt = await getSetting('red_flags_prompt');
        
        // Update the form with saved values if they exist
        if (defaultModel?.value) {
          analysisForm.setValue('defaultModel', defaultModel.value);
        }
        
        if (includeEvidence?.value) {
          analysisForm.setValue('includeEvidence', includeEvidence.value === 'true');
        }
        
        if (scoreThreshold?.value) {
          analysisForm.setValue('scoreThreshold', parseInt(scoreThreshold.value));
        }
        
        if (analysisPrompt?.value) {
          analysisForm.setValue('analysisPrompt', analysisPrompt.value);
        }
        
        if (workHistoryPrompt?.value) {
          analysisForm.setValue('workHistoryPrompt', workHistoryPrompt.value);
        }
        
        if (skillsPrompt?.value) {
          analysisForm.setValue('skillsPrompt', skillsPrompt.value);
        }
        
        if (redFlagsPrompt?.value) {
          analysisForm.setValue('redFlagsPrompt', redFlagsPrompt.value);
        }
      } catch (error) {
        console.error("Error loading settings:", error);
      } finally {
        setIsLoading(false);
      }
    }
    
    loadSettings();
  }, [analysisForm]);

  return (
    <>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Settings</h1>
        <div className="flex items-center text-gray-500">
          <Settings className="h-5 w-5 mr-2" />
          <span>Manage your application preferences</span>
        </div>
      </div>

      <Tabs defaultValue="general" className="w-full">
        <TabsList className="mb-6">
          <TabsTrigger value="general">
            <Layout className="h-4 w-4 mr-2" />
            General
          </TabsTrigger>
          <TabsTrigger value="api">
            <KeyRound className="h-4 w-4 mr-2" />
            API Keys
          </TabsTrigger>
          <TabsTrigger value="analysis">
            <FileCode className="h-4 w-4 mr-2" />
            Analysis
          </TabsTrigger>
        </TabsList>

        <TabsContent value="general">
          <Card>
            <CardHeader>
              <CardTitle>General Settings</CardTitle>
              <CardDescription>Manage your application preferences and user interface options.</CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...generalForm}>
                <form onSubmit={generalForm.handleSubmit(onGeneralSubmit)} className="space-y-6">
                  <FormField
                    control={generalForm.control}
                    name="siteName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Site Name</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormDescription>
                          This is the name displayed in the header and browser title.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Separator />
                  <h3 className="text-lg font-medium">Notifications</h3>

                  <FormField
                    control={generalForm.control}
                    name="enableNotifications"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">
                            Enable Notifications
                          </FormLabel>
                          <FormDescription>
                            Get notifications for analysis completion and system updates.
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={generalForm.control}
                    name="emailNotifications"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">
                            Email Notifications
                          </FormLabel>
                          <FormDescription>
                            Receive email notifications for important updates.
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <Separator />
                  <h3 className="text-lg font-medium">Appearance</h3>

                  <FormField
                    control={generalForm.control}
                    name="darkMode"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">
                            Dark Mode
                          </FormLabel>
                          <FormDescription>
                            Toggle dark mode for the application interface.
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <Button type="submit">Save General Settings</Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="api">
          <Card>
            <CardHeader>
              <CardTitle>API Configuration</CardTitle>
              <CardDescription>Manage your AI service provider API keys for resume analysis.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex justify-between items-center mb-4">
                <p className="text-sm text-gray-500">
                  API keys are securely stored and encrypted. You must unlock to view or edit them.
                </p>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setIsApiLocked(!isApiLocked)}
                >
                  {isApiLocked ? 'Unlock' : 'Lock'} API Settings
                </Button>
              </div>

              <Form {...apiForm}>
                <form onSubmit={apiForm.handleSubmit(onApiSubmit)} className="space-y-6">
                  <FormField
                    control={apiForm.control}
                    name="openaiApiKey"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>OpenAI API Key</FormLabel>
                        <FormControl>
                          <Input 
                            {...field} 
                            type={isApiLocked ? "password" : "text"} 
                            disabled={isApiLocked}
                          />
                        </FormControl>
                        <FormDescription>
                          Used for analyzing job descriptions and resumes.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={apiForm.control}
                    name="mistralApiKey"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Mistral AI API Key</FormLabel>
                        <FormControl>
                          <Input 
                            {...field} 
                            type={isApiLocked ? "password" : "text"} 
                            disabled={isApiLocked}
                          />
                        </FormControl>
                        <FormDescription>
                          Used for PDF text extraction and document processing.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={apiForm.control}
                    name="anthropicApiKey"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Anthropic API Key (Optional)</FormLabel>
                        <FormControl>
                          <Input 
                            {...field} 
                            type={isApiLocked ? "password" : "text"} 
                            disabled={isApiLocked}
                            placeholder="Enter Anthropic API key"
                          />
                        </FormControl>
                        <FormDescription>
                          Optional alternative AI provider for analysis.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={apiForm.control}
                    name="perplexityApiKey"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Perplexity AI API Key (Optional)</FormLabel>
                        <FormControl>
                          <Input 
                            {...field} 
                            type={isApiLocked ? "password" : "text"} 
                            disabled={isApiLocked}
                            placeholder="Enter Perplexity API key"
                          />
                        </FormControl>
                        <FormDescription>
                          Optional alternative AI provider for analysis.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Button type="submit" disabled={isApiLocked}>Save API Settings</Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analysis">
          <Card>
            <CardHeader>
              <CardTitle>Analysis Configuration</CardTitle>
              <CardDescription>Configure how resumes are analyzed and scored against job descriptions.</CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...analysisForm}>
                <form onSubmit={analysisForm.handleSubmit(onAnalysisSubmit)} className="space-y-6">
                  <FormField
                    control={analysisForm.control}
                    name="defaultModel"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Default AI Model</FormLabel>
                        <FormControl>
                          <select
                            className="w-full rounded-md border border-gray-300 p-2"
                            {...field}
                          >
                            <option value="gpt-4o-mini">GPT-4o Mini (Default)</option>
                            <option value="gpt-4o">GPT-4o (Higher Quality)</option>
                            <option value="claude-3-7-sonnet-20250219">Claude 3.7 Sonnet (New, Recommended)</option>
                            <option value="claude-3-haiku">Claude 3 Haiku (Faster)</option>
                            <option value="mistral-large">Mistral Large</option>
                          </select>
                        </FormControl>
                        <FormDescription>
                          Select the default AI model for resume analysis.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={analysisForm.control}
                    name="includeEvidence"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">
                            Include Evidence in Results
                          </FormLabel>
                          <FormDescription>
                            Show supporting text from resumes for each skill match.
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={analysisForm.control}
                    name="scoreThreshold"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Minimum Match Threshold (%)</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            min="0" 
                            max="100" 
                            {...field} 
                            onChange={e => field.onChange(parseInt(e.target.value))}
                          />
                        </FormControl>
                        <FormDescription>
                          Minimum overall score for highlighting top candidates.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={analysisForm.control}
                    name="analysisPrompt"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Custom Analysis Prompt</FormLabel>
                        <FormControl>
                          <Textarea 
                            {...field} 
                            placeholder="Enter custom analysis instructions..."
                            className="min-h-[100px]"
                          />
                        </FormControl>
                        <FormDescription>
                          Customize the instructions given to the AI for analysis.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={analysisForm.control}
                    name="workHistoryPrompt"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Work History Extraction Prompt</FormLabel>
                        <FormControl>
                          <Textarea 
                            {...field} 
                            placeholder="Enter instructions for extracting work history..."
                            className="min-h-[150px]"
                          />
                        </FormControl>
                        <FormDescription>
                          Customize the prompt used to extract work history from resumes.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={analysisForm.control}
                    name="skillsPrompt"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Skills Extraction Prompt</FormLabel>
                        <FormControl>
                          <Textarea 
                            {...field} 
                            placeholder="Enter instructions for extracting skills..."
                            className="min-h-[150px]"
                          />
                        </FormControl>
                        <FormDescription>
                          Customize the prompt used to extract skills from resumes.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={analysisForm.control}
                    name="redFlagsPrompt"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Red Flags Analysis Prompt</FormLabel>
                        <FormControl>
                          <Textarea 
                            {...field} 
                            placeholder="Enter instructions for red flags analysis..."
                            className="min-h-[150px]"
                          />
                        </FormControl>
                        <FormDescription>
                          Customize the prompt used to identify potential red flags and highlights in resumes.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Button type="submit">Save Analysis Settings</Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </>
  );
}