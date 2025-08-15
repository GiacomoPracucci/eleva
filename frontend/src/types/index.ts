// User related types
export interface User {
  id: number;
  email: string;
  username: string;
  full_name?: string;
  academic_level?: string;
  bio?: string;
  profile_picture_url?: string;
  show_profile_publicly: boolean;
  allow_ai_training: boolean;
  is_active: boolean;
  is_verified: boolean;
  created_at: string;
  updated_at: string;
}

export interface UserCreate {
  email: string;
  username: string;
  password: string;
  full_name?: string;
  academic_level?: string;
  bio?: string;
  show_profile_publicly?: boolean;
  allow_ai_training?: boolean;
}

export interface UserUpdate {
  full_name?: string;
  academic_level?: string;
  bio?: string;
  show_profile_publicly?: boolean;
  allow_ai_training?: boolean;
}

// Auth related types
export interface LoginCredentials {
  username: string; // Can be email or username
  password: string;
}

export interface Token {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export interface PasswordResetRequest {
  email: string;
}

// Subject related types
export interface Subject {
  id: number;
  name: string;
  description?: string;
  academic_year?: string;
  level?: string;
  category?: string;
  color?: string;
  icon?: string;
  is_active: boolean;
  is_archived: boolean;
  owner_id: number;
  created_at: string;
  updated_at: string;
}

export interface SubjectCreate {
  name: string;
  description?: string;
  academic_year?: string;
  level?: string;
  category?: string;
  color?: string;
  icon?: string;
}

export interface SubjectUpdate {
  name?: string;
  description?: string;
  academic_year?: string;
  level?: string;
  category?: string;
  color?: string;
  icon?: string;
  is_active?: boolean;
  is_archived?: boolean;
}

// API Response types
export interface ApiError {
  detail: string;
  status?: number;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  size: number;
}

// Form types
export interface FieldError {
  message: string;
  type: string;
}