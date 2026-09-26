// src/App.tsx
import React,{ lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation, useParams } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { AppLayout } from './components/layout/AppLayout';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { LectureBoardPage } from './pages/LectureBoardPage';

// Admin Components & Pages
import { AdminRoute } from './components/admin/AdminRoute';

// Pages load on demand so the first visit only downloads the logbook and the login screen.
const NewLecturePage = lazy(() => import('./pages/NewLecturePage').then((m) => ({ default: m.NewLecturePage })));
const LecturePage = lazy(() => import('./pages/LecturePage').then((m) => ({ default: m.LecturePage })));
const AdminLayout = lazy(() => import('./components/admin/AdminLayout').then((m) => ({ default: m.AdminLayout })));
const AdminOverviewPage = lazy(() => import('./pages/admin/AdminOverviewPage').then((m) => ({ default: m.AdminOverviewPage })));
const AdminContentQualityPage = lazy(() => import('./pages/admin/AdminContentQualityPage').then((m) => ({ default: m.AdminContentQualityPage })));
const AdminLessonsPage = lazy(() => import('./pages/admin/AdminLessonsPage').then((m) => ({ default: m.AdminLessonsPage })));
const AdminUsersPage = lazy(() => import('./pages/admin/AdminUsersPage').then((m) => ({ default: m.AdminUsersPage })));
const AdminAILlmPage = lazy(() => import('./pages/admin/AdminAILlmPage').then((m) => ({ default: m.AdminAILlmPage })));
const AdminLangfusePage = lazy(() => import('./pages/admin/AdminLangfusePage').then((m) => ({ default: m.AdminLangfusePage })));
const AdminEvaluationPage = lazy(() => import('./pages/admin/AdminEvaluationPage').then((m) => ({ default: m.AdminEvaluationPage })));
const AdminPromptPage = lazy(() => import('./pages/admin/AdminPromptPage').then((m) => ({ default: m.AdminPromptPage })));
const AdminErrorCenterPage = lazy(() => import('./pages/admin/AdminErrorCenterPage').then((m) => ({ default: m.AdminErrorCenterPage })));
const AdminTTSPage = lazy(() => import('./pages/admin/AdminTTSPage').then((m) => ({ default: m.AdminTTSPage })));
const AdminSettingsPage = lazy(() => import('./pages/admin/AdminSettingsPage').then((m) => ({ default: m.AdminSettingsPage })));
const KnowledgeInspectorPage = lazy(() => import('./pages/KnowledgeInspectorPage').then((m) => ({ default: m.KnowledgeInspectorPage })));

const PageFallback: React.FC = () => (
  <div className="flex min-h-[40vh] items-center justify-center text-sm text-ink-soft">Đang mở trang…</div>
);

/** /projects/:id(/:stage)?query -> /lectures/:id?query (same project id). */
const LegacyProjectRedirect: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { search } = useLocation();
  return <Navigate to={`/lectures/${id}${search}`} replace />;
};

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-paper text-sm text-ink-soft">
        Đang kiểm tra phiên đăng nhập...
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return (
    <AppLayout>
      <Suspense fallback={<PageFallback />}>{children}</Suspense>
    </AppLayout>
  );
};

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Suspense fallback={<PageFallback />}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          
          {/* Knowledge Inspector: weighted tree + visual regions of the user's own projects */}
          <Route
            path="/knowledge"
            element={
              <ProtectedRoute>
                <KnowledgeInspectorPage />
              </ProtectedRoute>
            }
          />
          <Route path="/inspector" element={<Navigate to="/knowledge" replace />} />
          <Route
            path="/projects/:id/knowledge"
            element={
              <ProtectedRoute>
                <KnowledgeInspectorPage />
              </ProtectedRoute>
            }
          />
          
          {/* Lecturer flow: board -> new lecture -> lecture (review, generate, read) */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <LectureBoardPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/lectures/new"
            element={
              <ProtectedRoute>
                <NewLecturePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/lectures/:id"
            element={
              <ProtectedRoute>
                <LecturePage />
              </ProtectedRoute>
            }
          />

          {/* Links saved from the retired studio UI */}
          <Route path="/advanced" element={<Navigate to="/knowledge" replace />} />
          <Route path="/dashboard" element={<Navigate to="/" replace />} />
          <Route path="/projects/new" element={<Navigate to="/lectures/new" replace />} />
          <Route path="/projects/:id" element={<LegacyProjectRedirect />} />
          <Route path="/projects/:id/:stage" element={<LegacyProjectRedirect />} />

          {/* ========================================================= */}
          {/* ADMIN DASHBOARD - RBAC PROTECTED                          */}
          {/* ========================================================= */}
          <Route
            path="/admin"
            element={
              <AdminRoute>
                <AdminLayout />
              </AdminRoute>
            }
          >
            <Route index element={<AdminOverviewPage />} />
            <Route path="overview" element={<AdminOverviewPage />} />
            <Route path="quality" element={<AdminContentQualityPage />} />
            <Route path="lessons" element={<AdminLessonsPage />} />
            <Route path="users" element={<AdminUsersPage />} />
            <Route path="ai-analytics" element={<AdminAILlmPage />} />
            <Route path="langfuse" element={<AdminLangfusePage />} />
            <Route path="evaluation" element={<AdminEvaluationPage />} />
            <Route path="prompts" element={<AdminPromptPage />} />
            <Route path="errors" element={<AdminErrorCenterPage />} />
            <Route path="tts" element={<AdminTTSPage />} />
            <Route path="settings" element={<AdminSettingsPage />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        </Suspense>
      </BrowserRouter>
    </AuthProvider>
  );
};

