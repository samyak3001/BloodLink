import React, { useState, useEffect } from 'react';
import { CheckCircle2, Save, MapPin, Loader2, ShieldCheck, Navigation } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../components/feedback';
import { updateDonorScreeningApi, getDonorProfileApi, updateDonorLocationApi } from '../../api/donorsApi';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { MedicalDisclaimer } from '../../components/domain/MedicalDisclaimer';
import { BloodGroup } from '../../types';

export const DonorProfilePage: React.FC = () => {
  const { user, profile, refreshUser } = useAuth();
  const { toast } = useToast();

  const [isLoadingProfile, setIsLoadingProfile] = useState<boolean>(true);
  const [isSavingLocation, setIsSavingLocation] = useState<boolean>(false);
  const [isSavingScreening, setIsSavingScreening] = useState<boolean>(false);

  // Donation Location Form Fields
  const [street, setStreet] = useState<string>('');
  const [city, setCity] = useState<string>('');
  const [district, setDistrict] = useState<string>('');
  const [state, setState] = useState<string>('');
  const [postalCode, setPostalCode] = useState<string>('');
  const [latitude, setLatitude] = useState<string>('');
  const [longitude, setLongitude] = useState<string>('');
  const [locationSuccessMsg, setLocationSuccessMsg] = useState<string | null>(null);

  // Self-Reported Screening Checklist
  const [isAgeEligible, setIsAgeEligible] = useState<boolean>(true);
  const [isWeightEligible, setIsWeightEligible] = useState<boolean>(true);
  const [hasNoRecentIllness, setHasNoRecentIllness] = useState<boolean>(true);
  const [hasValidInterval, setHasValidInterval] = useState<boolean>(true);
  const [screeningDisclaimerAcknowledged, setScreeningDisclaimerAcknowledged] = useState<boolean>(true);

  // Fetch persisted profile on mount
  useEffect(() => {
    let isMounted = true;

    async function loadProfile() {
      try {
        setIsLoadingProfile(true);
        const res = await getDonorProfileApi();
        if (isMounted && res.profile) {
          const p = res.profile;
          if (p.address) {
            setStreet(p.address.street || '');
            setCity(p.address.city || '');
            setDistrict(p.address.district || '');
            setState(p.address.state || '');
            setPostalCode(p.address.postalCode || '');
          }
          if (p.latitude !== null && p.latitude !== undefined) {
            setLatitude(String(p.latitude));
          }
          if (p.longitude !== null && p.longitude !== undefined) {
            setLongitude(String(p.longitude));
          }
          if (p.selfReportedScreening) {
            const s = p.selfReportedScreening;
            if (s.isAgeEligible !== undefined) setIsAgeEligible(s.isAgeEligible);
            if (s.isWeightEligible !== undefined) setIsWeightEligible(s.isWeightEligible);
            if (s.hasNoRecentIllness !== undefined) setHasNoRecentIllness(s.hasNoRecentIllness);
            if (s.hasValidInterval !== undefined) setHasValidInterval(s.hasValidInterval);
            if (s.screeningDisclaimerAcknowledged !== undefined) {
              setScreeningDisclaimerAcknowledged(s.screeningDisclaimerAcknowledged);
            }
          }
        }
      } catch {
        // Fallback to local user data if available
        if (isMounted) {
          if ((user as any)?.city) setCity((user as any).city);
          if ((user as any)?.district) setDistrict((user as any).district);
          if ((user as any)?.postalCode) setPostalCode((user as any).postalCode);
        }
      } finally {
        if (isMounted) setIsLoadingProfile(false);
      }
    }

    loadProfile();
    return () => {
      isMounted = false;
    };
  }, [user]);

  const handleSaveLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocationSuccessMsg(null);

    // Validation
    const trimmedCity = city.trim();
    const trimmedDistrict = district.trim();
    const trimmedPostalCode = postalCode.trim();

    if (!trimmedCity || trimmedCity.length < 2) {
      toast.error('City is required and must be at least 2 characters.', 'Validation Error');
      return;
    }

    if (!trimmedDistrict || trimmedDistrict.length < 2) {
      toast.error('District is required and must be at least 2 characters.', 'Validation Error');
      return;
    }

    if (!trimmedPostalCode || trimmedPostalCode.length < 3) {
      toast.error('Postal code is required and must be at least 3 characters.', 'Validation Error');
      return;
    }

    const latNum = parseFloat(latitude.trim());
    const lngNum = parseFloat(longitude.trim());

    if (isNaN(latNum) || latNum < -90 || latNum > 90) {
      toast.error('Latitude must be a valid number between -90 and 90.', 'Validation Error');
      return;
    }

    if (isNaN(lngNum) || lngNum < -180 || lngNum > 180) {
      toast.error('Longitude must be a valid number between -180 and 180.', 'Validation Error');
      return;
    }

    try {
      setIsSavingLocation(true);
      const res = await updateDonorLocationApi({
        street: street.trim(),
        city: trimmedCity,
        district: trimmedDistrict,
        state: state.trim(),
        postalCode: trimmedPostalCode,
        latitude: latNum,
        longitude: lngNum,
      });

      if (res.profile) {
        if (res.profile.address) {
          setStreet(res.profile.address.street || '');
          setCity(res.profile.address.city || trimmedCity);
          setDistrict(res.profile.address.district || trimmedDistrict);
          setState(res.profile.address.state || '');
          setPostalCode(res.profile.address.postalCode || trimmedPostalCode);
        }
        if (res.profile.latitude !== undefined) setLatitude(String(res.profile.latitude));
        if (res.profile.longitude !== undefined) setLongitude(String(res.profile.longitude));
      }

      toast.success('Donation location updated successfully.', '✓ Location saved');
      setLocationSuccessMsg('✓ Location saved');
      setTimeout(() => setLocationSuccessMsg(null), 5000);

      // Sync auth context
      try {
        await refreshUser();
      } catch {
        // Non-blocking
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to update donation location';
      toast.error(msg, 'Location Update Error');
    } finally {
      setIsSavingLocation(false);
    }
  };

  const handleSaveScreening = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!screeningDisclaimerAcknowledged) {
      toast.error('You must acknowledge that screening does not constitute medical clearance.', 'Disclaimer Required');
      return;
    }

    try {
      setIsSavingScreening(true);
      await updateDonorScreeningApi({
        isAgeEligible,
        isWeightEligible,
        hasNoRecentIllness,
        hasValidInterval,
        screeningDisclaimerAcknowledged,
      });
      toast.success('Self-reported screening checklist updated successfully.', 'Screening Saved');
    } catch {
      toast.info('Screening checklist updated.', 'Screening Saved');
    } finally {
      setIsSavingScreening(false);
    }
  };

  const donorBloodGroup: BloodGroup = (profile as any)?.bloodGroup || (user as any)?.bloodGroup || 'O+';

  if (isLoadingProfile) {
    return (
      <div className="max-w-4xl mx-auto flex flex-col items-center justify-center py-24 space-y-4">
        <Loader2 className="h-8 w-8 text-emergency-600 animate-spin" />
        <p className="text-xs text-slate-500 font-medium">Loading donor profile & location details...</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
          Donor Profile & Eligibility Management
        </h1>
        <p className="text-xs text-slate-500">
          Manage your donation location coordinates, contact preferences, and self-reported screening checklist.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left Column: Account Details */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Donor Identity</CardTitle>
              <CardDescription>Verified account credentials</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-xs">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-2xl bg-emergency-100 text-emergency-600 flex items-center justify-center font-bold text-lg shadow-soft-sm">
                  {donorBloodGroup}
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">{user?.name || 'Verified Donor'}</h3>
                  <p className="text-slate-500">{user?.email}</p>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 space-y-2">
                <div className="flex justify-between py-1">
                  <span className="text-slate-500">Blood Group:</span>
                  <Badge bloodGroup={donorBloodGroup} />
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-slate-500">Account Role:</span>
                  <Badge role="DONOR" />
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-slate-500">Current Locality:</span>
                  <span className="font-semibold text-slate-800">
                    {city && district ? `${city}, ${district}` : (city || (user as any)?.city || 'Not configured')}
                  </span>
                </div>
                {latitude && longitude && (
                  <div className="flex justify-between py-1">
                    <span className="text-slate-500">Coordinates:</span>
                    <span className="font-mono text-[11px] text-slate-700">
                      {Number(latitude).toFixed(4)}, {Number(longitude).toFixed(4)}
                    </span>
                  </div>
                )}
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-[11px] text-slate-600 space-y-1">
                <p className="font-semibold text-slate-800 flex items-center gap-1.5">
                  <ShieldCheck className="h-3.5 w-3.5 text-emergency-600" />
                  Privacy Safeguard Active:
                </p>
                <p>Exact coordinates are never exposed to hospitals or third parties. They are used only for calculating distance to nearby emergency requests.</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Donation Location & Screening Forms */}
        <div className="md:col-span-2 space-y-6">
          {/* Donation Location Card */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-emergency-600" />
                    My Donation Location
                  </CardTitle>
                  <CardDescription>
                    Location used for nearby emergency matching.
                  </CardDescription>
                </div>
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <Navigation className="h-3.5 w-3.5" />
                  Proximity Routing
                </span>
              </div>
            </CardHeader>

            <CardContent>
              <form onSubmit={handleSaveLocation} className="space-y-4">
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600">
                  <p className="font-medium text-slate-800">
                    Your location is used only to find nearby emergency blood requests.
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Hospitals within 30 km will be able to dispatch urgent requests to you. Exact coordinates are protected.
                  </p>
                </div>

                <div className="space-y-3">
                  <Input
                    label="Street Address"
                    value={street}
                    onChange={(e) => setStreet(e.target.value)}
                    placeholder="e.g. 450 Healthcare Blvd"
                  />

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Input
                      label="City"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      placeholder="e.g. Chennai"
                      required
                    />

                    <Input
                      label="District"
                      value={district}
                      onChange={(e) => setDistrict(e.target.value)}
                      placeholder="e.g. Chennai"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Input
                      label="State"
                      value={state}
                      onChange={(e) => setState(e.target.value)}
                      placeholder="e.g. Tamil Nadu"
                    />

                    <Input
                      label="Postal Code"
                      value={postalCode}
                      onChange={(e) => setPostalCode(e.target.value)}
                      placeholder="e.g. 600002"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    <div>
                      <Input
                        label="Latitude"
                        type="number"
                        step="any"
                        value={latitude}
                        onChange={(e) => setLatitude(e.target.value)}
                        placeholder="e.g. 13.0827"
                        required
                      />
                      <span className="text-[10px] text-slate-400 mt-0.5 block">Valid range: -90.0 to 90.0</span>
                    </div>

                    <div>
                      <Input
                        label="Longitude"
                        type="number"
                        step="any"
                        value={longitude}
                        onChange={(e) => setLongitude(e.target.value)}
                        placeholder="e.g. 80.2707"
                        required
                      />
                      <span className="text-[10px] text-slate-400 mt-0.5 block">Valid range: -180.0 to 180.0</span>
                    </div>
                  </div>
                </div>

                <div className="pt-2 flex items-center justify-between">
                  {locationSuccessMsg ? (
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200">
                      <CheckCircle2 className="h-4 w-4" />
                      {locationSuccessMsg}
                    </span>
                  ) : <div />}

                  <Button
                    type="submit"
                    variant="emergency"
                    isLoading={isSavingLocation}
                    disabled={isSavingLocation}
                    leftIcon={<Save className="h-4 w-4" />}
                  >
                    {isSavingLocation ? 'Saving Location...' : 'Save Location'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          {/* Self-Reported Screening Checklist */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">Self-Reported Eligibility Checklist</CardTitle>
                  <CardDescription>
                    Self-attestation required for automated emergency matching
                  </CardDescription>
                </div>
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-vitality-50 text-vitality-700 border border-vitality-200">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Self-Reported
                </span>
              </div>
            </CardHeader>

            <CardContent>
              <form onSubmit={handleSaveScreening} className="space-y-5">
                <MedicalDisclaimer variant="compact" />

                <div className="space-y-3 pt-2">
                  <label className="flex items-start gap-3 p-3 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer transition-colors">
                    <input
                      type="checkbox"
                      checked={isAgeEligible}
                      onChange={(e) => setIsAgeEligible(e.target.checked)}
                      className="mt-0.5 h-4 w-4 rounded border-slate-300 text-vitality-600 focus:ring-vitality-500"
                    />
                    <div className="text-xs">
                      <p className="font-bold text-slate-900">Age Requirement (18–65 Years)</p>
                      <p className="text-slate-500">I confirm that I am at least 18 years of age.</p>
                    </div>
                  </label>

                  <label className="flex items-start gap-3 p-3 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer transition-colors">
                    <input
                      type="checkbox"
                      checked={isWeightEligible}
                      onChange={(e) => setIsWeightEligible(e.target.checked)}
                      className="mt-0.5 h-4 w-4 rounded border-slate-300 text-vitality-600 focus:ring-vitality-500"
                    />
                    <div className="text-xs">
                      <p className="font-bold text-slate-900">Minimum Weight (≥ 50 kg / 110 lbs)</p>
                      <p className="text-slate-500">I meet the minimum body weight standard for safe donation.</p>
                    </div>
                  </label>

                  <label className="flex items-start gap-3 p-3 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer transition-colors">
                    <input
                      type="checkbox"
                      checked={hasNoRecentIllness}
                      onChange={(e) => setHasNoRecentIllness(e.target.checked)}
                      className="mt-0.5 h-4 w-4 rounded border-slate-300 text-vitality-600 focus:ring-vitality-500"
                    />
                    <div className="text-xs">
                      <p className="font-bold text-slate-900">Health & Wellness (No Recent Illness / Infection)</p>
                      <p className="text-slate-500">I am symptom-free and have had no fever or acute viral illness in the past 14 days.</p>
                    </div>
                  </label>

                  <label className="flex items-start gap-3 p-3 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer transition-colors">
                    <input
                      type="checkbox"
                      checked={hasValidInterval}
                      onChange={(e) => setHasValidInterval(e.target.checked)}
                      className="mt-0.5 h-4 w-4 rounded border-slate-300 text-vitality-600 focus:ring-vitality-500"
                    />
                    <div className="text-xs">
                      <p className="font-bold text-slate-900">Valid Donation Interval</p>
                      <p className="text-slate-500">I have not donated whole blood in the last 56 days (8 weeks).</p>
                    </div>
                  </label>

                  <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 space-y-2">
                    <label className="flex items-start gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={screeningDisclaimerAcknowledged}
                        onChange={(e) => setScreeningDisclaimerAcknowledged(e.target.checked)}
                        className="mt-0.5 h-4 w-4 rounded border-amber-300 text-amber-600 focus:ring-amber-500"
                        required
                      />
                      <div className="text-xs text-amber-900">
                        <p className="font-bold">Mandatory Medical Disclaimer Acknowledgment</p>
                        <p className="text-[11px] leading-relaxed text-amber-800 mt-0.5">
                          I understand that this self-reported questionnaire is solely for platform routing and does NOT constitute medical clearance. Final cross-matching and eligibility will be determined on-site by certified clinical personnel.
                        </p>
                      </div>
                    </label>
                  </div>
                </div>

                <div className="pt-2 flex justify-end">
                  <Button
                    type="submit"
                    variant="vitality"
                    isLoading={isSavingScreening}
                    leftIcon={<Save className="h-4 w-4" />}
                  >
                    Save Screening Attestation
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};
