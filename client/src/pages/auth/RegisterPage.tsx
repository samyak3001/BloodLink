import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { HeartPulse, Building2, User, Mail, Lock, Phone, MapPin, FileText } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../components/feedback';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '../../components/ui/Card';
import { MedicalDisclaimer } from '../../components/domain/MedicalDisclaimer';
import { BloodGroup } from '../../types';

export const RegisterPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const initialRole = searchParams.get('role') === 'HOSPITAL' ? 'HOSPITAL' : 'DONOR';

  const [role, setRole] = useState<'DONOR' | 'HOSPITAL'>(initialRole);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [bloodGroup, setBloodGroup] = useState<BloodGroup>('O+');
  const [city, setCity] = useState('');
  const [district, setDistrict] = useState('');
  const [state, setState] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [street, setStreet] = useState('');
  const [phone, setPhone] = useState('');
  const [registrationNumber, setRegistrationNumber] = useState('');
  const [emergencyPhone, setEmergencyPhone] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { register } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name || !email || !password) {
      setError('Please fill in all mandatory account fields.');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters long with at least one uppercase letter and number.');
      return;
    }

    try {
      setIsLoading(true);

      if (role === 'DONOR') {
        if (!bloodGroup) {
          setError('Please select your blood group.');
          return;
        }
        if (!city) {
          setError('Please enter your city / locality.');
          return;
        }
        if (!postalCode) {
          setError('Please enter your postal code (e.g. 629001).');
          return;
        }
        if (!phone) {
          setError('Please enter your contact phone number.');
          return;
        }
        await register({
          name,
          email,
          password,
          role: 'DONOR',
          bloodGroup,
          city,
          district: district || city,
          postalCode,
          phone,
        });
        toast.success('Donor account created successfully! Welcome to BloodLink.', 'Registration Complete');
        navigate('/donor/dashboard');
      } else {
        if (!registrationNumber) {
          setError('Please enter your facility license or registration number.');
          return;
        }
        if (!emergencyPhone && !phone) {
          setError('Please enter a 24/7 emergency blood bank helpline.');
          return;
        }
        if (!city) {
          setError('Please enter the city.');
          return;
        }
        if (!state) {
          setError('Please enter the state.');
          return;
        }
        if (!postalCode) {
          setError('Please enter the postal code.');
          return;
        }
        if (!street) {
          setError('Please enter the street address.');
          return;
        }
        await register({
          name,
          email,
          password,
          role: 'HOSPITAL',
          hospitalName: name,
          licenseNumber: registrationNumber,
          city,
          district: district || city,
          state,
          postalCode,
          street,
          emergencyHelpline: emergencyPhone || phone,
          phone: emergencyPhone || phone,
        });
        toast.success('Hospital account created! Welcome to BloodLink emergency network.', 'Registration Complete');
        navigate('/hospital/dashboard');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
      toast.error(err instanceof Error ? err.message : 'Failed to register', 'Registration Error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto py-8 px-4 space-y-6">
      <div className="text-center space-y-2">
        <div className="h-12 w-12 rounded-2xl bg-emergency-600 text-white flex items-center justify-center mx-auto shadow-soft">
          <HeartPulse className="h-6 w-6" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
          Create Your BloodLink Account
        </h1>
        <p className="text-xs text-slate-500">
          Join the real-time emergency matching network as a donor or hospital.
        </p>
      </div>

      {/* Role Selection Tabs */}
      <div className="grid grid-cols-2 p-1.5 bg-slate-100 rounded-2xl gap-1">
        <button
          type="button"
          onClick={() => {
            setRole('DONOR');
            setError(null);
          }}
          className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition-all ${
            role === 'DONOR'
              ? 'bg-white text-slate-900 shadow-soft-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <User className="h-4 w-4 text-vitality-600" />
          <span>I am a Blood Donor</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setRole('HOSPITAL');
            setError(null);
          }}
          className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition-all ${
            role === 'HOSPITAL'
              ? 'bg-white text-slate-900 shadow-soft-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Building2 className="h-4 w-4 text-clinical-600" />
          <span>I am a Hospital / Facility</span>
        </button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {role === 'DONOR' ? 'Donor Registration' : 'Hospital Healthcare Facility Registration'}
          </CardTitle>
          <CardDescription>
            {role === 'DONOR'
              ? 'Your exact location coordinates remain strictly masked to protect your privacy.'
              : 'Verified facilities can dispatch real-time emergency blood requests.'}
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 rounded-xl bg-emergency-50 border border-emergency-200 text-xs text-emergency-700 font-medium leading-relaxed">
                {error}
              </div>
            )}

            {/* Account Credentials */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label={role === 'DONOR' ? 'Full Legal Name' : 'Hospital / Clinic Name'}
                placeholder={role === 'DONOR' ? 'Sarah Connor' : 'Apollo Emergency Hospital'}
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />

              <Input
                label="Email Address"
                type="email"
                placeholder="name@example.org"
                leftIcon={<Mail className="h-4 w-4" />}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <Input
              label="Password"
              type="password"
              placeholder="••••••••"
              leftIcon={<Lock className="h-4 w-4" />}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              helperText="Must be at least 8 characters, with uppercase and numbers"
              required
            />

            {/* Role-Specific Fields */}
            {role === 'DONOR' ? (
              <div className="space-y-4 pt-2 border-t border-slate-100">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Select
                    label="Blood Group"
                    options={[
                      { value: 'O+', label: 'O Positive (O+)' },
                      { value: 'O-', label: 'O Negative (O-) — Universal' },
                      { value: 'A+', label: 'A Positive (A+)' },
                      { value: 'A-', label: 'A Negative (A-)' },
                      { value: 'B+', label: 'B Positive (B+)' },
                      { value: 'B-', label: 'B Negative (B-)' },
                      { value: 'AB+', label: 'AB Positive (AB+)' },
                      { value: 'AB-', label: 'AB Negative (AB-)' },
                    ]}
                    value={bloodGroup}
                    onChange={(e) => setBloodGroup(e.target.value as BloodGroup)}
                    helperText="Your reported blood group"
                    required
                  />

                  <Input
                    label="Contact Phone"
                    type="tel"
                    placeholder="9876543210"
                    leftIcon={<Phone className="h-4 w-4" />}
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    helperText="Never shared publicly"
                    required
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <Input
                    label="City / Locality"
                    placeholder="Nagercoil"
                    leftIcon={<MapPin className="h-4 w-4" />}
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    required
                  />

                  <Input
                    label="District"
                    placeholder="Kanyakumari"
                    value={district}
                    onChange={(e) => setDistrict(e.target.value)}
                    helperText="Optional"
                  />

                  <Input
                    label="Postal Code"
                    placeholder="629001"
                    value={postalCode}
                    onChange={(e) => setPostalCode(e.target.value)}
                    required
                  />
                </div>

                <MedicalDisclaimer variant="compact" />
              </div>
            ) : (
              <div className="space-y-4 pt-2 border-t border-slate-100">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Input
                    label="Facility License / Registration Number"
                    placeholder="HOSP-REG-88219"
                    leftIcon={<FileText className="h-4 w-4" />}
                    value={registrationNumber}
                    onChange={(e) => setRegistrationNumber(e.target.value)}
                    required
                  />

                  <Input
                    label="24/7 Emergency Blood Bank Hotline"
                    type="tel"
                    placeholder="+1 (555) 911-0000"
                    leftIcon={<Phone className="h-4 w-4" />}
                    value={emergencyPhone}
                    onChange={(e) => setEmergencyPhone(e.target.value)}
                    required
                  />
                </div>

                <Input
                  label="Street Address"
                  placeholder="500 Healthcare Blvd"
                  value={street}
                  onChange={(e) => setStreet(e.target.value)}
                  required
                />

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <Input
                    label="City"
                    placeholder="Central Metropolis"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    required
                  />
                  <Input
                    label="District"
                    placeholder="Medical District"
                    value={district}
                    onChange={(e) => setDistrict(e.target.value)}
                    helperText="Optional"
                  />
                  <Input
                    label="State"
                    placeholder="Tamil Nadu"
                    value={state}
                    onChange={(e) => setState(e.target.value)}
                    required
                  />
                  <Input
                    label="Postal Code"
                    placeholder="629001"
                    value={postalCode}
                    onChange={(e) => setPostalCode(e.target.value)}
                    required
                  />
                </div>
              </div>
            )}

            <Button
              type="submit"
              variant={role === 'DONOR' ? 'vitality' : 'primary'}
              fullWidth
              isLoading={isLoading}
              className="mt-2"
            >
              {role === 'DONOR' ? 'Complete Donor Registration' : 'Register Hospital Account'}
            </Button>
          </form>
        </CardContent>

        <CardFooter className="justify-center bg-slate-50/80 p-4">
          <p className="text-xs text-slate-500">
            Already have an authorized account?{' '}
            <Link
              to={role === 'HOSPITAL' ? '/hospital/sign-in' : '/login'}
              className="font-bold text-clinical-600 hover:text-clinical-700"
            >
              Sign in here
            </Link>
          </p>
        </CardFooter>
      </Card>
    </div>
  );
};
