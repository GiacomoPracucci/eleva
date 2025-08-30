/**
 * @file ProfileForm Component
 * components/profile/ProfileForm.tsx
 * 
 * Form principale per modifica profilo.
 * Presentazionale, usa react-hook-form via props.
 */

import React from 'react';
import clsx from 'clsx';
import { Save } from 'lucide-react';

interface ProfileFormProps {
  register: any;
  errors: any;
  isSubmitting: boolean;
  isDirty: boolean;
  onSubmit: () => void;
  onReset: () => void;
}

export const ProfileForm: React.FC<ProfileFormProps> = ({
  register,
  errors,
  isSubmitting,
  isDirty,
  onSubmit,
  onReset
}) => {
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {/* Full Name */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Full Name
        </label>
        <input
          type="text"
          {...register('full_name')}
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
      
      {/* Bio */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Bio
        </label>
        <textarea
          {...register('bio')}
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
      
      {/* Academic Level */}
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
      
      {/* Form Actions */}
      <div className="flex justify-between items-center pt-4 border-t">
        <div className="text-sm text-gray-500">
          {isDirty && "Don't forget to save your changes"}
        </div>
        <div className="space-x-3">
          {isDirty && (
            <button
              type="button"
              onClick={onReset}
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
  );
};

// ====================================================================================
// ====================================================================================

/**
 * @file ProfileHeader Component
 * components/profile/ProfileHeader.tsx
 * 
 * Header sezione profilo con info utente.
 */

interface ProfileHeaderProps {
  user: any;
  imageUrl?: string | null;
  onImageChange?: () => void;
}

export const ProfileHeader: React.FC<ProfileHeaderProps> = ({
  user
}) => {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-center space-x-6">
        <div className="flex-1">
          <h2 className="text-xl font-semibold text-gray-900">
            {user?.full_name || user?.username}
          </h2>
          <p className="text-gray-600">{user?.email}</p>
          <div className="mt-2 flex items-center space-x-4 text-sm text-gray-500">
            <span>Member since {new Date(user?.created_at).toLocaleDateString()}</span>
            {user?.role !== 'user' && (
              <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded-full">
                {user?.role === 'super_admin' ? 'Super Admin' : 'Admin'}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// ====================================================================================
// ====================================================================================

/**
 * @file PrivacySettings Component
 * components/profile/PrivacySettings.tsx
 * 
 * Sezione impostazioni privacy.
 */

interface PrivacySettingsProps {
  register: any;
  showProfilePublicly: boolean;
  allowAiTraining: boolean;
}

export const PrivacySettings: React.FC<PrivacySettingsProps> = ({
  register,
  showProfilePublicly,
  allowAiTraining
}) => {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <h3 className="text-lg font-medium text-gray-900 mb-4">Privacy Settings</h3>
      
      <div className="space-y-4">
        <label className="flex items-start space-x-3">
          <input
            type="checkbox"
            {...register('show_profile_publicly')}
            defaultChecked={showProfilePublicly}
            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 mt-1"
          />
          <div>
            <span className="text-sm font-medium text-gray-700">
              Show profile publicly
            </span>
            <p className="text-xs text-gray-500">
              Allow other users to view your profile and learning progress
            </p>
          </div>
        </label>
        
        <label className="flex items-start space-x-3">
          <input
            type="checkbox"
            {...register('allow_ai_training')}
            defaultChecked={allowAiTraining}
            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 mt-1"
          />
          <div>
            <span className="text-sm font-medium text-gray-700">
              Allow AI training
            </span>
            <p className="text-xs text-gray-500">
              Help improve our AI by allowing anonymous usage of your data for model training
            </p>
          </div>
        </label>
      </div>
    </div>
  );
};

// ====================================================================================
// ====================================================================================

/**
 * @file ReadOnlyFields Component
 * components/profile/ReadOnlyFields.tsx
 * 
 * Campi non modificabili del profilo.
 */

interface ReadOnlyFieldsProps {
  username: string;
  email: string;
}

export const ReadOnlyFields: React.FC<ReadOnlyFieldsProps> = ({
  username,
  email
}) => {
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Username
        </label>
        <input
          type="text"
          value={username}
          disabled
          className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 cursor-not-allowed"
        />
        <p className="mt-1 text-xs text-gray-500">Username cannot be changed</p>
      </div>
      
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Email
        </label>
        <input
          type="email"
          value={email}
          disabled
          className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 cursor-not-allowed"
        />
        <p className="mt-1 text-xs text-gray-500">
          Email cannot be changed for security reasons
        </p>
      </div>
    </div>
  );
};