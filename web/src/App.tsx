import { useEffect } from 'react';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { toast } from 'sonner';
import Navigation from './components/Navigation';
import AuthModal from './components/AuthModal';
import Home from './pages/Home';
import Gallery from './pages/Gallery';
import Invite from './pages/Invite';
import ConsoleLayout from './pages/console/ConsoleLayout';
import ConsoleAccount from './pages/console/ConsoleAccount';
import ConsoleGenerations from './pages/console/ConsoleGenerations';
import InitializationScreen from './components/InitializationScreen';
import { useAuth } from './hooks/useAuth';
import { useGeneration } from './hooks/useGeneration';
import { useInitialization } from './hooks/useInitialization';
import { usePublicModels } from './hooks/usePublicModels';

// Re-export for type usage
export type { GenerationRecord } from './hooks/useGeneration';

function AdminRedirect() {
  useEffect(() => {
    const adminAppUrl =
      window.__APP_CONFIG__?.VITE_ADMIN_APP_URL ||
      import.meta.env.VITE_ADMIN_APP_URL;
    if (adminAppUrl) {
      window.location.href = adminAppUrl;
    }
  }, []);

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center font-mono-data">
      后台已迁移到独立 admin 服务。
    </div>
  );
}

function AuthRequired({ openLogin }: { openLogin: () => void }) {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const returnTo = location.pathname + location.search;
    if (returnTo !== '/') {
      sessionStorage.setItem('authReturnTo', returnTo);
    }
    toast.info('请先登录');
    openLogin();
    navigate('/', { replace: true });
  }, [location, navigate, openLogin]);

  return <div className="min-h-screen bg-black" />;
}

function AppRoutes() {
  const auth = useAuth();
  const navigate = useNavigate();
  const { models, error: modelsError, loading: modelsLoading } = usePublicModels();
  const gen = useGeneration(auth.user?.id, models);

  // P0-2: 登录成功后返回原目标页
  useEffect(() => {
    if (auth.isLoggedIn) {
      const returnTo = sessionStorage.getItem('authReturnTo');
      if (returnTo) {
        sessionStorage.removeItem('authReturnTo');
        navigate(returnTo, { replace: true });
      }
    }
  }, [auth.isLoggedIn, navigate]);

  return (
    <Routes>
      <Route path="/admin/*" element={<AdminRedirect />} />
      {/* Console Routes (user dashboard) */}
      <Route
        path="/console"
        element={
          auth.isLoggedIn ? (
            <ConsoleLayout />
          ) : (
            <AuthRequired openLogin={auth.openLogin} />
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
                    models={models}
                    modelsError={modelsError}
                    modelsLoading={modelsLoading}
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
              onGoToLogin={() => auth.setAuthMode('login')}
              onResetPassword={auth.resetPassword}
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
