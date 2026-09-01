'use client';

import { useEffect, useState } from 'react';
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input, Label, Textarea } from '@fleek/ui';
import { apiFetch, useAuth } from '@/lib/auth';

export default function VerifyPage() {
  return (
    <div className="mx-auto max-w-4xl p-8">
      <h1 className="mb-1 text-2xl font-bold font-display">Run a verification</h1>
      <p className="mb-6 text-sm text-slate-500">Sandbox mode</p>
    </div>
  );
}
