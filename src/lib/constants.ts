export const COLLEGE_DEPARTMENTS = [
  'Administration',
  'College of Engineering',
  'College of Business Administration',
  'College of Education',
  'College of Arts and Sciences',
  'Library Services',
  'Student Affairs',
  'Athletics Department',
  'Faculty Affairs',
  'Visitor / Guest',
] as const;

export const VEHICLE_TYPES = [
  { value: 'private', label: 'Private', description: 'Personal vehicle' },
  { value: 'public', label: 'Public', description: 'Public transport / PUV' },
  { value: 'essu-owned', label: 'ESSU-Owned', description: 'University vehicle' },
] as const;

export const VEHICLE_COLORS = [
  'White', 'Black', 'Silver', 'Gray', 'Red', 'Blue', 'Green', 'Yellow', 'Brown', 'Orange',
];

export const VIOLATION_TYPES = [
  'Wrong Parking Area',
  'Over Time Limit',
  'No Parking Permit',
  'Blocking Driveway',
  'Double Parking',
  'Parking on Walkway',
  'Expired Registration',
];

export function getViolationLabel(count: number): string {
  if (count >= 4) return 'Warning';
  const suffix = count === 1 ? 'st' : count === 2 ? 'nd' : count === 3 ? 'rd' : 'th';
  return `${count}${suffix} Violation`;
}

export function getViolationSeverity(count: number): 'error' | 'warning' | 'info' {
  if (count >= 4) return 'warning';
  if (count >= 3) return 'error';
  if (count >= 2) return 'warning';
  return 'info';
}
