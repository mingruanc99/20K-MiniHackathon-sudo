// src/App.tsx
import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { AppLayout } from './components/layout/AppLayout';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { LectureBoardPage } from './pages/LectureBoardPage';
import { NewLecturePage } from './pages/NewLecturePage';
import { LecturePage } from './pages/LecturePage';
import { AdvancedPage } from './pages/AdvancedPage';
import { NewProjectPage } from './pages/NewProjectPage';
import { ProjectDetailPage } from './pages/ProjectDetailPage';

// Admin Components & Pages
import { AdminRoute } from './components/admin/AdminRoute';
import { AdminLayout } from './components/admin/AdminLayout';
import { AdminOverviewPage } from './pages/admin/AdminOverviewPage';
import { AdminContentQualityPage } from './pages/admin/AdminContentQualityPage';
import { AdminLessonsPage } from './pages/admin/AdminLessonsPage';
import { AdminUsersPage } from './pages/admin/AdminUsersPage';
import { AdminAILlmPage } from './pages/admin/AdminAILlmPage';
import { AdminLangfusePage } from './pages/admin/AdminLangfusePage';
import { AdminEvaluationPage } from './pages/admin/AdminEvaluationPage';
import { AdminPromptPage } from './pages/admin/AdminPromptPage';
import { AdminErrorCenterPage } from './pages/admin/AdminErrorCenterPage';
import { AdminTTSPage } from './pages/admin/AdminTTSPage';
import { AdminSettingsPage } from './pages/admin/AdminSettingsPage';
import { KnowledgeInspectorPage } from './pages/KnowledgeInspectorPage';

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 text-sm text-slate-500">
        Đang kiểm tra phiên đăng nhập...
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <AppLayout>{children}</AppLayout>;
};

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <BrowserRouter>
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

          {/* Advanced: the full studio and detailed tools */}
          <Route
            path="/advanced"
            element={
              <ProtectedRoute>
                <AdvancedPage />
              </ProtectedRoute>
            }
          />
          <Route path="/dashboard" element={<Navigate to="/" replace />} />
          <Route
            path="/projects/new"
            element={
              <ProtectedRoute>
                <NewProjectPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/projects/:id"
            element={
              <ProtectedRoute>
                <ProjectDetailPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/projects/:id/:stage"
            element={
              <ProtectedRoute>
                <ProjectDetailPage />
              </ProtectedRoute>
            }
          />

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
      </BrowserRouter>
    </AuthProvider>
  );
};

export default App;
