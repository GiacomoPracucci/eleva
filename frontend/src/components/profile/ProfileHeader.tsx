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