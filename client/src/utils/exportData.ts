/**
 * Utility functions for exporting data in different formats
 */

/**
 * Convert an object to a CSV string
 * 
 * @param data Object to convert to CSV
 * @returns CSV string
 */
export function objectToCSV(data: any): string {
  if (!data) return '';
  
  // Handle simple skills array
  if (data.skills && Array.isArray(data.skills)) {
    const skillsCSV = 'Skill\n' + data.skills.map((skill: string) => `"${skill}"`).join('\n');
    return skillsCSV;
  }
  
  // Handle work history array
  if (data.workHistory && Array.isArray(data.workHistory)) {
    const headers = ['Title', 'Company', 'StartDate', 'EndDate', 'Description', 'Duration (Months)'];
    const rows = data.workHistory.map((job: any) => [
      `"${job.title || ''}"`,
      `"${job.company || ''}"`,
      `"${job.startDate || ''}"`,
      `"${job.endDate || ''}"`,
      `"${job.description || ''}"`,
      job.durationMonths || ''
    ]);
    
    return [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');
  }
  
  // Handle red flags array
  if (data.redFlags && Array.isArray(data.redFlags)) {
    const redFlagsCSV = 'RedFlag\n' + data.redFlags.map((flag: string) => `"${flag}"`).join('\n');
    return redFlagsCSV;
  }
  
  // Fallback for complex objects - turn into JSON
  return JSON.stringify(data, null, 2);
}

/**
 * Export data as CSV file
 * 
 * @param data Data to export
 * @param fileName File name without extension
 */
export function exportAsCSV(data: any, fileName: string = 'export'): void {
  const csv = objectToCSV(data);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `${fileName}.csv`);
  link.style.visibility = 'hidden';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Export data as JSON file
 * 
 * @param data Data to export
 * @param fileName File name without extension
 */
export function exportAsJSON(data: any, fileName: string = 'export'): void {
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `${fileName}.json`);
  link.style.visibility = 'hidden';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}