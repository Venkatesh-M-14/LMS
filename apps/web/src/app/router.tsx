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
import { AssessmentEditorPage } from '../features/cms/AssessmentEditorPage';
import { GradingQueuePage } from '../features/cms/GradingQueuePage';
import { AttemptPage } from '../features/quiz/AttemptPage';
import { ProjectPage } from '../features/projects/ProjectPage';
import { ProjectQueuePage } from '../features/projects/ProjectQueuePage';
import { ProjectReviewPage } from '../features/projects/ProjectReviewPage';
import { LeaderboardPage } from '../features/gamification/LeaderboardPage';
import { AchievementsPage } from '../features/gamification/AchievementsPage';
import { CertificatesPage } from '../features/gamification/CertificatesPage';
import { MentorPage } from '../features/mentor/MentorPage';
import { VerifyCertificatePage } from '../features/gamification/VerifyCertificatePage';
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
      // Public: shareable certificate verification, no session required.
      { path: '/verify/:code', element: <VerifyCertificatePage /> },
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
              { path: '/attempts/:attemptId', element: <AttemptPage /> },
              { path: '/projects/topic/:topicId', element: <ProjectPage /> },
              { path: '/mentor', element: <MentorPage /> },
              { path: '/leaderboard', element: <LeaderboardPage /> },
              { path: '/achievements', element: <AchievementsPage /> },
              { path: '/certificates', element: <CertificatesPage /> },
              {
                element: <RoleRoute roles={['INSTRUCTOR']} />,
                children: [
                  { path: '/instructor', element: <InstructorLessonsPage /> },
                  { path: '/instructor/lessons/:lessonId', element: <LessonEditorPage /> },
                  {
                    path: '/instructor/lessons/:lessonId/assessment',
                    element: <AssessmentEditorPage />,
                  },
                  { path: '/instructor/grading', element: <GradingQueuePage /> },
                  { path: '/instructor/projects', element: <ProjectQueuePage /> },
                  { path: '/instructor/projects/:submissionId', element: <ProjectReviewPage /> },
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
