'use client';

/**
 * Device state for offline capture (spec §5 Phase 4): PIN lock, idle auto-lock (10 min),
 * device wipe on sign-out or user switch, pending-sync count, and starting the outbox.
 */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { useAuth, useSession } from '@clerk/nextjs';
import { isUnlocked, lock, onLockChange, setupPin, unlock } from '@/lib/offline/crypto';
import { getMeta, setMeta, wipeDevice } from '@/lib/offline/db';
import { onOutboxChange, pendingCount, startOutbox, syncNow } from '@/lib/offline/outbox';

const IDLE_MS = 10 * 60_000;

type DeviceState = {
  unlocked: boolean;
  hasPin: boolean | null;
  pending: number;
  syncing: boolean;
  setPin(pin: string): Promise<void>;
  unlockWithPin(pin: string): Promise<boolean>;
  lockNow(): void;
  syncNow(): Promise<void>;
};

const Ctx = createContext<DeviceState | null>(null);

export function useDevice(): DeviceState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useDevice must be used inside DeviceProvider');
  return v;
}

function useUnlocked() {
  return useSyncExternalStore(onLockChange, isUnlocked, () => false);
}

export default function DeviceProvider({ children }: { children: React.ReactNode }) {
  const { isLoaded, isSignedIn, userId } = useAuth();
  const { session } = useSession();
  const unlocked = useUnlocked();
  const [hasPin, setHasPin] = useState<boolean | null>(null);
  const [pending, setPending] = useState(0);
  const [syncing, setSyncing] = useState(false);

  // Wipe the device when the signed-in user changes or signs out.
  useEffect(() => {
    if (!isLoaded) return;
    let cancelled = false;
    (async () => {
      try {
        const owner = await getMeta<string>('owner');
        if (!isSignedIn) {
          if (owner && navigator.onLine) {
            lock();
            await wipeDevice();
          }
          return;
        }
        if (owner && owner !== userId) {
          lock();
          await wipeDevice();
        }
        await setMeta('owner', userId);
        if (session?.expireAt) await setMeta('sessionExpiresAt', new Date(session.expireAt).getTime());
        const salt = await getMeta<Uint8Array>('pinSalt');
        if (!cancelled) setHasPin(Boolean(salt));
      } catch {
        if (!cancelled) setHasPin(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isLoaded, isSignedIn, userId, session?.expireAt]);

  // Pending count.
  useEffect(() => {
    const refresh = () => pendingCount().then(setPending).catch(() => {});
    refresh();
    return onOutboxChange(refresh);
  }, []);

  // Start syncing once unlocked.
  useEffect(() => {
    if (unlocked) startOutbox();
  }, [unlocked]);

  // Idle auto-lock.
  useEffect(() => {
    if (!unlocked) return;
    let timer = setTimeout(lock, IDLE_MS);
    const reset = () => {
      clearTimeout(timer);
      timer = setTimeout(lock, IDLE_MS);
    };
    const events = ['pointerdown', 'keydown', 'touchstart', 'scroll'];
    events.forEach((e) => window.addEventListener(e, reset, { passive: true }));
    return () => {
      clearTimeout(timer);
      events.forEach((e) => window.removeEventListener(e, reset));
    };
  }, [unlocked]);

  const setPin = useCallback(async (pin: string) => {
    const { salt, verifier } = await setupPin(pin);
    await setMeta('pinSalt', salt);
    await setMeta('pinVerifier', verifier);
    setHasPin(true);
  }, []);

  const unlockWithPin = useCallback(async (pin: string) => {
    const salt = await getMeta<Uint8Array>('pinSalt');
    const verifier = await getMeta<ArrayBuffer>('pinVerifier');
    if (!salt || !verifier) return false;
    const expires = await getMeta<number>('sessionExpiresAt');
    if (!navigator.onLine && expires && expires < Date.now()) return false; // must sign in again online
    return unlock(pin, salt, verifier);
  }, []);

  const doSync = useCallback(async () => {
    setSyncing(true);
    try {
      await syncNow();
    } finally {
      setSyncing(false);
      setPending(await pendingCount().catch(() => 0));
    }
  }, []);

  const value = useMemo<DeviceState>(
    () => ({ unlocked, hasPin, pending, syncing, setPin, unlockWithPin, lockNow: lock, syncNow: doSync }),
    [unlocked, hasPin, pending, syncing, setPin, unlockWithPin, doSync],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
