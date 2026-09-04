import React, { useState } from 'react';
import {
  Lock,
  Download,
  Trash2,
  EyeOff,
  User,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../components/feedback';
import {
  exportUserDataApi,
  updatePrivacySettingsApi,
  changePasswordApi,
  deleteAccountApi,
} from '../../api/userApi';
import { Button } from '../../components/ui/Button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';

export const SettingsPage: React.FC = () => {
  const { user, logout } = useAuth();
  const { toast } = useToast();

  // Privacy State
  const [hideExactLocation, setHideExactLocation] = useState<boolean>(true);
  const [showContactOnlyMatched, setShowContactOnlyMatched] = useState<boolean>(true);
  const [isSavingPrivacy, setIsSavingPrivacy] = useState<boolean>(false);

  // Password State
  const [currentPassword, setCurrentPassword] = useState<string>('');
  const [newPassword, setNewPassword] = useState<string>('');
  const [confirmNewPassword, setConfirmNewPassword] = useState<string>('');
  const [isChangingPassword, setIsChangingPassword] = useState<boolean>(false);

  // Data Export State
  const [isExporting, setIsExporting] = useState<boolean>(false);

  // Account Deletion State
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState<boolean>(false);
  const [deletePassword, setDeletePassword] = useState<string>('');
  const [isDeletingAccount, setIsDeletingAccount] = useState<boolean>(false);

  // Handle Privacy Update
  const handleSavePrivacy = async () => {
    try {
      setIsSavingPrivacy(true);
      await updatePrivacySettingsApi({
        hideExactLocation,
        showContactToMatchedHospitalsOnly: showContactOnlyMatched,
      });
      toast.success('Privacy preferences updated successfully.', 'Privacy Settings Saved');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update privacy settings';
      toast.error(msg, 'Error');
    } finally {
      setIsSavingPrivacy(false);
    }
  };

  // Handle Password Change
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmNewPassword) {
      toast.error('New passwords do not match.', 'Validation Error');
      return;
    }
    if (newPassword.length < 8) {
      toast.error('Password must be at least 8 characters long.', 'Validation Error');
      return;
    }

    try {
      setIsChangingPassword(true);
      await changePasswordApi({ currentPassword, newPassword });
      toast.success('Your password has been changed securely.', 'Password Updated');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update password';
      toast.error(msg, 'Error');
    } finally {
      setIsChangingPassword(false);
    }
  };

  // Handle Data Export (Portability)
  const handleExportData = async () => {
    try {
      setIsExporting(true);
      const data = await exportUserDataApi();

      // Create and trigger browser file download
      const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(data, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute('href', dataStr);
      downloadAnchor.setAttribute('download', `bloodlink-data-export-${new Date().toISOString().slice(0, 10)}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();

      toast.success('Personal data archive generated and downloaded successfully.', 'Export Complete');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to export data';
      toast.error(msg, 'Export Failed');
    } finally {
      setIsExporting(false);
    }
  };

  // Handle Account Deletion
  const handleDeleteAccount = async () => {
    if (!deletePassword) {
      toast.error('Please enter your password to confirm account deletion.', 'Password Required');
      return;
    }

    try {
      setIsDeletingAccount(true);
      await deleteAccountApi(deletePassword);
      toast.success('Account deactivated and personal data anonymized.', 'Account Deleted');
      setIsDeleteDialogOpen(false);
      logout();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to delete account';
      toast.error(msg, 'Deletion Failed');
    } finally {
      setIsDeletingAccount(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 p-4 sm:p-6 lg:p-8">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">Settings & Privacy</h1>
        <p className="text-sm text-slate-500 mt-1">
          Manage your account profile, privacy controls, data portability, and security credentials.
        </p>
      </div>

      {/* Account Profile Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <User className="h-5 w-5 text-slate-600" />
            <CardTitle>Account Information</CardTitle>
          </div>
          <CardDescription>Overview of your authenticated account metadata.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
              <span className="text-xs text-slate-500 font-medium block">Full Name</span>
              <span className="font-semibold text-slate-800">{user?.name || '—'}</span>
            </div>
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
              <span className="text-xs text-slate-500 font-medium block">Registered Email</span>
              <span className="font-semibold text-slate-800">{user?.email || '—'}</span>
            </div>
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
              <span className="text-xs text-slate-500 font-medium block">Platform Role</span>
              <Badge variant="clinical" className="mt-1">{user?.role}</Badge>
            </div>
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
              <span className="text-xs text-slate-500 font-medium block">Account Status</span>
              <Badge variant="vitality" className="mt-1">{user?.status || 'ACTIVE'}</Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Privacy Controls (Especially for Donors) */}
      {user?.role === 'DONOR' && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <EyeOff className="h-5 w-5 text-indigo-600" />
              <CardTitle>Privacy & Masking Controls</CardTitle>
            </div>
            <CardDescription>
              Configure how your geographic and personal contact data is handled across matching views.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start gap-3 p-4 bg-slate-50 rounded-lg border border-slate-200">
              <input
                type="checkbox"
                id="hideLocation"
                checked={hideExactLocation}
                onChange={(e) => setHideExactLocation(e.target.checked)}
                className="mt-1 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              <label htmlFor="hideLocation" className="text-sm cursor-pointer">
                <span className="font-medium text-slate-800 block">
                  Mask Exact GPS Coordinates (Privacy-by-Design)
                </span>
                <span className="text-xs text-slate-500 block mt-0.5">
                  When enabled, hospital coordinators and algorithms only see your city/district and calculated distance, never raw coordinate pins.
                </span>
              </label>
            </div>

            <div className="flex items-start gap-3 p-4 bg-slate-50 rounded-lg border border-slate-200">
              <input
                type="checkbox"
                id="showContactOnlyMatched"
                checked={showContactOnlyMatched}
                onChange={(e) => setShowContactOnlyMatched(e.target.checked)}
                className="mt-1 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              <label htmlFor="showContactOnlyMatched" className="text-sm cursor-pointer">
                <span className="font-medium text-slate-800 block">
                  Restrict Phone Number to Confirmed Matches Only
                </span>
                <span className="text-xs text-slate-500 block mt-0.5">
                  Hospitals can only access your direct helpline if you have explicitly accepted their emergency request.
                </span>
              </label>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={handleSavePrivacy}
              disabled={isSavingPrivacy}
              className="mt-2"
            >
              {isSavingPrivacy ? 'Saving Preferences...' : 'Save Privacy Preferences'}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Security & Password Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Lock className="h-5 w-5 text-slate-700" />
            <CardTitle>Change Password</CardTitle>
          </div>
          <CardDescription>Update your authentication password credentials securely.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleChangePassword} className="space-y-4 max-w-md">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Current Password</label>
              <Input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="••••••••••••"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">New Password (min 8 chars)</label>
              <Input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="••••••••••••"
                required
                minLength={8}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Confirm New Password</label>
              <Input
                type="password"
                value={confirmNewPassword}
                onChange={(e) => setConfirmNewPassword(e.target.value)}
                placeholder="••••••••••••"
                required
                minLength={8}
              />
            </div>
            <Button type="submit" disabled={isChangingPassword} className="mt-2">
              {isChangingPassword ? 'Updating Password...' : 'Update Password'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Data Portability (GDPR / Data Rights) Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Download className="h-5 w-5 text-emerald-600" />
            <CardTitle>Personal Data Portability</CardTitle>
          </div>
          <CardDescription>
            Download a complete machine-readable JSON archive of your personal profile, activity history, and notifications.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-slate-600">
            In accordance with data protection principles (Prompt.md rule 633), you can export all records linked to your account at any time. The archive will download automatically as a structured JSON file.
          </p>
          <Button
            variant="outline"
            onClick={handleExportData}
            disabled={isExporting}
            className="flex items-center gap-2"
          >
            <Download className="h-4 w-4" />
            {isExporting ? 'Compiling Archive...' : 'Download My Data Archive (JSON)'}
          </Button>
        </CardContent>
      </Card>

      {/* Danger Zone: Account Deletion */}
      <Card className="border-red-200 bg-red-50/20">
        <CardHeader>
          <div className="flex items-center gap-2 text-red-700">
            <Trash2 className="h-5 w-5" />
            <CardTitle className="text-red-700">Danger Zone</CardTitle>
          </div>
          <CardDescription className="text-red-600/80">
            Irreversible actions regarding your account ownership and profile existence.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-slate-600">
            Deleting your account will immediately revoke all active sessions, mark your donor profile as permanently unavailable, and scrub your identifiable PII (name, phone, email) in accordance with data retention regulations.
          </p>
          <Button
            variant="emergency"
            onClick={() => setIsDeleteDialogOpen(true)}
            className="flex items-center gap-2"
          >
            <Trash2 className="h-4 w-4" />
            Delete Account
          </Button>
        </CardContent>
      </Card>

      {/* Account Deletion Confirmation Modal */}
      <Modal
        isOpen={isDeleteDialogOpen}
        onClose={() => {
          setIsDeleteDialogOpen(false);
          setDeletePassword('');
        }}
        title="Permanently Delete Account?"
        description="This action cannot be undone. To verify your intent and prevent accidental deletion, please confirm your current account password below:"
        maxWidth="sm"
      >
        <div className="mt-4 space-y-4">
          <Input
            type="password"
            value={deletePassword}
            onChange={(e) => setDeletePassword(e.target.value)}
            placeholder="Enter your current password"
            autoFocus
          />
          <div className="flex gap-2.5 pt-2">
            <Button
              type="button"
              variant="outline"
              fullWidth
              onClick={() => {
                setIsDeleteDialogOpen(false);
                setDeletePassword('');
              }}
              disabled={isDeletingAccount}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              fullWidth
              disabled={isDeletingAccount || !deletePassword}
              onClick={handleDeleteAccount}
            >
              {isDeletingAccount ? 'Deleting...' : 'Delete Account'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
