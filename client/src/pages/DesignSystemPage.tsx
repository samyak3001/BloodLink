import React, { useState } from 'react';
import {
  Layers,
  Sparkles,
  Search,
  Mail,
} from 'lucide-react';
import {
  Button,
  Input,
  Select,
  Badge,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Modal,
  ConfirmDialog,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  SkeletonCard,
  SkeletonTable,
  EmptyState,
  ErrorState,
  StatusIndicator,
} from '../components/ui';
import { useToast } from '../components/feedback';
import {
  MedicalDisclaimer,
  DonorCard,
  EmergencyRequestCard,
} from '../components/domain';

export const DesignSystemPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>('primitives');
  const [buttonLoading, setButtonLoading] = useState<boolean>(false);
  const [modalOpen, setModalOpen] = useState<boolean>(false);
  const [confirmOpen, setConfirmOpen] = useState<boolean>(false);
  const [inputValue, setInputValue] = useState<string>('');
  const [inputError, setInputError] = useState<string>('');
  const [selectValue, setSelectValue] = useState<string>('A+');

  const { toast } = useToast();

  return (
    <div className="space-y-8">
      {/* Header */}
      <section className="text-center max-w-3xl mx-auto space-y-3 pt-2">
        <div className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-clinical-50 border border-clinical-200 text-clinical-700 text-xs font-semibold tracking-wide uppercase shadow-soft-sm">
          <Layers className="h-3.5 w-3.5 text-clinical-600" />
          <span>Interactive Component Workbench & Design System</span>
        </div>

        <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
          BloodLink Design Tokens & Component Library
        </h1>

        <p className="text-sm text-slate-600 leading-relaxed max-w-2xl mx-auto">
          Production-grade healthcare tokens, accessible interactive primitives, real-time feedback components, and domain-specific matching cards.
        </p>
      </section>

      {/* Tabs */}
      <div className="max-w-5xl mx-auto w-full space-y-6">
        <div className="flex items-center justify-between border-b border-slate-200 pb-3 flex-wrap gap-2">
          <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-xl text-xs font-semibold">
            <button
              onClick={() => setActiveTab('primitives')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                activeTab === 'primitives'
                  ? 'bg-white text-slate-900 shadow-soft-sm font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              UI Primitives
            </button>
            <button
              onClick={() => setActiveTab('domain')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                activeTab === 'domain'
                  ? 'bg-white text-slate-900 shadow-soft-sm font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Domain Cards
            </button>
            <button
              onClick={() => setActiveTab('feedback')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                activeTab === 'feedback'
                  ? 'bg-white text-slate-900 shadow-soft-sm font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Toasts & States
            </button>
          </div>
        </div>

        {/* TAB 1: UI PRIMITIVES */}
        {activeTab === 'primitives' && (
          <div className="space-y-8 animate-in fade-in duration-200">
            <Card>
              <CardHeader>
                <CardTitle>1. Buttons & Interaction States</CardTitle>
                <CardDescription>
                  Healthcare semantic tokens: Emergency Crimson, Clinical Blue, Vitality Emerald, Secondary, and Destructive.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-3 items-center">
                  <Button variant="primary">Primary (Emergency)</Button>
                  <Button variant="clinical">Clinical Blue</Button>
                  <Button variant="vitality">Vitality Emerald</Button>
                  <Button variant="secondary">Secondary</Button>
                  <Button variant="outline">Outline</Button>
                  <Button variant="ghost">Ghost</Button>
                  <Button variant="destructive">Destructive</Button>
                </div>

                <div className="pt-2 border-t border-slate-100 flex flex-wrap gap-3 items-center">
                  <Button size="sm" variant="clinical">Small Button</Button>
                  <Button size="md" variant="clinical">Medium Button</Button>
                  <Button size="lg" variant="clinical">Large Button</Button>
                  <Button
                    variant="primary"
                    isLoading={buttonLoading}
                    onClick={() => {
                      setButtonLoading(true);
                      setTimeout(() => setButtonLoading(false), 2000);
                    }}
                    leftIcon={<Sparkles className="h-4 w-4" />}
                  >
                    {buttonLoading ? 'Simulating...' : 'Click for Loading State'}
                  </Button>
                  <Button variant="outline" disabled>Disabled Button</Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>2. Accessible Form Controls</CardTitle>
                <CardDescription>
                  Form elements with floating/stacked labels, left/right icons, helper text, and accessible error validation.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Input
                  label="Search Donors or Requests"
                  placeholder="e.g. O+ blood, Apollo Hospital"
                  leftIcon={<Search className="h-4 w-4" />}
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  helperText="Press Enter to filter potential matches"
                />

                <Input
                  label="Email Address"
                  type="email"
                  placeholder="doctor@hospital.org"
                  leftIcon={<Mail className="h-4 w-4" />}
                  error={inputError}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val && !val.includes('@')) {
                      setInputError('Please enter a valid hospital email address');
                    } else {
                      setInputError('');
                    }
                  }}
                  helperText="Type an invalid email to test field-level error state"
                  required
                />

                <Select
                  label="Required Blood Group"
                  options={[
                    { value: 'A+', label: 'A Positive (A+)' },
                    { value: 'A-', label: 'A Negative (A-)' },
                    { value: 'B+', label: 'B Positive (B+)' },
                    { value: 'B-', label: 'B Negative (B-)' },
                    { value: 'AB+', label: 'AB Positive (AB+)' },
                    { value: 'AB-', label: 'AB Negative (AB-)' },
                    { value: 'O+', label: 'O Positive (O+)' },
                    { value: 'O-', label: 'O Negative (O-)' },
                  ]}
                  value={selectValue}
                  onChange={(e) => setSelectValue(e.target.value)}
                  helperText="Select compatible blood group"
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>3. Healthcare Badges & Status Indicators</CardTitle>
                <CardDescription>
                  Strict clinical badges for Urgency, State Machine Request Statuses, Blood Groups, and live status dots.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                    Request Urgency Badges
                  </h4>
                  <div className="flex flex-wrap gap-2.5">
                    <Badge urgency="CRITICAL" />
                    <Badge urgency="HIGH" />
                    <Badge urgency="MEDIUM" />
                  </div>
                </div>

                <div>
                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                    Request Lifecycle Statuses
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    <Badge status="ACTIVE" />
                    <Badge status="MATCHED" />
                    <Badge status="FULFILLED" />
                    <Badge status="CANCELLED" />
                    <Badge status="EXPIRED" />
                  </div>
                </div>

                <div>
                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                    Blood Group Identifiers
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {(['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+'] as const).map((bg) => (
                      <Badge key={bg} bloodGroup={bg} />
                    ))}
                  </div>
                </div>

                <div>
                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                    Live Status Indicators
                  </h4>
                  <div className="flex flex-wrap gap-4">
                    <StatusIndicator status="online" label="WebSocket Online" />
                    <StatusIndicator status="available" label="Available to Donate" />
                    <StatusIndicator status="busy" label="Engaged in Donation" />
                    <StatusIndicator status="critical" label="Emergency Broadcast Active" />
                    <StatusIndicator status="offline" label="Offline" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>4. Accessible Modals & Confirm Dialogs</CardTitle>
                <CardDescription>
                  Backdrop blur, Escape key dismiss, focus containment, and safe confirm/cancel workflows.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-3">
                <Button variant="outline" onClick={() => setModalOpen(true)}>
                  Open Standard Modal
                </Button>

                <Button variant="destructive" onClick={() => setConfirmOpen(true)}>
                  Trigger Destructive ConfirmDialog
                </Button>

                <Modal
                  isOpen={modalOpen}
                  onClose={() => setModalOpen(false)}
                  title="Emergency Coordination Protocol"
                  description="Review platform coordination procedure before dispatching alerts."
                >
                  <div className="space-y-3 text-xs text-slate-600">
                    <p>1. Verify hospital blood inventory and required component units.</p>
                    <p>2. Real-time matching automatically notifies compatible donors within radius.</p>
                    <p>3. Donors receive an emergency toast and notification; exact GPS coordinates remain strictly private.</p>
                    <div className="pt-3 flex justify-end">
                      <Button variant="clinical" size="sm" onClick={() => setModalOpen(false)}>
                        Understood
                      </Button>
                    </div>
                  </div>
                </Modal>

                <ConfirmDialog
                  isOpen={confirmOpen}
                  onClose={() => setConfirmOpen(false)}
                  onConfirm={() => {
                    toast.success('Emergency request successfully cancelled.', 'Request Cancelled');
                  }}
                  title="Cancel Emergency Request?"
                  message="Are you sure you wish to cancel this emergency request? Notified donors will be informed in real time."
                  confirmText="Yes, Cancel Request"
                  variant="danger"
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>5. Responsive Healthcare Data Table</CardTitle>
                <CardDescription>
                  Structured tabular view with hover highlighting and mobile horizontal scroll.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Request Ref</TableHead>
                      <TableHead>Blood Group</TableHead>
                      <TableHead>Hospital</TableHead>
                      <TableHead>Urgency</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell className="font-mono text-xs">REQ-2026-081</TableCell>
                      <TableCell><Badge bloodGroup="O-" /></TableCell>
                      <TableCell>Apollo Emergency Hospital</TableCell>
                      <TableCell><Badge urgency="CRITICAL" /></TableCell>
                      <TableCell><Badge status="ACTIVE" /></TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="outline">View Matches</Button>
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        )}

        {/* TAB 2: DOMAIN CARDS */}
        {activeTab === 'domain' && (
          <div className="space-y-8 animate-in fade-in duration-200">
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-slate-900 tracking-tight">Standardized Medical Disclaimers</h3>
              <MedicalDisclaimer variant="banner" />
              <MedicalDisclaimer variant="compact" />
            </div>

            <div className="space-y-4">
              <h3 className="text-sm font-bold text-slate-900 tracking-tight">Emergency Request Cards (Donor View)</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <EmergencyRequestCard
                  id="req-1"
                  patientIdentifier="PT-88921"
                  bloodGroup="O-"
                  bloodComponent="WHOLE_BLOOD"
                  unitsRequired={3}
                  urgency="CRITICAL"
                  status="ACTIVE"
                  hospitalName="Apollo Emergency Hospital"
                  city="Central District"
                  distanceFormatted="2.4 km away"
                  estimatedTransitTimeMinutes={8}
                  requiredWithinHours={3}
                  notes="Immediate transfusion needed for emergency surgical patient."
                  onAccept={() => toast.success('You accepted the emergency request. Hospital notified!', 'Accepted')}
                  onDecline={() => toast.info('You declined this request.', 'Declined')}
                  onViewDetails={() => toast.info('Navigating to request details...', 'Details')}
                />
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-sm font-bold text-slate-900 tracking-tight">
                Potential Match Donor Cards (Hospital View — Masked GPS Privacy)
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <DonorCard
                  id="donor-1"
                  name="Marcus Vance (Verified Donor)"
                  bloodGroup="O-"
                  isAvailable={true}
                  supportedComponents={['WHOLE_BLOOD', 'RED_CELLS']}
                  city="Downtown District"
                  distanceKm={1.8}
                  matchScore={96}
                  isCompatible={true}
                  onContact={() => toast.success('Opening secure communication channel with donor...', 'Contact Initiated')}
                />
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: TOAST FEEDBACK & SKELETONS */}
        {activeTab === 'feedback' && (
          <div className="space-y-8 animate-in fade-in duration-200">
            <Card>
              <CardHeader>
                <CardTitle>Action Feedback Toast System</CardTitle>
                <CardDescription>
                  Toast notifications stack in the top-right corner with auto-dismiss and color-coded status styling.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-3">
                <Button
                  variant="vitality"
                  onClick={() => toast.success('Emergency response dispatched to hospital.', 'Success')}
                >
                  Trigger Success Toast
                </Button>

                <Button
                  variant="primary"
                  onClick={() => toast.error('Connection timed out. Retrying socket...', 'Request Failed')}
                >
                  Trigger Error Toast
                </Button>

                <Button
                  variant="secondary"
                  onClick={() => toast.warning('Your donor screening interval expires in 5 days.', 'Interval Warning')}
                >
                  Trigger Warning Toast
                </Button>

                <Button
                  variant="clinical"
                  onClick={() => toast.info('New potential match found 3.2 km away.', 'New Notification')}
                >
                  Trigger Info Toast
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Skeleton Loading States</CardTitle>
                <CardDescription>
                  Animated placeholder skeletons for smooth page transitions and asynchronous data loading.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <SkeletonCard />
                <SkeletonTable rows={3} columns={3} />
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <EmptyState
                title="No Active Emergency Requests"
                description="There are currently no urgent blood requests matching your blood group in this search perimeter."
                actionLabel="Expand Distance Radius"
                onAction={() => toast.info('Radius expanded to 25 km', 'Search Updated')}
              />

              <ErrorState
                title="Failed to Load Matches"
                message="Unable to communicate with the matching engine. Please check your network and try again."
                onRetry={() => toast.info('Re-querying potential matches...', 'Retry')}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
