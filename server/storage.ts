import { 
  User, InsertUser, 
  JobDescription, InsertJobDescription,
  JobRequirement, InsertJobRequirement,
  Resume, InsertResume,
  AnalysisResult, InsertAnalysisResult,
  CandidateJobConnection, InsertCandidateJobConnection
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
  updateAnalysisResult(id: string, data: Partial<AnalysisResult>): Promise<AnalysisResult | undefined>;
  deleteAnalysisResult(id: string): Promise<boolean>;
  
  // Candidate-Job Connection methods
  getCandidateJobConnection(id: string): Promise<CandidateJobConnection | undefined>;
  getCandidateJobConnections(filters?: { resumeId?: string, jobDescriptionId?: string }): Promise<CandidateJobConnection[]>;
  createCandidateJobConnection(connection: InsertCandidateJobConnection): Promise<CandidateJobConnection>;
  updateCandidateJobConnection(id: string, data: Partial<CandidateJobConnection>): Promise<CandidateJobConnection | undefined>;
  deleteCandidateJobConnection(id: string): Promise<boolean>;
}

export class DatabaseStorage implements IStorage {
  // User methods
  async getUser(id: number): Promise<User | undefined> {
    const { db } = await import('./db');
    const { eq } = await import('drizzle-orm');
    const { users } = await import('@shared/schema');

    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const { db } = await import('./db');
    const { eq } = await import('drizzle-orm');
    const { users } = await import('@shared/schema');

    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const { db } = await import('./db');
    const { users } = await import('@shared/schema');

    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }
  
  // Job Description methods
  async getJobDescription(id: string): Promise<JobDescription | undefined> {
    const { db } = await import('./db');
    const { eq } = await import('drizzle-orm');
    const { jobDescriptions } = await import('@shared/schema');

    const [jobDescription] = await db.select().from(jobDescriptions).where(eq(jobDescriptions.id, id));
    return jobDescription;
  }
  
  async getAllJobDescriptions(): Promise<JobDescription[]> {
    const { db } = await import('./db');
    const { desc } = await import('drizzle-orm');
    const { jobDescriptions } = await import('@shared/schema');

    return db.select().from(jobDescriptions).orderBy(desc(jobDescriptions.createdAt));
  }
  
  async createJobDescription(jobDescription: InsertJobDescription): Promise<JobDescription> {
    const { db } = await import('./db');
    const { jobDescriptions } = await import('@shared/schema');

    const [newJobDescription] = await db.insert(jobDescriptions).values(jobDescription).returning();
    return newJobDescription;
  }
  
  async deleteJobDescription(id: string): Promise<boolean> {
    const { db } = await import('./db');
    const { eq } = await import('drizzle-orm');
    const { jobDescriptions, jobRequirements, analysisResults } = await import('@shared/schema');
    
    try {
      // Delete related results first
      await db.delete(analysisResults).where(eq(analysisResults.jobDescriptionId, id));
      
      // Delete requirements
      await db.delete(jobRequirements).where(eq(jobRequirements.jobDescriptionId, id));
      
      // Delete job description
      const result = await db.delete(jobDescriptions).where(eq(jobDescriptions.id, id)).returning();
      return result.length > 0;
    } catch (error) {
      console.error('Error deleting job description:', error);
      return false;
    }
  }
  
  // Job Requirement methods
  async getJobRequirements(jobDescriptionId: string): Promise<JobRequirement[]> {
    const { db } = await import('./db');
    const { eq } = await import('drizzle-orm');
    const { jobRequirements } = await import('@shared/schema');

    return db.select().from(jobRequirements).where(eq(jobRequirements.jobDescriptionId, jobDescriptionId));
  }
  
  async createJobRequirement(requirement: InsertJobRequirement): Promise<JobRequirement> {
    const { db } = await import('./db');
    const { jobRequirements } = await import('@shared/schema');

    const [newRequirement] = await db.insert(jobRequirements).values(requirement).returning();
    return newRequirement;
  }
  
  async updateJobRequirement(id: string, data: Partial<JobRequirement>): Promise<JobRequirement | undefined> {
    const { db } = await import('./db');
    const { eq } = await import('drizzle-orm');
    const { jobRequirements } = await import('@shared/schema');

    const [updatedRequirement] = await db
      .update(jobRequirements)
      .set(data)
      .where(eq(jobRequirements.id, id))
      .returning();
    
    return updatedRequirement;
  }
  
  async deleteJobRequirement(id: string): Promise<boolean> {
    const { db } = await import('./db');
    const { eq } = await import('drizzle-orm');
    const { jobRequirements } = await import('@shared/schema');

    const result = await db.delete(jobRequirements).where(eq(jobRequirements.id, id)).returning();
    return result.length > 0;
  }
  
  // Resume methods
  async getResume(id: string): Promise<Resume | undefined> {
    const { db } = await import('./db');
    const { eq } = await import('drizzle-orm');
    const { resumes } = await import('@shared/schema');

    const [resume] = await db.select().from(resumes).where(eq(resumes.id, id));
    return resume;
  }
  
  async getAllResumes(): Promise<Resume[]> {
    const { db } = await import('./db');
    const { desc } = await import('drizzle-orm');
    const { resumes } = await import('@shared/schema');

    return db.select().from(resumes).orderBy(desc(resumes.createdAt));
  }
  
  async createResume(resume: InsertResume): Promise<Resume> {
    const { db } = await import('./db');
    const { resumes } = await import('@shared/schema');

    const [newResume] = await db.insert(resumes).values(resume).returning();
    return newResume;
  }
  
