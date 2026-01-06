'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { subscribeToNewsletter } from '@/actions/newsletter';

export function EmailSignupForm() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('loading');

    const result = await subscribeToNewsletter(email);

    if (result.success) {
      setStatus('success');
      setMessage(result.message);
      setEmail('');
    } else {
      setStatus('error');
      setMessage(result.message);
    }
  };

  if (status === 'success') {
    return (
      <div className="bg-primary-50 text-primary-700 p-4 rounded-lg text-center">
        {message}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3">
      <Input
        type="email"
        placeholder="Enter your email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
        className="flex-1 h-11"
        disabled={status === 'loading'}
      />
      <Button
        type="submit"
        disabled={status === 'loading'}
        className="h-11 bg-primary hover:bg-primary-700"
      >
        {status === 'loading' ? 'Subscribing...' : 'Get Updates'}
      </Button>
      {status === 'error' && (
        <p className="text-red-500 text-sm mt-2">{message}</p>
      )}
    </form>
  );
}
