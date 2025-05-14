import React from 'react';
import { Button } from '@/components/ui/button';
import { parseRawResponse } from '@/lib/raw-response-parser';

// Sample data from the user's provided example
const SAMPLE_DATA = `{
  "matching_score": 15,
  "Summary": "The candidate Olivia DeSpirito has minimal alignment with the Head of Growth position requirements. The job requires 7+ years of experience in growth marketing with at least 3 years in leadership, expertise in digital advertising, SEO, content marketing, and CRO, along with strong analytical skills. The candidate's experience is primarily in sales associate roles, nanny positions, and customer service, with no demonstrated growth marketing, digital marketing, or lead generation experience.",
  "Work_History": [
    {
      "Title": "Sales Associate",
      "Company": "HOTWORX",
      "location": "Grand Junction, Colorado",
      "startDate": "November 2024",
      "endDate": "Present",
      "description": "Provided exceptional customer service, guiding potential members through fitness programs and membership options. Consistently met and exceeded monthly sales targets through effective prospecting and consultative selling. Conducted engaging studio tours and product demonstrations to educate clients on HOTWORX's infrared workout benefits. Built strong relationships with members, fostering retention and referrals to increase studio growth. Assisted in local marketing initiatives, including community events and social media promotions. Utilized CRM software to track leads, follow-ups, and membership conversions.",
      "durationMonths": 0,
      "isCurrentRole": true
    },
    {
      "Title": "Nanny for Private Political Family",
      "Company": "Private family",
      "location": "Colorado",
      "startDate": "February 2022",
      "endDate": "October 2024",
      "description": "Provided attentive care and supervision for children, ensuring a safe and nurturing environment. Organized household schedules, appointments, and travel arrangements for family members. Managed household errands, including grocery shopping, dry cleaning, and bill payments. Maintained open communication with parents regarding children's progress and needs. Planned and facilitated educational and recreational activities to support child development. Assisted with daily routines, including meal preparation, homework help, and bedtime schedules.",
      "durationMonths": 32,
      "isCurrentRole": false
    },
    {
      "Title": "Coach",
      "Company": "Coach",
      "location": "Colorado",
      "startDate": "December 2021",
      "endDate": "January 2022",
      "description": "Instructed and mentored gymnasts of various skill levels, from beginners to competitive athletes, in proper techniques, form, and safety protocols. Designed and implemented personalized training programs to enhance strength, flexibility, and overall performance. Motivated and encouraged gymnasts to build confidence, discipline, and teamwork through consistent coaching and support. Conducted skill assessments and provided detailed feedback to help athletes set and achieve goals. Maintained a safe training environment by enforcing gym rules and properly using equipment.",
      "durationMonths": 2,
      "isCurrentRole": false
    },
    {
      "Title": "Selling Memberships",
      "Company": "Kids Club",
      "location": "Colorado",
      "startDate": "May 2021",
      "endDate": "November 2021",
      "description": "Promoted and sold daycare memberships by effectively communicating program benefits, services, and value to prospective families. Conducted tours of the facility, highlighting safety features, learning programs, and amenities to build trust and generate interest. Developed and maintained strong relationships with parents, addressing inquiries and providing detailed information on membership options. Utilized persuasive sales techniques to meet and exceed enrollment goals.",
      "durationMonths": 7,
      "isCurrentRole": false
    },
    {
      "Title": "Nanny",
      "Company": "Private Family",
      "location": "Connecticut",
      "startDate": "September 2019",
      "endDate": "April 2021",
      "description": "Provided emotional support and positive discipline strategies to encourage good behavior. Created a structured daily routine tailored to children's developmental needs. Managed children's schedules, including school drop-offs/pick-ups, medical appointments, and extracurricular activities. In charge of daily routine and caring for the infant.",
      "durationMonths": 20,
      "isCurrentRole": false
    },
    {
      "Title": "Cashier",
      "Company": "Caraluzzies",
      "location": "",
      "startDate": "August 2018",
      "endDate": "August 2019",
      "description": "Resolved customer inquiries and concerns with professionalism, ensuring a positive shopping experience. Applied discounts, coupons, and loyalty rewards accurately, following company policies. Assisted with bagging and packaging items carefully to prevent damage. Cross-sold and upsold products, promoting special offers and boosting sales. Provided prompt, friendly, and efficient customer service while processing transactions accurately. Handled cash, credit, and electronic payments, ensuring correct change and balancing the register at the end of each shift.",
      "durationMonths": 12,
      "isCurrentRole": false
    }
  ],
  "Skills": [
    "Effectively able to Communicate",
    "B2B & B2C Sales",
    "Prospecting & Lead Generation",
    "Cold Calling & Territory Management",
    "Healthcare & Medical Terminology",
    "Anatomy & Physiology Understanding",
    "Strong Presentation & Public Speaking Skills",
    "Client Education & Training",
    "Confident & Competitive",
    "Adaptability and Problem Solving",
    "Networking and Relationship-Building",
    "Strategic Thinking"
  ],
  "Red_Flags": [
    "Future start date - The resume lists November 2024 as the start date for the current role, which is in the future",
    "Lack of marketing experience - The job requires extensive growth marketing experience, but the candidate has primarily worked in sales, childcare, and service roles",
    "Insufficient leadership experience - The job requires 3+ years in a leadership role, which is not demonstrated in the resume",
    "Incomplete education - The candidate is still pursuing their Business degree according to the resume",
    "No demonstrated expertise in required areas - The job requires expertise in digital advertising, SEO, content marketing, and CRO, which are not mentioned in the resume",
    "Short-term employment - Multiple positions with durations of only 1-2 months indicate potential job stability issues",
    "Lack of relevant industry experience - No experience in marketing agencies or similar environments",
    "No evidence of data analytics skills - The position requires strong analytical capabilities not shown in the resume"
  ]
}`;

export function TestParserBtn() {
  const runTest = () => {
    console.log("=== RUNNING DIRECT PARSER TEST ===");
    try {
      // Test with the sample data
      const result = parseRawResponse(SAMPLE_DATA);
      
      console.log("PARSER TEST RESULT:", {
        workHistoryCount: result.workHistory.length,
        skillsCount: result.skills.length,
        redFlagsCount: result.redFlags.length,
        workHistory: result.workHistory,
        skills: result.skills,
        redFlags: result.redFlags
      });
      
      // Verify if it found the data correctly
      if (result.workHistory.length > 0 && result.skills.length > 0 && result.redFlags.length > 0) {
        console.log("✅ PARSER TEST SUCCESSFUL - All data found correctly!");
      } else {
        console.log("❌ PARSER TEST FAILED - Missing data:");
        if (result.workHistory.length === 0) console.log("- Work history missing");
        if (result.skills.length === 0) console.log("- Skills missing");
        if (result.redFlags.length === 0) console.log("- Red flags missing");
      }
    } catch (e) {
      console.error("PARSER TEST ERROR:", e);
    }
  };
  
  return (
    <Button 
      variant="outline"
      size="sm"
      className="ml-2"
      onClick={runTest}
    >
      Test Parser
    </Button>
  );
}