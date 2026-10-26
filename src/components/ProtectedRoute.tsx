import { Navigate, Outlet, useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuth, type AuthRole } from '../contexts/AuthContext';
import { postLoginHomePath } from '../config/stagingHome';

interface ProtectedRouteProps {
  roles?: AuthRole[];
  /** Platform super-admin only (username === 'admin'), matching backend require_super_admin. */
  superAdminOnly?: boolean;
}

function ForbiddenPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center text-center">
      <h1 className="text-2xl font-black uppercase tracking-wide text-redwood-text-main">403 Forbidden</h1>
      <p className="mt-2 max-w-md text-sm text-redwood-text-muted">
        You do not have permission to access this page.
      </p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="rounded-md border border-redwood-border bg-redwood-midnight px-4 py-2 text-sm font-medium text-redwood-text-main hover:bg-redwood-bg-light"
        >
          Go back
        </button>
        <button
          type="button"
          onClick={() => navigate(postLoginHomePath(user?.role))}
          className="rounded-md bg-redwood-brand px-4 py-2 text-sm font-medium text-white hover:opacity-90"
        >
          Go to my home
        </button>
      </div>
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
