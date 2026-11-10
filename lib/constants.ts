export const MUNICIPAL_DEPARTMENTS = [
  'Roads & Pavement Department',
  'Sanitation & Waste Management',
  'Electrical & Streetlighting',
  'Drainage & Sewerage Board',
  'Water Supply Department',
  'Horticulture & Public Parks',
  'Traffic & Enforcement Division',
] as const;

export type MunicipalDepartment = (typeof MUNICIPAL_DEPARTMENTS)[number];

export const COMPLAINT_CATEGORIES = [
  'Road & Pavement',
  'Waste & Cleanliness',
  'Streetlights',
  'Drainage',
  'Water Leakage',
  'Other',
] as const;

export type ComplaintCategory = (typeof COMPLAINT_CATEGORIES)[number];

export const COMPLAINT_STATUSES = [
  'Pending',
  'In Progress',
  'Resolved',
] as const;

export type ComplaintStatus = (typeof COMPLAINT_STATUSES)[number];

export const PRIORITY_LEVELS = [
  'Urgent',
  'High',
  'Normal',
  'Low',
] as const;

export type PriorityLevel = (typeof PRIORITY_LEVELS)[number];
