import { useEffect } from 'react';
import { useSocket } from './useSocket';

export function useRequestRoom(requestId: string | undefined) {
  const { socket, isConnected } = useSocket();

  useEffect(() => {
    if (!socket || !isConnected || !requestId) return;

    socket.emit('request:subscribe', requestId);

    return () => {
      socket.emit('request:unsubscribe', requestId);
    };
  }, [socket, isConnected, requestId]);
}
