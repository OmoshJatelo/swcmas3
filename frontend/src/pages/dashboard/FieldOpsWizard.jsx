import React, { useState, useEffect } from 'react';
import { MapPin, CheckCircle, ArrowRight, X, Activity } from 'lucide-react';
import toast from 'react-hot-toast';
import { startCollection, completeCollection } from '@/api/collections.api.js';
import { getLatestSensorReading } from '@/api/sensors.api.js';
import LoadingSpinner from '@/components/ui/LoadingSpinner.jsx';
import Badge from '@/components/ui/Badge.jsx';

const FieldOpsWizard = ({ collection, onClose, onComplete }) => {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  
  const [location, setLocation] = useState(null);
  
  const [sensorReading, setSensorReading] = useState(null);
  const [sensorLoading, setSensorLoading] = useState(true);

  useEffect(() => {
    const fetchSensor = async () => {
      try {
        const res = await getLatestSensorReading(collection.apartment._id);
        setSensorReading(res.data?.data);
      } catch (e) {
        console.error(e);
      } finally {
        setSensorLoading(false);
      }
    };
    if (collection.apartment?._id) {
      fetchSensor();
    }
  }, [collection.apartment]);

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
    if (!location) return toast.error('Please verify location first');
    
    setLoading(true);
    try {
      await startCollection(collection._id, { startLocation: location });
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
    try {
      // Get current location for endLocation
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

      await completeCollection(collection._id, { endLocation: endLoc });
      toast.success('Collection completed successfully!');
      onComplete();
    } catch (e) {
      toast.error(e?.response?.data?.message || 'Failed to complete collection');
    } finally {
      setLoading(false);
    }
  };

  const renderFillGauge = () => {
    if (sensorLoading) return <div className="flex justify-center p-4"><LoadingSpinner size="sm" /></div>;
    if (!sensorReading || sensorReading.fillLevelPercent === null || sensorReading.status === 'no_data') {
      return (
        <div className="flex flex-col items-center justify-center p-4 bg-red-50 dark:bg-red-500/10 rounded-xl mb-6 border border-red-200 dark:border-red-500/20">
          <Activity className="w-8 h-8 text-red-500 mb-2 opacity-50" />
          <span className="text-red-600 dark:text-red-400 font-medium">No sensor data — contact admin</span>
        </div>
      );
    }

    const fill = sensorReading.fillLevelPercent;
    let colorClass = 'bg-emerald-500';
    let badgeColor = 'success';
    if (fill > 70) {
      colorClass = 'bg-red-500';
      badgeColor = 'danger';
    } else if (fill >= 30) {
      colorClass = 'bg-amber-500';
      badgeColor = 'warning';
    }

    return (
      <div className="flex flex-col items-center p-6 bg-gray-50 dark:bg-slate-800 rounded-2xl mb-6 border border-gray-200 dark:border-slate-700">
        <div className="flex items-center gap-2 mb-4">
          <Activity className="w-5 h-5 text-gray-400" />
          <h4 className="text-sm font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Live Sensor Data</h4>
        </div>
        
        <div className="w-full bg-gray-200 dark:bg-slate-700 rounded-full h-8 mb-3 overflow-hidden relative shadow-inner">
          <div className={`${colorClass} h-full transition-all duration-1000 ease-out`} style={{ width: `${Math.max(5, fill)}%` }}></div>
          <span className="absolute inset-0 flex items-center justify-center text-sm font-extrabold text-white drop-shadow-md">
            {Math.round(fill)}% Full
          </span>
        </div>
        
        <div className="flex justify-between w-full text-xs text-gray-500 font-medium">
          <span>Empty</span>
          {sensorReading.recordedAt && (
            <span>Updated: {new Date(sensorReading.recordedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          )}
          <span>Full</span>
        </div>
        
        <div className="mt-4">
          <Badge variant={badgeColor}>
            {fill < 30 ? 'Low Volume' : fill > 70 ? 'Critical Volume' : 'Moderate Volume'}
          </Badge>
        </div>
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
              <p className="text-gray-500 dark:text-gray-400 mb-6 text-sm px-4">Ensure the bins are emptied. The sensors will verify the collection drop automatically.</p>
              
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
      </div>
    </div>
  );
};

export default FieldOpsWizard;
