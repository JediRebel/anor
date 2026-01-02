export type UserRole = 'guest' | 'user' | 'paid' | 'admin';

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// --- 新增：工具相关类型 ---
export type ToolType = 'ee-score' | 'path-selector';

export interface ToolRecord {
  id: number;
  userId: number;
  toolType: ToolType;
  inputPayload: any;
  resultPayload: any;
  createdAt: Date | string;
  updatedAt: Date | string;
}
