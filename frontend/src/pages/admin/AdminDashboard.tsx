import { useState, useEffect } from 'react';
import { 
  Users, 
  UserCheck, 
  BookOpen, 
  TrendingUp,
  Calendar,
  Activity
} from 'lucide-react';
import api from '@/services/api';
import { Line } from 'recharts';
import { LineChart, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface DashboardStats {
  total_users: number;
  active_users: number;
  total_subjects: number;
  today_registrations: number;
  week_registrations: number;
  daily_registrations: Array<{
    date: string;
    count: number;
  }>;
  role_distribution: Record<string, number>;
}

/**
 * Admin Dashboard Page
 * Displays key metrics and charts for system overview
 */
const AdminDashboard = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchDashboardStats();
  }, []);

  const fetchDashboardStats = async () => {
    try {
      setIsLoading(true);
      const response = await api.get<DashboardStats>('/admin/dashboard');
      setStats(response.data);
      setError(null);
    } catch (error: any) {
      setError('Failed to load dashboard statistics');
      console.error('Dashboard error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4">
        {error}
      </div>
    );
  }

  if (!stats) return null;

  // Prepare chart data
  const chartData = stats.daily_registrations.map(item => ({
    date: new Date(item.date).toLocaleDateString('en', { month: 'short', day: 'numeric' }),
    registrations: item.count
  }));

  const statCards = [
    {
      title: 'Total Users',
      value: stats.total_users,
      icon: Users,
      color: 'bg-blue-500',
      subtext: `${stats.role_distribution?.admin || 0} admins`
    },
    {
      title: 'Active Users',
      value: stats.active_users,
      icon: UserCheck,
      color: 'bg-green-500',
      subtext: `${((stats.active_users / stats.total_users) * 100).toFixed(1)}% active`
    },
    {
      title: 'Total Subjects',
      value: stats.total_subjects,
      icon: BookOpen,
      color: 'bg-purple-500',
      subtext: `${(stats.total_subjects / stats.total_users).toFixed(1)} per user`
    },
    {
      title: 'Today\'s Registrations',
      value: stats.today_registrations,
      icon: Calendar,
      color: 'bg-orange-500',
      subtext: `${stats.week_registrations} this week`
    }
  ];

  return (
    <div>
      {/* Page Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
        <p className="text-gray-600 mt-1">System overview and statistics</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {statCards.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.title} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <div className={`${stat.color} p-3 rounded-lg text-white`}>
                  <Icon className="w-6 h-6" />
                </div>
                <TrendingUp className="w-5 h-5 text-green-500" />
              </div>
              <p className="text-2xl font-bold text-gray-900">{stat.value.toLocaleString()}</p>
              <p className="text-sm font-medium text-gray-700 mt-1">{stat.title}</p>
              <p className="text-xs text-gray-500 mt-1">{stat.subtext}</p>
            </div>
          );
        })}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Registration Trend Chart */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Registration Trend</h2>
            <Activity className="w-5 h-5 text-gray-400" />
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis 
                dataKey="date" 
                stroke="#6b7280"
                style={{ fontSize: '12px' }}
              />
              <YAxis 
                stroke="#6b7280"
                style={{ fontSize: '12px' }}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'white',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px'
                }}
              />
              <Line 
                type="monotone" 
                dataKey="registrations" 
                stroke="#3b82f6" 
                strokeWidth={2}
                dot={{ fill: '#3b82f6', r: 4 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Role Distribution */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">User Roles</h2>
            <Users className="w-5 h-5 text-gray-400" />
          </div>
          <div className="space-y-4">
            {Object.entries(stats.role_distribution).map(([role, count]) => {
              const percentage = (count / stats.total_users) * 100;
              const roleColors = {
                user: 'bg-gray-500',
                admin: 'bg-blue-500',
                super_admin: 'bg-purple-500'
              };
              return (
                <div key={role}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-gray-700 capitalize">
                      {role.replace('_', ' ')}
                    </span>
                    <span className="text-sm text-gray-500">
                      {count} ({percentage.toFixed(1)}%)
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className={`${roleColors[role as keyof typeof roleColors]} h-2 rounded-full`}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="mt-6 bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Stats</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-sm text-gray-600">Average Subjects per User</p>
            <p className="text-xl font-bold text-gray-900 mt-1">
              {(stats.total_subjects / stats.total_users).toFixed(2)}
            </p>
          </div>
          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-sm text-gray-600">Active User Rate</p>
            <p className="text-xl font-bold text-gray-900 mt-1">
              {((stats.active_users / stats.total_users) * 100).toFixed(1)}%
            </p>
          </div>
          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-sm text-gray-600">Weekly Growth</p>
            <p className="text-xl font-bold text-gray-900 mt-1">
              +{stats.week_registrations} users
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;