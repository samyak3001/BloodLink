import React, { useState, useEffect } from 'react';
import { Building2, ShieldCheck, Clock, Phone, MapPin, FileText, Save, Loader2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../components/feedback';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../components/ui/Card';
import { getHospitalProfileApi, updateHospitalProfileApi } from '../../api/hospitalsApi';

export const HospitalProfilePage: React.FC = () => {
  const { user, refreshUser } = useAuth();
  const { toast } = useToast();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('');
  const [district, setDistrict] = useState('');
  const [state, setState] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [street, setStreet] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [hasValidLocation, setHasValidLocation] = useState(false);
  const [licenseNumber, setLicenseNumber] = useState('');
  const [isVerifiedByAdmin, setIsVerifiedByAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const fetchProfile = async () => {
    try {
      setIsLoading(true);
      const res = await getHospitalProfileApi();
      if (res.profile) {
        setName(res.profile.hospitalName || '');
        setEmail(res.profile.email || '');
        setPhone(res.profile.emergencyHelpline || res.profile.phone || '');
        setCity(res.profile.address?.city || '');
        setDistrict(res.profile.address?.district || '');
        setState(res.profile.address?.state || '');
        setPostalCode(res.profile.address?.postalCode || '');
        setStreet(res.profile.address?.street || '');
        setLicenseNumber(res.profile.licenseNumber || '');
        setIsVerifiedByAdmin(res.profile.isVerifiedByAdmin === true);

        if (res.profile.latitude !== null && res.profile.latitude !== undefined) {
          setLatitude(String(res.profile.latitude));
        } else if (res.profile.location?.coordinates?.[1] !== undefined) {
          setLatitude(String(res.profile.location.coordinates[1]));
        }

        if (res.profile.longitude !== null && res.profile.longitude !== undefined) {
          setLongitude(String(res.profile.longitude));
        } else if (res.profile.location?.coordinates?.[0] !== undefined) {
          setLongitude(String(res.profile.location.coordinates[0]));
        }

        setHasValidLocation(res.profile.hasValidLocation === true || (Array.isArray(res.profile.coordinates) && res.profile.coordinates.length === 2));
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load facility profile';
      toast.error(msg, 'Load Error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving) return;

    // Required fields client-side validation
    if (!name.trim()) {
      toast.error('Hospital name is required', 'Validation Error');
      return;
    }
    if (!email.trim()) {
      toast.error('Official email is required', 'Validation Error');
      return;
    }
    if (!phone.trim()) {
      toast.error('Emergency hotline is required', 'Validation Error');
      return;
    }
    if (!city.trim()) {
      toast.error('City is required', 'Validation Error');
      return;
    }

    // Latitude & Longitude validation
    let parsedLat: number | undefined;
    let parsedLng: number | undefined;

    if (latitude.trim() || longitude.trim()) {
      parsedLat = parseFloat(latitude.trim());
      parsedLng = parseFloat(longitude.trim());

      if (isNaN(parsedLat) || parsedLat < -90 || parsedLat > 90) {
        toast.error('Latitude must be a valid number between -90 and 90', 'Coordinates Error');
        return;
      }
      if (isNaN(parsedLng) || parsedLng < -180 || parsedLng > 180) {
        toast.error('Longitude must be a valid number between -180 and 180', 'Coordinates Error');
        return;
      }
    }

    setIsSaving(true);
    try {
      const payload: any = {
        hospitalName: name.trim(),
        email: email.trim(),
        emergencyHelpline: phone.trim(),
        licenseNumber: licenseNumber.trim(),
        street: street.trim(),
        city: city.trim(),
        district: district.trim(),
        state: state.trim() || district.trim(),
        postalCode: postalCode.trim(),
      };

      if (parsedLat !== undefined && parsedLng !== undefined) {
        payload.latitude = parsedLat;
        payload.longitude = parsedLng;
        payload.coordinates = [parsedLng, parsedLat];
      }

      const res = await updateHospitalProfileApi(payload);

      toast.success('Facility profile and coordinates updated successfully.', 'Profile Saved');

      if (res.profile) {
        setName(res.profile.hospitalName || name);
        setEmail(res.profile.email || email);
        setPhone(res.profile.emergencyHelpline || phone);
        setCity(res.profile.address?.city || city);
        setDistrict(res.profile.address?.district || district);
        setState(res.profile.address?.state || state);
        setPostalCode(res.profile.address?.postalCode || postalCode);
        setStreet(res.profile.address?.street || street);
        setLicenseNumber(res.profile.licenseNumber || licenseNumber);
        setIsVerifiedByAdmin(res.profile.isVerifiedByAdmin === true);

        if (res.profile.latitude !== null && res.profile.latitude !== undefined) {
          setLatitude(String(res.profile.latitude));
        }
        if (res.profile.longitude !== null && res.profile.longitude !== undefined) {
          setLongitude(String(res.profile.longitude));
        }
        setHasValidLocation(res.profile.hasValidLocation === true || (Array.isArray(res.profile.coordinates) && res.profile.coordinates.length === 2));
      }

      // Synchronize auth context in background
      void refreshUser();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unable to update facility profile. Please try again.';
      toast.error(msg, 'Update Failed');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto py-12 flex flex-col items-center justify-center space-y-3">
        <Loader2 className="h-8 w-8 text-clinical-600 animate-spin" />
        <p className="text-sm font-medium text-slate-500">Loading hospital facility profile...</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
          Hospital Profile & Clinical Facility Information
        </h1>
        <p className="text-xs text-slate-500">
          Manage your hospital's operational credentials, emergency hotline, and trauma dispatch location.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left Card: Verified Badge & Overview */}
        <Card className="h-fit">
          <CardHeader>
            <CardTitle className="text-base">Facility Status</CardTitle>
            <CardDescription>Regulatory validation record</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-xs">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-2xl bg-clinical-50 text-clinical-600 flex items-center justify-center shadow-soft-sm">
                <Building2 className="h-6 w-6" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-sm truncate max-w-[170px]" title={name}>
                  {name || user?.name || 'Healthcare Facility'}
                </h3>
                <p className="text-slate-500 truncate max-w-[170px]" title={email}>
                  {email || user?.email || ''}
                </p>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100 space-y-2">
              <div className="flex items-center justify-between py-1">
                <span className="text-slate-500">Platform Status:</span>
                {isVerifiedByAdmin ? (
                  <span className="inline-flex items-center gap-1 text-xs font-bold text-vitality-700 bg-vitality-50 px-2.5 py-0.5 rounded-full border border-vitality-200">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    Verified Hospital
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-700 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200">
                    <Clock className="h-3.5 w-3.5" />
                    Pending Verification
                  </span>
                )}
              </div>
              <div className="flex items-center justify-between py-1">
                <span className="text-slate-500">License Reference:</span>
                <span className="font-mono font-bold text-slate-800 truncate max-w-[120px]" title={licenseNumber}>
                  {licenseNumber || 'N/A'}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Right Card: Edit Form */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Facility Details</CardTitle>
            <CardDescription>Verified information displayed to responding donors</CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSave} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="Hospital / Clinic Name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Metro General Hospital"
                  required
                />
                <Input
                  label="Official Email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g. contact@metrohospital.org"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="License / Registration Ref"
                  leftIcon={<FileText className="h-4 w-4" />}
                  value={licenseNumber}
                  onChange={(e) => setLicenseNumber(e.target.value)}
                  placeholder="e.g. HOSP-LIC-12345"
                  required
                />
                <Input
                  label="Emergency Blood Hotline"
                  leftIcon={<Phone className="h-4 w-4" />}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="e.g. +91 98765 43210"
                  required
                />
              </div>

              <div className="space-y-1">
                <Input
                  label="Street Address"
                  leftIcon={<MapPin className="h-4 w-4" />}
                  value={street}
                  onChange={(e) => setStreet(e.target.value)}
                  placeholder="e.g. 123 Healthcare Boulevard"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                  placeholder="e.g. 600006"
                />
              </div>

              {/* Precise GPS Coordinates for Trauma Matching */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <p className="text-xs font-bold text-slate-800">Dispatch Location Coordinates</p>
                    <p className="text-[11px] text-slate-500">
                      Required for radius-based matching with nearby donors within 30 km.
                    </p>
                  </div>
                  {hasValidLocation ? (
                    <span className="text-[11px] font-bold text-vitality-700 bg-vitality-50 px-2 py-0.5 rounded border border-vitality-200">
                      ✓ GPS Verified
                    </span>
                  ) : (
                    <span className="text-[11px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                      Coordinates Missing
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Input
                    label="Latitude (-90 to 90)"
                    value={latitude}
                    onChange={(e) => setLatitude(e.target.value)}
                    placeholder="e.g. 13.0604"
                    helperText="Decimal degrees (e.g. 13.0604 for Chennai)"
                  />
                  <Input
                    label="Longitude (-180 to 180)"
                    value={longitude}
                    onChange={(e) => setLongitude(e.target.value)}
                    placeholder="e.g. 80.2508"
                    helperText="Decimal degrees (e.g. 80.2508 for Chennai)"
                  />
                </div>
              </div>

              <div className="pt-3 flex justify-end">
                <Button
                  type="submit"
                  variant="clinical"
                  isLoading={isSaving}
                  disabled={isSaving}
                  leftIcon={<Save className="h-4 w-4" />}
                >
                  {isSaving ? 'Saving...' : 'Save Facility Profile'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

