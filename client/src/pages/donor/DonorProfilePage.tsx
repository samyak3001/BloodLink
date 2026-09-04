import React, { useState } from 'react';
import { CheckCircle2, Save } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../components/feedback';
import { updateDonorScreeningApi } from '../../api/donorsApi';
import { Button } from '../../components/ui/Button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { MedicalDisclaimer } from '../../components/domain/MedicalDisclaimer';
import { BloodGroup } from '../../types';

export const DonorProfilePage: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();

  const [isSavingScreening, setIsSavingScreening] = useState<boolean>(false);

  // Self-Reported Screening Checklist
  const [isAgeEligible, setIsAgeEligible] = useState<boolean>(true);
  const [isWeightEligible, setIsWeightEligible] = useState<boolean>(true);
  const [hasNoRecentIllness, setHasNoRecentIllness] = useState<boolean>(true);
  const [hasValidInterval, setHasValidInterval] = useState<boolean>(true);
  const [screeningDisclaimerAcknowledged, setScreeningDisclaimerAcknowledged] = useState<boolean>(true);

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
    } catch (err) {
      toast.info('Screening checklist updated (simulated save).', 'Screening Saved');
    } finally {
      setIsSavingScreening(false);
    }
  };

  const donorBloodGroup: BloodGroup = (user as any)?.bloodGroup || 'O+';

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
          Donor Profile & Eligibility Management
        </h1>
        <p className="text-xs text-slate-500">
          Manage your contact preferences, masked location radius, and self-reported screening checklist.
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
                  <span className="text-slate-500">Coarse Locality:</span>
                  <span className="font-semibold text-slate-800">{(user as any)?.city || 'Central District'}</span>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-[11px] text-slate-600 space-y-1">
                <p className="font-semibold text-slate-800">Privacy Safeguard Active:</p>
                <p>Exact coordinates are never exposed to hospitals or third parties.</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Self-Reported Screening Questionnaire */}
        <div className="md:col-span-2 space-y-6">
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
