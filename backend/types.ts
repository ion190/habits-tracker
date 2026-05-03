// Types matching frontend Dexie schemas - used for API validation/response

export interface HabitQuota {
  type: 'quantity' | 'time';
  target: number;
  unit: string;
}

export interface Habit {
  id: string;
  name: string;
  color: string;
  icon: string;
  frequency: 'daily' | 'weekly' | 'custom';
  targetDays: number[];
  tags: string[];
  quota?: HabitQuota;
  createdAt: string;
  archivedAt?: string;
}

export interface HabitLog {
  id: string;
  habitId: string;
  completedAt: string;
  note?: string;
  value?: number;
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  dueDate?: string;
  notificationTime?: string;
  completedAt?: string;
  createdAt: string;
  tags: string[];
  urgency: 'low' | 'medium' | 'high';
  importance: 'low' | 'medium' | 'high';
  archivedAt?: string;
}

export interface JWTPayload {
  sub: string;  // user ID
  email: string;
  role: 'USER' | 'ADMIN';
  exp: number;
  iat: number;
}

// Pagination metadata
export interface PaginationMeta {
  total: number;
  limit: number;
  offset: number;
}

