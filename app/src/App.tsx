import { Routes, Route, Navigate } from 'react-router-dom';
import Navigation from './components/Navigation';
import AuthModal from './components/AuthModal';
import Home from './pages/Home';
import Gallery from './pages/Gallery';
import Invite from './pages/Invite';
import ConsoleLayout from './pages/console/ConsoleLayout';
import ConsoleAccount from './pages/console/ConsoleAccount';
import AdminLayout from './pages/admin/AdminLayout';
import AdminLogin from './pages/admin/AdminLogin';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminUsers from './pages/admin/AdminUsers';
import AdminModels from './pages/admin/AdminModels';
import AdminGenerations from './pages/admin/AdminGenerations';
import ConsoleGenerations from './pages/console/ConsoleGenerations';
import InitializationScreen from './components/InitializationScreen';
import { useAuth } from './hooks/useAuth';
import { useGeneration } from './hooks/useGeneration';
import { useAdmin } from './hooks/useAdmin';
import { useInitialization } from './hooks/useInitialization';

// Re-export for type usage
export type { GenerationRecord } from './hooks/useGeneration';

function AppRoutes() {
  const auth = useAuth();
  const admin = useAdmin();
  const gen = useGeneration(auth.user?.id, admin.models);

  return (
    <Routes>
      {/* Admin Routes */}
      <Route
        path="/admin"
        element={
          admin.isAdminLoggedIn ? (
            <AdminLayout onLogout={admin.adminLogout} />
          ) : (
            <Navigate to="/admin/login" replace />
          )
        }
      >
        <Route
          index
          element={
            <AdminDashboard
              userCount={admin.users.length}
              generationCount={gen.history.length}
              history={gen.history}
            />
          }
        />
        <Route
          path="users"
          element={
            <AdminUsers
              users={admin.users}
              onToggleStatus={admin.toggleUserStatus}
            />
          }
        />
        <Route
          path="models"
          element={
            <AdminModels
              models={admin.models}
              onUpdateModels={admin.updateModels}
            />
          }
        />
        <Route
          path="generations"
          element={
            <AdminGenerations
              history={gen.history}
              users={admin.users}
              onDelete={gen.deleteRecord}
            />
          }
        />
      </Route>
      <Route
        path="/admin/login"
        element={<AdminLogin onLogin={admin.adminLogin} />}
      />

      {/* Console Routes (user dashboard) */}
      <Route
        path="/console"
        element={
          auth.isLoggedIn ? (
            <ConsoleLayout />
          ) : (
            <Navigate to="/" replace />
          )
        }
      >
        <Route
          index
          element={
            <Gallery
              history={gen.favoriteRecords}
              onDelete={gen.deleteRecord}
              onToggleFavorite={gen.toggleFavorite}
              lifecycleTick={gen.lifecycleTick}
            />
          }
        />
        <Route
          path="generations"
          element={
            <ConsoleGenerations
              history={gen.history}
              onDelete={gen.deleteRecord}
              onToggleFavorite={gen.toggleFavorite}
              lifecycleTick={gen.lifecycleTick}
            />
          }
        />
        <Route
          path="invite"
          element={
            <Invite
              isLoggedIn={auth.isLoggedIn}
              inviteCode={auth.profile?.inviteCode || null}
              inviteCount={auth.profile?.inviteCount || 0}
              onRequireAuth={auth.openLogin}
            />
          }
        />
        <Route
          path="account"
          element={
            <ConsoleAccount
              username={auth.profile?.username || null}
              email={auth.user?.email || null}
              inviteCode={auth.profile?.inviteCode || null}
              inviteCount={auth.profile?.inviteCount || 0}
              onLogout={auth.logout}
            />
          }
        />
      </Route>

      {/* Frontend Routes */}
      <Route
        path="*"
        element={
          <div className="min-h-screen bg-black text-white">
            <Navigation
              username={auth.profile?.username || auth.user?.email?.split('@')[0] || null}
              isLoggedIn={auth.isLoggedIn}
              onLogin={auth.openLogin}
              onRegister={auth.openRegister}
              onLogout={auth.logout}
            />
            <Routes>
              <Route
                path="/"
                element={
                  <Home
                    isGenerating={gen.isGenerating}
                    isLoggedIn={auth.isLoggedIn}
                    history={gen.history}
                    models={admin.models}
                    lifecycleTick={gen.lifecycleTick}
                    onGenerate={gen.generate}
                    onRequireAuth={auth.openLogin}
                    onDeleteRecord={gen.deleteRecord}
                  />
                }
              />
            </Routes>
            <AuthModal
              visible={auth.showAuthModal}
              mode={auth.authMode}
              error={auth.error}
              confirmation={auth.confirmationMessage}
              onClose={auth.closeAuth}
              onLogin={auth.login}
              onRegister={auth.register}
              onSwitchMode={() => auth.setAuthMode(auth.authMode === 'login' ? 'register' : 'login')}
            />
          </div>
        }
      />
    </Routes>
  );
}

function App() {
  const initialization = useInitialization();

  if (initialization.status.kind !== 'ready') {
    return (
      <InitializationScreen
        status={initialization.status}
        runtimeConfig={initialization.runtimeConfig}
        onRetry={() => {
          void initialization.refresh();
        }}
      />
    );
  }

  return <AppRoutes />;
}

export default App;
