/**
 * @file This file defines the ProfilePage component, which allows users
 * to view and edit their profile information.
 */

// React's core hooks for managing state and side effects.
import { useState, useEffect, useRef } from 'react';
// The primary hook from React Hook Form to manage form state and validation.
import { useForm } from 'react-hook-form';
// Our custom hook to interact with our global authentication state (Zustand).
import { useAuthStore } from '@/store/authStore';
// The configured Axios instance for making API calls.
import api from '@/services/api';
// TypeScript types defining the shape of user data.
import { User, UserUpdate } from '@/types';

import { profileService } from '@/services/profile';

// Icons from the lucide-react library for the UI.
import { 
  Camera, 
  Save, 
  AlertCircle, 
  CheckCircle, 
  X, 
  Upload, 
  Trash2,
  Loader2 
} from 'lucide-react';
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

  // NUOVI STATES per upload
  const [profilePicturePreview, setProfilePicturePreview] = useState<string | null>(null);
  const [isUploadingPicture, setIsUploadingPicture] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // useRef per tracciare l'URL di preview e fare cleanup
  // PERCHÉ useRef? Perché vogliamo mantenere il riferimento tra i render
  // senza causare re-render quando cambia
  const previewUrlRef = useRef<string | null>(null);

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

  // Cleanup dell'URL di preview quando il componente si smonta
  // IMPORTANTE: Previene memory leak!
  useEffect(() => {
    return () => {
      if (previewUrlRef.current && previewUrlRef.current.startsWith('blob:')) {
        profileService.revokePreviewUrl(previewUrlRef.current);
      }
    };
  }, []);

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
      const updatedUser = await profileService.updateProfile(data);

      // Update the global state with the new user data
      // This ensures consistency across the entire application
      setUser(updatedUser);

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

    // Cleanup vecchio preview URL se esiste
    if (previewUrlRef.current && previewUrlRef.current.startsWith('blob:')) {
      profileService.revokePreviewUrl(previewUrlRef.current);
    }

    // Crea nuovo preview URL
    const newPreviewUrl = profileService.createPreviewUrl(file);
    previewUrlRef.current = newPreviewUrl;
    setProfilePicturePreview(newPreviewUrl);
    setSelectedFile(file);
    setApiError(null);
  };

  /**
   * Esegue l'upload effettivo dell'immagine
   * PATTERN: Separazione tra selezione e conferma
   * Questo permette all'utente di vedere l'anteprima prima di confermare
   */
  const uploadProfilePicture = async () => {
    if (!selectedFile) return;

    setIsUploadingPicture(true);
    setUploadProgress(0);
    
    try {
      // Simula progresso per UX (l'upload reale non fornisce progress events)
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 10;
        });
      }, 100);

      const updatedUser = await profileService.uploadProfilePicture(selectedFile);
      
      clearInterval(progressInterval);
      setUploadProgress(100);
      
      // Aggiorna stato globale
      setUser(updatedUser);
      
      // Reset stati locali
      setSelectedFile(null);
      setProfilePicturePreview(updatedUser.profile_picture_url ?? null);

      // Cleanup preview URL
      if (previewUrlRef.current && previewUrlRef.current.startsWith('blob:')) {
        profileService.revokePreviewUrl(previewUrlRef.current);
        previewUrlRef.current = null;
      }
      
      setShowSuccessMessage(true);
      
      // Reset progress dopo animazione
      setTimeout(() => setUploadProgress(0), 500);
      
    } catch (error: any) {
      const errorMessage = 
        error.response?.data?.detail || 
        error.message ||
        'Failed to upload image. Please try again.';
      setApiError(errorMessage);
      setUploadProgress(0);
    } finally {
      setIsUploadingPicture(false);
    }
  };

  /**
   * Cancella l'upload in corso o il file selezionato
   */
  const cancelUpload = () => {
    setSelectedFile(null);
    
    // Ripristina l'immagine originale o l'iniziale dell'username
    if (user?.profile_picture_url) {
      setProfilePicturePreview(user.profile_picture_url);
    } else {
      setProfilePicturePreview(null);
    }
    
    // Cleanup preview URL
    if (previewUrlRef.current && previewUrlRef.current.startsWith('blob:')) {
      profileService.revokePreviewUrl(previewUrlRef.current);
      previewUrlRef.current = null;
    }
  };

  /**
   * Rimuove l'immagine profilo esistente
   */
  const deleteProfilePicture = async () => {
    if (!window.confirm('Are you sure you want to remove your profile picture?')) {
      return;
    }

    setIsUploadingPicture(true);
    
    try {
      const updatedUser = await profileService.deleteProfilePicture();
      setUser(updatedUser);
      setProfilePicturePreview(null);
      setShowSuccessMessage(true);
    } catch (error: any) {
      const errorMessage = 
        error.response?.data?.detail || 
        'Failed to delete profile picture. Please try again.';
      setApiError(errorMessage);
    } finally {
      setIsUploadingPicture(false);
    }
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

      {/* Notifications */}
      {showSuccessMessage && (
        <div className="mb-4 p-4 bg-green-50 border border-green-200 text-green-700 rounded-lg flex items-center animate-slide-down">
          <CheckCircle className="w-5 h-5 mr-2 flex-shrink-0" />
          <span>Profile updated successfully!</span>
        </div>
      )}

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
        {/* Profile Header con gestione immagine migliorata */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center space-x-6">
            <div className="relative">
              {/* Avatar/Immagine profilo */}
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
                
                {/* Progress overlay durante upload */}
                {isUploadingPicture && (
                  <div className="absolute inset-0 bg-black bg-opacity-50 rounded-full flex items-center justify-center">
                    <div className="text-white">
                      <Loader2 className="w-8 h-8 animate-spin" />
                      <span className="text-xs mt-1">{uploadProgress}%</span>
                    </div>
                  </div>
                )}
              </div>
              
              {/* Hidden file input */}
              <input
                id="profile-picture-input"
                type="file"
                accept="image/*"
                onChange={handleProfilePictureChange}
                className="hidden"
                disabled={isUploadingPicture}
              />
              
              {/* Bottoni azione immagine */}
              <div className="absolute -bottom-2 -right-2 flex space-x-1">
                <button 
                  onClick={() => document.getElementById('profile-picture-input')?.click()}
                  disabled={isUploadingPicture}
                  className="bg-blue-600 text-white p-2 rounded-full hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Change profile picture"
                >
                  <Camera className="w-4 h-4" />
                </button>
                
                {user.profile_picture_url && !selectedFile && (
                  <button 
                    onClick={deleteProfilePicture}
                    disabled={isUploadingPicture}
                    className="bg-red-600 text-white p-2 rounded-full hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Remove profile picture"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
            
            <div className="flex-1">
              <h2 className="text-xl font-semibold text-gray-900">
                {user.full_name || user.username}
              </h2>
              <p className="text-gray-600">{user.email}</p>
              
              {/* Azioni per immagine selezionata ma non caricata */}
              {selectedFile && (
                <div className="mt-3 flex items-center space-x-2">
                  <button
                    onClick={uploadProfilePicture}
                    disabled={isUploadingPicture}
                    className="inline-flex items-center px-3 py-1 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 disabled:opacity-50"
                  >
                    <Upload className="w-4 h-4 mr-1" />
                    Upload Photo
                  </button>
                  <button
                    onClick={cancelUpload}
                    disabled={isUploadingPicture}
                    className="inline-flex items-center px-3 py-1 bg-gray-200 text-gray-700 text-sm rounded-lg hover:bg-gray-300 disabled:opacity-50"
                  >
                    <X className="w-4 h-4 mr-1" />
                    Cancel
                  </button>
                  <span className="text-sm text-gray-500">
                    Preview mode - click Upload to save
                  </span>
                </div>
              )}
              
              {isDirty && (
                <p className="text-sm text-amber-600 mt-1">
                  You have unsaved changes in the form below
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Rest of the form remains the same */}
        <div className="p-6">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {/* ... resto del form uguale ... */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

            <div className="border-t pt-4">
              <h3 className="text-lg font-medium text-gray-900 mb-3">Privacy Settings</h3>
              
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
            
            <div className="flex justify-between items-center pt-4 border-t">
              <div className="text-sm text-gray-500">
                {isDirty && "Don't forget to save your changes"}
              </div>
              <div className="space-x-3">
                {isDirty && (
                  <button
                    type="button"
                    onClick={() => reset()}
                    className="px-4 py-2 text-gray-600 hover:text-gray-900 font-medium"
                  >
                    Cancel
                  </button>
                )}
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