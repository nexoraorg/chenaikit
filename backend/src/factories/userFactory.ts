import { randomBytes, randomUUID } from 'crypto';

const randomInt = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;
const randomItem = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

export interface UserFactoryOptions {
  count?: number;
  email?: string;
  password?: string;
  role?: 'user' | 'admin';
}

export function createUserFactory(options: UserFactoryOptions = {}) {
  const { count = 1, email, password, role } = options;

  const users: any[] = [];
  
  for (let i = 0; i < count; i++) {
    const user: any = {
      id: randomUUID(),
      email: email || `user${randomUUID().slice(0, 8)}@example.com`,
      password: password || randomBytes(16).toString('base64url'),
      role: role || randomItem(['user', 'admin', 'user', 'user']),
      createdAt: new Date(Date.now() - randomInt(0, 30 * 24 * 60 * 60 * 1000)),
      updatedAt: new Date(),
    };
    
    users.push(user);
  }

  return users;
}

export function createUserCreateInput(overrides: any = {}): any {
  const password = overrides.password || randomBytes(16).toString('base64url');
  
  return {
    id: randomUUID(),
    email: overrides.email || `user${randomUUID().slice(0, 8)}@example.com`,
    password,
    role: overrides.role || 'user',
    ...overrides,
  };
}
