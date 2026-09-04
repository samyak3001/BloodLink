import React, { useState } from 'react';
import { Building2, ShieldCheck, Phone, MapPin, FileText, Save } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../components/feedback';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../components/ui/Card';

export const HospitalProfilePage: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();

  const [name, setName] = useState(user?.name || 'Apollo Emergency Hospital');
  const [email, setEmail] = useState(user?.email || 'apollo.er@bloodlink.org');
  const [phone, setPhone] = useState('+1 (555) 911-0199');
  const [city, setCity] = useState('Central Metropolis');
  const [district, setDistrict] = useState('Medical Care Zone');
  const [street, setStreet] = useState('450 Healthcare Blvd');
  const [licenseNumber, setLicenseNumber] = useState('HOSP-LIC-99201');
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setTimeout(() => {
      setIsSaving(false);
      toast.success('Hospital facility profile successfully updated.', 'Profile Saved');
    }, 600);
  };

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
                <h3 className="font-bold text-slate-900 text-sm">{name}</h3>
                <p className="text-slate-500">{email}</p>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100 space-y-2">
              <div className="flex items-center justify-between py-1">
                <span className="text-slate-500">Platform Status:</span>
                <span className="inline-flex items-center gap-1 text-xs font-bold text-vitality-700 bg-vitality-50 px-2.5 py-0.5 rounded-full border border-vitality-200">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Verified Hospital
                </span>
              </div>
              <div className="flex items-center justify-between py-1">
                <span className="text-slate-500">License Reference:</span>
                <span className="font-mono font-bold text-slate-800">{licenseNumber}</span>
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
                  required
                />
                <Input
                  label="Official Email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="License / Registration Ref"
                  leftIcon={<FileText className="h-4 w-4" />}
                  value={licenseNumber}
                  onChange={(e) => setLicenseNumber(e.target.value)}
                  required
                />
                <Input
                  label="Emergency Blood Hotline"
                  leftIcon={<Phone className="h-4 w-4" />}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-1">
                <Input
                  label="Street Address"
                  leftIcon={<MapPin className="h-4 w-4" />}
                  value={street}
                  onChange={(e) => setStreet(e.target.value)}
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="City"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  required
                />
                <Input
                  label="District"
                  value={district}
                  onChange={(e) => setDistrict(e.target.value)}
                  required
                />
              </div>

              <div className="pt-3 flex justify-end">
                <Button
                  type="submit"
                  variant="clinical"
                  isLoading={isSaving}
                  leftIcon={<Save className="h-4 w-4" />}
                >
                  Save Facility Profile
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
