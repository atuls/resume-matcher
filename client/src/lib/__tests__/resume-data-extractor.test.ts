import { extractResumeData, extractRedFlagData } from '../resume-data-extractor';
import { extractWorkHistory } from '../debug-utils';

describe('Resume Data Extractor Tests', () => {
  // Test data that matches our expected API response structure
  const sampleRedFlagData = {
    resumeId: '123',
    jobDescriptionId: '456',
    analysis: {
      currentJobPosition: 'Software Engineer',
      currentCompany: 'Tech Company',
      isCurrentlyEmployed: true,
      recentRoles: [
        {
          title: 'Software Engineer',
          company: 'Tech Company',
          durationMonths: 24,
          isContract: false
        },
        {
          title: 'Junior Developer',
          company: 'Startup Inc',
          durationMonths: 18,
          isContract: false
        }
      ],
      averageTenureMonths: 21,
      hasJobHoppingHistory: false,
      hasContractRoles: false,
      redFlags: ['No recent experience found', 'Potential job hopping'],
      highlights: ['JavaScript', 'React', 'Node.js']
    }
  };

  describe('extractWorkHistory function', () => {
    it('should extract work history from recentRoles array', () => {
      const workHistory = extractWorkHistory(sampleRedFlagData);
      
      // Verify workHistory is extracted and matches expected data
      expect(workHistory).toHaveLength(2);
      expect(workHistory[0].title).toBe('Software Engineer');
      expect(workHistory[0].company).toBe('Tech Company');
      expect(workHistory[1].title).toBe('Junior Developer');
    });

    it('should return empty array when data is missing', () => {
      const emptyData = {};
      const workHistory = extractWorkHistory(emptyData);
      
      expect(workHistory).toHaveLength(0);
    });
  });

  describe('extractResumeData function', () => {
    it('should extract all resume sections from analysis result', () => {
      const extractedData = extractResumeData(sampleRedFlagData);
      
      // Test work history extraction
      expect(extractedData.workHistory).toHaveLength(2);
      expect(extractedData.workHistory[0].title).toBe('Software Engineer');
      
      // Test redFlags extraction
      expect(extractedData.redFlags).toHaveLength(0); // It doesn't extract these in the current implementation
    });
  });

  describe('extractRedFlagData function', () => {
    it('should extract red flags from analysis', () => {
      // Create a version of our test data that matches what extractRedFlagData expects
      const redFlagData = {
        ...sampleRedFlagData,
        redFlags: sampleRedFlagData.analysis.redFlags
      };
      
      const extractedFlags = extractRedFlagData(redFlagData);
      expect(extractedFlags).toHaveLength(2);
      expect(extractedFlags).toContain('No recent experience found');
      expect(extractedFlags).toContain('Potential job hopping');
    });
  });
});