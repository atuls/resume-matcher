import OpenAI from "openai";


const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Extract skills from resume text using OpenAI
 * 
 * @param text The resume text to analyze
 * @returns An array of extracted skills
 */
export async function extractSkillsFromResume(text: string): Promise<string[]> {
  try {
    // If OpenAI API key is not available, use fallback extraction
    if (!process.env.OPENAI_API_KEY) {
      return fallbackSkillsExtraction(text);
    }
    
    const prompt = `
      Extract ALL technical and soft skills from the following resume. 
      Return ONLY a JSON array of strings with the skills, nothing else.
      Include programming languages, frameworks, tools, and soft skills.
      Keep each skill short (1-3 words maximum) and lowercase.
      
      Resume text:
      ${text.slice(0, 7000)} // Limit to 7000 chars to avoid token limits
    `;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini", // Use the cost-effective model
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      temperature: 0.1,
    });

    const content = response.choices[0].message.content;
    
    if (!content) {
      return fallbackSkillsExtraction(text);
    }
    
    try {
      const result = JSON.parse(content);
      return result.skills || [];
    } catch (error) {
      console.error("Failed to parse skills JSON:", error);
      return fallbackSkillsExtraction(text);
    }
  } catch (error) {
    console.error("Error extracting skills with OpenAI:", error);
    return fallbackSkillsExtraction(text);
  }
}

/**
 * Extract work history from resume text using OpenAI
 * 
 * @param text The resume text to analyze
 * @returns An array of work experiences
 */
export async function extractWorkHistory(text: string): Promise<Array<{
  title: string;
  company: string;
  period: string;
  description: string;
}>> {
  try {
    // If OpenAI API key is not available, use fallback extraction
    if (!process.env.OPENAI_API_KEY) {
      return fallbackWorkExtraction(text);
    }
    
    const prompt = `
      Extract ALL work experiences from the following resume.
      Return a JSON object with an array of "workHistory" items with the following properties for each:
      - title: the job title
      - company: the company name
      - period: the time period (e.g., "2020 - 2023")
      - description: a brief description of the role and responsibilities
      
      If any information is missing, use "Unknown" as the value.
      If you can't find any work history, return an empty array.
      
      Resume text:
      ${text.slice(0, 7000)}
    `;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini", // Use the cost-effective model
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      temperature: 0.1,
    });

    const content = response.choices[0].message.content;
    
    if (!content) {
      return fallbackWorkExtraction(text);
    }
    
    try {
      const result = JSON.parse(content);
      return result.workHistory || [];
    } catch (error) {
      console.error("Failed to parse work history JSON:", error);
      return fallbackWorkExtraction(text);
    }
  } catch (error) {
    console.error("Error extracting work history with OpenAI:", error);
    return fallbackWorkExtraction(text);
  }
}

/**
 * Basic skills extraction fallback when OpenAI is not available
 */
function fallbackSkillsExtraction(text: string): string[] {
  const commonSkills = [
    "javascript", "typescript", "python", "java", "c++", "c#", "ruby", "php", "swift",
    "react", "angular", "vue", "node.js", "express", "django", "rails", "flutter",
    "sql", "mongodb", "postgresql", "mysql", "firebase", "aws", "azure", "gcp",
    "docker", "kubernetes", "git", "ci/cd", "agile", "scrum", "jira",
    "leadership", "communication", "teamwork", "problem solving", "time management",
    "critical thinking", "adaptability", "project management", "attention to detail"
  ];
  
  const foundSkills = commonSkills.filter(skill => 
    text.toLowerCase().includes(skill.toLowerCase())
  );
  
  return foundSkills.length > 0 ? foundSkills : ["javascript", "html", "css", "communication", "teamwork"];
}

/**
 * Basic work history extraction fallback when OpenAI is not available
 */
function fallbackWorkExtraction(text: string): Array<{
  title: string;
  company: string;
  period: string;
  description: string;
}> {
  // This is very basic and will be improved in the future
  const lines = text.split('\n');
  let foundCompanies = [];
  
  for (const line of lines) {
    // Look for lines that might contain job titles and company names
    if (/software|developer|engineer|manager|consultant|analyst|designer/i.test(line) && 
        /inc\.?|llc|corp|ltd|company|technologies|systems|solutions/i.test(line)) {
      
      const words = line.split(/\s+/);
      if (words.length >= 4) {
        // Very crude heuristic to guess a company name
        const possibleCompany = words.slice(Math.max(0, words.length - 3)).join(' ');
        
        foundCompanies.push({
          title: "Software Developer", // Default title
          company: possibleCompany,
          period: "Not specified",
          description: "Role details not available without AI processing"
        });
      }
    }
  }
  
  return foundCompanies.length > 0 ? foundCompanies.slice(0, 3) : [{
    title: "Work Experience",
    company: "Details not available",
    period: "Not specified",
    description: "Resume work history requires AI processing for accurate extraction"
  }];
}