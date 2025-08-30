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