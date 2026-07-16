import { createBrowserRouter, Outlet } from 'react-router';
import { AppLayout } from '../shared/components/AppLayout';
import { ProtectedRoute } from '../shared/components/ProtectedRoute';
import { GuestOnlyRoute } from '../shared/components/GuestOnlyRoute';
import { RoleRoute } from '../shared/components/RoleRoute';
import { SessionBootstrap } from '../features/auth/SessionBootstrap';
import { LoginPage } from '../features/auth/pages/LoginPage';
import { RegisterPage } from '../features/auth/pages/RegisterPage';
import { DashboardPage } from '../features/dashboard/DashboardPage';
import { CurriculumPage } from '../features/curriculum/CurriculumPage';
import { LessonPage } from '../features/curriculum/LessonPage';
import { InstructorLessonsPage } from '../features/cms/InstructorLessonsPage';
import { LessonEditorPage } from '../features/cms/LessonEditorPage';
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
            children: [
              { path: '/', element: <DashboardPage /> },
              { path: '/curriculum', element: <CurriculumPage /> },
              { path: '/lessons/:lessonId', element: <LessonPage /> },
              {
                element: <RoleRoute roles={['INSTRUCTOR']} />,
                children: [
                  { path: '/instructor', element: <InstructorLessonsPage /> },
                  { path: '/instructor/lessons/:lessonId', element: <LessonEditorPage /> },
                ],
              },
            ],
          },
        ],
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);
