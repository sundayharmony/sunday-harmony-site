'use client';

import { useEffect, useState } from 'react';

interface OnboardingData {
  id: string;
  business_goals: string;
  target_audience: string;
  brand_voice: string;
  social_accounts: {
    instagram?: string;
    facebook?: string;
    tiktok?: string;
    linkedin?: string;
    twitter?: string;
    website?: string;
  };
  google_business_url: string;
  existing_assets: string;
  competitors: string;
  additional_notes: string;
  completed: boolean;
}

export default function OnboardingPage() {
  const [data, setData] = useState<OnboardingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [error, setError] = useState('');
  const [isEditing, setIsEditing] = useState(false);

  // Fetch existing onboarding data
  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch('/api/dashboard/onboarding');
        if (!res.ok) throw new Error('Failed to fetch onboarding data');
        const result = await res.json();
        setData(result.data);
        if (!result.data?.completed) {
          setIsEditing(true);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Auto-save on blur
  const handleBlur = async (field: string, value: string) => {
    if (!data) return;

    setSaveStatus('saving');
    try {
      const updateData = { ...data, [field]: value };
      const res = await fetch('/api/dashboard/onboarding', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData),
      });

      if (!res.ok) throw new Error('Failed to save');
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
      setSaveStatus('idle');
    }
  };

  // Handle social account change
  const handleSocialAccountChange = async (platform: string, value: string) => {
    if (!data) return;

    const updatedSocials = {
      ...data.social_accounts,
      [platform]: value,
    };

    setData({
      ...data,
      social_accounts: updatedSocials,
    });

    setSaveStatus('saving');
    try {
      const res = await fetch('/api/dashboard/onboarding', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          social_accounts: updatedSocials,
        }),
      });

      if (!res.ok) throw new Error('Failed to save');
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
      setSaveStatus('idle');
    }
  };

  // Submit onboarding
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!data) return;

    setSaving(true);
    try {
      const res = await fetch('/api/dashboard/onboarding', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, completed: true }),
      });

      if (!res.ok) throw new Error('Failed to submit onboarding');
      setData(prev => prev ? { ...prev, completed: true } : null);
      setIsEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-brand-muted">Loading...</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-brand-text">Unable to load onboarding form</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-serif text-brand-text mb-2">Getting Started</h1>
        <p className="text-brand-muted">Help us understand your business so we can create the perfect strategy.</p>
      </div>

      {/* Completion Banner */}
      {data.completed && !isEditing && (
        <div className="mb-6 bg-green-50 border border-green-200 rounded-2xl p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-brand-text font-serif text-lg mb-1">Onboarding Complete</h3>
              <p className="text-brand-muted">Your information has been saved. Your Sunday Harmony team can now begin working on your strategy.</p>
            </div>
            <button
              onClick={() => setIsEditing(true)}
              className="px-4 py-2 text-brand-gold hover:text-brand-gold/80 font-medium transition-colors"
            >
              Edit
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-2xl p-4 text-red-700">
          {error}
        </div>
      )}

      {(isEditing || !data.completed) && (
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Business Goals */}
          <div className="bg-white border border-brand-border rounded-2xl p-6">
            <label className="block text-brand-text font-serif text-lg mb-2">
              Business Goals
            </label>
            <p className="text-brand-muted text-sm mb-3">What are your top 3 business goals for the next 6 months?</p>
            <textarea
              value={data.business_goals}
              onChange={(e) => setData({ ...data, business_goals: e.target.value })}
              onBlur={(e) => handleBlur('business_goals', e.target.value)}
              rows={4}
              className="w-full px-4 py-3 border border-brand-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-gold/20 text-brand-text placeholder-brand-dim"
              placeholder="E.g., Increase brand awareness, Launch new product line, Grow email list to 5000 subscribers..."
            />
          </div>

          {/* Target Audience */}
          <div className="bg-white border border-brand-border rounded-2xl p-6">
            <label className="block text-brand-text font-serif text-lg mb-2">
              Target Audience
            </label>
            <p className="text-brand-muted text-sm mb-3">Describe your ideal customer (age, location, interests, pain points)</p>
            <textarea
              value={data.target_audience}
              onChange={(e) => setData({ ...data, target_audience: e.target.value })}
              onBlur={(e) => handleBlur('target_audience', e.target.value)}
              rows={4}
              className="w-full px-4 py-3 border border-brand-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-gold/20 text-brand-text placeholder-brand-dim"
              placeholder="E.g., Women ages 25-45, interested in wellness and sustainable products, located in urban areas..."
            />
          </div>

          {/* Brand Voice */}
          <div className="bg-white border border-brand-border rounded-2xl p-6">
            <label className="block text-brand-text font-serif text-lg mb-2">
              Brand Voice & Personality
            </label>
            <p className="text-brand-muted text-sm mb-3">How would you describe your brand's personality? (e.g., professional, friendly, bold, luxury)</p>
            <textarea
              value={data.brand_voice}
              onChange={(e) => setData({ ...data, brand_voice: e.target.value })}
              onBlur={(e) => handleBlur('brand_voice', e.target.value)}
              rows={4}
              className="w-full px-4 py-3 border border-brand-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-gold/20 text-brand-text placeholder-brand-dim"
              placeholder="E.g., Warm and approachable, with a modern edge. We speak to our audience like we're sharing a secret..."
            />
          </div>

          {/* Social Accounts */}
          <div className="bg-white border border-brand-border rounded-2xl p-6">
            <label className="block text-brand-text font-serif text-lg mb-4">
              Social Media Accounts
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {['instagram', 'facebook', 'tiktok', 'linkedin', 'twitter', 'website'].map((platform) => (
                <div key={platform}>
                  <label className="block text-brand-text text-sm font-medium mb-2 capitalize">
                    {platform}
                  </label>
                  <input
                    type="text"
                    value={data.social_accounts[platform as keyof typeof data.social_accounts] || ''}
                    onChange={(e) => handleSocialAccountChange(platform, e.target.value)}
                    placeholder={`Your ${platform} ${platform === 'website' ? 'URL' : 'handle or URL'}`}
                    className="w-full px-4 py-2 border border-brand-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-gold/20 text-brand-text placeholder-brand-dim text-sm"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Google Business */}
          <div className="bg-white border border-brand-border rounded-2xl p-6">
            <label className="block text-brand-text font-serif text-lg mb-2">
              Google Business Profile
            </label>
            <p className="text-brand-muted text-sm mb-3">Paste your Google Business Profile URL (if you have one)</p>
            <input
              type="text"
              value={data.google_business_url}
              onChange={(e) => setData({ ...data, google_business_url: e.target.value })}
              onBlur={(e) => handleBlur('google_business_url', e.target.value)}
              placeholder="https://www.google.com/business/..."
              className="w-full px-4 py-3 border border-brand-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-gold/20 text-brand-text placeholder-brand-dim"
            />
          </div>

          {/* Existing Assets */}
          <div className="bg-white border border-brand-border rounded-2xl p-6">
            <label className="block text-brand-text font-serif text-lg mb-2">
              Existing Marketing Assets
            </label>
            <p className="text-brand-muted text-sm mb-3">What marketing assets do you currently have? (logo, photos, videos, brochures, etc.)</p>
            <textarea
              value={data.existing_assets}
              onChange={(e) => setData({ ...data, existing_assets: e.target.value })}
              onBlur={(e) => handleBlur('existing_assets', e.target.value)}
              rows={3}
              className="w-full px-4 py-3 border border-brand-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-gold/20 text-brand-text placeholder-brand-dim"
              placeholder="E.g., Professional logo, 50+ product photos, company video, brand guidelines document..."
            />
          </div>

          {/* Competitors */}
          <div className="bg-white border border-brand-border rounded-2xl p-6">
            <label className="block text-brand-text font-serif text-lg mb-2">
              Competitors
            </label>
            <p className="text-brand-muted text-sm mb-3">Who are your top 3 competitors? (names and/or URLs)</p>
            <textarea
              value={data.competitors}
              onChange={(e) => setData({ ...data, competitors: e.target.value })}
              onBlur={(e) => handleBlur('competitors', e.target.value)}
              rows={3}
              className="w-full px-4 py-3 border border-brand-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-gold/20 text-brand-text placeholder-brand-dim"
              placeholder="E.g., Company A (www.companya.com), Company B (www.companyb.com), Company C..."
            />
          </div>

          {/* Additional Notes */}
          <div className="bg-white border border-brand-border rounded-2xl p-6">
            <label className="block text-brand-text font-serif text-lg mb-2">
              Additional Information
            </label>
            <p className="text-brand-muted text-sm mb-3">Anything else we should know?</p>
            <textarea
              value={data.additional_notes}
              onChange={(e) => setData({ ...data, additional_notes: e.target.value })}
              onBlur={(e) => handleBlur('additional_notes', e.target.value)}
              rows={3}
              className="w-full px-4 py-3 border border-brand-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-gold/20 text-brand-text placeholder-brand-dim"
              placeholder="Share any additional context that would help our team..."
            />
          </div>

          {/* Save Status Indicator */}
          <div className="flex items-center justify-between">
            <div className="h-4">
              {saveStatus === 'saving' && (
                <p className="text-brand-muted text-sm">Saving...</p>
              )}
              {saveStatus === 'saved' && (
                <p className="text-green-600 text-sm">Saved</p>
              )}
            </div>
          </div>

          {/* Submit Button */}
          <div className="flex gap-4">
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-3 bg-brand-gold text-white font-medium rounded-lg hover:bg-brand-gold/90 transition-colors disabled:opacity-50"
            >
              {saving ? 'Submitting...' : 'Complete Onboarding'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
