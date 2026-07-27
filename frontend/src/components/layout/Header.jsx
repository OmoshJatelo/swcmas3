import React, { useState, useRef, useEffect, useCallback, memo } from 'react';
import { useAuth } from '@/context/AuthContext.jsx';
import { useTheme } from '@/context/ThemeContext.jsx';
import { useNavigate, useLocation } from 'react-router-dom';
import { Sun, Moon, Bell, ChevronDown, LogOut, User, Plus } from 'lucide-react';

/* ─────────────────────────────────────────────────────────
   Map route paths to human-readable page titles
───────────────────────────────────────────────────────── */
const PAGE_TITLES = {
  '/dashboard': 'Dashboard',
  '/maps': 'Live Map',
  '/notifications': 'Notifications',
  '/users': 'User Management',
  '/apartments': 'Apartments & Properties',
  '/collections': 'Waste Collections',
  '/complaints': 'Complaints',
  '/reports': 'Analytics & Reports',
  '/anomalies': 'Anomaly Alerts',
  '/audit': 'Audit Logs',
  '/verifications': 'Verifications',
};

/* ─────────────────────────────────────────────────────────
   User Avatar — initials-based
───────────────────────────────────────────────────────── */
const UserAvatar = memo(({ user, size = 'md' }) => {
  const sizes = { sm: 'w-7 h-7 text-xs', md: 'w-9 h-9 text-sm' };
  return (
    <div
      className={`${sizes[size]} rounded-full bg-gradient-to-tr from-brand-500 to-emerald-400 flex items-center justify-center text-white font-semibold ring-2 ring-white dark:ring-slate-800 shadow-sm`}
      aria-hidden="true"
    >
      {user.firstName[0]}{user.lastName[0]}
    </div>
  );
});
UserAvatar.displayName = 'UserAvatar';

/* ─────────────────────────────────────────────────────────
   Quick-Action Buttons — role-gated
───────────────────────────────────────────────────────── */
const QuickActions = memo(({ role, navigate }) => {
  const adminRoles = ['county_admin', 'county_officer'];
  if (!adminRoles.includes(role)) return null;

  return (
    <div className="hidden md:flex items-center gap-2">
      <button
        onClick={() => navigate('/complaints')}
        className="btn-secondary flex items-center gap-1.5 text-xs"
        aria-label="Report a new complaint"
      >
        <Plus className="w-3.5 h-3.5" aria-hidden="true" />
        Complaint
      </button>
      <button
        onClick={() => navigate('/collections')}
        className="btn-primary flex items-center gap-1.5 text-xs"
        aria-label="Schedule a new collection"
      >
        <Plus className="w-3.5 h-3.5" aria-hidden="true" />
        Collection
      </button>
    </div>
  );
});
QuickActions.displayName = 'QuickActions';

/* ─────────────────────────────────────────────────────────
   Notification Bell
───────────────────────────────────────────────────────── */
const NotificationBell = memo(({ navigate }) => {
  // Unread count — could be wired to a real API; currently static for scaffold
  const unreadCount = 0;

  return (
    <button
      onClick={() => navigate('/notifications')}
      className="btn-icon relative"
      aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ''}`}
    >
      <Bell className="w-5 h-5" aria-hidden="true" />
      {unreadCount > 0 && (
        <span
          className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center animate-bounce-in"
          aria-hidden="true"
        >
          {unreadCount > 9 ? '9+' : unreadCount}
        </span>
      )}
    </button>
  );
});
NotificationBell.displayName = 'NotificationBell';

/* ─────────────────────────────────────────────────────────
   Header
───────────────────────────────────────────────────────── */
const Header = () => {
  const { user, logout } = useAuth();
  const { darkMode, toggle } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const avatarRef = useRef(null);
  const dropdownRef = useRef(null);

  const pageTitle = PAGE_TITLES[location.pathname] || 'SWCMAS';

  const handleLogout = useCallback(async () => {
    setDropdownOpen(false);
    await logout();
    navigate('/auth/login');
  }, [logout, navigate]);

  // Close dropdown on Escape or outside click
  useEffect(() => {
    if (!dropdownOpen) return;
    const handleKey = (e) => { if (e.key === 'Escape') setDropdownOpen(false); };
    const handleClick = (e) => {
      if (!avatarRef.current?.contains(e.target) && !dropdownRef.current?.contains(e.target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('keydown', handleKey);
    document.addEventListener('mousedown', handleClick);
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.removeEventListener('mousedown', handleClick);
    };
  }, [dropdownOpen]);

  return (
    <header
      className="h-16 glass-header sticky top-0 z-30 flex items-center justify-between px-5 md:px-8 shrink-0"
      role="banner"
    >
      {/* Left — Page context */}
      <div className="flex items-center gap-3">
        <h1 className="text-base font-semibold text-gray-900 dark:text-white leading-tight">
          {pageTitle}
        </h1>
      </div>

      {/* Right — Actions */}
      <div className="flex items-center gap-2">
        {user && <QuickActions role={user.role} navigate={navigate} />}

        {/* Divider */}
        <div className="hidden md:block w-px h-5 bg-gray-200 dark:bg-slate-700 mx-1" aria-hidden="true" />

        {/* Notifications */}
        {user && <NotificationBell navigate={navigate} />}

        {/* Dark mode toggle */}
        <button
          onClick={toggle}
          aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
          className="btn-icon"
        >
          {darkMode
            ? <Sun className="w-5 h-5" aria-hidden="true" />
            : <Moon className="w-5 h-5" aria-hidden="true" />
          }
        </button>

        {/* Divider */}
        <div className="w-px h-5 bg-gray-200 dark:bg-slate-700 mx-1" aria-hidden="true" />

        {/* User menu */}
        {user && (
          <div className="relative">
            <button
              ref={avatarRef}
              onClick={() => setDropdownOpen((o) => !o)}
              aria-expanded={dropdownOpen}
              aria-haspopup="true"
              aria-label="Open user menu"
              className="flex items-center gap-2.5 focus-ring rounded-xl p-1 transition-all duration-150 hover:bg-gray-100 dark:hover:bg-slate-800/60"
            >
              <UserAvatar user={user} />
              <div className="hidden md:flex flex-col items-start">
                <span className="text-sm font-semibold text-gray-800 dark:text-gray-200 leading-tight">
                  {user.firstName} {user.lastName}
                </span>
                <span className="text-xs text-gray-500 dark:text-gray-400 capitalize">
                  {user.role.replace(/_/g, ' ')}
                </span>
              </div>
              <ChevronDown
                className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${dropdownOpen ? 'rotate-180' : ''}`}
                aria-hidden="true"
              />
            </button>

            {dropdownOpen && (
              <div
                ref={dropdownRef}
                role="menu"
                aria-label="User menu"
                className="absolute right-0 mt-2 w-52 rounded-2xl shadow-xl bg-white dark:bg-slate-800 ring-1 ring-black/5 dark:ring-white/10 divide-y divide-gray-100 dark:divide-slate-700 animate-dropdown-in origin-top-right z-50 overflow-hidden"
              >
                {/* User info header */}
                <div className="px-4 py-3 bg-gray-50 dark:bg-slate-900/50">
                  <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                    {user.firstName} {user.lastName}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate capitalize mt-0.5">
                    {user.role.replace(/_/g, ' ')}
                  </p>
                </div>
                {/* Actions */}
                <div className="py-1">
                  <button
                    role="menuitem"
                    onClick={handleLogout}
                    className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                  >
                    <LogOut className="w-4 h-4" aria-hidden="true" />
                    Sign out
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
};

export default Header;
