export type ApiProtocol = 'openai' | 'midjourney' | 'stability' | 'custom';

export interface AdminUser {
  id: string;
  username: string;
  email: string;
  status: 'active' | 'banned' | 'pending';
  role: 'user' | 'admin';
  createdAt: string;
  generationCount: number;
  inviteCount: number;
}

export interface ModelConfig {
  id: string;
  name: string;
  provider: string;
  apiKey: string;
  apiEndpoint: string;
  enabled: boolean;
  maxTokens: number;
  temperature: number;
  defaultSize: string;
  protocol: ApiProtocol;
  hasApiKey?: boolean;
}

export interface GenerationRecord {
  id: string;
  pictureId: string | null;
  prompt: string;
  aspectRatio: '1:1' | '16:9' | '3:4' | '9:16';
  styleStrength: number;
  engine: string;
  imageUrl: string;
  createdAt: number;
  expiresAt: number | null;
  lifecycle: 'pending' | 'generating' | 'active' | 'expiring' | 'expired' | null;
  status: 'pending' | 'generating' | 'completed' | 'failed';
  isFavorite: boolean;
  userId?: string;
}

export interface AdminMe {
  id: string;
  email: string;
  isAdmin: boolean;
}

export interface AppSettings {
  publicWebUrl: string | null;
}
