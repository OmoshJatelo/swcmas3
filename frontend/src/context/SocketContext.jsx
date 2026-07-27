import React, { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext.jsx';
import toast from 'react-hot-toast';

const SocketContext = createContext(null);

export const SocketProvider = ({ children }) => {
  const { user, accessToken: token } = useAuth();
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    if (user && token) {
      const rawUrl = import.meta.env.VITE_BACKEND_URL || 'https://swcmas3.onrender.com';
      const backendUrl = rawUrl.replace(/\/api\/v1\/?$/, '');
      
      const newSocket = io(backendUrl, {
        auth: {
          token
        }
      });

      setSocket(newSocket);

      newSocket.on('connect', () => {
        console.log('Connected to SWCMAS real-time server');
      });

      // Global Event Listeners
      newSocket.on('new_complaint', (complaint) => {
        toast((t) => (
          <div>
            <b>New Complaint Filed:</b> {complaint.title}
            <div className="text-xs text-gray-500 mt-1">Priority: {complaint.priority || 'pending'}</div>
          </div>
        ), { icon: '🚨' });
      });

      newSocket.on('new_anomaly', (anomaly) => {
        toast((t) => (
          <div>
            <b>AI Anomaly Detected!</b>
            <div className="text-xs text-gray-500 mt-1">{anomaly.description}</div>
          </div>
        ), { icon: '⚠️', duration: 6000 });
      });

      newSocket.on('sensor_reading', (reading) => {
        window.dispatchEvent(new CustomEvent('sensor_reading_update', { detail: reading }));
      });

      return () => {
        newSocket.disconnect();
      };
    }
  }, [user, token]);

  return (
    <SocketContext.Provider value={{ socket }}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => {
  return useContext(SocketContext);
};
