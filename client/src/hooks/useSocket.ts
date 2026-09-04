import { useSocketContext } from '../context/SocketContext';

export function useSocket() {
  const { socket, isConnected } = useSocketContext();
  return { socket, isConnected };
}
