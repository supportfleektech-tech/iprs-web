import 'reflect-metadata';

declare global {
  namespace Express {
    interface Request {
      user?: {
        sub: string | null;
        email: string | null;
        organizationId: string | null;
        role: string;
        isPlatformAdmin: boolean;
      };
      apiKey?: {
        id: string;
        organizationId: string;
        environment: 'live' | 'test';
      };
    }
  }
}

export {};
