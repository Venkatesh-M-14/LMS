import { Navigate, Outlet, useLocation } from 'react-router';
import { useAppSelector } from '../../app/hooks';

/** Gate for authenticated-only routes; preserves the intended destination. */
export function ProtectedRoute() {
  const status = useAppSelector((state) => state.auth.status);
  const location = useLocation();

  if (status !== 'authenticated') {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  return <Outlet />;
}
