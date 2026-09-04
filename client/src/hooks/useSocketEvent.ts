import { useEffect } from 'react';
import { useSocket } from './useSocket';
import { ServerToClientEvents } from '../types/socket';

export function useSocketEvent<K extends keyof ServerToClientEvents>(
  event: K,
  callback: ServerToClientEvents[K] | undefined
) {
  const { socket } = useSocket();

  useEffect(() => {
    if (!socket || !callback) return;

    socket.on(event, callback as any);

    return () => {
      socket.off(event, callback as any);
    };
  }, [socket, event, callback]);
}
