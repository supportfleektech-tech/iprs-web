import 'reflect-metadata';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
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
