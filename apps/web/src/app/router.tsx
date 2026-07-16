import { createBrowserRouter, Outlet } from 'react-router';
import { AppLayout } from '../shared/components/AppLayout';
import { ProtectedRoute } from '../shared/components/ProtectedRoute';
import { GuestOnlyRoute } from '../shared/components/GuestOnlyRoute';
import { SessionBootstrap } from '../features/auth/SessionBootstrap';
import { LoginPage } from '../features/auth/pages/LoginPage';
import { RegisterPage } from '../features/auth/pages/RegisterPage';
import { DashboardPage } from '../features/dashboard/DashboardPage';
import { NotFoundPage } from '../shared/components/NotFoundPage';

function Root() {
  return (
    <SessionBootstrap>
      <Outlet />
    </SessionBootstrap>
  );
}

export const router = createBrowserRouter([
  {
    element: <Root />,
    children: [
      {
        element: <GuestOnlyRoute />,
        children: [
          { path: '/login', element: <LoginPage /> },
          { path: '/register', element: <RegisterPage /> },
        ],
      },
      {
        element: <ProtectedRoute />,
        children: [
          {
            element: <AppLayout />,
            children: [{ path: '/', element: <DashboardPage /> }],
          },
        ],
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);
