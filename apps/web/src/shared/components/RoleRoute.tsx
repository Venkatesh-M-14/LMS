import { Navigate, Outlet } from 'react-router';
import type { Role } from '@academy/shared';
import { useAppSelector } from '../../app/hooks';

/**
 * Client-side role gate for route groups (the API enforces the real rule).
 * Admins pass every gate, mirroring the server's requireRole semantics.
 */
export function RoleRoute({ roles }: { roles: Role[] }) {
  const user = useAppSelector((state) => state.auth.user);

  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== 'ADMIN' && !roles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }
  return <Outlet />;
}
