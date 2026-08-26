import { createBrowserRouter, Navigate } from 'react-router-dom';
import ProtectedRoute from '../auth/ProtectedRoute';
import AppLayout from '../layouts/AppLayout';
import LoginPage from '../pages/Login/LoginPage';
import DashboardPage from '../pages/Dashboard/DashboardPage';
import ProcessListPage from '../pages/Processes/ProcessListPage';
import ProcessDetailPage from '../pages/Processes/ProcessDetailPage';
import ProcessVersionDetailPage from '../pages/Processes/ProcessVersionDetailPage';
import NotFoundPage from '../pages/NotFound/NotFoundPage';
import UserRoleSettingsPage from '../pages/Settings/UserRoleSettingsPage';

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { path: '/', element: <DashboardPage /> },
          { path: '/processes', element: <ProcessListPage /> },
          { path: '/processes/:id', element: <ProcessDetailPage /> },
          { path: '/process-versions/:id', element: <ProcessVersionDetailPage /> },
          { path: '/my-documents', element: <Navigate to="/processes" replace /> },
          { path: '/settings/users', element: <UserRoleSettingsPage /> }
        ]
      }
    ]
  },
  { path: '*', element: <NotFoundPage /> }
]);
