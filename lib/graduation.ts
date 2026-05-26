export const PROGRAM_DURATION: Record<string, number> = {
  "BSc Computer Science": 4,
  "BSc Nursing": 4,
  "BBA": 4,
  "Diploma": 2,
  "MBA": 2,
};

export function calculateGraduationYear(student: any): number {
  if (student.graduationYear) return student.graduationYear;

  const duration = PROGRAM_DURATION[student.program] || 4;
  const currentYear = new Date().getFullYear();

  if (student.level && student.entryYear) {
    const remainingYears = duration - (student.level / 100);
    return currentYear + remainingYears;
  }

  if (student.entryYear) {
    return student.entryYear + duration;
  }

  return currentYear + 2;
}

export function getNearestJune30(currentDate: Date = new Date()): Date {
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth(); // 0-indexed: 0 = Jan, 5 = Jun, 11 = Dec
  
  if (currentMonth <= 5) {
    return new Date(currentYear, 5, 30, 23, 59, 59, 999);
  } else {
    return new Date(currentYear + 1, 5, 30, 23, 59, 59, 999);
  }
}

export function calculateIDExpiry(student: any, currentDate: Date = new Date()): Date {
  const programLower = (student.program || '').toLowerCase();
  const isPass = programLower.includes('temporary') || 
                 programLower.includes('annual') || 
                 programLower.includes('single-session') || 
                 programLower.includes('pass');

  if (isPass) {
    return getNearestJune30(currentDate);
  }

  const graduationYear = calculateGraduationYear(student);
  const expiryDate = new Date(graduationYear, 5, 30, 23, 59, 59, 999);

  // If the calculated expiry is in the past, fall back to the nearest upcoming June 30th of the current academic cycle
  if (expiryDate.getTime() < currentDate.getTime()) {
    return getNearestJune30(currentDate);
  }

  return expiryDate;
}
