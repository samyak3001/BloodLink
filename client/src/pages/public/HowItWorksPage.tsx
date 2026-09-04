import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  HeartPulse,
  Activity,
  ShieldCheck,
  Building2,
  BellRing,
  ArrowRight,
  AlertCircle,
  HelpCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';

export const HowItWorksPage: React.FC = () => {
  const [activeFaq, setActiveFaq] = useState<number | null>(null);

  const steps = [
    {
      step: '01',
      title: 'Emergency Blood Request Creation',
      icon: <Building2 className="h-6 w-6 text-emergency-600" />,
      description:
        'Licensed medical facilities create urgent blood requests specifying blood group, component (Whole Blood, Red Cells, Plasma, Platelets), required units, and urgency level.',
      details: [
        'Authenticated hospital verification ensures only accredited clinics issue broadcasts.',
        'Urgency prioritization (Critical <1hr, High <4hrs, Medium <12hrs).',
        'Hospital coordinates locked for radius calculation.',
      ],
      color: 'bg-emergency-50 border-emergency-200 text-emergency-700',
    },
    {
      step: '02',
      title: 'Smart Matching & Proximity Engine',
      icon: <Activity className="h-6 w-6 text-clinical-600" />,
      description:
        'The algorithmic engine immediately filters active donors based on ABO/Rh biological compatibility, real-time availability status, and geographical distance.',
      details: [
        'Red cell vs Plasma universal donor inversions accounted for.',
        'Haversine distance ranking with proximity scoring.',
        'Cooldown window enforcement (90 days for whole blood donations).',
      ],
      color: 'bg-clinical-50 border-clinical-200 text-clinical-700',
    },
    {
      step: '03',
      title: 'Instant Multi-Channel Alerts',
      icon: <BellRing className="h-6 w-6 text-amber-600" />,
      description:
        'Compatible donors within radius receive real-time push alerts with hospital details and patient urgency. Donors can accept or decline with a single click.',
      details: [
        'Sub-second WebSocket broadcast with sound/visual cue.',
        'No phone number or personal identity revealed to unauthorized callers.',
        'GPS privacy masking: exact coordinates are never exposed.',
      ],
      color: 'bg-amber-50 border-amber-200 text-amber-700',
    },
    {
      step: '04',
      title: 'Clinical Verification & Transfusion',
      icon: <ShieldCheck className="h-6 w-6 text-vitality-600" />,
      description:
        'Upon acceptance, the hospital is notified and prepares for donor intake. Authorized clinical staff perform formal medical screening before transfusion.',
      details: [
        'Mandatory distinction: "Potentially Eligible" vs "Medically Cleared".',
        'Official blood bank pre-donation screening & cross-matching.',
        'Donation history ledger updated with immutable audit verification.',
      ],
      color: 'bg-vitality-50 border-vitality-200 text-vitality-700',
    },
  ];

  const compatibilityMatrix = [
    { recipient: 'O-', canReceiveFrom: ['O-'], canDonateTo: ['All Groups (Universal Donor)'] },
    { recipient: 'O+', canReceiveFrom: ['O+', 'O-'], canDonateTo: ['O+', 'A+', 'B+', 'AB+'] },
    { recipient: 'A-', canReceiveFrom: ['A-', 'O-'], canDonateTo: ['A-', 'A+', 'AB-', 'AB+'] },
    { recipient: 'A+', canReceiveFrom: ['A+', 'A-', 'O+', 'O-'], canDonateTo: ['A+', 'AB+'] },
    { recipient: 'B-', canReceiveFrom: ['B-', 'O-'], canDonateTo: ['B-', 'B+', 'AB-', 'AB+'] },
    { recipient: 'B+', canReceiveFrom: ['B+', 'B-', 'O+', 'O-'], canDonateTo: ['B+', 'AB+'] },
    { recipient: 'AB-', canReceiveFrom: ['AB-', 'A-', 'B-', 'O-'], canDonateTo: ['AB-', 'AB+'] },
    { recipient: 'AB+', canReceiveFrom: ['All Groups (Universal Recipient)'], canDonateTo: ['AB+ only'] },
  ];

  const faqs = [
    {
      q: 'Does BloodLink perform medical fitness clearances?',
      a: 'No. BloodLink is an emergency coordination and matching platform, not a medical diagnosis system. Matching is based on biological blood group compatibility and self-reported donor readiness. Final clinical eligibility and cross-matching must be verified by licensed medical staff at the recipient hospital.',
    },
    {
      q: 'Is my personal phone number and exact GPS location safe?',
      a: 'Yes. BloodLink implements Privacy by Design. Exact donor GPS coordinates are never exposed publicly or to hospitals; only calculated proximity distances (e.g. ~4.2 km) are shared. Donors can also toggle GPS privacy masking in Settings at any time.',
    },
    {
      q: 'How are hospitals verified before issuing broadcasts?',
      a: 'Every hospital registration requires manual administrator review and validation of clinical licensing, official medical helpline credentials, and facility jurisdiction before emergency broadcast privileges are unlocked.',
    },
    {
      q: 'What happens if a donor declines an emergency alert?',
      a: 'Declining an alert is completely non-punitive. The engine immediately notifies the hospital dashboard so the facility can follow up with alternative matched candidates in the surrounding area.',
    },
  ];

  return (
    <div className="space-y-16 py-4 sm:py-8 max-w-5xl mx-auto">
      {/* Hero Section */}
      <div className="text-center space-y-4 max-w-3xl mx-auto px-4">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emergency-50 border border-emergency-200 text-emergency-700 text-xs font-bold uppercase tracking-wider">
          <HeartPulse className="h-3.5 w-3.5" />
          Platform Architecture & Workflow
        </div>
        <h1 className="text-3xl sm:text-5xl font-black text-slate-900 tracking-tight leading-tight">
          How <span className="text-emergency-600">BloodLink</span> Saves Lives in Critical Minutes
        </h1>
        <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
          A real-time emergency coordination bridge connecting verified hospitals with nearby,
          biologically compatible blood donors when every single minute matters.
        </p>
      </div>

      {/* 4-Step Architectural Workflow */}
      <div className="space-y-6">
        <div className="text-center space-y-1">
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            End-to-End Emergency Workflow
          </h2>
          <p className="text-xs text-slate-500">
            From emergency broadcast to hospital transfusion, engineered for speed, privacy, and clinical safety.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {steps.map((s) => (
            <Card key={s.step} hoverable className="border border-slate-200">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                      {s.icon}
                    </div>
                    <div>
                      <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                        Step {s.step}
                      </span>
                      <CardTitle className="text-base">{s.title}</CardTitle>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-xs text-slate-600 leading-relaxed">
                  {s.description}
                </p>
                <div className="pt-2 border-t border-slate-100 space-y-1.5">
                  {s.details.map((detail, dIdx) => (
                    <div key={dIdx} className="flex items-start gap-2 text-xs text-slate-500">
                      <CheckCircle2 className="h-3.5 w-3.5 text-vitality-600 mt-0.5 shrink-0" />
                      <span>{detail}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Medical Safety Disclaimer Alert */}
      <div className="p-5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 flex items-start gap-4">
        <AlertCircle className="h-6 w-6 text-amber-600 shrink-0 mt-0.5" />
        <div className="space-y-1 text-xs">
          <h3 className="font-bold text-sm text-amber-900">
            Crucial Medical Safety Principle (Prompt.md #41–50)
          </h3>
          <p className="text-amber-800 leading-relaxed">
            BloodLink is exclusively an emergency coordination and matching engine. It does not provide medical diagnoses, nor does it guarantee physiological donor fitness. Every prospective donor matched by the algorithm is classified as <strong>potentially eligible</strong> until verified and cleared in person by authorized hospital hematology personnel.
          </p>
        </div>
      </div>

      {/* Red Cell Compatibility Matrix */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">
              Biological Compatibility Engine (ABO / Rh Matrix)
            </h2>
            <p className="text-xs text-slate-500">
              The platform implements full clinical red cell & plasma compatibility rules for instantaneous scoring.
            </p>
          </div>
          <Badge variant="clinical">
            Whole Blood & RBC Rules
          </Badge>
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-soft-sm">
          <table className="w-full text-xs text-left" role="table" aria-label="ABO Compatibility Matrix">
            <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Blood Group</th>
                <th className="py-3 px-4">Compatible Donors (Can Receive From)</th>
                <th className="py-3 px-4">Compatible Recipients (Can Donate To)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {compatibilityMatrix.map((row) => (
                <tr key={row.recipient} className="hover:bg-slate-50/70 transition-colors">
                  <td className="py-3 px-4 font-black text-slate-900 text-sm">
                    {row.recipient}
                  </td>
                  <td className="py-3 px-4 text-slate-700">
                    <div className="flex flex-wrap gap-1">
                      {row.canReceiveFrom.map((g) => (
                        <span
                          key={g}
                          className="px-2 py-0.5 rounded-md bg-clinical-50 text-clinical-800 font-semibold border border-clinical-200"
                        >
                          {g}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="py-3 px-4 text-slate-700">
                    <div className="flex flex-wrap gap-1">
                      {row.canDonateTo.map((g) => (
                        <span
                          key={g}
                          className="px-2 py-0.5 rounded-md bg-vitality-50 text-vitality-800 font-semibold border border-vitality-200"
                        >
                          {g}
                        </span>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Frequently Asked Questions */}
      <div className="space-y-4">
        <div className="text-center space-y-1">
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            Frequently Asked Questions
          </h2>
          <p className="text-xs text-slate-500">
            Key operational, privacy, and clinical governance inquiries.
          </p>
        </div>

        <div className="space-y-3 max-w-3xl mx-auto">
          {faqs.map((faq, idx) => {
            const isOpen = activeFaq === idx;
            return (
              <div
                key={idx}
                className="border border-slate-200 rounded-xl bg-white overflow-hidden shadow-soft-sm"
              >
                <button
                  onClick={() => setActiveFaq(isOpen ? null : idx)}
                  className="w-full p-4 flex items-center justify-between text-left hover:bg-slate-50 transition-colors focus:outline-none focus:ring-2 focus:ring-clinical-500"
                  aria-expanded={isOpen}
                >
                  <span className="text-xs sm:text-sm font-bold text-slate-900 flex items-center gap-2">
                    <HelpCircle className="h-4 w-4 text-clinical-600 shrink-0" />
                    {faq.q}
                  </span>
                  {isOpen ? (
                    <ChevronUp className="h-4 w-4 text-slate-400" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-slate-400" />
                  )}
                </button>
                {isOpen && (
                  <div className="px-4 pb-4 pt-1 text-xs text-slate-600 leading-relaxed border-t border-slate-100 bg-slate-50/50">
                    {faq.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Call to Action Banner */}
      <div className="p-8 sm:p-10 rounded-3xl bg-slate-900 text-white text-center space-y-6 shadow-soft">
        <div className="max-w-2xl mx-auto space-y-2">
          <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
            Ready to Support Emergency Blood Matching?
          </h2>
          <p className="text-xs sm:text-sm text-slate-300">
            Join hundreds of lifesaving donors or register your hospital facility to unlock instant emergency broadcasts.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link to="/register">
            <Button size="md" variant="emergency" rightIcon={<ArrowRight className="h-4 w-4" />}>
              Register as a Donor
            </Button>
          </Link>
          <Link to="/register">
            <Button size="md" variant="outline" className="border-slate-700 text-white hover:bg-slate-800">
              Register a Hospital
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
};
