'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useUser } from '@clerk/nextjs';
import ServiceNotice from '@/components/layout/ServiceNotice';
import { useDevice } from '@/components/offline/DeviceProvider';
import { organisationErrorMessage } from '@/lib/organisation-errors';
import { useWorkspaces } from './use-workspaces';
import { cardCls, errorCls, fieldCls, labelCls, primaryBtnCls, secondaryBtnCls } from './styles';

export default function CreateOrganisationForm() {
  const { pending } = useDevice();
  const { isLoaded: userLoaded, user } = useUser();
  const { isLoaded, createOrganization, refreshLists, switchTo } = useWorkspaces();
  const [name, setName] = useState('');
  const [createdId, setCreatedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  if (userLoaded && user && !user.createOrganizationEnabled) {
    return <ServiceNotice title="Creating organisations is turned off">Ask your DaktariScribe administrator to set one up for you.</ServiceNotice>;
  }

  const locked = pending > 0;
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (trimmed.length < 2) return setError('Enter a name with at least 2 characters.');
    setBusy(true);
    setError('');
    let id = createdId;
    try {
      if (!id) {
        if (!createOrganization) throw new Error('not ready');
        id = (await createOrganization({ name: trimmed })).id;
        // Trying again after a failed switch must not create a second organisation.
        setCreatedId(id);
      }
      await switchTo(id, '/organisation');
      await refreshLists();
    } catch (err) {
      setError(
        id
          ? 'Your organisation was created, but it could not be opened. Check your connection and try again.'
          : organisationErrorMessage(err, 'The organisation could not be created. Check your connection and try again.'),
      );
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} noValidate className={`${cardCls} flex flex-col gap-4`}>
      {locked && (
        <p role="status" className={errorCls}>
          Upload or discard the records waiting on this device before creating an organisation. Otherwise they could be saved to the wrong workspace.
        </p>
      )}
      {error && (
        <p role="alert" className={errorCls}>
          {error}
        </p>
      )}
      <div className="max-w-lg">
        <label htmlFor="org-name" className={labelCls}>
          Organisation name
        </label>
        <input
          id="org-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={createdId !== null}
          maxLength={100}
          autoComplete="organization"
          placeholder="For example, Kawempe Health Centre"
          className={fieldCls}
        />
        <p className="mt-1 text-[13px] text-on-surface-variant">This name appears in the workspace menu and on exported reports. You can change it later.</p>
      </div>
      <p className="text-body-md text-on-surface-variant">You will be the admin. Records in your personal workspace stay there and do not move to the organisation.</p>
      <div className="flex flex-wrap gap-3">
        <button type="submit" disabled={busy || locked || !isLoaded} className={primaryBtnCls}>
          {busy ? 'Creating…' : createdId ? 'Open organisation' : 'Create organisation'}
        </button>
        <Link href="/field-entry" className={secondaryBtnCls}>
          Cancel
        </Link>
      </div>
    </form>
  );
}
