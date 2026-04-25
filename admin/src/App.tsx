import { Navigate, Route, Routes } from 'react-router-dom';
import AdminDashboard from '@/pages/admin/AdminDashboard';
import AdminGenerations from '@/pages/admin/AdminGenerations';
import AdminLayout from '@/pages/admin/AdminLayout';
import AdminLogin from '@/pages/admin/AdminLogin';
import AdminModels from '@/pages/admin/AdminModels';
import AdminSettings from '@/pages/admin/AdminSettings';
import AdminUsers from '@/pages/admin/AdminUsers';
import { useAdminApp } from '@/hooks/useAdminApp';

export default function App() {
  const admin = useAdminApp();

  if (admin.loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-white flex items-center justify-center font-mono-data">
        Loading admin...
      </div>
    );
  }

  return (
    <Routes>
      <Route
        path="/login"
        element={<AdminLogin onLogin={admin.adminLogin} />}
      />
      <Route
        path="/"
        element={
          admin.isAdminLoggedIn ? (
            <AdminLayout onLogout={admin.adminLogout} />
          ) : (
            <Navigate to="/login" replace />
          )
        }
      >
        <Route
          index
          element={
            <AdminDashboard
              userCount={admin.users.length}
              generationCount={admin.history.length}
              history={admin.history}
            />
          }
        />
        <Route
          path="users"
          element={
            <AdminUsers
              users={admin.users}
              onToggleStatus={admin.toggleUserStatus}
              onUpdateUserSettings={admin.updateUserSettings}
              onDeleteUser={admin.deleteUser}
              currentAdminId={admin.me?.id}
            />
          }
        />
        <Route
          path="models"
          element={<AdminModels models={admin.models} onUpdateModels={admin.updateModels} />}
        />
        <Route
          path="settings"
          element={<AdminSettings settings={admin.settings} onUpdateSettings={admin.updateSettings} />}
        />
        <Route
          path="generations"
          element={
            <AdminGenerations
              history={admin.history}
              users={admin.users}
              onDelete={admin.deleteGeneration}
            />
          }
        />
      </Route>
      <Route path="*" element={<Navigate to={admin.isAdminLoggedIn ? '/' : '/login'} replace />} />
    </Routes>
  );
}
