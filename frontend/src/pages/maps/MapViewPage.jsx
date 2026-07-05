import React, { useEffect, useState, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import axios from '@/api/axios.js';
import { getSensorHealth } from '@/api/sensors.api.js';
import L from 'leaflet';
import 'leaflet.heat';
import MapControls from '@/components/ui/MapControls.jsx';
import MapLegend from '@/components/ui/MapLegend.jsx';
import Badge from '@/components/ui/Badge.jsx';
import LoadingSpinner from '@/components/ui/LoadingSpinner.jsx';
import { AlertTriangle, Building2, MapPin, Truck } from 'lucide-react';
import { useSocket } from '@/context/SocketContext.jsx';

// Fix default icon issue with Leaflet in Webpack/Vite
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: new URL('leaflet/dist/images/marker-icon-2x.png', import.meta.url).href,
  iconUrl: new URL('leaflet/dist/images/marker-icon.png', import.meta.url).href,
  shadowUrl: new URL('leaflet/dist/images/marker-shadow.png', import.meta.url).href,
});

// Custom Icons
const createCustomIcon = (color) => {
  return new L.Icon({
    iconUrl: `https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-${color}.png`,
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
  });
};

const blueIcon = createCustomIcon('blue');
const redIcon = createCustomIcon('red');
const orangeIcon = createCustomIcon('orange');
const yellowIcon = createCustomIcon('yellow');
const greenIcon = createCustomIcon('green');
const greyIcon = createCustomIcon('grey');

// Heatmap Layer Component
const HeatmapLayer = ({ points }) => {
  const map = useMap();
  useEffect(() => {
    if (!points || !points.length) return;
    
    // Leaflet heat expects [lat, lng, intensity]
    const heatData = points.map(p => [
      p.geometry.coordinates[1], 
      p.geometry.coordinates[0], 
      p.properties.weight || 1
    ]);
    
    const heatLayer = L.heatLayer(heatData, {
      radius: 25,
      blur: 15,
      maxZoom: 15,
      max: 1.0,
      gradient: { 0.4: 'blue', 0.6: 'lime', 1: 'red' }
    });
    
    heatLayer.addTo(map);
    return () => {
      map.removeLayer(heatLayer);
    };
  }, [map, points]);
  return null;
};

