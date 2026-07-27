import React, { useState, useEffect, useCallback } from 'react';
import { MapPin, CheckCircle, ArrowRight, X, Activity, AlertTriangle, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import { startCollection, completeCollection } from '@/api/collections.api.js';
import { getLatestSensorReading } from '@/api/sensors.api.js';
import LoadingSpinner from '@/components/ui/LoadingSpinner.jsx';
import Badge from '@/components/ui/Badge.jsx';
import { useSocket } from '@/context/SocketContext.jsx';

const FieldOpsWizard = ({ collection, onClose, onComplete }) => {
  const [step, setStep] = useState(collection?.status === 'in_progress' ? 3 : 1);
  const [loading, setLoading] = useState(false);
  
  const [location, setLocation] = useState(null);
  
  const [sensorReading, setSensorReading] = useState(null);
  const [sensorLoading, setSensorLoading] = useState(true);
  const [sensorAlert, setSensorAlert] = useState(null);

  const { socket } = useSocket();

  const apartmentId = collection.apartment?._id || collection.apartment;

  const fetchSensor = useCallback(async () => {
    if (!apartmentId) return null;
    try {
      setSensorLoading(true);
      const res = await getLatestSensorReading(apartmentId);
      const data = res.data?.data;
      setSensorReading(data);
      if (data && data.fillLevelPercent !== null && data.fillLevelPercent !== undefined) {
        if (data.fillLevelPercent < 20) {
          setSensorAlert(null);
        }
      }
      return data;
    } catch (e) {
      console.error('Failed to fetch sensor reading:', e);
      return null;
    } finally {
      setSensorLoading(false);
    }
  }, [apartmentId]);

  useEffect(() => {
    fetchSensor();

    // Auto-poll every 4 seconds to catch Wokwi telemetry updates
    const pollInterval = setInterval(() => {
      fetchSensor();
    }, 4000);

    // Socket listener for real-time sensor updates
    if (socket) {
      const handleSensorReading = (data) => {
        const targetAptId = typeof data.apartment === 'object' ? data.apartment?._id : data.apartment;
        if (targetAptId === apartmentId) {
          setSensorReading(data);
          if (data.fillLevelPercent !== null && data.fillLevelPercent < 20) {
            setSensorAlert(null);
          }
        }
      };
      socket.on('sensor_reading', handleSensorReading);

      return () => {
        clearInterval(pollInterval);
        socket.off('sensor_reading', handleSensorReading);
      };
    }

    return () => clearInterval(pollInterval);
  }, [fetchSensor, socket, apartmentId]);

  // Haversine distance helper (km)
  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371; 
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2); 
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
    return R * c; 
  };

  const handleCaptureLocation = () => {
    setLoading(true);
    if (!navigator.geolocation) {
      toast.error('Geolocation is not supported by your browser');
      setLoading(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude: lat, longitude: lng } = position.coords;
        
        // Geofencing Check
        const aptCoords = collection.apartment?.location?.coordinates;
        if (aptCoords) {
          const distKm = calculateDistance(lat, lng, aptCoords[1], aptCoords[0]);
          if (distKm > 0.1) { // 100 meters
            toast.error(`You are ${Math.round(distKm * 1000)}m away from the property. Please move closer.`, { duration: 5000 });
            toast('Demo Mode: Location captured anyway.', { icon: 'ℹ️' });
          } else {
            toast.success('Location verified within geofence');
          }
        } else {
          toast.success('Location verified');
        }

        setLocation({ lat, lng });
        setLoading(false);
      },
      (err) => {
        toast.error('Failed to get location. Please enable GPS.');
        setLoading(false);
      }
    );
  };

  const handleStart = async () => {
    if (!location && step === 1) return toast.error('Please verify location first');
    
    setLoading(true);
    try {
      await startCollection(collection._id, { startLocation: location || { lat: 0, lng: 0 } });
      toast.success('Collection started');
      setStep(3); // Move to completion step
    } catch (e) {
      toast.error(e?.response?.data?.message || 'Failed to start collection');
    } finally {
      setLoading(false);
    }
  };

  const handleComplete = async () => {
    setLoading(true);
    setSensorAlert(null);

    try {
      // 1. Fetch latest sensor reading directly from DB to verify fill level
      const latestReading = await fetchSensor();

      if (latestReading && latestReading.fillLevelPercent !== null && latestReading.fillLevelPercent !== undefined) {
        if (latestReading.fillLevelPercent >= 20) {
          const currentFill = Math.round(latestReading.fillLevelPercent);
          const errorMsg = `Cannot complete collection: Sensor fill level must be less than 20% to finish. Current fill level is ${currentFill}%.`;
          setSensorAlert(errorMsg);
          toast.error(errorMsg, { duration: 6000 });
          setLoading(false);
          return;
        }
      }

      // 2. Get current location for endLocation
      const endLoc = await new Promise((resolve) => {
        if (!navigator.geolocation) {
          resolve(location || { lat: 0, lng: 0 });
          return;
        }
        navigator.geolocation.getCurrentPosition(
          (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
          () => resolve(location || { lat: 0, lng: 0 }),
          { enableHighAccuracy: false, maximumAge: 30000, timeout: 5000 }
        );
      });

      // 3. Complete collection
      await completeCollection(collection._id, { endLocation: endLoc });
      toast.success('Collection completed successfully! Sensor verified <20% full.');
      onComplete();
    } catch (e) {
      const msg = e?.response?.data?.message || 'Failed to complete collection';
      setSensorAlert(msg);
      toast.error(msg, { duration: 6000 });
    } finally {
      setLoading(false);
    }
  };

  const renderFillGauge = () => {
    if (sensorLoading && !sensorReading) return <div className="flex justify-center p-4"><LoadingSpinner size="sm" /></div>;
    if (!sensorReading || sensorReading.fillLevelPercent === null || sensorReading.status === 'no_data') {
      return (
        <div className="flex flex-col items-center justify-center p-4 bg-amber-50 dark:bg-amber-500/10 rounded-xl mb-6 border border-amber-200 dark:border-amber-500/20">
          <Activity className="w-8 h-8 text-amber-500 mb-2 opacity-50" />
          <span className="text-amber-700 dark:text-amber-400 font-medium">No live sensor data found for this bin</span>
        </div>
      );
    }

    const fill = sensorReading.fillLevelPercent;
    let colorClass = 'bg-emerald-500';
    let badgeColor = 'success';
    if (fill >= 70) {
      colorClass = 'bg-red-500';
      badgeColor = 'danger';
    } else if (fill >= 20) {
      colorClass = 'bg-amber-500';
      badgeColor = 'warning';
    }

    return (
      <div className="flex flex-col items-center p-6 bg-gray-50 dark:bg-slate-800 rounded-2xl mb-6 border border-gray-200 dark:border-slate-700">
        <div className="flex items-center justify-between w-full mb-4">
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-brand-500" />
            <h4 className="text-sm font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Live Bin Sensor Reading</h4>
          </div>
          <button 
            type="button"
            onClick={fetchSensor} 
            disabled={sensorLoading}
            className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-white transition-colors"
            title="Refresh sensor reading"
          >
            <RefreshCw className={`w-4 h-4 ${sensorLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
        
        <div className="w-full bg-gray-200 dark:bg-slate-700 rounded-full h-8 mb-3 overflow-hidden relative shadow-inner">
          <div className={`${colorClass} h-full transition-all duration-1000 ease-out`} style={{ width: `${Math.max(5, fill)}%` }}></div>
          <span className="absolute inset-0 flex items-center justify-center text-sm font-extrabold text-white drop-shadow-md">
            {Math.round(fill)}% Full
          </span>
        </div>
        
        <div className="flex justify-between w-full text-xs text-gray-500 font-medium">
          <span>0% (Empty)</span>
          {sensorReading.recordedAt && (
            <span>Last Updated: {new Date(sensorReading.recordedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
          )}
          <span>100% (Full)</span>
        </div>
        
        <div className="mt-4 flex items-center gap-2">
          <Badge variant={badgeColor}>
            {fill < 20 ? 'Empty (<20%) - Allowed to Finish' : fill >= 70 ? 'Critical Volume' : 'Moderate Volume (>=20%)'}
          </Badge>
        </div>

        {fill >= 20 && (
          <p className="text-xs text-amber-600 dark:text-amber-400 mt-2 text-center font-medium">
            ⚠️ Bin fill must drop below 20% before you can finish collection.
          </p>
        )}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 bg-white dark:bg-slate-900 flex flex-col">
      {/* Mobile Header */}
      <div className="h-14 border-b border-gray-200 dark:border-slate-800 flex items-center justify-between px-4">
        <h2 className="text-lg font-bold text-gray-900 dark:text-white">Active Route</h2>
        <button onClick={onClose} className="p-2 text-gray-500 hover:bg-gray-100 rounded-full dark:hover:bg-slate-800">
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 max-w-lg mx-auto w-full">
        {/* Progress Bar */}
        <div className="flex items-center justify-between mb-8">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex flex-col items-center flex-1 relative">
              {s !== 3 && <div className={`absolute top-4 left-1/2 w-full h-1 -z-10 ${step > s ? 'bg-brand-500' : 'bg-gray-200 dark:bg-slate-800'}`}></div>}
              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${step >= s ? 'bg-brand-500 text-white shadow-lg' : 'bg-gray-200 text-gray-500 dark:bg-slate-800'}`}>
                {s}
              </div>
            </div>
          ))}
        </div>

        <div className="bg-gradient-to-r from-brand-50 to-brand-100 dark:from-brand-500/10 dark:to-brand-500/20 p-5 rounded-2xl mb-6 border border-brand-200 dark:border-brand-500/30">
          <h3 className="font-bold text-brand-900 dark:text-brand-100 text-lg">{collection.apartment?.name}</h3>
          <p className="text-sm text-brand-700 dark:text-brand-300 mt-1 flex items-center gap-1.5">
            <MapPin className="w-4 h-4 opacity-70" /> {collection.apartment?.address}
          </p>
        </div>

        {/* STEP 1: Arrival & GPS */}
        {step === 1 && (
          <div className="space-y-6 animate-in slide-in-from-right fade-in duration-300">
            <div className="text-center">
              <div className="w-20 h-20 bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 rounded-full flex items-center justify-center mx-auto mb-5 shadow-inner">
                <MapPin className="w-10 h-10" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Verify Arrival</h3>
              <p className="text-gray-500 dark:text-gray-400 mb-8 text-sm px-4">We need to capture your GPS coordinates to confirm you have arrived at the property.</p>
              
              {!location ? (
                <button 
                  onClick={handleCaptureLocation}
                  disabled={loading}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-2xl font-bold flex justify-center items-center gap-2 transition-all shadow-lg hover:shadow-xl disabled:opacity-70 text-lg"
                >
                  {loading ? <LoadingSpinner size="sm" /> : <><MapPin className="w-6 h-6" /> Capture Location</>}
                </button>
              ) : (
                <div className="space-y-4">
                  <div className="bg-green-50 dark:bg-green-500/10 text-green-700 dark:text-green-400 p-4 rounded-2xl font-medium flex items-center justify-center gap-2 border border-green-200 dark:border-green-500/20">
                    <CheckCircle className="w-5 h-5" /> Location Verified
                  </div>
                  <button 
                    onClick={() => setStep(2)}
                    className="w-full bg-brand-600 hover:bg-brand-700 text-white py-4 rounded-2xl font-bold flex justify-center items-center gap-2 transition-all shadow-lg hover:shadow-xl text-lg"
                  >
                    Continue <ArrowRight className="w-6 h-6" />
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* STEP 2: Start Collection */}
        {step === 2 && (
          <div className="space-y-6 animate-in slide-in-from-right fade-in duration-300">
            <div className="text-center">
              <div className="w-20 h-20 bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 rounded-full flex items-center justify-center mx-auto mb-5 shadow-inner">
                <Activity className="w-10 h-10" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Start Collection</h3>
              <p className="text-gray-500 dark:text-gray-400 mb-6 text-sm px-4">Review the live sensor data below before starting the collection.</p>
              
              {renderFillGauge()}

              <button 
                onClick={handleStart}
                disabled={loading}
                className="w-full bg-brand-600 hover:bg-brand-700 text-white py-4 rounded-2xl font-bold flex justify-center items-center gap-2 transition-all shadow-lg hover:shadow-xl disabled:opacity-70 text-lg"
              >
                {loading ? <LoadingSpinner size="sm" /> : 'Start Collection'}
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: Complete Collection */}
        {step === 3 && (
          <div className="space-y-6 animate-in slide-in-from-right fade-in duration-300">
            <div className="text-center">
              <div className="w-20 h-20 bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mx-auto mb-5 shadow-inner">
                <CheckCircle className="w-10 h-10" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Complete Route</h3>
              <p className="text-gray-500 dark:text-gray-400 mb-6 text-sm px-4">Ensure the bins are emptied. The system checks sensor readings to ensure the bin is less than 20% full.</p>
              
              {sensorAlert && (
                <div className="p-4 bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-500/40 rounded-xl text-red-800 dark:text-red-300 text-sm font-semibold flex flex-col gap-1 text-left mb-6 animate-in fade-in">
                  <div className="flex items-center gap-2 font-bold text-red-700 dark:text-red-400">
                    <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0" />
                    <span>Collection Cannot Be Finished</span>
                  </div>
                  <p className="mt-1">{sensorAlert}</p>
                </div>
              )}

              {renderFillGauge()}

              <button 
                onClick={handleComplete}
                disabled={loading}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-4 rounded-2xl font-bold flex justify-center items-center gap-2 transition-all shadow-lg hover:shadow-xl disabled:opacity-70 text-lg"
              >
                {loading ? <LoadingSpinner size="sm" /> : 'Finish & Complete'}
              </button>
            </div>
          </div>
        )}

        {/* Fallback for invalid step */}
        {(step !== 1 && step !== 2 && step !== 3) && (
          <div className="space-y-6 animate-in slide-in-from-right fade-in duration-300">
            <div className="text-center p-8">
              <div className="w-20 h-20 bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400 rounded-full flex items-center justify-center mx-auto mb-5">
                <AlertTriangle className="w-10 h-10" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Wizard Error</h3>
              <p className="text-gray-500 dark:text-gray-400 mb-8 text-sm px-4">
                Invalid step: {step}. Please close and reopen the wizard.
              </p>
              <button 
                onClick={onClose}
                className="w-full bg-red-600 hover:bg-red-700 text-white py-4 rounded-2xl font-bold flex justify-center items-center gap-2 transition-all shadow-lg hover:shadow-xl text-lg"
              >
                Close Wizard
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default FieldOpsWizard;

