'use client';

import { useEffect, useState } from 'react';

interface UserSettings {
  id: string;
  name: string;
  email: string;
}

export default function AdminSettingsPage() {
  const [user, setUser] = useState<UserSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Password form state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);

  // Fetch user settings
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await fetch('/api/dashboard/settings');
        if (!res.ok) throw new Error('Failed to fetch settings');
        const result = await res.json();
        setUser(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchSettings();
  }, []);

  // Handle password change
  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError('');
    setPasswordSuccess('');

    // Validation
    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordError('Please fill in all password fields');
      return;
    }

    if (newPassword.length < 8) {
      setPasswordError('New password must be at least 8 characters');
      return;
    }

    if (!/[A-Z]/.test(newPassword) || !/[a-z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
      setPasswordError('Password must contain at least one uppercase letter, one lowercase letter, and one number');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('Passwords do not match');
      return;
    }

    setChangingPassword(true);
    try {
      const res = await fetch('/api/dashboard/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to change password');
      }

      setPasswordSuccess('Password changed successfully');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setPasswordSuccess(''), 5000);
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : 'Failed to change password');
    } finally {
      setChangingPassword(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-brand-muted">Loading...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-brand-text">Unable to load settings</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-serif text-brand-text">Settings</h1>
        <p className="text-brand-muted text-sm mt-1">Manage your account and security</p>
      </div>

      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-2xl p-4 text-red-700">
          {error}
        </div>
      )}

      {/* Account Information */}
      <div className="bg-white border border-brand-border rounded-2xl p-6 mb-6">
        <h2 className="text-lg font-serif text-brand-text mb-6">Account Information</h2>

        <div className="space-y-4">
          <div>
            <label className="block text-brand-text font-medium text-sm mb-2">Full Name</label>
            <p className="px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-brand-text">
              {user.name}
            </p>
          </div>

          <div>
            <label className="block text-brand-text font-medium text-sm mb-2">Email Address</label>
            <p className="px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-brand-text">
              {user.email}
            </p>
          </div>
        </div>
      </div>

      {/* Change Password */}
      <div className="bg-white border border-brand-border rounded-2xl p-6">
        <h2 className="text-lg font-serif text-brand-text mb-2">Change Password</h2>
        <p className="text-brand-muted text-sm mb-6">Update your password directly â no email reset needed.</p>

        {passwordError && (
          <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm">
            {passwordError}
          </div>
        )}

        {passwordSuccess && (
          <div className="mb-4 bg-green-50 border border-green-200 rounded-lg p-3 text-green-700 text-sm">
            {passwordSuccess}
          </div>
        )}

        <form onSubmit={handlePasswordChange} className="space-y-4">
          <div>
            <label htmlFor="current-password" className="block text-brand-text font-medium text-sm mb-2">
              Current Password
            </label>
            <input
              id="current-password"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full px-4 py-3 border border-brand-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-gold/20 text-brand-text placeholder-brand-dim"
              placeholder="Enter your current password"
            />
          </div>

          <div>
            <label htmlFor="new-password" className="block text-brand-text font-medium text-sm mb-2">
              New Password
            </label>
            <input
              id="new-password"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full px-4 py-3 border border-brand-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-gold/20 text-brand-text placeholder-brand-dim"
              placeholder="Enter new password (min 8 characters)"
            />
            <p className="text-brand-muted text-xs mt-1">Min 8 characters with uppercase, lowercase, and a number</p>
          </div>

          <div>
            <label htmlFor="confirm-password" className="block text-brand-text font-medium text-sm mb-2">
              Confirm New Password
            </label>
            <input
              id="confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-4 py-3 border border-brand-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-gold/20 text-brand-text placeholder-brand-dim"
              placeholder="Confirm your new password"
            />
          </div>

          <button
            type="submit"
            disabled={changingPassword}
            className="w-full px-6 py-3 bg-brand-gold text-white font-medium rounded-lg hover:bg-brand-gold/90 transition-colors disabled:opacity-50"
          >
            {changingPassword ? 'Changing Password...' : 'Change Password'}
          </button>
        </form>
      </div>
    </div>
  );
}
