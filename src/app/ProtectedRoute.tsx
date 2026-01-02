import { Navigate, Outlet } from 'react-router-dom';

// Simple authentication check placeholder
const useAuth = () => {
    // For now, we assume the user is always authenticated
    // Later this will check a token in localStorage or a global state
    return { isAuthenticated: true };
};

const ProtectedRoute = () => {
    const { isAuthenticated } = useAuth();

    if (!isAuthenticated) {
        return <Navigate to="/login" replace />;
    }

    return <Outlet />;
};

export default ProtectedRoute;
