import { Navigate, Outlet } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuth, type AuthRole } from '../contexts/AuthContext';

interface ProtectedRouteProps {
  roles?: AuthRole[];
  /** Platform super-admin only (username === 'admin'), matching backend require_super_admin. */
  superAdminOnly?: boolean;
}

function ForbiddenPage() {
  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center text-center">
      <h1 className="text-2xl font-black uppercase tracking-wide text-redwood-text-main">403 Forbidden</h1>
      <p className="mt-2 max-w-md text-sm text-redwood-text-muted">
        You do not have permission to access this page.
      </p>
    </div>
  );
}

export default function ProtectedRoute({ roles, superAdminOnly }: ProtectedRouteProps) {
  const { user, isAuthenticated, isLoading, hasRole } = useAuth();

  if (isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-redwood-brand" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: window.location.pathname }} />;
  }

  if (superAdminOnly && user?.username !== 'admin') {
    return <ForbiddenPage />;
  }

  if (roles && roles.length > 0 && !hasRole(...roles)) {
    return <ForbiddenPage />;
  }

  return <Outlet />;
}
