import type { Role } from './domain/permissions.js';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      requestId: string;
      anon?: { reporterId: string };
      staff?: {
        userId: string;
        sessionId: string;
        role: Exclude<Role, 'citizen'>;
        name: string;
        officialId: string;
        email: string;
      };
    }
  }
}

export {};
