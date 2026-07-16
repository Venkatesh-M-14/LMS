import { Navigate, Outlet } from 'react-router';
import { useAppSelector } from '../../app/hooks';

/** Login/register are pointless for a logged-in user — bounce to the app. */
export function GuestOnlyRoute() {
  const status = useAppSelector((state) => state.auth.status);

  if (status === 'authenticated') {
    return <Navigate to="/" replace />;
  }
  return <Outlet />;
}
