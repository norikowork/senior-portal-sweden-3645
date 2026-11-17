import { useCallback, useEffect, useRef, useState } from 'react';
import auth from '@/lib/shared/kliv-auth.js';

export function useAuth() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const authChanges = useRef(0);

  // kliv-auth announces `kliv:auth-changed` whenever the signed-in member changes: a sign-in or
  // sign-out from any component, a refresh that finds another member or none, or a test runner
  // handing the page to another actor. By then the SDK has already stored the new member, so
  // following it costs no request. A call's own answer can carry more than an announcement does
  // (a profile edit keeps the same member, so nothing is announced), but if a change was announced
  // while the call was in flight its answer may be older than the SDK's, so `adopt` takes the SDK's.
  const adopt = useCallback((changesWhenStarted: number, member: any) => {
    const current = authChanges.current === changesWhenStarted ? member : (auth.user ?? null);
    setUser(current);
    return current;
  }, []);

  // Asks the server who is signed in and returns that member, or null.
  const refresh = useCallback(async () => {
    const started = authChanges.current;
    setLoading(true);
    try {
      return adopt(started, await auth.getUser(true));
    } finally {
      setLoading(false);
    }
  }, [adopt]);

  useEffect(() => {
    let active = true;
    const followAuthChange = () => {
      authChanges.current += 1;
      setUser(auth.user ?? null);
      setLoading(false);
    };
    window.addEventListener('kliv:auth-changed', followAuthChange);
    const started = authChanges.current;
    auth.getUser().then((u: any) => {
      if (!active) return;
      adopt(started, u);
      setLoading(false);
    });
    return () => {
      active = false;
      window.removeEventListener('kliv:auth-changed', followAuthChange);
    };
  }, [adopt]);

  const signIn = async (email: string, password: string) => {
    const started = authChanges.current;
    const result = await auth.signIn(email, password);
    if (result.status === 'authenticated') {
      adopt(started, result.user);
    }
    return result;
  };

  const signInWithPasskey = async () => {
    const started = authChanges.current;
    const u = await auth.signInWithPasskey();
    adopt(started, u);
    return u;
  };

  const signUp = async (email: string, password: string, name: string) => {
    const started = authChanges.current;
    const u = await auth.signUp(email, password, name);
    adopt(started, u);
    return u;
  };

  const signOut = async () => {
    const started = authChanges.current;
    await auth.signOut();
    adopt(started, null);
  };

  // The five fields PUT /api/v2/auth/user accepts. It takes user metadata as `metadata` but
  // returns it as `userMetadata`, and the write replaces the whole map — read the current map
  // and merge onto it (see @/lib/authAccount) or the keys you omit are deleted.
  const updateUser = async (updates: {
    firstName?: string;
    lastName?: string;
    email?: string;
    password?: string;
    currentPassword?: string;
    metadata?: Record<string, string>;
  }) => {
    return await auth.updateUser(updates);
  };

  const cancelEmailChange = async () => {
    const started = authChanges.current;
    const updated = await auth.cancelEmailChange();
    adopt(started, updated);
    return updated;
  };

  const resendEmailChange = async () => {
    await auth.resendEmailChange();
  };

  const submitTotp = async (email: string, password: string, code: string) => {
    const started = authChanges.current;
    const result = await auth.submitTotp(email, password, code);
    if (result.status === 'authenticated') {
      adopt(started, result.user);
    }
    return result;
  };

  const submitRecoveryCode = async (email: string, password: string, code: string) => {
    const started = authChanges.current;
    const result = await auth.submitRecoveryCode(email, password, code);
    if (result.status === 'authenticated') {
      adopt(started, result.user);
    }
    return result;
  };

  // Completes a sign-in that answered `verification_required`, with the emailed link's token or
  // the emailed code. Only the browser that entered the password can complete it.
  const verifySignIn = async (proof: { token: string } | { code: string }) => {
    const started = authChanges.current;
    const u = await auth.verifySignIn(proof);
    adopt(started, u);
    return u;
  };

  const getOAuthProviders = async () => {
    return await auth.getOAuthProviders();
  };

  const signInWithOAuth = async (provider: string) => {
    return await auth.signInWithOAuth(provider as any);
  };

  const listIdentities = async () => {
    return await auth.listIdentities();
  };

  const removeIdentity = async (identityUuid: string) => {
    return await auth.removeIdentity(identityUuid);
  };

  const renameIdentity = async (identityUuid: string, label: string) => {
    return await auth.renameIdentity(identityUuid, label);
  };

  const addPasskey = async (name?: string) => {
    return await auth.addPasskey(name);
  };

  const enrollTotp = async () => {
    return await auth.enrollTotp();
  };

  const confirmTotp = async (code: string) => {
    return await auth.confirmTotp(code);
  };

  const disableTotp = async () => {
    return await auth.disableTotp();
  };

  const regenerateRecoveryCodes = async () => {
    return await auth.regenerateRecoveryCodes();
  };

  const changePassword = async (currentPassword: string, newPassword: string) => {
    return await auth.changePassword(currentPassword, newPassword);
  };

  const listSessions = async () => {
    return await auth.listSessions();
  };

  const logoutAllDevices = async () => {
    return await auth.logoutAllDevices();
  };

  const reauthenticate = async (password: string) => {
    return await auth.reauthenticate(password);
  };

  const reauthenticateWithPasskey = async () => {
    return await auth.reauthenticateWithPasskey();
  };

  return {
    user,
    loading,
    signedIn: user !== null,
    refresh,
    signIn,
    signInWithPasskey,
    signUp,
    signOut,
    updateUser,
    cancelEmailChange,
    resendEmailChange,
    submitTotp,
    submitRecoveryCode,
    verifySignIn,
    getOAuthProviders,
    signInWithOAuth,
    listIdentities,
    removeIdentity,
    renameIdentity,
    addPasskey,
    enrollTotp,
    confirmTotp,
    disableTotp,
    regenerateRecoveryCodes,
    changePassword,
    listSessions,
    logoutAllDevices,
    reauthenticate,
    reauthenticateWithPasskey,
  };
}