  async deleteResume(id: string): Promise<boolean> {
    const { db } = await import('./db');
    const { eq } = await import('drizzle-orm');
    const { resumes, analysisResults } = await import('@shared/schema');
    
    try {
      // Delete related results first
      await db.delete(analysisResults).where(eq(analysisResults.resumeId, id));
      
      // Delete resume
      const result = await db.delete(resumes).where(eq(resumes.id, id)).returning();
      return result.length > 0;
    } catch (error) {
      console.error('Error deleting resume:', error);
      return false;
    }
  }
  
  // Add missing method for updateResume that was previously called in routes.ts
  async updateResume(id: string, data: Partial<Resume>): Promise<Resume | undefined> {
    const { db } = await import('./db');
    const { eq } = await import('drizzle-orm');
    const { resumes } = await import('@shared/schema');

    const [updatedResume] = await db
      .update(resumes)
      .set(data)
      .where(eq(resumes.id, id))
      .returning();
    
    return updatedResume;
  }
  
  // Analysis Result methods
  async getAnalysisResult(id: string): Promise<AnalysisResult | undefined> {
    const { db } = await import('./db');
    const { eq } = await import('drizzle-orm');
    const { analysisResults } = await import('@shared/schema');

    const [result] = await db.select().from(analysisResults).where(eq(analysisResults.id, id));
    return result;
  }
  
  async getAnalysisResultsByJob(jobDescriptionId: string): Promise<AnalysisResult[]> {
    const { db } = await import('./db');
    const { eq, desc } = await import('drizzle-orm');
    const { analysisResults } = await import('@shared/schema');

    return db
      .select()
      .from(analysisResults)
      .where(eq(analysisResults.jobDescriptionId, jobDescriptionId))
      .orderBy(desc(analysisResults.overallScore));
  }
  
  async getAnalysisResultForResume(resumeId: string, jobDescriptionId: string): Promise<AnalysisResult | undefined> {
    const { db } = await import('./db');
    const { and, eq } = await import('drizzle-orm');
    const { analysisResults } = await import('@shared/schema');

    const [result] = await db
      .select()
      .from(analysisResults)
      .where(
        and(
          eq(analysisResults.resumeId, resumeId),
          eq(analysisResults.jobDescriptionId, jobDescriptionId)
        )
      );
    
    return result;
  }
  
  async createAnalysisResult(result: InsertAnalysisResult): Promise<AnalysisResult> {
    const { db } = await import('./db');
    const { analysisResults } = await import('@shared/schema');

    const [newResult] = await db.insert(analysisResults).values(result).returning();
    return newResult;
  }
  
  async deleteAnalysisResult(id: string): Promise<boolean> {
    const { db } = await import('./db');
    const { eq } = await import('drizzle-orm');
    const { analysisResults } = await import('@shared/schema');

    const result = await db.delete(analysisResults).where(eq(analysisResults.id, id)).returning();
    return result.length > 0;
  }

  // Candidate-Job Connection methods
  async getCandidateJobConnection(id: string): Promise<CandidateJobConnection | undefined> {
    const { db } = await import('./db');
    const { eq } = await import('drizzle-orm');
    const { candidateJobConnections } = await import('@shared/schema');

    const [connection] = await db
      .select()
      .from(candidateJobConnections)
      .where(eq(candidateJobConnections.id, id));
    
    return connection;
  }

  async getCandidateJobConnections(filters?: { resumeId?: string, jobDescriptionId?: string }): Promise<CandidateJobConnection[]> {
    const { db } = await import('./db');
    const { eq, and, desc } = await import('drizzle-orm');
    const { candidateJobConnections } = await import('@shared/schema');

    // Define filter conditions
    const conditions = [];
    if (filters?.resumeId) {
      conditions.push(eq(candidateJobConnections.resumeId, filters.resumeId));
    }
    if (filters?.jobDescriptionId) {
      conditions.push(eq(candidateJobConnections.jobDescriptionId, filters.jobDescriptionId));
    }
    
    // Execute query with any applicable filters
    const connections = await db.select()
      .from(candidateJobConnections)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(candidateJobConnections.createdAt));
      
    return connections;
  }

  async createCandidateJobConnection(connection: InsertCandidateJobConnection): Promise<CandidateJobConnection> {
    const { db } = await import('./db');
    const { candidateJobConnections } = await import('@shared/schema');

    const [newConnection] = await db.insert(candidateJobConnections).values(connection).returning();
    return newConnection;
  }

  async updateCandidateJobConnection(id: string, data: Partial<CandidateJobConnection>): Promise<CandidateJobConnection | undefined> {
    const { db } = await import('./db');
    const { eq } = await import('drizzle-orm');
    const { candidateJobConnections } = await import('@shared/schema');

    // Add updatedAt timestamp to the update
    const updateData = {
      ...data,
      updatedAt: new Date()
    };

    const [updated] = await db
      .update(candidateJobConnections)
      .set(updateData)
      .where(eq(candidateJobConnections.id, id))
      .returning();
    
    return updated;
  }

  async deleteCandidateJobConnection(id: string): Promise<boolean> {
    const { db } = await import('./db');
    const { eq } = await import('drizzle-orm');
    const { candidateJobConnections } = await import('@shared/schema');

    const result = await db
      .delete(candidateJobConnections)
      .where(eq(candidateJobConnections.id, id))
      .returning();
    
    return result.length > 0;
  }
}

export const storage = new DatabaseStorage();
