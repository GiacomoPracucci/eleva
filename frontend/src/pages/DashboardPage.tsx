// ===== pages/DashboardPage.tsx =====
import { useAuthStore } from '@/store/authStore';
import { BookOpen, Clock, TrendingUp, Target } from 'lucide-react';

export const DashboardPage = () => {
  const { user } = useAuthStore();

  const stats = [
    { label: 'Active Subjects', value: '0', icon: BookOpen, color: 'bg-blue-500' },
    { label: 'Study Hours', value: '0', icon: Clock, color: 'bg-green-500' },
    { label: 'Avg. Progress', value: '0%', icon: TrendingUp, color: 'bg-purple-500' },
    { label: 'Goals Met', value: '0', icon: Target, color: 'bg-orange-500' },
  ];

  return (
    <div>
      {/* Welcome Section */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">
          Welcome back, {user?.full_name || user?.username}! 👋
        </h1>
        <p className="text-gray-600 mt-2">
          Here's your learning progress at a glance
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {stats.map((stat) => {
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

      {/* Quick Actions */}
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

// ===== pages/SubjectsPage.tsx =====
import { Plus } from 'lucide-react';

export const SubjectsPage = () => {
  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-900">My Subjects</h1>
        <button className="btn-primary inline-flex items-center">
          <Plus className="w-5 h-5 mr-2" />
          Add Subject
        </button>
      </div>

      {/* Empty state */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12">
        <div className="text-center">
          <BookOpen className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">No subjects yet</h2>
          <p className="text-gray-600 mb-6">
            Start by adding your first subject to track your learning progress
          </p>
          <button className="btn-primary inline-flex items-center">
            <Plus className="w-5 h-5 mr-2" />
            Add Your First Subject
          </button>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;