export type UserRole = 'guest' | 'user' | 'paid' | 'admin';

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}
