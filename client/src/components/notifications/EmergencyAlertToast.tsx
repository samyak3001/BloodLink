import React, { useEffect, useState } from 'react';
import { useNotifications } from '../../hooks/useNotifications';
import { ShieldAlert, X, MapPin, Clock } from 'lucide-react';
import { EmergencyAlertPayload } from '../../types/socket';

export const EmergencyAlertToast: React.FC = () => {
  const { latestEmergencyAlert, clearEmergencyAlert } = useNotifications();
  const [isVisible, setIsVisible] = useState(false);
  const [alert, setAlert] = useState<EmergencyAlertPayload | null>(null);

  useEffect(() => {
    if (latestEmergencyAlert) {
      setAlert(latestEmergencyAlert);
      setIsVisible(true);
      
      // Auto-hide after 15 seconds
      const timer = setTimeout(() => {
        setIsVisible(false);
        setTimeout(clearEmergencyAlert, 300); // allow animation to finish
      }, 15000);
      
      return () => clearTimeout(timer);
    }
  }, [latestEmergencyAlert, clearEmergencyAlert]);

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(clearEmergencyAlert, 300);
  };

  if (!alert) return null;

  return (
    <div
      className={`fixed bottom-4 right-4 z-50 max-w-sm w-full bg-white border-l-4 border-emergency-600 rounded-lg shadow-2xl overflow-hidden transition-all duration-300 transform ${
        isVisible ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0 pointer-events-none'
      }`}
    >
      <div className="p-4">
        <div className="flex items-start">
          <div className="flex-shrink-0">
            <ShieldAlert className="h-6 w-6 text-emergency-600 animate-pulse" />
          </div>
          <div className="ml-3 w-0 flex-1 pt-0.5">
            <p className="text-sm font-bold text-slate-900 uppercase tracking-wide flex items-center gap-2">
              <span className="bg-emergency-100 text-emergency-700 px-2 py-0.5 rounded text-[10px]">
                {alert.urgency}
              </span>
              Blood Request
            </p>
            <p className="mt-1 text-sm text-slate-600 font-medium leading-snug">
              {alert.hospitalName} urgently needs {alert.unitsRequired} unit(s) of{' '}
              <span className="text-emergency-700 font-bold">{alert.bloodGroup}</span>
            </p>
            
            <div className="mt-3 flex flex-col space-y-1.5 text-xs text-slate-500">
              <div className="flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5" />
                <span>
                  {alert.distanceFormatted} away • {alert.address.city}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" />
                <span>Est. transit: {alert.estimatedTransitTimeMinutes} mins</span>
              </div>
            </div>

            <div className="mt-4 flex gap-2">
              <a
                href={`/dashboard/requests/${alert.requestId}`} // Ready for Phase 7 routing
                className="flex-1 text-center bg-emergency-600 text-white text-xs font-semibold px-3 py-1.5 rounded hover:bg-emergency-700 transition-colors"
                onClick={handleClose}
              >
                View Details
              </a>
            </div>
          </div>
          <div className="ml-4 flex-shrink-0 flex">
            <button
              onClick={handleClose}
              className="bg-white rounded-md inline-flex text-slate-400 hover:text-slate-500 focus:outline-none"
            >
              <span className="sr-only">Close</span>
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
