/**
 * @file This file sets up the authentication context and provides components for route protection.
 * It uses the Zustand auth store as the source of truth and makes authentication status
 * available to the component tree via a React Context.
 */

import React, { createContext, useContext, useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';

/**
 * Defines the shape of the data that will be available through the AuthContext.
 */
interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
}

/**
 * Creates a React Context to provide authentication status to any component in the app
 * without needing to pass props down manually ("prop drilling").
 */
const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * A component that provides authentication context to its children.
 * It should be placed high up in the component tree, wrapping the entire application.
 */
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Get state and actions from our Zustand store.
  const { isAuthenticated, isLoading, checkAuth } = useAuthStore();

  useEffect(() => {
    // When the application loads, we immediately trigger a check to see if the user
    // has a valid session (e.g., a valid token in localStorage).
    checkAuth();
  }, [checkAuth]); // The dependency array ensures this runs only once on mount.

  // The Provider component makes the auth state available to any child component that calls useAuth().
  return (
    <AuthContext.Provider value={{ isAuthenticated, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
};

/**
 * A custom hook for consuming the AuthContext.
 * This simplifies accessing auth state and provides a check to ensure it's used correctly.
 */
export const useAuth = () => {
  const context = useContext(AuthContext);
  // This check ensures that any component using this hook is a descendant of AuthProvider.
  // It's a best practice that prevents runtime errors.
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

/**
 * A component that protects routes requiring authentication.
 * If the user is not logged in, it redirects them to the login page.
 */
export const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  // While the auth status is being checked, show a loading spinner.
  // This prevents a flicker or rendering the wrong component momentarily.
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        {/* Simple TailwindCSS spinner */}
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // If the check is complete and the user is not authenticated, redirect them.
  if (!isAuthenticated) {
    // The <Navigate> component from react-router-dom handles the redirect.
    // We pass the current location in the `state` prop. This allows the login page
    // to redirect the user back to the page they were trying to access.
    // `replace` prevents the user from using the back button to return to this protected route.
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // If the user is authenticated, render the children components (the actual protected page).
  return <>{children}</>;
};

/**
 * A component for routes that should only be accessible to unauthenticated users
 * (e.g., login, register pages). If an authenticated user tries to access these,
 * they are redirected to the dashboard.
 */
export const PublicRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  // Show a loading spinner during the initial auth check.
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // If the user is already authenticated, redirect them away from the public page.
  if (isAuthenticated) {
    // Check if we were redirected from a protected route; if so, go back there.
    // Otherwise, default to the main dashboard.
    const from = location.state?.from?.pathname || '/dashboard';
    return <Navigate to={from} replace />;
  }

  // If the user is not authenticated, render the public page (e.g., the login form).
  return <>{children}</>;
};