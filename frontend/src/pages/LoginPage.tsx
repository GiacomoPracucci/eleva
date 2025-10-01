/**
 * @file This file defines the LoginPage component, which provides the user interface
 * for user authentication. It handles form input, validation, and submission.
 */

// React's core hook for managing local component state.
import { useState } from 'react';
// Hooks from React Router for navigation and accessing location data.
import { Link, useNavigate, useLocation } from 'react-router-dom';
// The primary hook from React Hook Form to manage form state and validation.
import { useForm } from 'react-hook-form';
// A custom hook to interact with our global authentication state (Zustand).
import { useAuthStore } from '@/store/authStore';
// A TypeScript type defining the shape of our login credentials.
import { LoginCredentials } from '@/types';
// Icons from the lucide-react library for a clean UI.
import { Eye, EyeOff, LogIn } from 'lucide-react';
// A utility to conditionally join CSS class names together. Great for dynamic styling.
import clsx from 'clsx';

/**
 * The LoginPage component renders a sign-in form and manages the authentication process.
 * It leverages several hooks for state management, navigation, and form handling to provide
 * a responsive and user-friendly login experience.
 */
const LoginPage = () => {
  // Hook for programmatic navigation.
  const navigate = useNavigate();
  // Hook to access the current URL location, used for post-login redirection.
  const location = useLocation();
  // Custom hook to interact with the global authentication state.
  const { login, isLoading, error, clearError } = useAuthStore();
  // Local state for toggling password visibility in the UI.
  const [showPassword, setShowPassword] = useState(false);

  // Initialize react-hook-form to manage form state, validation, and submission.
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginCredentials>();

  // Determine the redirect path after a successful login.
  // It checks if the user was redirected from a protected route, otherwise defaults to '/dashboard'.
  // Optional chaining `?.` prevents runtime errors if location.state or state.from is null.
  const from = location.state?.from?.pathname || '/dashboard';

  /**
   * Handles the form submission event after validation has passed.
   * @param data - The validated form data containing the user's credentials.
   */
  const onSubmit = async (data: LoginCredentials) => {
    try {
      // Call the login action from the global auth store.
      await login(data);
      // On successful login, redirect the user to their original destination or the dashboard.
      // `{ replace: true }` prevents the user from navigating back to the login page.
      navigate(from, { replace: true });
    } catch {
      // The authStore is responsible for catching the error and setting the global
      // error state, so no explicit error handling is needed here in the component.
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        {/* App Logo and welcome message */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-blue-600 mb-2">Eléva</h1>
          <p className="text-gray-600">Welcome back! Please login to continue.</p>
        </div>

        {/* The main card containing the form */}
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Sign In</h2>

          {/* Displays a global error message if the login API call fails */}
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
              {error}
            </div>
          )}

          {/* The form element is wired up with react-hook-form's handleSubmit wrapper */}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {/* Username/Email Input Field */}
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-1">
                Username or Email
              </label>
              <input
                {...register('username', {
                  required: 'Username or email is required',
                  onChange: () => clearError(),
                })}
                type="text"
                id="username"
                className={clsx(
                  'w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500',
                  errors.username ? 'border-red-300' : 'border-gray-300'
                )}
                placeholder="Enter your username or email"
              />
              {/* Displays the validation message if the username field is invalid */}
              {errors.username && (
                <p className="mt-1 text-sm text-red-600">{errors.username.message}</p>
              )}
            </div>

            {/* Password Input Field */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                Password
              </label>
              <div className="relative">
                <input
                  {...register('password', {
                    required: 'Password is required',
                    onChange: () => clearError(),
                  })}
                  type={showPassword ? 'text' : 'password'}
                  id="password"
                  className={clsx(
                    'w-full px-3 py-2 pr-10 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500',
                    errors.password ? 'border-red-300' : 'border-gray-300'
                  )}
                  placeholder="Enter your password"
                />
                {/* Button to toggle password visibility state */}
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                >
                  {showPassword ? (
                    <EyeOff className="w-5 h-5" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
                </button>
              </div>
              {errors.password && (
                <p className="mt-1 text-sm text-red-600">{errors.password.message}</p>
              )}
            </div>

            {/* Additional form options (remember me and forgot password) */}
            <div className="flex items-center justify-between">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <span className="ml-2 text-sm text-gray-600">Remember me</span>
              </label>
              <Link
                to="/forgot-password"
                className="text-sm text-blue-600 hover:text-blue-700"
              >
                Forgot password?
              </Link>
            </div>

            {/* Submit Button with Loading State */}
            <button
              type="submit"
              disabled={isLoading}
              className={clsx(
                'w-full py-2.5 px-4 rounded-lg font-medium transition-colors flex items-center justify-center',
                isLoading
                  ? 'bg-gray-300 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700 text-white'
              )}
            >
              {/* Render a spinner during loading, otherwise show the text and icon */}
              {isLoading ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                  Signing in...
                </>
              ) : (
                <>
                  <LogIn className="w-5 h-5 mr-2" />
                  Sign In
                </>
              )}
            </button>
          </form>

          {/* Divider providing an alternative action */}
          <div className="mt-6 relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-gray-500">Or</span>
            </div>
          </div>

          {/* Sign Up - Link to the registration page for new users */}
          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600">
              Don't have an account?{' '}
              <Link
                to="/register"
                className="font-medium text-blue-600 hover:text-blue-700"
              >
                Sign up
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
