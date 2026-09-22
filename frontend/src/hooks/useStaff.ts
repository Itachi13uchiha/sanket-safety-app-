import { staffStore } from '../state/app';
import type { Permission } from '../api/types';

export function useStaff() {
  const session = staffStore.use();
  return {
    session,
    user: session?.user ?? null,
    can: (p: Permission) => !!session?.permissions.includes(p),
  };
}
