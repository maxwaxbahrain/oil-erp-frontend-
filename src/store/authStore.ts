
export const useAuth = () => {
    // Mock auth for now
    return {
        user: { name: 'Admin', role: 'SuperUser' },
        isAuthenticated: true
    };
};
