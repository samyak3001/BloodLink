import React from 'react';
import { Server } from 'lucide-react';
import { useSocket } from '../../hooks/useSocket';

export const ConnectionStatus: React.FC = () => {
  const { isConnected } = useSocket();

  return (
    <div className="flex items-center space-x-1.5 px-3 py-1.5 rounded-full border border-slate-200 bg-slate-50 text-slate-600 text-xs">
      <Server className="h-3.5 w-3.5" />
      <span>Socket:</span>
      {isConnected ? (
        <span className="inline-flex items-center font-semibold text-vitality-600">
          <span className="h-1.5 w-1.5 rounded-full bg-vitality-500 mr-1 animate-pulse" />
          Online
        </span>
      ) : (
        <span className="inline-flex items-center font-semibold text-emergency-600">
          <span className="h-1.5 w-1.5 rounded-full bg-emergency-500 mr-1" />
          Offline
        </span>
      )}
    </div>
  );
};
