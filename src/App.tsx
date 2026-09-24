// src/App.tsx
import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { AppLayout } from './components/layout/AppLayout';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { DashboardPage } from './pages/DashboardPage';
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
      <div className="min-h-screen flex items-center justify-center bg-slate-50 text-xs text-slate-500">
        Authenticating session...
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
          
          {/* Dedicated Knowledge / Database Inspector (Public Access for Evaluators & Debugging) */}
          <Route path="/knowledge" element={<KnowledgeInspectorPage />} />
          <Route path="/inspector" element={<KnowledgeInspectorPage />} />
          
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <DashboardPage />
              </ProtectedRoute>
            }
          />
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

          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
};

export default App;
