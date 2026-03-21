import { lazy, Suspense, useEffect, useState } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import AppLockScreen from "@/components/AppLockScreen";
import SplashScreen from "@/components/SplashScreen";
import { AppErrorBoundary } from "@/components/AppErrorBoundary";

const loadAppLayout = () => import("@/components/AppLayout");
const loadAuth = () => import("@/pages/Auth");
const loadNotFound = () => import("@/pages/NotFound");
const loadDashboard = () => import("@/pages/Dashboard");
const loadObjetivos = () => import("@/pages/Objetivos");
const loadGraficos = () => import("@/pages/Graficos");
const loadPerfil = () => import("@/pages/Perfil");
const loadChat = () => import("@/pages/Chat");

const AppLayout = lazy(loadAppLayout);
const Auth = lazy(loadAuth);
const NotFound = lazy(loadNotFound);
const Dashboard = lazy(loadDashboard);
const Objetivos = lazy(loadObjetivos);
const Graficos = lazy(loadGraficos);
const Perfil = lazy(loadPerfil);
const Chat = lazy(loadChat);

const queryClient = new QueryClient();

const BootFallback = () => (
  <div className="min-h-screen bg-[hsl(243,75%,20%)] text-white flex items-center justify-center px-6">
    <div className="text-center">
      <p className="text-lg font-semibold">Carregando o app...</p>
      <p className="mt-2 text-sm text-white/70">Preparando sua sessao e restaurando o ultimo estado.</p>
    </div>
  </div>
);

const RouteFallback = () => (
  <div className="flex min-h-[30vh] items-center justify-center text-sm text-muted-foreground">
    Carregando tela...
  </div>
);

const RouteSuspense = ({ children }: { children: React.ReactNode }) => (
  <Suspense fallback={<RouteFallback />}>{children}</Suspense>
);

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading, locked, unlock, passwordOnlyLock, allowBiometricUnlock } = useAuth();
  if (loading) return <BootFallback />;
  if (!user) return <Navigate to="/auth" replace />;
  if (locked) return <AppLockScreen userEmail={user.email ?? ""} onUnlock={unlock} passwordOnly={passwordOnlyLock} allowBiometricUnlock={allowBiometricUnlock} />;
  return <>{children}</>;
};

const PublicRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  if (loading) return <BootFallback />;
  if (user) return <Navigate to="/" replace />;
  return <>{children}</>;
};

const App = () => {
  const [splashDone, setSplashDone] = useState(false);

  useEffect(() => {
    const prefetchRoutes = () => {
      void loadDashboard();
      void loadObjetivos();
      void loadGraficos();
      void loadPerfil();
      void loadChat();
    };

    if ("requestIdleCallback" in window) {
      const idleId = (window as Window & { requestIdleCallback: (cb: () => void, opts?: { timeout: number }) => number }).requestIdleCallback(
        prefetchRoutes,
        { timeout: 2500 },
      );
      return () => {
        if ("cancelIdleCallback" in window) {
          (window as Window & { cancelIdleCallback: (id: number) => void }).cancelIdleCallback(idleId);
        }
      };
    }

    const timeoutId = window.setTimeout(prefetchRoutes, 1200);
    return () => window.clearTimeout(timeoutId);
  }, []);

  return (
    <AppErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            {!splashDone && <SplashScreen onFinish={() => setSplashDone(true)} />}
            <BrowserRouter>
              <Routes>
                <Route path="/auth" element={<PublicRoute><RouteSuspense><Auth /></RouteSuspense></PublicRoute>} />
                <Route element={<ProtectedRoute><RouteSuspense><AppLayout /></RouteSuspense></ProtectedRoute>}>
                  <Route path="/" element={<RouteSuspense><Dashboard /></RouteSuspense>} />
                  <Route path="/share-target" element={<RouteSuspense><Dashboard /></RouteSuspense>} />
                  <Route path="/objetivos" element={<RouteSuspense><Objetivos /></RouteSuspense>} />
                  <Route path="/graficos" element={<RouteSuspense><Graficos /></RouteSuspense>} />
                  <Route path="/perfil" element={<RouteSuspense><Perfil /></RouteSuspense>} />
                  <Route path="/chat" element={<RouteSuspense><Chat /></RouteSuspense>} />
                </Route>
                <Route path="*" element={<RouteSuspense><NotFound /></RouteSuspense>} />
              </Routes>
            </BrowserRouter>
          </TooltipProvider>
        </AuthProvider>
      </QueryClientProvider>
    </AppErrorBoundary>
  );
};

export default App;
