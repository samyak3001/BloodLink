import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from './AuthContext';
import { ServerToClientEvents, ClientToServerEvents } from '../types/socket';

type BloodLinkSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

interface SocketContextType {
  socket: BloodLinkSocket | null;
  isConnected: boolean;
}

const SocketContext = createContext<SocketContextType | undefined>(undefined);

export const SocketProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { token, user } = useAuth();
  const [socket, setSocket] = useState<BloodLinkSocket | null>(null);
  const [isConnected, setIsConnected] = useState<boolean>(false);

  useEffect(() => {
    const socketUrl = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';
    
    const newSocket: BloodLinkSocket = io(socketUrl, {
      auth: {
        token: token || undefined
      },
      transports: ['websocket', 'polling'],
      autoConnect: true
    });

    newSocket.on('connect', () => {
      setIsConnected(true);
      console.log('[Socket.IO] Connected');
    });

    newSocket.on('disconnect', () => {
      setIsConnected(false);
      console.log('[Socket.IO] Disconnected');
    });

    newSocket.on('connect_error', (err) => {
      console.error('[Socket.IO] Connection error:', err.message);
      setIsConnected(false);
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, [token, user]); // Reconnect if token or user changes

  return (
    <SocketContext.Provider value={{ socket, isConnected }}>
      {children}
    </SocketContext.Provider>
  );
};

export function useSocketContext(): SocketContextType {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocketContext must be used within a SocketProvider');
  }
  return context;
}
