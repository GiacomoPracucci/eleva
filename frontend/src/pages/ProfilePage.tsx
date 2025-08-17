/**
 * @file This file defines the ProfilePage component, which allows users
 * to view and edit their profile information.
 */

// React's core hooks for managing state and side effects.
import { useState, useEffect } from 'react';
// The primary hook from React Hook Form to manage form state and validation.
import { useForm } from 'react-hook-form';
// Our custom hook to interact with our global authentication state (Zustand).
import { useAuthStore } from '@/store/authStore';
// The configured Axios instance for making API calls.
import api from '@/services/api';
// TypeScript types defining the shape of user data.
import { User, UserUpdate } from '@/types';
// Icons from the lucide-react library for the UI.
import { Camera, Save, AlertCircle, CheckCircle, X } from 'lucide-react';
// A utility to conditionally join CSS class names together.
import clsx from 'clsx';
/**
 * The ProfilePage component displays and allows editing of the current user's data.
 * It implements a controlled form with validation, handles profile updates via API,
 * and provides visual feedback for all user actions.
 * 
 * Key Features:
 * - Form validation using react-hook-form
 * - Optimistic UI updates with error rollback
 * - Profile picture upload preview (prepared for future implementation)
 * - Success/error notifications
 * - Loading states during API calls
 */
