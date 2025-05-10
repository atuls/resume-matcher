import { 
  User, InsertUser, 
  JobDescription, InsertJobDescription,
  JobRequirement, InsertJobRequirement,
  Resume, InsertResume,
  AnalysisResult, InsertAnalysisResult
} from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  // User methods
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Job Description methods
  getJobDescription(id: string): Promise<JobDescription | undefined>;
  getAllJobDescriptions(): Promise<JobDescription[]>;
  createJobDescription(jobDescription: InsertJobDescription): Promise<JobDescription>;
  deleteJobDescription(id: string): Promise<boolean>;
  
  // Job Requirement methods
  getJobRequirements(jobDescriptionId: string): Promise<JobRequirement[]>;
  createJobRequirement(requirement: InsertJobRequirement): Promise<JobRequirement>;
  updateJobRequirement(id: string, data: Partial<JobRequirement>): Promise<JobRequirement | undefined>;
  deleteJobRequirement(id: string): Promise<boolean>;
  
  // Resume methods
  getResume(id: string): Promise<Resume | undefined>;
  getAllResumes(): Promise<Resume[]>;
  createResume(resume: InsertResume): Promise<Resume>;
  deleteResume(id: string): Promise<boolean>;
  
  // Analysis Result methods
  getAnalysisResult(id: string): Promise<AnalysisResult | undefined>;
  getAnalysisResultsByJob(jobDescriptionId: string): Promise<AnalysisResult[]>;
  getAnalysisResultForResume(resumeId: string, jobDescriptionId: string): Promise<AnalysisResult | undefined>;
  createAnalysisResult(result: InsertAnalysisResult): Promise<AnalysisResult>;
  deleteAnalysisResult(id: string): Promise<boolean>;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private jobDescriptions: Map<string, JobDescription>;
  private jobRequirements: Map<string, JobRequirement>;
  private resumes: Map<string, Resume>;
  private analysisResults: Map<string, AnalysisResult>;
  
  private currentUserId: number;

  constructor() {
    this.users = new Map();
    this.jobDescriptions = new Map();
    this.jobRequirements = new Map();
    this.resumes = new Map();
    this.analysisResults = new Map();
    this.currentUserId = 1;
  }

  // User methods
  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.currentUserId++;
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }
  
  // Job Description methods
  async getJobDescription(id: string): Promise<JobDescription | undefined> {
    return this.jobDescriptions.get(id);
  }
  
  async getAllJobDescriptions(): Promise<JobDescription[]> {
    return Array.from(this.jobDescriptions.values())
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }
  
  async createJobDescription(jobDescription: InsertJobDescription): Promise<JobDescription> {
    const id = randomUUID();
    const now = new Date();
    const newJobDescription: JobDescription = {
      ...jobDescription,
      id,
      createdAt: now,
    };
    this.jobDescriptions.set(id, newJobDescription);
    return newJobDescription;
  }
  
  async deleteJobDescription(id: string): Promise<boolean> {
    // Delete related requirements and analysis results first
    const requirements = await this.getJobRequirements(id);
    for (const req of requirements) {
      await this.deleteJobRequirement(req.id);
    }
    
    const results = await this.getAnalysisResultsByJob(id);
    for (const result of results) {
      await this.deleteAnalysisResult(result.id);
    }
    
    return this.jobDescriptions.delete(id);
  }
  
  // Job Requirement methods
  async getJobRequirements(jobDescriptionId: string): Promise<JobRequirement[]> {
    return Array.from(this.jobRequirements.values())
      .filter(req => req.jobDescriptionId === jobDescriptionId);
  }
  
  async createJobRequirement(requirement: InsertJobRequirement): Promise<JobRequirement> {
    const id = randomUUID();
    const now = new Date();
    const newRequirement: JobRequirement = {
      ...requirement,
      id,
      createdAt: now,
    };
    this.jobRequirements.set(id, newRequirement);
    return newRequirement;
  }
  
  async updateJobRequirement(id: string, data: Partial<JobRequirement>): Promise<JobRequirement | undefined> {
    const requirement = this.jobRequirements.get(id);
    if (!requirement) return undefined;
    
    const updatedRequirement = {
      ...requirement,
      ...data,
    };
    
    this.jobRequirements.set(id, updatedRequirement);
    return updatedRequirement;
  }
  
  async deleteJobRequirement(id: string): Promise<boolean> {
    return this.jobRequirements.delete(id);
  }
  
  // Resume methods
  async getResume(id: string): Promise<Resume | undefined> {
    return this.resumes.get(id);
  }
  
  async getAllResumes(): Promise<Resume[]> {
    return Array.from(this.resumes.values())
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }
  
  async createResume(resume: InsertResume): Promise<Resume> {
    const id = randomUUID();
    const now = new Date();
    const newResume: Resume = {
      ...resume,
      id,
      createdAt: now,
    };
    this.resumes.set(id, newResume);
    return newResume;
  }
  
  async deleteResume(id: string): Promise<boolean> {
    // Delete related analysis results first
    const results = Array.from(this.analysisResults.values())
      .filter(result => result.resumeId === id);
    
    for (const result of results) {
      await this.deleteAnalysisResult(result.id);
    }
    
    return this.resumes.delete(id);
  }
  
  // Analysis Result methods
  async getAnalysisResult(id: string): Promise<AnalysisResult | undefined> {
    return this.analysisResults.get(id);
  }
  
  async getAnalysisResultsByJob(jobDescriptionId: string): Promise<AnalysisResult[]> {
    return Array.from(this.analysisResults.values())
      .filter(result => result.jobDescriptionId === jobDescriptionId)
      .sort((a, b) => b.overallScore - a.overallScore);
  }
  
  async getAnalysisResultForResume(resumeId: string, jobDescriptionId: string): Promise<AnalysisResult | undefined> {
    return Array.from(this.analysisResults.values())
      .find(result => result.resumeId === resumeId && result.jobDescriptionId === jobDescriptionId);
  }
  
  async createAnalysisResult(result: InsertAnalysisResult): Promise<AnalysisResult> {
    const id = randomUUID();
    const now = new Date();
    const newResult: AnalysisResult = {
      ...result,
      id,
      createdAt: now,
    };
    this.analysisResults.set(id, newResult);
    return newResult;
  }
  
  async deleteAnalysisResult(id: string): Promise<boolean> {
    return this.analysisResults.delete(id);
  }
}

export const storage = new MemStorage();
