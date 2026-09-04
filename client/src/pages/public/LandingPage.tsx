import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  HeartPulse,
  Activity,
  ShieldCheck,
  Building2,
  Clock,
  ArrowRight,
  Server,
  Layers,
  HeartHandshake,
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Card, CardContent } from '../../components/ui/Card';
import { MedicalDisclaimer } from '../../components/domain/MedicalDisclaimer';
import { ConnectionStatus } from '../../components/shared/ConnectionStatus';
import { HealthStatus } from '../../types';

export const LandingPage: React.FC = () => {
  const [health, setHealth] = useState<HealthStatus | null>(null);

  useEffect(() => {
    fetch('/api/health')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setHealth(data))
      .catch(() => setHealth(null));
  }, []);

  return (
    <div className="space-y-16 py-4">
      {/* Hero Section */}
      <section className="text-center max-w-4xl mx-auto space-y-6 pt-6">
        <div className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-emergency-50 border border-emergency-200 text-emergency-700 text-xs font-semibold tracking-wide uppercase shadow-soft-sm">
          <Activity className="h-3.5 w-3.5 animate-pulse text-emergency-600" />
          <span>Real-Time Emergency Blood Coordination Platform</span>
        </div>

        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-slate-900 tracking-tight leading-tight">
          Every Second Counts in a{' '}
          <span className="text-emergency-600">Critical Medical Emergency</span>
        </h1>

        <p className="text-base sm:text-lg text-slate-600 leading-relaxed max-w-2xl mx-auto">
          BloodLink bridges medical facilities directly with compatible, nearby prospective donors when hospital blood bank reserves fall critically short.
        </p>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
          <Link to="/register?role=HOSPITAL">
            <Button size="lg" variant="primary" leftIcon={<Building2 className="h-5 w-5" />}>
              Request Blood as Hospital
            </Button>
          </Link>
          <Link to="/register?role=DONOR">
            <Button size="lg" variant="vitality" leftIcon={<HeartPulse className="h-5 w-5" />}>
              Register as Blood Donor
            </Button>
          </Link>
          <Link to="/how-it-works">
            <Button size="lg" variant="ghost">
              How It Works
            </Button>
          </Link>
          <Link to="/login">
            <Button size="lg" variant="outline" rightIcon={<ArrowRight className="h-4 w-4" />}>
              Sign In to Portal
            </Button>
          </Link>
        </div>

        {/* Real-time Status Pills */}
        <div className="flex items-center justify-center gap-3 pt-4 text-xs">
          <ConnectionStatus />
          <div className="flex items-center space-x-1.5 px-3 py-1.5 rounded-full border border-slate-200 bg-slate-50 text-slate-600">
            <Server className="h-3.5 w-3.5 text-slate-500" />
            <span>API Status:</span>
            <span className="font-semibold text-vitality-600">
              {health?.status === 'ok' ? 'Healthy (v1.0)' : 'Diagnostic Mode'}
            </span>
          </div>
        </div>
      </section>

      {/* Medical Safety Disclaimer */}
      <section className="max-w-4xl mx-auto">
        <MedicalDisclaimer variant="banner" />
      </section>

      {/* Emergency Coordination Workflow */}
      <section className="max-w-5xl mx-auto space-y-8">
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
            How BloodLink Coordinates Emergencies
          </h2>
          <p className="text-xs sm:text-sm text-slate-500">
            Algorithmic potential matching designed for speed, safety, and strict privacy.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card hoverable className="text-center">
            <CardContent className="p-6 space-y-3">
              <div className="h-12 w-12 rounded-2xl bg-emergency-50 text-emergency-600 flex items-center justify-center mx-auto shadow-soft-sm font-bold text-base">
                1
              </div>
              <h3 className="text-sm font-bold text-slate-900">Hospital Request</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Hospital dispatches an urgent request with blood group, units, and urgency level.
              </p>
            </CardContent>
          </Card>

          <Card hoverable className="text-center">
            <CardContent className="p-6 space-y-3">
              <div className="h-12 w-12 rounded-2xl bg-clinical-50 text-clinical-600 flex items-center justify-center mx-auto shadow-soft-sm font-bold text-base">
                2
              </div>
              <h3 className="text-sm font-bold text-slate-900">Intelligent Matching</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Platform scores nearby compatible donors by proximity and self-reported availability.
              </p>
            </CardContent>
          </Card>

          <Card hoverable className="text-center">
            <CardContent className="p-6 space-y-3">
              <div className="h-12 w-12 rounded-2xl bg-vitality-50 text-vitality-600 flex items-center justify-center mx-auto shadow-soft-sm font-bold text-base">
                3
              </div>
              <h3 className="text-sm font-bold text-slate-900">Real-Time Alerts</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Matched prospective donors receive immediate push alerts and can accept or decline.
              </p>
            </CardContent>
          </Card>

          <Card hoverable className="text-center">
            <CardContent className="p-6 space-y-3">
              <div className="h-12 w-12 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center mx-auto shadow-soft-sm font-bold text-base">
                4
              </div>
              <h3 className="text-sm font-bold text-slate-900">Clinical Verification</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Final donor cross-matching and eligibility verification is conducted on-site by medical staff.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Key Architectural Pillars */}
      <section className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card hoverable>
          <CardContent className="p-6 space-y-3">
            <div className="p-3 rounded-xl bg-emergency-50 text-emergency-600 w-fit">
              <Clock className="h-6 w-6" />
            </div>
            <h3 className="text-sm font-bold text-slate-900">Sub-Second WebSocket Alerts</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Real-time Socket.IO architecture notifies nearby donors without polling, updating hospital dashboards dynamically as responses arrive.
            </p>
          </CardContent>
        </Card>

        <Card hoverable>
          <CardContent className="p-6 space-y-3">
            <div className="p-3 rounded-xl bg-clinical-50 text-clinical-600 w-fit">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <h3 className="text-sm font-bold text-slate-900">Masked Location Privacy</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Donors' exact GPS coordinates are strictly protected and never exposed in client payloads; only rounded distances and coarse localities are shared.
            </p>
          </CardContent>
        </Card>

        <Card hoverable>
          <CardContent className="p-6 space-y-3">
            <div className="p-3 rounded-xl bg-vitality-50 text-vitality-600 w-fit">
              <HeartHandshake className="h-6 w-6" />
            </div>
            <h3 className="text-sm font-bold text-slate-900">Self-Reported Screening</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Donors complete eligibility questionnaires to filter potential matches; full medical clearance remains solely with hospital healthcare providers.
            </p>
          </CardContent>
        </Card>
      </section>

      {/* Design System & Workbench Callout */}
      <section className="max-w-4xl mx-auto">
        <Card className="bg-gradient-to-r from-slate-900 to-slate-800 text-white border-0 shadow-soft-lg">
          <CardContent className="p-8 flex flex-col sm:flex-row items-center justify-between gap-6">
            <div className="space-y-1.5 text-center sm:text-left">
              <div className="flex items-center gap-2 justify-center sm:justify-start text-xs font-semibold text-clinical-300 uppercase tracking-wider">
                <Layers className="h-4 w-4" />
                <span>Developer & Reviewer Tooling</span>
              </div>
              <h3 className="text-lg font-bold text-white tracking-tight">
                Explore the Phase 7 UI Design System Workbench
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed max-w-md">
                Test and preview all healthcare buttons, form controls, modals, tables, loading skeletons, and domain cards interactively.
              </p>
            </div>

            <Link to="/design-system">
              <Button variant="clinical" size="md" rightIcon={<ArrowRight className="h-4 w-4" />}>
                Open Workbench
              </Button>
            </Link>
          </CardContent>
        </Card>
      </section>
    </div>
  );
};
