/**
 * @file This file defines the DashboardPage component, which serves as the main
 * landing page for authenticated users, providing a summary of their activity.
 */

// our custom hook to interact with our global authentication state (Zustand).
import { useAuthStore } from '@/store/authStore';
// Icons from the lucide-react library for a clean UI.
import { BookOpen, Clock, TrendingUp, Target } from 'lucide-react';

/**
 * The DashboardPage component is the user's main hub after logging in.
 * It provides a personalized welcome, a grid of key statistics, and quick
 * access to common actions. Currently, it displays static placeholder data.
 */
export const DashboardPage = () => {
  // Destructure the `user` object from the global store to display personalized content.
  const { user } = useAuthStore();

  // This array acts as a configuration for the stats grid.
  // Using a configuration array like this makes the UI modular and easy to update.
  // You can add or remove stats here without changing the JSX logic.
  const stats = [
    { label: 'Active Subjects', value: '0', icon: BookOpen, color: 'bg-blue-500' },
    { label: 'Study Hours', value: '0', icon: Clock, color: 'bg-green-500' },
    { label: 'Avg. Progress', value: '0%', icon: TrendingUp, color: 'bg-purple-500' },
    { label: 'Goals Met', value: '0', icon: Target, color: 'bg-orange-500' },
  ];

  return (
    <div>
      {/* Welcome Section: Greets the user with their name. */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">
          Welcome back, {user?.full_name || user?.username}! 👋
        </h1>
        <p className="text-gray-600 mt-2">
          Here's your learning progress at a glance
        </p>
      </div>

      {/* Stats Grid: Dynamically renders stat cards from the `stats` array. */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {/* We map over the `stats` array to create a card for each object. */}
        {stats.map((stat) => {
          // It's a common pattern in React to assign the icon component to a variable
          // with a capitalized name (e.g., `Icon`) so it can be rendered as a component (`<Icon />`).
          const Icon = stat.icon;
          return (
            <div key={stat.label} className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
              <div className="flex items-center justify-between mb-4">
                <div className={`${stat.color} p-3 rounded-lg text-white`}>
                  <Icon className="w-6 h-6" />
                </div>
              </div>
              <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
              <p className="text-sm text-gray-600 mt-1">{stat.label}</p>
            </div>
          );
        })}
      </div>

      {/* Quick Actions: Provides easy access to key features. */}
      {/* NOTE: These buttons are placeholders and need `onClick` handlers to be functional. */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-left">
            <BookOpen className="w-8 h-8 text-blue-600 mb-2" />
            <h3 className="font-medium text-gray-900">Add Subject</h3>
            <p className="text-sm text-gray-600">Create a new subject to track</p>
          </button>
          <button className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-left">
            <Clock className="w-8 h-8 text-green-600 mb-2" />
            <h3 className="font-medium text-gray-900">Study Session</h3>
            <p className="text-sm text-gray-600">Start a focused study session</p>
          </button>
          <button className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-left">
            <Target className="w-8 h-8 text-purple-600 mb-2" />
            <h3 className="font-medium text-gray-900">Set Goals</h3>
            <p className="text-sm text-gray-600">Define your learning objectives</p>
          </button>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;