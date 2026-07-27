import React, { memo } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext.jsx';
import {
  LayoutDashboard,
  Map as MapIcon,
  Bell,
  Users,
  Building2,
  Truck,
  AlertTriangle,
  BarChart3,
  FileWarning,
  CheckSquare,
  Shield,
  Activity,
} from 'lucide-react';

/* ─────────────────────────────────────────────────────────
   Role-based grouped navigation definitions
   Groups: Overview | Operations | Monitoring | Administration
───────────────────────────────────────────────────────── */
const getMenuGroups = (role) => {
  const overview = {
    label: 'Overview',
    items: [
      { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { to: '/maps', label: 'Live Map', icon: MapIcon },
      { to: '/notifications', label: 'Notifications', icon: Bell },
    ],
  };

  const byRole = {
    county_admin: [
      {
        label: 'Operations',
        items: [
          { to: '/apartments', label: 'Apartments', icon: Building2 },
          { to: '/collections', label: 'Collections', icon: Truck },
          { to: '/complaints', label: 'Complaints', icon: FileWarning },
        ],
      },
      {
        label: 'Monitoring',
        items: [
          { to: '/anomalies', label: 'Anomalies', icon: AlertTriangle },
          { to: '/reports', label: 'Analytics', icon: BarChart3 },
        ],
      },
      {
        label: 'Administration',
        items: [
          { to: '/users', label: 'Users', icon: Users },
          { to: '/audit', label: 'Audit Logs', icon: Shield },
        ],
      },
    ],
    county_officer: [
      {
        label: 'Operations',
        items: [
          { to: '/complaints', label: 'Complaints', icon: FileWarning },
          { to: '/anomalies', label: 'Anomalies', icon: AlertTriangle },
        ],
      },
      {
        label: 'Monitoring',
        items: [{ to: '/reports', label: 'Reports', icon: BarChart3 }],
      },
    ],
    landlord: [
      {
        label: 'Operations',
        items: [
          { to: '/apartments', label: 'My Properties', icon: Building2 },
          { to: '/collections', label: 'Collections', icon: Truck },
        ],
      },
    ],
    waste_collector: [
      {
        label: 'Operations',
        items: [{ to: '/collections', label: 'My Routes', icon: Truck }],
      },
    ],
    resident: [
      {
        label: 'Operations',
        items: [
          { to: '/complaints', label: 'My Complaints', icon: FileWarning },
          { to: '/verifications', label: 'Verifications', icon: CheckSquare },
        ],
      },
    ],
  };

  return [overview, ...(byRole[role] || [])];
};

/* ─────────────────────────────────────────────────────────
   Individual Nav Item
───────────────────────────────────────────────────────── */
const NavItem = memo(({ to, label, icon: Icon }) => (
  <NavLink
    to={to}
    aria-label={label}
    className={({ isActive }) =>
      `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 focus-ring group ${
        isActive
          ? 'bg-brand-50 dark:bg-brand-500/10 text-brand-700 dark:text-brand-400 border-l-[3px] border-brand-500 pl-[9px]'
          : 'text-gray-600 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-800/70 hover:text-gray-900 dark:hover:text-slate-200 border-l-[3px] border-transparent'
      }`
    }
  >
    {({ isActive }) => (
      <>
        <Icon
          className={`w-4 h-4 shrink-0 transition-colors ${
            isActive
              ? 'text-brand-600 dark:text-brand-400'
              : 'text-gray-400 dark:text-slate-500 group-hover:text-gray-600 dark:group-hover:text-slate-300'
          }`}
          aria-hidden="true"
        />
        <span className="truncate">{label}</span>
        {isActive && <span className="sr-only">(current page)</span>}
      </>
    )}
  </NavLink>
));

NavItem.displayName = 'NavItem';

/* ─────────────────────────────────────────────────────────
   Sidebar
───────────────────────────────────────────────────────── */
const Sidebar = () => {
  const { user } = useAuth();
  const role = user?.role || '';
  const groups = getMenuGroups(role);

  return (
    <aside
      className="w-64 shrink-0 bg-white dark:bg-slate-900 border-r border-gray-100 dark:border-slate-800 flex flex-col h-screen z-20"
      aria-label="Application sidebar"
    >
      {/* Logo */}
      <div className="h-16 px-5 flex items-center border-b border-gray-100 dark:border-slate-800 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-500 to-emerald-400 flex items-center justify-center shadow-sm shadow-brand-500/30 shrink-0">
            <span className="text-white font-bold text-sm tracking-tighter" aria-hidden="true">SW</span>
          </div>
          <span className="text-base font-bold text-gray-900 dark:text-white tracking-tight">
            SWCMAS
          </span>
        </div>
      </div>

      {/* Navigation */}
      <nav
        role="navigation"
        aria-label="Main navigation"
        className="flex-1 overflow-y-auto py-4 px-3 scrollbar-hide space-y-0"
      >
        {groups.map((group) => (
          <div key={group.label} className="mb-4">
            {/* Section label — hidden from screen (aria-hidden) but visually distinct */}
            <p className="nav-group-label" aria-hidden="true">{group.label}</p>
            <ul role="list" className="space-y-0.5">
              {group.items.map((item) => (
                <li key={item.to}>
                  <NavItem to={item.to} label={item.label} icon={item.icon} />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      {/* AI Badge Footer */}
      <div className="p-4 border-t border-gray-100 dark:border-slate-800 shrink-0">
        <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-brand-50 dark:bg-brand-500/10 border border-brand-100 dark:border-brand-500/20">
          <Activity className="w-4 h-4 text-brand-600 dark:text-brand-400 shrink-0" aria-hidden="true" />
          <div className="min-w-0">
            <p className="text-xs font-semibold text-brand-700 dark:text-brand-400 truncate">AI-Powered</p>
            <p className="text-xs text-brand-600/70 dark:text-brand-500 truncate">Compliance & Monitoring</p>
          </div>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