const MapViewPage = () => {
  const [activeLayer, setActiveLayer] = useState('apartments');
  const [geoData, setGeoData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [liveTrucks, setLiveTrucks] = useState({});
  const [sensorHealth, setSensorHealth] = useState({});
  const { socket } = useSocket();

  useEffect(() => {
    const fetchHealth = async () => {
      try {
        const res = await getSensorHealth();
        const healthMap = {};
        if (res.data?.data) {
          res.data.data.forEach(h => {
             healthMap[h.apartmentId] = h;
          });
        }
        setSensorHealth(healthMap);
      } catch (err) {
        console.error('Failed to load sensor health:', err);
      }
    };
    fetchHealth();
  }, []);

  useEffect(() => {
    const fetchGeo = async () => {
      try {
        setLoading(true);
        const { data } = await axios.get(`/maps/${activeLayer}`);
        setGeoData(data.data);
      } catch (err) {
        setError(err?.response?.data?.message || 'Failed to load map data');
      } finally {
        setLoading(false);
      }
    };
    fetchGeo();
  }, [activeLayer]);

  useEffect(() => {
    if (socket) {
      socket.on('live_truck_update', (data) => {
        setLiveTrucks((prev) => ({
          ...prev,
          [data.collectorId]: data
        }));
      });
    }
  }, [socket]);

  const features = geoData?.features || [];
  
  // Center map on first feature or default to Nairobi
  const center = features.length > 0 
    ? [features[0].geometry.coordinates[1], features[0].geometry.coordinates[0]] 
    : [-1.2921, 36.8219];

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight flex items-center gap-2">
          <MapPin className="w-6 h-6 text-brand-500" /> Geospatial Insights
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Visualize property locations, violations, and complaint hotspots.</p>
      </div>

      <div className="flex-1 glass-panel rounded-2xl overflow-hidden relative border border-gray-200 dark:border-slate-700 shadow-xl">
        {loading && (
          <div className="absolute inset-0 z-[2000] flex items-center justify-center bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm">
            <LoadingSpinner size="lg" />
          </div>
        )}
        
        {error && (
          <div className="absolute inset-0 z-[2000] flex items-center justify-center bg-white dark:bg-slate-900">
            <div className="text-center">
              <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Failed to load map data</h3>
              <p className="text-sm text-gray-500">{error}</p>
            </div>
          </div>
        )}

        <MapControls activeLayer={activeLayer} setActiveLayer={setActiveLayer} />
        <MapLegend activeLayer={activeLayer} />

        <MapContainer center={center} zoom={13} style={{ height: '100%', width: '100%' }} zoomControl={false}>
          <TileLayer
            attribution="&copy; OpenStreetMap contributors"
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            className="map-tiles"
          />
          
          {/* Custom position for zoom control could be added here */}

          {activeLayer === 'heatmap' && <HeatmapLayer points={features} />}

          {activeLayer !== 'heatmap' && features.map((feature, idx) => {
            const [lng, lat] = feature.geometry.coordinates;
            
            // Determine icon based on layer and properties
            let icon = blueIcon;
            let fillLevel = null;
            if (activeLayer === 'violations') {
              const priority = feature.properties.priority;
              icon = (priority === 'critical' || priority === 'high') ? redIcon 
                   : (priority === 'medium') ? orangeIcon 
                   : yellowIcon;
            } else if (activeLayer === 'apartments') {
              const aptId = feature.properties._id || feature.properties.id;
              const health = sensorHealth[aptId];
              if (health && health.fillLevelPercent != null) {
                fillLevel = health.fillLevelPercent;
                if (fillLevel > 70) icon = redIcon;
                else if (fillLevel >= 30) icon = orangeIcon;
                else icon = greenIcon;
              } else {
                icon = greyIcon;
              }
            }

            return (
              <Marker key={`${feature.properties.id || idx}`} position={[lat, lng]} icon={icon}>
                <Popup className="custom-popup">
                  <div className="p-1 min-w-[200px]">
                    <h3 className="font-bold text-gray-900 mb-1">{feature.properties.name || feature.properties.title}</h3>
                    
                    {activeLayer === 'apartments' && (
                      <div className="text-sm text-gray-600">
                        <p className="flex items-center gap-1 mb-1"><MapPin className="w-3 h-3"/> {feature.properties.address}</p>
                        <p className="flex items-center gap-1"><Building2 className="w-3 h-3"/> {feature.properties.unitCount} Units</p>
                        <div className="mt-2 pt-2 border-t border-gray-100">
                          {fillLevel != null ? (
                            <p className="font-medium text-gray-900">Bin Fill Level: {Math.round(fillLevel)}%</p>
                          ) : (
                            <p className="text-xs text-gray-500">No Sensor Data</p>
                          )}
                        </div>
                      </div>
                    )}

                    {activeLayer === 'violations' && (
                      <div className="text-sm space-y-2 mt-2">
                        <div className="flex justify-between items-center">
                          <span className="text-gray-500">Type:</span>
                          <span className="font-medium capitalize">{feature.properties.type?.replace('_', ' ')}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-gray-500">Status:</span>
                          <span className="font-medium capitalize">{feature.properties.status?.replace('_', ' ')}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-gray-500">Priority:</span>
                          <span className="font-medium capitalize">{feature.properties.priority}</span>
                        </div>
                      </div>
                    )}
                  </div>
                </Popup>
              </Marker>
            );
          })}

          {/* Render Live Trucks */}
          {Object.values(liveTrucks).map((truck) => (
            <Marker key={`truck-${truck.collectorId}`} position={[truck.lat, truck.lng]} icon={greenIcon}>
              <Popup className="custom-popup">
                <div className="p-1 min-w-[150px]">
                  <h3 className="font-bold text-gray-900 mb-1 flex items-center gap-1">
                    <Truck className="w-4 h-4 text-green-600" /> Live Truck
                  </h3>
                  <div className="text-sm text-gray-600 space-y-1">
                    <p><strong>Collector:</strong> {truck.collectorName}</p>
                    <p className="text-xs text-gray-400">Last updated: {new Date(truck.timestamp).toLocaleTimeString()}</p>
                  </div>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>
      
      {/* Dark mode styles for map */}
      <style>{`
        .dark .map-tiles {
          filter: brightness(0.6) invert(1) contrast(3) hue-rotate(200deg) saturate(0.3) brightness(0.7);
        }
        .leaflet-container {
          background-color: var(--bg-main) !important;
          font-family: 'Inter', sans-serif !important;
        }
        .leaflet-popup-content-wrapper {
          border-radius: 12px;
          box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1);
        }
      `}</style>
    </div>
  );
};

export default MapViewPage;
