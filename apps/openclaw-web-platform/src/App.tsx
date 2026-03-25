import { Suspense, lazy, type ReactElement } from "react";
import { BrowserRouter as Router, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { AdminWorkspace } from "@/components/layout/AdminWorkspace";
import { Home } from "@/pages/Home";
import { Download } from "@/pages/Download";
import { Community } from "@/pages/Community";
import { PackageDetail } from "@/pages/PackageDetail";
import { PlatformProvider, usePlatform } from "@/lib/platform";
import { isRoleAllowed } from "@/lib/api";
import type { UserRole } from "@/contracts/types";

const Login = lazy(() => import("@/pages/Login").then((module) => ({ default: module.Login })));
const Submit = lazy(() => import("@/pages/Submit").then((module) => ({ default: module.Submit })));
const MySubmissions = lazy(() => import("@/pages/MySubmissions").then((module) => ({ default: module.MySubmissions })));
const ReviewQueue = lazy(() => import("@/pages/ReviewQueue").then((module) => ({ default: module.ReviewQueue })));
const AdminDashboard = lazy(() => import("@/pages/AdminDashboard").then((module) => ({ default: module.AdminDashboard })));
const Admin2FA = lazy(() => import("@/pages/Admin2FA").then((module) => ({ default: module.Admin2FA })));
const AdminSecurity = lazy(() => import("@/pages/AdminSecurity").then((module) => ({ default: module.AdminSecurity })));
const AdminPlatform = lazy(() => import("@/pages/AdminPlatform").then((module) => ({ default: module.AdminPlatform })));
const AdminCloudAccess = lazy(() => import("@/pages/AdminCloudAccess").then((module) => ({ default: module.AdminCloudAccess })));
const AdminLocalCompute = lazy(() => import("@/pages/AdminLocalCompute").then((module) => ({ default: module.AdminLocalCompute })));
const UserManagement = lazy(() => import("@/pages/UserManagement").then((module) => ({ default: module.UserManagement })));
const CloudOpenClaw = lazy(() => import("@/pages/CloudOpenClaw").then((module) => ({ default: module.CloudOpenClaw })));
const CloudConsoleAccess = lazy(() => import("@/pages/CloudConsoleAccess").then((module) => ({ default: module.CloudConsoleAccess })));
const SharedRuntime = lazy(() => import("@/pages/SharedRuntime").then((module) => ({ default: module.SharedRuntime })));

function RouteFallback() {
  return <div className="min-h-screen bg-[#0a0e17]" />;
}

function DeferredPage({ children }: { children: ReactElement }) {
  return <Suspense fallback={<RouteFallback />}>{children}</Suspense>;
}

function ProtectedRoute({
  children,
  roles,
  requireTwoFactor = false,
}: {
  children: ReactElement;
  roles?: UserRole[];
  requireTwoFactor?: boolean;
}) {
  const { loading, session } = usePlatform();
  const location = useLocation();

  if (loading || !session) {
    return <div className="min-h-screen bg-[#0a0e17]" />;
  }
  if (!session.authenticated || !session.user) {
    return <Navigate to={`/login?redirectTo=${encodeURIComponent(location.pathname)}`} replace />;
  }
  if (roles && !isRoleAllowed(session.user.role, roles)) {
    return <Navigate to="/" replace />;
  }
  if (requireTwoFactor && session.user.role === "super_admin" && !session.twoFactorPassed) {
    return <Navigate to="/admin/2fa" replace />;
  }
  return children;
}

function AdminTwoFactorRoute() {
  const { loading, session } = usePlatform();

  if (loading || !session) {
    return <div className="min-h-screen bg-[#0a0e17]" />;
  }
  if (!session.authenticated || !session.user) {
    return <Navigate to="/login" replace />;
  }
  if (session.user.role !== "super_admin") {
    return <Navigate to="/" replace />;
  }
  if (session.twoFactorPassed) {
    return <Navigate to="/admin" replace />;
  }
  return (
    <DeferredPage>
      <Admin2FA />
    </DeferredPage>
  );
}

function AdminIndexRoute() {
  const { loading, session } = usePlatform();

  if (loading || !session) {
    return <div className="min-h-screen bg-[#0a0e17]" />;
  }
  if (session.user?.role === "reviewer") {
    return <Navigate to="/admin/review" replace />;
  }
  return (
    <DeferredPage>
      <AdminDashboard />
    </DeferredPage>
  );
}

export default function App() {
  return (
    <Router>
      <PlatformProvider>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<Home />} />
            <Route path="downloads" element={<Download />} />
            <Route path="download" element={<Navigate to="/downloads" replace />} />
            <Route path="community" element={<Community />} />
            <Route path="package/:id" element={<PackageDetail />} />
            <Route path="packages/:id/view" element={<PackageDetail />} />
            <Route
              path="submit"
              element={
                <ProtectedRoute>
                  <DeferredPage>
                    <Submit />
                  </DeferredPage>
                </ProtectedRoute>
              }
            />
            <Route
              path="me"
              element={
                <ProtectedRoute>
                  <DeferredPage>
                    <MySubmissions />
                  </DeferredPage>
                </ProtectedRoute>
              }
            />
            <Route
              path="cloud-console"
              element={
                <ProtectedRoute>
                  <DeferredPage>
                    <CloudConsoleAccess />
                  </DeferredPage>
                </ProtectedRoute>
              }
            />
            <Route
              path="shared-runtime"
              element={
                <ProtectedRoute>
                  <DeferredPage>
                    <SharedRuntime />
                  </DeferredPage>
                </ProtectedRoute>
              }
            />
            <Route
              path="my-submissions"
              element={<Navigate to="/me" replace />}
            />
            <Route
              path="admin"
              element={
                <ProtectedRoute roles={["reviewer", "super_admin"]} requireTwoFactor>
                  <AdminWorkspace />
                </ProtectedRoute>
              }
            >
              <Route index element={<AdminIndexRoute />} />
              <Route path="overview" element={<Navigate to="/admin" replace />} />
              <Route
                path="review"
                element={
                  <DeferredPage>
                    <ReviewQueue />
                  </DeferredPage>
                }
              />
              <Route
                path="users"
                element={
                  <ProtectedRoute roles={["super_admin"]} requireTwoFactor>
                    <DeferredPage>
                      <UserManagement />
                    </DeferredPage>
                  </ProtectedRoute>
                }
              />
              <Route
                path="security"
                element={
                  <ProtectedRoute roles={["super_admin"]} requireTwoFactor>
                    <DeferredPage>
                      <AdminSecurity />
                    </DeferredPage>
                  </ProtectedRoute>
                }
              />
              <Route
                path="platform"
                element={
                  <ProtectedRoute roles={["super_admin"]} requireTwoFactor>
                    <DeferredPage>
                      <AdminPlatform />
                    </DeferredPage>
                  </ProtectedRoute>
                }
              />
              <Route
                path="cloud-access"
                element={
                  <ProtectedRoute roles={["super_admin"]} requireTwoFactor>
                    <DeferredPage>
                      <AdminCloudAccess />
                    </DeferredPage>
                  </ProtectedRoute>
                }
              />
              <Route
                path="runtime"
                element={
                  <ProtectedRoute roles={["super_admin"]} requireTwoFactor>
                    <DeferredPage>
                      <CloudOpenClaw />
                    </DeferredPage>
                  </ProtectedRoute>
                }
              />
              <Route
                path="local-compute"
                element={
                  <ProtectedRoute roles={["super_admin"]} requireTwoFactor>
                    <DeferredPage>
                      <AdminLocalCompute />
                    </DeferredPage>
                  </ProtectedRoute>
                }
              />
              <Route path="cloud-openclaw" element={<Navigate to="/admin/runtime" replace />} />
            </Route>
            <Route path="review" element={<Navigate to="/admin/review" replace />} />
            <Route path="review-queue" element={<Navigate to="/admin/review" replace />} />
            <Route path="admin-dashboard" element={<Navigate to="/admin" replace />} />
          </Route>
          <Route
            path="/login"
            element={(
              <DeferredPage>
                <Login />
              </DeferredPage>
            )}
          />
          <Route path="/admin/2fa" element={<AdminTwoFactorRoute />} />
        </Routes>
      </PlatformProvider>
    </Router>
  );
}
