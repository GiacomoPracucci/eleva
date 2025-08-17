/**
 * @file This file defines the ProfilePage component, which allows users
 * to view and edit their profile information.
 */

// our custom hook to interact with our global authentication state (Zustand).
import { useAuthStore } from '@/store/authStore';
// Icons from the lucide-react library for the UI.
import { Camera, Save } from 'lucide-react';

/**
 * The ProfilePage component displays the current user's data in a form.
 * It fetches user information from the global `useAuthStore` and renders it
 * in editable and non-editable fields.
 * NOTE: This component currently handles displaying data; form submission logic
 * needs to be implemented.
 */
export const ProfilePage = () => {
  // Destructure the `user` object from the global authentication store.
  // This object contains all the data for the currently logged-in user.
  const { user } = useAuthStore();

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold text-gray-900 mb-6">Profile Settings</h1>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        {/* Profile Header: Displays the user's avatar, name, and email. */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center space-x-6">
            <div className="relative">
              <div className="w-24 h-24 bg-gray-200 rounded-full flex items-center justify-center">
                {/* Conditionally render the profile picture if the URL exists. */}
                {user?.profile_picture_url ? (
                  <img 
                    src={user.profile_picture_url} 
                    alt="Profile" 
                    className="w-full h-full rounded-full object-cover"
                  />
                ) : (
                  // As a fallback, display the first initial of the username.
                  // The optional chaining `?.` prevents errors if `user` or `username` is undefined.
                  <span className="text-3xl font-semibold text-gray-600">
                    {user?.username?.[0]?.toUpperCase()}
                  </span>
                )}
              </div>
              {/* This button is a placeholder for profile picture upload functionality. */}
              <button className="absolute bottom-0 right-0 bg-blue-600 text-white p-2 rounded-full hover:bg-blue-700">
                <Camera className="w-4 h-4" />
              </button>
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                {/* Display the full name if available, otherwise fall back to the username. */}
                {user?.full_name || user?.username}
              </h2>
              <p className="text-gray-600">{user?.email}</p>
            </div>
          </div>
        </div>

        {/* Profile Form: Contains fields for editing user details. */}
        <div className="p-6">
          {/* Note: This form currently lacks an `onSubmit` handler to save changes. */}
          <form className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Username Field (Read-only) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Username
                </label>
                <input
                  type="text"
                  // `value` is used for read-only fields that are controlled by state.
                  value={user?.username || ''}
                  disabled // This field cannot be edited by the user.
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50"
                />
              </div>
              {/* Full Name Field (Editable) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  // `defaultValue` sets the initial value but allows the user to change it.
                  // This makes the input "uncontrolled" by React state.
                  defaultValue={user?.full_name || ''}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            
            {/* Email Field (Read-only) */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                type="email"
                value={user?.email || ''}
                disabled
                className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50"
              />
            </div>
            
            {/* Bio Field (Editable) */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Bio
              </label>
              <textarea
                rows={4}
                defaultValue={user?.bio || ''}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Tell us about yourself..."
              />
            </div>

            {/* Academic Level Field (Editable) */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Academic Level
              </label>
              <select
                defaultValue={user?.academic_level || ''}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select level</option>
                <option value="high_school">High School</option>
                <option value="university">University</option>
                <option value="graduate">Graduate</option>
                <option value="professional">Professional</option>
              </select>
            </div>
            
            {/* Submit Button */}
            <div className="pt-4">
              <button type="submit" className="btn-primary inline-flex items-center">
                <Save className="w-5 h-5 mr-2" />
                Save Changes
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;