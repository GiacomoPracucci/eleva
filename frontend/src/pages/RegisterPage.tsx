/**
 * @file This file defines the RegisterPage component, which provides the UI
 * for new users to create an account. It includes form validation, password
 * confirmation, and handles the registration process.
 */

// React's core hook for managing local component state.
import { useState } from 'react';
// Hooks from React Router for navigation.
import { Link, useNavigate } from 'react-router-dom';
// The primary hook from React Hook Form to manage form state and validation.
import { useForm } from 'react-hook-form';
// Our custom hook to interact with our global authentication state (Zustand).
import { useAuthStore } from '@/store/authStore';
// A TypeScript type defining the shape of the data needed to create a user.
import { UserCreate } from '@/types';
// Icons from the lucide-react library for a clean UI.
import { Eye, EyeOff, UserPlus } from 'lucide-react';
// A utility to conditionally join CSS class names together.
import clsx from 'clsx';


/**
 * The RegisterPage component renders a sign-up form for new users.
 * It uses `react-hook-form` to handle complex validation, including real-time
 * password confirmation, and communicates with the global auth store to register the user.
 */
export const RegisterPage = () => {
  // Hook for programmatic navigation, used to redirect after successful registration.
  const navigate = useNavigate();
  // We alias `register` from the store to `registerUser` to avoid a name conflict
  // with the `register` function provided by `react-hook-form`.
  const { register: registerUser, isLoading, error, clearError } = useAuthStore();
  // Local state for toggling password visibility in the UI.
  const [showPassword, setShowPassword] = useState(false);

  // Initialize react-hook-form.
  const {
    register,
    handleSubmit,
    watch, // `watch` is subscribed to input changes and is used here to get the password value for confirmation.
    formState: { errors },
  } = useForm<UserCreate & { confirmPassword: string }>(); // We extend the form type to include a temporary `confirmPassword` field.

  // We "watch" the password field. `react-hook-form` will provide the current value
  // and re-render the component when it changes, allowing for real-time validation.
  const password = watch('password');

  /**
   * Handles the form submission event after validation has passed.
   * @param data - The validated form data, including the temporary `confirmPassword` field.
   */
  const onSubmit = async (data: UserCreate & { confirmPassword: string }) => {
    // We use object destructuring to separate `confirmPassword` from the actual user data
    // that needs to be sent to the API. This is a clean way to handle temporary fields.
    const { confirmPassword, ...userData } = data;
    try {
      // Call the registration action from the global auth store with the clean user data.
      await registerUser(userData);
      // On success, redirect the user to the main dashboard.
      navigate('/dashboard');
    } catch (error) {
      // Error state is managed by the authStore, so no specific action is needed here.
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center px-4 py-8">
      <div className="max-w-md w-full">
        {/* App Logo and call to action */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-blue-600 mb-2">Eléva</h1>
          <p className="text-gray-600">Create your account to get started</p>
        </div>

        {/* The main card containing the registration form */}
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Sign Up</h2>

          {/* Displays a global error message if the registration API call fails */}
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              {/* Username Field */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Username
                </label>
                <input
                  {...register('username', {
                    required: 'Username is required',
                    minLength: { value: 3, message: 'Minimum 3 characters' },
                  })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  onChange={() => clearError()}
                />
                {errors.username && (
                  <p className="mt-1 text-sm text-red-600">{errors.username.message}</p>
                )}
              </div>

              {/* Full Name Field (Optional) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Full Name
                </label>
                <input
                  {...register('full_name')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Email Field */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                {...register('email', {
                  required: 'Email is required',
                  pattern: {
                    value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                    message: 'Invalid email address',
                  },
                })}
                type="email"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                onChange={() => clearError()}
              />
              {errors.email && (
                <p className="mt-1 text-sm text-red-600">{errors.email.message}</p>
              )}
            </div>

            {/* Password Field */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Password
              </label>
              <div className="relative">
                <input
                  {...register('password', {
                    required: 'Password is required',
                    minLength: { value: 8, message: 'Minimum 8 characters' },
                  })}
                  type={showPassword ? 'text' : 'password'}
                  className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              {errors.password && (
                <p className="mt-1 text-sm text-red-600">{errors.password.message}</p>
              )}
            </div>

            {/* Confirm Password Field */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Confirm Password
              </label>
              <input
                {...register('confirmPassword', {
                  required: 'Please confirm your password',
                  // This custom validation function checks if the value matches the 'password' field.
                  // The `password` constant is provided by the `watch` hook.
                  validate: value => value === password || 'Passwords do not match',
                })}
                type="password"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {errors.confirmPassword && (
                <p className="mt-1 text-sm text-red-600">{errors.confirmPassword.message}</p>
              )}
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
              {isLoading ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                  Creating account...
                </>
              ) : (
                <>
                  <UserPlus className="w-5 h-5 mr-2" />
                  Sign Up
                </>
              )}
            </button>
          </form>

          {/* Link to the login page for existing users */}
          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600">
              Already have an account?{' '}
              <Link to="/login" className="font-medium text-blue-600 hover:text-blue-700">
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RegisterPage;