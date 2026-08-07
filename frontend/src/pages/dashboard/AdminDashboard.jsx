import React, { useEffect, useState, useCallback, memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAdminStats } from '@/api/dashboard.api.js';
import { getSensorHealth } from '@/api/sensors.api.js';
import StatCard from '@/components/ui/StatCard.jsx';
import { SkeletonStatCard, SkeletonProgressCard } from '@/components/ui/SkeletonLoader.jsx';
import LineChartCard from '@/components/ui/LineChartCard.jsx';
import DataTable from '@/components/ui/DataTable.jsx';
import Badge from '@/components/ui/Badge.jsx';
import EmptyState from '@/components/ui/EmptyState.jsx';
import TrustScoreGauge from '@/components/ui/TrustScoreGauge.jsx';
import { Users, Building2, Truck, FileWarning, AlertTriangle, Activity, CheckCircle, Wifi, WifiOff } from 'lucide-react';

/* ─────────────────────────────────────────────────────────
   Anomaly table column definitions
───────────────────────────────────────────────────────── */
const anomalyCols = [
  {
    header: 'Type',
    accessor: 'type',
    render: (row) => (
      <span className="font-medium capitalize text-gray-800 dark:text-gray-200">
        {row.type.replace(/_/g, ' ')}
      </span>
    ),
  },
  {
    header: 'Entity',
    accessor: 'entity',
    render: (row) => (
      <span className="text-gray-600 dark:text-gray-400">
        {row.apartment?.name || row.description?.split(' ').slice(0, 4).join(' ') || 'Unknown'}
      </span>
    ),
  },
  {
    header: 'Severity',
    accessor: 'severity',
    render: (row) => (
      <Badge
        dot
        variant={
          row.severity === 'critical' ? 'danger' :
          row.severity === 'high' ? 'danger' :
          row.severity === 'medium' ? 'warning' : 'info'
        }
      >
        {row.severity}
      </Badge>
    ),
  },
  {
    header: 'Date',
    accessor: 'createdAt',
    render: (row) => (
      <span className="text-gray-500 dark:text-gray-400 text-xs">
        {new Date(row.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
      </span>
    ),
  },
];

/* ─────────────────────────────────────────────────────────
   Sensor Health card — inline mini component
───────────────────────────────────────────────────────── */
const SensorHealthCard = memo(({ health, className = '' }) => {
  const onlinePct = health.total > 0 ? Math.round((health.online / health.total) * 100) : 0;

  return (
    <div className={`glass-panel p-5 rounded-2xl transition-all duration-200 hover:shadow-xl hover:-translate-y-1 ${className}`}>
      <div className="flex items-start justify-between mb-4">
        <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Sensor Health</p>
        <div className="p-2.5 rounded-xl bg-blue-50 dark:bg-blue-500/10">
          <Activity className="w-5 h-5 text-blue-600 dark:text-blue-400" aria-hidden="true" />
        </div>
      </div>

      <p className="text-4xl font-extrabold text-gray-900 dark:text-white tracking-tight tabular-nums">
        {health.total}
      </p>
      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Total sensors</p>

      <div className="mt-4 flex items-center gap-3">
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
          <Wifi className="w-3 h-3" aria-hidden="true" />
          {health.online} Online
        </span>
        {health.offline > 0 && (
          <a
            href="/anomalies?type=no_sensor_data"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-500 hover:text-red-600 hover:underline transition-colors"
            aria-label={`${health.offline} sensors offline — view anomalies`}
          >
            <WifiOff className="w-3 h-3" aria-hidden="true" />
            {health.offline} Offline
          </a>
        )}
      </div>
    </div>
  );
});
SensorHealthCard.displayName = 'SensorHealthCard';

/* ─────────────────────────────────────────────────────────
   Quick Stats row — secondary metrics
───────────────────────────────────────────────────────── */
const QuickStatsPanel = memo(({ stats }) => {
  const rows = [
    { label: 'Verified Collections', value: stats.verifiedCollections, color: 'text-emerald-600 dark:text-emerald-400' },
    { label: 'Completed Collections', value: stats.completedCollections, color: 'text-gray-900 dark:text-white' },
    { label: 'Open Complaints', value: stats.complaintCount - (stats.resolvedComplaints || 0), color: 'text-amber-600 dark:text-amber-400' },
  ];

  return (
    <div className="glass-panel p-5 rounded-2xl">
      <h3 className="section-title mb-4">Quick Stats</h3>
      <ul className="divide-y divide-gray-100 dark:divide-slate-800" role="list">
        {rows.map(({ label, value, color }) => (
          <li
            key={label}
            className="flex justify-between items-center py-3 first:pt-0 last:pb-0"
          >
            <span className="text-sm text-gray-500 dark:text-gray-400">{label}</span>
            <span className={`text-lg font-bold tabular-nums ${color}`}>{value ?? '—'}</span>
          </li>
        ))}
      </ul>
    </div>
  );
});
QuickStatsPanel.displayName = 'QuickStatsPanel';

/* ─────────────────────────────────────────────────────────
   AdminDashboard
───────────────────────────────────────────────────────── */
const AdminDashboard = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sensorHealth, setSensorHealth] = useState({ total: 0, online: 0, offline: 0 });

  const fetchStats = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getAdminStats();
      setStats(data);
    } catch (e) {
      setError(e?.response?.data?.message || 'Failed to load dashboard stats');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();

    const fetchHealth = async () => {
      try {
        const res = await getSensorHealth();
        const healthData = res.data?.data || [];
        const online = healthData.filter((h) => h.status === 'online').length;
        const offline = healthData.filter((h) => h.status === 'offline').length;
        setSensorHealth({ total: healthData.length, online, offline });
      } catch (e) {
        console.error('Sensor health fetch error:', e);
      }
    };
    fetchHealth();
  }, [fetchStats]);

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="page-title">System Overview</h2>
          <p className="page-subtitle">County-wide waste management performance</p>
        </div>
        <EmptyState
          title="Error Loading Dashboard"
          message={error}
          icon={AlertTriangle}
          onRetry={fetchStats}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-6">
      {/* Page header */}
      <div>
        <h2 className="page-title">System Overview</h2>
        <p className="page-subtitle">County-wide waste management performance</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {loading ? (
          Array.from({ length: 5 }).map((_, i) => <SkeletonStatCard key={i} />)
        ) : (
          <>
            <StatCard
              title="Total Users"
              value={stats.userCount}
              icon={Users}
              variant="blue"
              subtitle="Registered accounts"
              className="animate-pop-in stagger-1"
            />
            <StatCard
              title="Registered Properties"
              value={stats.apartmentCount}
              icon={Building2}
              variant="purple"
              subtitle="Active landlords"
              className="animate-pop-in stagger-2"
            />
            <StatCard
              title="Total Collections"
              value={stats.collectionCount}
              icon={Truck}
              variant="green"
              subtitle="All time"
              className="animate-pop-in stagger-3"
            />
            <StatCard
              title="Total Complaints"
              value={stats.complaintCount}
              icon={FileWarning}
              variant="amber"
              subtitle="Filed by residents"
              className="animate-pop-in stagger-4"
            />
            <SensorHealthCard health={sensorHealth} className="animate-pop-in stagger-5" />
          </>
        )}
      </div>

      {/* Main content grid */}
      {!loading && stats && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Left column — chart + anomaly table */}
          <div className="lg:col-span-2 space-y-4">
            <LineChartCard
              title="30-Day Activity Trends"
              subtitle="Collections vs. complaints over the past month"
              data={
                stats.collectionTrend?.map((ct, i) => ({
                  date: new Date(ct.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
                  collections: ct.count,
                  complaints: stats.complaintTrend?.[i]?.count || 0,
                })) || []
              }
              xAxisKey="date"
              lines={[
                { dataKey: 'collections', stroke: '#10b981', label: 'Collections' },
                { dataKey: 'complaints', stroke: '#f59e0b', label: 'Complaints' },
              ]}
            />

            {/* Anomaly table */}
            <div className="glass-panel p-5 rounded-2xl">
              <div className="flex items-center justify-between mb-5">
                <h3 className="section-title">Active Anomalies</h3>
                <Badge variant={stats.recentAnomalies?.length > 0 ? 'warning' : 'default'} dot>
                  {stats.recentAnomalies?.length || 0} alerts
                </Badge>
              </div>
              <DataTable
                columns={anomalyCols}
                data={stats.recentAnomalies || []}
                keyField="_id"
                emptyMessage="No active anomalies detected."
                onRowClick={(row) => navigate('/anomalies')}
                aria-label="Active anomalies"
              />
            </div>
          </div>

          {/* Right column — scores + quick stats */}
          <div className="space-y-4">
            {loading ? (
              <>
                <SkeletonProgressCard />
                <SkeletonProgressCard />
              </>
            ) : (
              <>
                <TrustScoreGauge score={stats.complianceRate} title="Overall Compliance Rate" />
                <TrustScoreGauge score={stats.resolutionRate} title="Complaint Resolution Rate" />
                <QuickStatsPanel stats={stats} />
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
