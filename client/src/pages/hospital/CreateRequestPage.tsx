import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Activity,
  PlusCircle,
  MapPin,
  Clock,
  ArrowLeft,
} from 'lucide-react';
import { useToast } from '../../components/feedback';
import { createEmergencyRequestApi } from '../../api/requestsApi';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../components/ui/Card';
import { MedicalDisclaimer } from '../../components/domain/MedicalDisclaimer';
import { BloodGroup, BloodComponent, RequestUrgency } from '../../types';

export const CreateRequestPage: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [patientIdentifier, setPatientIdentifier] = useState(`ER-${Math.floor(1000 + Math.random() * 9000)}`);
  const [bloodGroup, setBloodGroup] = useState<BloodGroup>('O-');
  const [bloodComponent, setBloodComponent] = useState<BloodComponent>('WHOLE_BLOOD');
  const [unitsRequired, setUnitsRequired] = useState<number>(2);
  const [urgency, setUrgency] = useState<RequestUrgency>('CRITICAL');
  const [requiredWithinHours, setRequiredWithinHours] = useState<number>(3);
  const [maxRadiusKm, setMaxRadiusKm] = useState<number>(25);
  const [notes, setNotes] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!patientIdentifier) {
      setError('Please provide a patient or case reference identifier.');
      return;
    }

    if (unitsRequired < 1 || unitsRequired > 20) {
      setError('Required units must be between 1 and 20.');
      return;
    }

    if (requiredWithinHours < 1 || requiredWithinHours > 72) {
      setError('Required timeframe must be between 1 and 72 hours.');
      return;
    }

    try {
      setIsLoading(true);
      const res = await createEmergencyRequestApi({
        patientIdentifier,
        bloodGroup,
        bloodComponent,
        unitsRequired,
        urgency,
        requiredWithinHours,
        maxRadiusKm,
        notes: notes || undefined,
      });

      toast.success(
        `Emergency alert for ${unitsRequired} units of ${bloodGroup} dispatched via WebSocket to nearby donors.`,
        'Request Broadcast Live'
      );

      const newId = res.request?.id || res.request?._id || 'req-new';
      navigate(`/hospital/requests/${newId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create emergency request');
      toast.error(err instanceof Error ? err.message : 'Error creating request', 'Broadcast Error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Link
          to="/hospital/dashboard"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Dashboard
        </Link>
      </div>

      <Card className="border-emergency-200 shadow-soft-md">
        <CardHeader className="bg-gradient-to-r from-emergency-50/50 to-white pb-4 border-b border-slate-100">
          <div className="flex items-center space-x-3">
            <div className="h-10 w-10 rounded-xl bg-emergency-600 text-white flex items-center justify-center shadow-soft">
              <Activity className="h-5 w-5 animate-pulse" />
            </div>
            <div>
              <CardTitle className="text-lg text-slate-900">
                Dispatch Emergency Blood Request
              </CardTitle>
              <CardDescription>
                Broadcasting activates real-time matching and notifies compatible donors within your search radius.
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="p-3.5 rounded-xl bg-emergency-50 border border-emergency-200 text-xs text-emergency-800 font-medium">
                {error}
              </div>
            )}

            {/* Patient Identifier & Urgency */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Case / Patient Reference Code"
                placeholder="e.g. ER-TRAUMA-102"
                value={patientIdentifier}
                onChange={(e) => setPatientIdentifier(e.target.value)}
                helperText="De-identified patient identifier"
                required
              />

              <Select
                label="Urgency Level"
                options={[
                  { value: 'CRITICAL', label: 'CRITICAL (Immediate Life Threat — < 3 Hrs)' },
                  { value: 'HIGH', label: 'HIGH (Urgent Surgery / ICU — < 6 Hrs)' },
                  { value: 'MEDIUM', label: 'MEDIUM (Scheduled / Stable — < 24 Hrs)' },
                ]}
                value={urgency}
                onChange={(e) => setUrgency(e.target.value as RequestUrgency)}
                helperText="Controls donor alert priority"
                required
              />
            </div>

            {/* Blood Specifications */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Select
                label="Required Blood Group"
                options={[
                  { value: 'O-', label: 'O Negative (O-) — Universal' },
                  { value: 'O+', label: 'O Positive (O+)' },
                  { value: 'A-', label: 'A Negative (A-)' },
                  { value: 'A+', label: 'A Positive (A+)' },
                  { value: 'B-', label: 'B Negative (B-)' },
                  { value: 'B+', label: 'B Positive (B+)' },
                  { value: 'AB-', label: 'AB Negative (AB-)' },
                  { value: 'AB+', label: 'AB Positive (AB+)' },
                ]}
                value={bloodGroup}
                onChange={(e) => setBloodGroup(e.target.value as BloodGroup)}
                required
              />

              <Select
                label="Blood Component"
                options={[
                  { value: 'WHOLE_BLOOD', label: 'Whole Blood' },
                  { value: 'RED_CELLS', label: 'Packed Red Blood Cells (PRBC)' },
                  { value: 'PLATELETS', label: 'Platelet Concentrate' },
                  { value: 'PLASMA', label: 'Fresh Frozen Plasma (FFP)' },
                  { value: 'CRYOPRECIPITATE', label: 'Cryoprecipitate' },
                ]}
                value={bloodComponent}
                onChange={(e) => setBloodComponent(e.target.value as BloodComponent)}
                required
              />

              <Input
                label="Units Required (1–20)"
                type="number"
                min={1}
                max={20}
                value={unitsRequired}
                onChange={(e) => setUnitsRequired(parseInt(e.target.value, 10) || 1)}
                required
              />
            </div>

            {/* Timeframe & Perimeter */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Required Within (Hours)"
                type="number"
                min={1}
                max={72}
                leftIcon={<Clock className="h-4 w-4" />}
                value={requiredWithinHours}
                onChange={(e) => setRequiredWithinHours(parseInt(e.target.value, 10) || 1)}
                helperText="Request automatically expires after this duration"
                required
              />

              <Input
                label="Search Perimeter Radius (Kilometers)"
                type="number"
                min={5}
                max={100}
                leftIcon={<MapPin className="h-4 w-4" />}
                value={maxRadiusKm}
                onChange={(e) => setMaxRadiusKm(parseInt(e.target.value, 10) || 25)}
                helperText="Maximum distance to alert compatible donors"
                required
              />
            </div>

            {/* Clinical Notes */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">
                Clinical Context & Instructions for Donors (Optional)
              </label>
              <textarea
                rows={3}
                className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-clinical-500 focus:border-transparent transition-all"
                placeholder="e.g. Report to Emergency Admissions desk, Building B, 2nd Floor. Bring government photo identification."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>

            <MedicalDisclaimer variant="compact" />

            <div className="pt-2">
              <Button
                type="submit"
                variant="primary"
                fullWidth
                size="lg"
                isLoading={isLoading}
                leftIcon={<PlusCircle className="h-5 w-5" />}
              >
                Dispatch Emergency Request Live
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};
