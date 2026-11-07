import React from 'react';
import { Alert } from '@/components/ui/kit';

/** Shown when a service is unavailable or access is limited. No technical detail leaks. */
export default function ServiceNotice({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <Alert tone="warning" title={title}>
      {children}
    </Alert>
  );
}
