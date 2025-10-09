export interface UserPayload {
  id: string;
  email: string;
  role: 'user' | 'admin';
}
