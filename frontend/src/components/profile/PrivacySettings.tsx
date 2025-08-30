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