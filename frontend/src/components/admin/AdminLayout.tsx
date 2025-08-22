import { Outlet, NavLink, Navigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { 
  LayoutDashboard, 
  Users, 
  BookOpen, 
  Settings,
  ChevronLeft,
  Menu,
  LogOut,
  Shield
} from 'lucide-react';
import { useState } from 'react';
import clsx from 'clsx';

/**
 * Admin Layout Component
 * Provides the main structure for admin pages with sidebar navigation
 */
const AdminLayout = () => {
  const { user, logout } = useAuthStore();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Check if user has admin privileges
  if (!user || (user.role !== 'admin' && user.role !== 'super_admin')) {
    return <Navigate to="/dashboard" replace />;
  }

  const navigation = [
    { name: 'Dashboard', href: '/admin', icon: LayoutDashboard },
    { name: 'Users', href: '/admin/users', icon: Users },
    { name: 'Subjects', href: '/admin/subjects', icon: BookOpen },
    { name: 'Settings', href: '/admin/settings', icon: Settings },
  ];

  const handleLogout = async () => {
    await logout();
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sidebar */}
      <div className={clsx(
        "fixed inset-y-0 left-0 z-50 bg-gray-900 transition-all duration-300",
        sidebarOpen ? "w-64" : "w-20"
      )}>
        {/* Logo */}
        <div className="flex items-center justify-between h-16 px-4 bg-gray-800">
          <div className="flex items-center">
            <Shield className="w-8 h-8 text-blue-500" />
            {sidebarOpen && (
              <span className="ml-2 text-xl font-bold text-white">Admin Panel</span>
            )}
          </div>
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="text-gray-400 hover:text-white"
          >
            {sidebarOpen ? (
              <ChevronLeft className="w-5 h-5" />
            ) : (
              <Menu className="w-5 h-5" />
            )}
          </button>
        </div>

        {/* Navigation */}
        <nav className="px-2 py-4">
          {navigation.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.name}
                to={item.href}
                end={item.href === '/admin'}
                className={({ isActive }) =>
                  clsx(
                    "flex items-center px-2 py-2 mb-1 rounded-lg transition-colors",
                    isActive
                      ? "bg-blue-600 text-white"
                      : "text-gray-300 hover:bg-gray-800 hover:text-white"
                  )
                }
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                {sidebarOpen && (
                  <span className="ml-3">{item.name}</span>
                )}
              </NavLink>
            );
          })}
        </nav>

        {/* User section */}
        <div className="absolute bottom-0 w-full p-4 border-t border-gray-800">
          <div className="flex items-center">
            <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
              <span className="text-sm font-medium text-white">
                {user.username[0].toUpperCase()}
              </span>
            </div>
            {sidebarOpen && (
              <div className="ml-3 flex-1">
                <p className="text-sm font-medium text-white">{user.username}</p>
                <p className="text-xs text-gray-400">
                  {user.role === 'super_admin' ? 'Super Admin' : 'Admin'}
                </p>
              </div>
            )}
            {sidebarOpen && (
              <button
                onClick={handleLogout}
                className="ml-auto text-gray-400 hover:text-white"
              >
                <LogOut className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className={clsx(
        "transition-all duration-300",
        sidebarOpen ? "ml-64" : "ml-20"
      )}>
        {/* Top bar */}
        <div className="bg-white shadow-sm border-b border-gray-200 h-16 flex items-center px-6">
          <h1 className="text-xl font-semibold text-gray-900">
            Eléva Administration
          </h1>
          <div className="ml-auto flex items-center space-x-2">
            <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded-full">
              {user.role === 'super_admin' ? 'SUPER ADMIN' : 'ADMIN'}
            </span>
          </div>
        </div>

        {/* Page content */}
        <div className="p-6">
          <Outlet />
        </div>
      </div>
    </div>
  );
};

export default AdminLayout;