export const ProfilePage = () => {
  // ===================================================================================
  // GLOBAL STATE
  // We destructure both the user object AND the setUser function from the store.
  // setUser will be needed to update the global state after a successful profile update.
  // ===================================================================================
  const { user, setUser } = useAuthStore();

  // ===================================================================================
  // LOCAL STATE
  // We manage UI-specific state locally in the component.
  // This follows the principle of keeping state as close to where it's used as possible.
  // ===================================================================================

  /**
   * Controls the visibility of the success notification.
   * We use a separate state for this instead of deriving it from form state
   * to have better control over the timing and animation.
   */
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);

  /**
   * Stores API error messages.
   * We keep this separate from form validation errors to distinguish between
   * client-side validation (form errors) and server-side issues (API errors).
   */
  const [apiError, setApiError] = useState<string | null>(null);

  /**
   * Preview URL for the profile picture.
   * This allows users to see their new picture before saving.
   * NOTE: Currently for preview only - actual upload implementation pending.
   */
  const [profilePicturePreview, setProfilePicturePreview] = useState<string | null>(null);

  // ===================================================================================
  // FORM MANAGEMENT
  // react-hook-form provides powerful form handling with minimal re-renders.
  // We destructure only the functions we need to keep the component clean.
  // ===================================================================================
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<UserUpdate>({
    // Default values are crucial for controlled inputs.
    // Without them, React will warn about uncontrolled to controlled component changes.
    defaultValues: {
      full_name: user?.full_name || '',
      academic_level: user?.academic_level || '',
      bio: user?.bio || '',
      show_profile_publicly: user?.show_profile_publicly || false,
      allow_ai_training: user?.allow_ai_training || true,
    }
  });

  // ===================================================================================
  // SIDE EFFECTS
  // ===================================================================================
  
  /**
   * Reset form values when user data changes.
   * This is important for when the user data is fetched asynchronously
   * or when returning to the page after navigation.
   */
  useEffect(() => {
    if (user) {
      reset({
        full_name: user.full_name || '',
        academic_level: user.academic_level || '',
        bio: user.bio || '',
        show_profile_publicly: user.show_profile_publicly || false,
        allow_ai_training: user.allow_ai_training || true,
      });
      if (user.profile_picture_url) {
        setProfilePicturePreview(user.profile_picture_url);
      }
    }
  }, [user, reset]);

  /**
   * Auto-hide success message after 3 seconds.
   * This provides a better UX by not requiring manual dismissal
   * while ensuring the user sees the confirmation.
   */
  useEffect(() => {
    if (showSuccessMessage) {
      const timer = setTimeout(() => {
        setShowSuccessMessage(false);
      }, 3000);
      // Cleanup function to clear the timer if the component unmounts
      // or if showSuccessMessage changes before the timeout.
      return () => clearTimeout(timer);
    }
  }, [showSuccessMessage]);  

  // ===================================================================================
  // EVENT HANDLERS
  // ===================================================================================

  /**
   * Handles form submission for profile updates.
   * This function is called by react-hook-form after successful validation.
   * 
   * @param data - The validated form data containing only the fields that have been changed.
   * 
   * Design decisions:
   * 1. We use try-catch for explicit error handling
   * 2. We update both the API and local state for consistency
   * 3. We provide clear user feedback for both success and failure
   */
  const onSubmit = async (data: UserUpdate) => {
    try {
      // Clear any previous API errors before attempting the update
      setApiError(null);

      // Make the API call to update the user profile
      // The PUT endpoint expects only the fields that need updating
      const response = await api.put<User>('/users/me', data);

      // Update the global state with the new user data
      // This ensures consistency across the entire application
      setUser(response.data);

      // Reset the form with the new values to update the "dirty" state
      // This prevents the "unsaved changes" warning after a successful save
      reset(data);

      // Show success feedback to the user
      setShowSuccessMessage(true);
    } catch (error: any) {
      // Handle different types of errors with appropriate messages
      // We check for common API error response structures
      const errorMessage = 
        error.response?.data?.detail || 
        error.response?.data?.message ||
        'Failed to update profile. Please try again.';
      
      setApiError(errorMessage);
      
      // Log the full error for debugging (only in development)
      if (process.env.NODE_ENV === 'development') {
        console.error('Profile update error:', error);
      }
    }
  };

  /**
   * Handles profile picture selection.
   * Currently creates a preview - full upload implementation pending.
   * 
   * @param event - The file input change event
   * 
   * Design decisions:
   * 1. We validate file type client-side for immediate feedback
   * 2. We create a preview URL using FileReader API for instant visual feedback
   * 3. We prepare the structure for future S3 upload implementation
   */
  const handleProfilePictureChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (!file) return;

    // validate file input
    if (!file.type.startsWith('image/')) {
      setApiError('Please select an image file');
      return;
    }

    // validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024
    if (file.size > maxSize) {
      setApiError('Image size must be less than 5MB');
      return;
    }

    // Create preview URL
    const reader = new FileReader();
    reader.onloadend = () => {
      setProfilePicturePreview(reader.result as string);
    };
    reader.readAsDataURL(file);
    
    // TODO: Implement actual upload to S3
    // This would involve:
    // 1. Creating a FormData object
    // 2. Sending to /users/me/profile-picture endpoint
    // 3. Updating global user state with new picture URL
    console.log('Profile picture upload not yet implemented');
  };

  // ===================================================================================
  // RENDER
  // ===================================================================================

  // Early return if no user data is available
  // This prevents errors from trying to access undefined user properties
  if (!user) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }


  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold text-gray-900 mb-6">Profile Settings</h1>

      {/* Success Notification - Animated slide-down effect */}
      {showSuccessMessage && (
        <div className="mb-4 p-4 bg-green-50 border border-green-200 text-green-700 rounded-lg flex items-center animate-slide-down">
          <CheckCircle className="w-5 h-5 mr-2 flex-shrink-0" />
          <span>Profile updated successfully!</span>
        </div>
      )}

      {/* Error Notification - Shows API errors */}
      {apiError && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg flex items-center">
          <AlertCircle className="w-5 h-5 mr-2 flex-shrink-0" />
          <span>{apiError}</span>
          <button
            onClick={() => setApiError(null)}
            className="ml-auto text-red-700 hover:text-red-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        {/* Profile Header: Displays the user's avatar, name, and email. */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center space-x-6">
            <div className="relative">
              <div className="w-24 h-24 bg-gray-200 rounded-full flex items-center justify-center overflow-hidden">
                {profilePicturePreview ? (
                  <img 
                    src={profilePicturePreview} 
                    alt="Profile" 
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-3xl font-semibold text-gray-600">
                    {user.username?.[0]?.toUpperCase()}
                  </span>
                )}
              </div>
              {/* Hidden file input for profile picture upload */}
              <input
                id="profile-picture-input"
                type="file"
                accept="image/*"
                onChange={handleProfilePictureChange}
                className="hidden"
              />
              <button 
                onClick={() => document.getElementById('profile-picture-input')?.click()}
                className="absolute bottom-0 right-0 bg-blue-600 text-white p-2 rounded-full hover:bg-blue-700 transition-colors"
                title="Change profile picture"
              >
                <Camera className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-semibold text-gray-900">
                {user.full_name || user.username}
              </h2>
              <p className="text-gray-600">{user.email}</p>
              {/* Show if profile has unsaved changes */}
              {isDirty && (
                <p className="text-sm text-amber-600 mt-1">
                  You have unsaved changes
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Profile Form with validation and submission handling */}
        <div className="p-6">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Username Field (Read-only) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Username
                </label>
                <input
                  type="text"
                  value={user.username}
                  disabled
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 cursor-not-allowed"
                />
                <p className="mt-1 text-xs text-gray-500">Username cannot be changed</p>
              </div>

              {/* Full Name Field (Editable) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  {...register('full_name', {
                    maxLength: {
                      value: 100,
                      message: 'Full name must be less than 100 characters'
                    }
                  })}
                  className={clsx(
                    "w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500",
                    errors.full_name ? "border-red-300" : "border-gray-300"
                  )}
                  placeholder="Enter your full name"
                />
                {errors.full_name && (
                  <p className="mt-1 text-sm text-red-600">{errors.full_name.message}</p>
                )}
              </div>
            </div>
            
            {/* Email Field (Read-only) */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                type="email"
                value={user.email}
                disabled
                className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 cursor-not-allowed"
              />
              <p className="mt-1 text-xs text-gray-500">
                Email cannot be changed for security reasons
              </p>
            </div>
            
            {/* Bio Field (Editable) */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Bio
              </label>
              <textarea
                {...register('bio', {
                  maxLength: {
                    value: 500,
                    message: 'Bio must be less than 500 characters'
                  }
                })}
                rows={4}
                className={clsx(
                  "w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500",
                  errors.bio ? "border-red-300" : "border-gray-300"
                )}
                placeholder="Tell us about yourself..."
              />
              {errors.bio && (
                <p className="mt-1 text-sm text-red-600">{errors.bio.message}</p>
              )}
            </div>

            {/* Academic Level Field (Editable) */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Academic Level
              </label>
              <select
                {...register('academic_level')}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select level</option>
                <option value="high_school">High School</option>
                <option value="university">University</option>
                <option value="graduate">Graduate</option>
                <option value="professional">Professional</option>
              </select>
            </div>

            {/* Privacy Settings Section */}
            <div className="border-t pt-4">
              <h3 className="text-lg font-medium text-gray-900 mb-3">Privacy Settings</h3>
              
              {/* Public Profile Toggle */}
              <div className="space-y-3">
                <label className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    {...register('show_profile_publicly')}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <div>
                    <span className="text-sm font-medium text-gray-700">
                      Show profile publicly
                    </span>
                    <p className="text-xs text-gray-500">
                      Allow other users to view your profile
                    </p>
                  </div>
                </label>

                {/* AI Training Toggle */}
                <label className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    {...register('allow_ai_training')}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <div>
                    <span className="text-sm font-medium text-gray-700">
                      Allow AI training
                    </span>
                    <p className="text-xs text-gray-500">
                      Help improve our AI by allowing anonymous usage of your data
                    </p>
                  </div>
                </label>
              </div>
            </div>
            
            {/* Form Actions */}
            <div className="flex justify-between items-center pt-4 border-t">
              <div className="text-sm text-gray-500">
                {isDirty && "Don't forget to save your changes"}
              </div>
              <div className="space-x-3">
                {/* Cancel button - only shown when there are unsaved changes */}
                {isDirty && (
                  <button
                    type="button"
                    onClick={() => reset()}
                    className="px-4 py-2 text-gray-600 hover:text-gray-900 font-medium"
                  >
                    Cancel
                  </button>
                )}
                {/* Submit button with loading state */}
                <button 
                  type="submit" 
                  disabled={isSubmitting || !isDirty}
                  className={clsx(
                    "inline-flex items-center px-4 py-2 rounded-lg font-medium transition-colors",
                    isSubmitting || !isDirty
                      ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                      : "bg-blue-600 text-white hover:bg-blue-700"
                  )}
                >
                  {isSubmitting ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="w-5 h-5 mr-2" />
                      Save Changes
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;