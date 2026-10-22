import React, { createContext, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from './AuthContext';
import { ServerToClientEvents, ClientToServerEvents } from '../types/socket';
import { API_BASE_URL } from '../config/api';

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
  // Track the current socket instance for cleanup without stale closure issues
  const socketRef = useRef<BloodLinkSocket | null>(null);

  useEffect(() => {
    // Only open a socket when the user is authenticated.
    // Before login (token === null) we skip entirely — no guest connection,
    // no false "Online" indicator before credentials are available.
    if (!token || !user) {
      // Tear down any existing connection from a previous login session.
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
        setSocket(null);
        setIsConnected(false);
      }
      return;
    }

    const socketUrl = import.meta.env.VITE_SOCKET_URL || API_BASE_URL;

    const newSocket: BloodLinkSocket = io(socketUrl, {
      auth: {
        token,
      },
      // Start with polling for reliability; upgrade to WebSocket when possible.
      transports: ['polling', 'websocket'],
      upgrade: true,
      // Reconnect automatically with exponential back-off — no error shown to user.
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 15000,
      autoConnect: true,
    });

    newSocket.on('connect', () => {
      setIsConnected(true);
      console.debug('[Socket.IO] Connected as', user.role);
    });

    newSocket.on('disconnect', (reason) => {
      setIsConnected(false);
      console.debug('[Socket.IO] Disconnected:', reason);
      // Socket.IO will auto-reconnect unless the server intentionally closes the
      // connection (e.g. 'io server disconnect'). No user-visible error is shown.
    });

    newSocket.on('connect_error', (err) => {
      // Log internally only — never expose raw socket errors to the user.
      console.debug('[Socket.IO] Connection error (will retry):', err.message);
      setIsConnected(false);
    });

    socketRef.current = newSocket;
    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
      socketRef.current = null;
    };
  }, [token, user]); // Re-run whenever auth state changes

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
