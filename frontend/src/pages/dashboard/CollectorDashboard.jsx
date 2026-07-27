import React, { useEffect, useState, useRef } from 'react';
import { getCollectorStats } from '@/api/dashboard.api.js';
import StatCard from '@/components/ui/StatCard.jsx';
import DataTable from '@/components/ui/DataTable.jsx';
import Badge from '@/components/ui/Badge.jsx';
import LoadingSpinner from '@/components/ui/LoadingSpinner.jsx';
import EmptyState from '@/components/ui/EmptyState.jsx';
import TrustScoreGauge from '@/components/ui/TrustScoreGauge.jsx';
import FieldOpsWizard from './FieldOpsWizard.jsx';
import { Map as MapIcon, CheckCircle, ListTodo, Star, PlayCircle } from 'lucide-react';
import { useSocket } from '@/context/SocketContext.jsx';
import { useAuth } from '@/context/AuthContext.jsx';

const CollectorDashboard = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeWizard, setActiveWizard] = useState(null);
  const { socket } = useSocket();
  const { user } = useAuth();
  
  const [optimizing, setOptimizing] = useState(false);

  const fetchStats = async () => {
    try {
      const data = await getCollectorStats();
      setStats(data);
    } catch (e) {
      setError(e?.response?.data?.message || 'Failed to load dashboard stats');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();

    // Start live tracking emission
    if (!navigator.geolocation) return;
    const locationInterval = setInterval(() => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          if (socket) {
            socket.emit('truck_location_update', {
              collectorId: user?._id,
              collectorName: `${user?.firstName} ${user?.lastName}`,
              lat: position.coords.latitude,
              lng: position.coords.longitude,
              timestamp: new Date().toISOString()
            });
          }
        },
        (err) => console.log('Live tracking GPS error:', err),
        { enableHighAccuracy: false, maximumAge: 10000, timeout: 5000 }
      );
    }, 15000); // Emit every 15 seconds for testing purposes

    return () => clearInterval(locationInterval);
  }, [socket, user]);

  // Haversine distance helper
  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371; // Radius of the earth in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2); 
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
    return R * c; // Distance in km
  };

  const handleOptimizeRoute = () => {
    setOptimizing(true);
    if (!navigator.geolocation) {
      import('react-hot-toast').then(({ default: toast }) => toast.error('Geolocation is not supported by your browser'));
      setOptimizing(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude: lat, longitude: lng } = position.coords;
        
        // Nearest-Neighbor TSP
        let unvisited = [...(stats.todayAssignments || [])];
        const optimized = [];
        let currentLoc = { lat, lng };

        while (unvisited.length > 0) {
          let nearestIdx = 0;
          let minDistance = Infinity;

          for (let i = 0; i < unvisited.length; i++) {
            const aptCoords = unvisited[i].apartment?.location?.coordinates;
            if (!aptCoords) continue;
            
            // Note: MongoDB GeoJSON coordinates are [longitude, latitude]
            const dist = calculateDistance(currentLoc.lat, currentLoc.lng, aptCoords[1], aptCoords[0]);
            if (dist < minDistance) {
              minDistance = dist;
              nearestIdx = i;
            }
          }

          const nearest = unvisited.splice(nearestIdx, 1)[0];
          optimized.push(nearest);
          
          if (nearest.apartment?.location?.coordinates) {
            currentLoc = {
              lat: nearest.apartment.location.coordinates[1],
              lng: nearest.apartment.location.coordinates[0]
            };
          }
        }

        setStats(prev => ({ ...prev, todayAssignments: optimized }));
        import('react-hot-toast').then(({ default: toast }) => toast.success('Route optimized based on your current location!'));
        setOptimizing(false);
      },
      (err) => {
        import('react-hot-toast').then(({ default: toast }) => toast.error('Failed to get location for optimization.'));
        setOptimizing(false);
      }
    );
  };

  if (loading) return <div className="h-full flex items-center justify-center"><LoadingSpinner size="lg" /></div>;
  if (error) return <EmptyState title="Error Loading Dashboard" message={error} icon={MapIcon} />;
  if (!stats) return null;

  const handleWizardComplete = () => {
    setActiveWizard(null);
    setLoading(true);
    fetchStats();
  };

  const todayCols = [
    { header: 'Property', accessor: 'apartment', render: (row) => row.apartment?.name },
    { header: 'Address', accessor: 'address', render: (row) => row.apartment?.address },
    { header: 'Time', accessor: 'scheduledDate', render: (row) => {
        const d = new Date(row.scheduledDate);
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }},
    { header: 'Status', accessor: 'status', render: (row) => (
      <Badge variant={row.status === 'completed' ? 'success' : row.status === 'in_progress' ? 'info' : 'default'}>
        {row.status.replace('_', ' ')}
      </Badge>
    )},
    { header: 'Action', accessor: 'actions', render: (row) => (
      row.status === 'scheduled' || row.status === 'in_progress' ? (
        <button 
          onClick={() => setActiveWizard(row)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-600 hover:bg-brand-700 text-white rounded-lg transition-colors text-sm font-medium whitespace-nowrap shadow-sm"
        >
          <PlayCircle className="w-4 h-4" /> Start Route
        </button>
      ) : (
        <span className="text-sm text-gray-400 font-medium px-3">Completed</span>
      )
    )}
  ];

  return (
    <div className="space-y-6">
      {activeWizard && (
        <FieldOpsWizard 
          collection={activeWizard} 
          onClose={() => setActiveWizard(null)} 
          onComplete={handleWizardComplete} 
        />
      )}

      <div>
        <h2 className="page-title">Collector Dashboard</h2>
        <p className="page-subtitle">Your assigned routes and performance metrics</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Assigned" value={stats.assignedCount} icon={ListTodo} variant="blue" />
        <StatCard title="Completed" value={stats.completedCount} icon={CheckCircle} variant="green" />
        <StatCard title="Verified" value={stats.verifiedCount} icon={Star} variant="brand" />
        <StatCard title="Today's Routes" value={stats.todayAssignments?.length || 0} icon={MapIcon} variant="purple" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 glass-panel p-6 rounded-2xl">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Today's Schedule</h3>
            <div className="flex items-center gap-2">
              <button 
                onClick={handleOptimizeRoute}
                disabled={optimizing || !stats.todayAssignments?.length}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-100 hover:bg-brand-200 text-brand-700 dark:bg-brand-500/20 dark:text-brand-300 dark:hover:bg-brand-500/30 rounded-lg transition-colors text-sm font-medium"
              >
                <MapIcon className="w-4 h-4" /> {optimizing ? 'Optimizing...' : 'Optimize Route'}
              </button>
              <Badge variant="info">{stats.todayAssignments?.length || 0} stops</Badge>
            </div>
          </div>
          <DataTable 
            columns={todayCols} 
            data={stats.todayAssignments || []} 
            keyField="_id"
            emptyMessage="No collections scheduled for today."
          />
        </div>

        <div className="space-y-6">
          <TrustScoreGauge score={stats.avgScore} title="Average Verification Score" />
          
          <div className="glass-panel p-6 rounded-2xl">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Recent Activity</h3>
            <div className="space-y-4">
              {stats.recentCollections?.length === 0 ? (
                 <p className="text-sm text-gray-500 text-center py-4">No recent activity.</p>
              ) : (
                stats.recentCollections?.map((col) => (
                  <div key={col._id} className="flex justify-between items-center pb-2 border-b border-gray-100 dark:border-slate-800 last:border-0">
                    <div className="flex flex-col">
                      <span className="text-sm font-medium text-gray-900 dark:text-white">{col.apartment?.name}</span>
                      <span className="text-xs text-gray-500">{new Date(col.completedAt || col.updatedAt).toLocaleDateString()}</span>
                    </div>
                    <Badge variant={col.verificationStatus === 'verified' ? 'success' : 'default'}>
                      {col.verificationStatus || 'Pending'}
                    </Badge>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CollectorDashboard;
