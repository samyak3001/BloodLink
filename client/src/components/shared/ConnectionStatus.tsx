import React from 'react';
import { useSocket } from '../../hooks/useSocket';

/**
 * ConnectionStatus — intentionally renders nothing to end users.
 *
 * The raw Socket.IO connection state ("Online / Offline") is a technical
 * implementation detail that must NOT be shown in the donor or hospital UI.
 * Socket.IO is still fully operational internally; only the visual indicator
 * is suppressed here.
 *
 * If a visible live-updates indicator is ever needed in the future, add it
 * here — but never expose the raw socket transport status to users.
 */
export const ConnectionStatus: React.FC = () => {
  // Keep the hook call so that the component remains a valid consumer of
  // SocketContext and tree-shaking doesn't remove SocketProvider unnecessarily.
  useSocket();

  // Return null — no UI element rendered.
  return null;
};
