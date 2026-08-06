export interface UserProfileUpdatePayload {
  displayName?: string;
  avatar?: string;
  locale?: 'vi' | 'en';
  timezone?: string;
}

export interface SafeUserProfile {
  id: string;
  email: string;
  displayName: string | null;
  avatar: string | null;
  role: string;
  locale: string;
  timezone: string;
  createdAt: Date;
  updatedAt: Date;
}
