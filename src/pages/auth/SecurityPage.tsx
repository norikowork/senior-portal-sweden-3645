import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { SignedInDevices } from '@/components/auth/SignedInDevices';
import type { SignedInSession } from '@/lib/shared/kliv-auth.js';
import { Shield, Key, Smartphone, Lock, LogOut, AlertCircle, CheckCircle2, Copy, Download, Plus, Trash2, Edit2, ArrowLeft, Loader2 } from 'lucide-react';

// The enrollment's QR code arrives already rendered by Kliv. It is drawn only as an inline image:
// the otpauth URI carries the TOTP secret, so it must never be sent to an image or QR service.
function isInlineQrImage(value: unknown): value is string {
  return typeof value === 'string' && value.startsWith('data:image/png;base64,');
}

function securityError(reason: unknown, fallback: string, notFoundMessage?: string) {
  const code = (reason as { code?: string } | null)?.code;
  if (code === 'not_found' && notFoundMessage) return notFoundMessage;
  if (code === 'impersonation_refused') return 'Säkerhetsinställningarna kan inte ändras när du agerar som en annan användare.';
  return fallback;
}

const SecurityPage = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading, listIdentities, removeIdentity, renameIdentity, addPasskey, enrollTotp, confirmTotp, disableTotp, regenerateRecoveryCodes, changePassword, listSessions, logoutAllDevices, reauthenticate, reauthenticateWithPasskey } = useAuth();

  const [identities, setIdentities] = useState<any[]>([]);
  const [sessions, setSessions] = useState<SignedInSession[] | null>(null);
  const [sessionsFailed, setSessionsFailed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [reauthPassword, setReauthPassword] = useState('');
  const [showReauth, setShowReauth] = useState(false);
  const [pendingAction, setPendingAction] = useState<(() => Promise<void>) | null>(null);

  // Password change
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);

  // TOTP enrollment
  const [showTotpEnroll, setShowTotpEnroll] = useState(false);
  const [totpEnrollment, setTotpEnrollment] = useState<any>(null);
  const [totpCode, setTotpCode] = useState('');
  const [enrollingTotp, setEnrollingTotp] = useState(false);
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [showRecoveryCodes, setShowRecoveryCodes] = useState(false);

  // Add passkey
  const [showAddPasskey, setShowAddPasskey] = useState(false);
  const [passkeyName, setPasskeyName] = useState('');
  const [addingPasskey, setAddingPasskey] = useState(false);

  // Rename identity
  const [renamingIdentity, setRenamingIdentity] = useState<string | null>(null);
  const [newLabel, setNewLabel] = useState('');
  const [savingRename, setSavingRename] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate('/login', { state: { from: '/account/security' } });
      return;
    }
    loadIdentities();
    loadSessions();
  }, [authLoading, user]);

  const loadSessions = async () => {
    try {
      setSessions(await listSessions());
      setSessionsFailed(false);
    } catch {
      // Shown in place of the list; the rest of the page does not depend on it.
      setSessionsFailed(true);
    }
  };

  const loadIdentities = async () => {
    try {
      const data = await listIdentities();
      setIdentities(data);
    } catch (err: unknown) {
      toast.error('Något gick fel', { description: securityError(err, 'Det gick inte att visa säkerhetsinställningarna.') });
    } finally {
      setLoading(false);
    }
  };

  const handleReauthRequired = (action: () => Promise<void>) => {
    setPendingAction(() => action);
    setShowReauth(true);
  };

  const handlePasskeyReauth = async () => {
    if (!pendingAction) return;
    try {
      await reauthenticateWithPasskey();
    } catch (err: unknown) {
      toast.error('Något gick fel', { description: securityError(err, 'Bekräftelsen med nyckel avbröts eller misslyckades. Försök igen, eller logga ut och logga in igen.') });
      return;
    }
    setShowReauth(false);
    setReauthPassword('');
    const action = pendingAction;
    setPendingAction(null);
    try {
      await action();
    } catch (err: any) {
      toast.error('Något gick fel', { description: securityError(err, 'Ändringen kunde inte genomföras.') });
    }
  };

  const handleReauthSubmit = async () => {
    if (!pendingAction) return;
    try {
      await reauthenticate(reauthPassword);
      setShowReauth(false);
      setReauthPassword('');
      await pendingAction();
      setPendingAction(null);
    } catch (err: any) {
      if (err.message?.includes('bad_credentials')) {
        toast.error('Något gick fel', { description: 'Fel lösenord' });
      } else {
        toast.error('Något gick fel', { description: securityError(err, 'Det gick inte att bekräfta att det är du') });
      }
    }
  };

  const handleRemoveIdentity = async (identity: any) => {
    if (!confirm(`Ta bort ${getIdentityLabel(identity)}?`)) return;

    try {
      await removeIdentity(identity.uuid);
      toast.success('Klart', { description: 'Inloggningssättet är borttaget.' });
      loadIdentities();
    } catch (err: any) {
      if (err.message?.includes('cannot_remove_last_login_method')) {
        toast.error('Kan inte tas bort', { description: 'Du måste ha minst ett sätt att logga in.' });
      } else if (err.message?.includes('reauth_required')) {
        handleReauthRequired(() => handleRemoveIdentity(identity));
      } else {
        toast.error('Något gick fel', { description: securityError(err, 'Det gick inte att ta bort inloggningssättet.', 'Inloggningssättet finns inte längre eller är inte tillgängligt för dig.') });
      }
    }
  };

  const handleRenameIdentity = async () => {
    if (!renamingIdentity || !newLabel.trim()) return;
    setSavingRename(true);
    try {
      await renameIdentity(renamingIdentity, newLabel);
      toast.success('Klart', { description: 'Nyckeln har fått ett nytt namn.' });
      setRenamingIdentity(null);
      setNewLabel('');
      loadIdentities();
    } catch (err) {
      toast.error('Något gick fel', { description: securityError(err, 'Det gick inte att byta namn på nyckeln.', 'Inloggningssättet finns inte längre eller är inte tillgängligt för dig.') });
    } finally {
      setSavingRename(false);
    }
  };

  const handleAddPasskey = async () => {
    setAddingPasskey(true);
    try {
      const action = async () => {
        await addPasskey(passkeyName || undefined);
        toast.success('Klart', { description: 'Nyckeln är tillagd.' });
        setShowAddPasskey(false);
        setPasskeyName('');
        loadIdentities();
      };
      await action();
    } catch (err: any) {
      if (err.message?.includes('reauth_required')) {
        handleReauthRequired(handleAddPasskey);
      } else if (err.code === 'not_found') {
        toast.error('Något gick fel', { description: 'Nyckeln blev inte klar. Kontrollera dina inloggningssätt innan du försöker igen.' });
        loadIdentities();
      } else if (err.message?.includes('not_validated') || err.message?.includes('challenge_not_found')) {
        toast.error('Avbrutet', { description: 'Nyckeln skapades inte eftersom det avbröts.' });
      } else {
        toast.error('Något gick fel', {
          description: securityError(err, `Det gick inte att lägga till nyckeln: ${(err && (err.name || err.message)) || 'okänt fel'}`),
        });
      }
    } finally {
      setAddingPasskey(false);
    }
  };

  const handleEnrollTotp = async () => {
    setEnrollingTotp(true);
    try {
      const action = async () => {
        const enrollment = await enrollTotp();
        setTotpEnrollment(enrollment);
        setShowTotpEnroll(true);
      };
      await action();
    } catch (err: any) {
      if (err.message?.includes('reauth_required')) {
        handleReauthRequired(async () => {
          const enrollment = await enrollTotp();
          setTotpEnrollment(enrollment);
          setShowTotpEnroll(true);
        });
      } else if (err.message?.includes('totp_already_enabled')) {
        toast.error('Redan påslagen', {
          description: 'Verifieringskoden är redan påslagen.',
        });
      } else {
        toast.error('Något gick fel', { description: securityError(err, 'Det gick inte att starta inställningen.') });
      }
    } finally {
      setEnrollingTotp(false);
    }
  };

  const handleConfirmTotp = async () => {
    if (!totpCode || totpCode.length !== 6) {
      toast.error('Fel kod', {
        description: 'Ange koden med 6 siffror från din autentiseringsapp.',
      });
      return;
    }
    setEnrollingTotp(true);
    try {
      const result = await confirmTotp(totpCode);
      setRecoveryCodes(result.recoveryCodes);
      setShowRecoveryCodes(true);
      setShowTotpEnroll(false);
      setTotpEnrollment(null);
      setTotpCode('');
      loadIdentities();
    } catch (err: any) {
      if (err.message?.includes('invalid_code')) {
        toast.error('Fel kod', { description: 'Koden du skrev in stämmer inte.' });
      } else if (err.message?.includes('reauth_required')) {
        handleReauthRequired(async () => {
          const result = await confirmTotp(totpCode);
          setRecoveryCodes(result.recoveryCodes);
          setShowRecoveryCodes(true);
          setShowTotpEnroll(false);
          setTotpEnrollment(null);
          setTotpCode('');
          loadIdentities();
        });
      } else {
        toast.error('Något gick fel', { description: securityError(err, 'Det gick inte att slå på verifieringskoden.') });
      }
    } finally {
      setEnrollingTotp(false);
    }
  };

  const handleDisableTotp = async () => {
    if (!confirm('Stänga av verifieringskoden? Ditt konto blir mindre skyddat.')) return;
    try {
      const action = async () => {
        await disableTotp();
        toast.success('Klart', { description: 'Verifieringskoden är avstängd.' });
        loadIdentities();
      };
      await action();
    } catch (err: any) {
      if (err.message?.includes('reauth_required')) {
        handleReauthRequired(async () => {
          await disableTotp();
          toast.success('Klart', { description: 'Verifieringskoden är avstängd.' });
          loadIdentities();
        });
      } else {
        toast.error('Något gick fel', { description: securityError(err, 'Det gick inte att stänga av verifieringskoden.', 'Inloggningssättet finns inte längre eller är inte tillgängligt för dig.') });
      }
    }
  };

  const handleRegenerateCodes = async () => {
    if (!confirm('Skapa nya reservkoder? Dina gamla koder slutar fungera direkt.')) return;
    try {
      const action = async () => {
        const result = await regenerateRecoveryCodes();
        setRecoveryCodes(result.recoveryCodes);
        setShowRecoveryCodes(true);
      };
      await action();
    } catch (err: any) {
      if (err.message?.includes('reauth_required')) {
        handleReauthRequired(async () => {
          const result = await regenerateRecoveryCodes();
          setRecoveryCodes(result.recoveryCodes);
          setShowRecoveryCodes(true);
        });
      } else {
        toast.error('Något gick fel', { description: securityError(err, 'Det gick inte att skapa nya reservkoder.') });
      }
    }
  };

  const handleChangePassword = async () => {
    if (newPassword !== confirmPassword) {
      toast.error('Stämmer inte', { description: 'De nya lösenorden är inte likadana.' });
      return;
    }
    setChangingPassword(true);
    try {
      await changePassword(currentPassword, newPassword);
      toast.success('Klart', { description: 'Lösenordet är ändrat.' });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      if (err.message?.includes('bad_credentials')) {
        toast.error('Fel lösenord', { description: 'Ditt nuvarande lösenord stämmer inte.' });
      } else if (err.message?.includes('insufficient_password_complexity')) {
        toast.error('För svagt lösenord', {
          description: 'Lösenordet är för svagt. Välj ett längre lösenord som inte är din e-postadress eller ett vanligt lösenord.',
        });
      } else {
        toast.error('Något gick fel', { description: securityError(err, 'Det gick inte att ändra lösenordet.') });
      }
    } finally {
      setChangingPassword(false);
    }
  };

  const handleLogoutAll = async () => {
    if (!confirm('Logga ut från alla andra enheter? Du är fortfarande inloggad på den här enheten.')) return;
    try {
      const action = async () => {
        await logoutAllDevices();
        toast.success('Klart', { description: 'Du är utloggad från alla andra enheter.' });
        loadSessions();
      };
      await action();
    } catch (err: any) {
      if (err.message?.includes('reauth_required')) {
        handleReauthRequired(async () => {
          await logoutAllDevices();
          toast.success('Klart', { description: 'Du är utloggad från alla andra enheter.' });
          loadSessions();
        });
      } else {
        toast.error('Något gick fel', { description: securityError(err, 'Det gick inte att logga ut de andra enheterna.') });
      }
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast('Kopierat', { description: 'Kopierat till urklipp.' });
  };

  const downloadRecoveryCodes = () => {
    const text = recoveryCodes.join('\n');
    const blob = new Blob([`Dina reservkoder:\n\n${text}\n\nFörvara dem säkert! Varje kod kan bara användas en gång.`], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'reservkoder.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  const getIdentityIcon = (type: string) => {
    switch (type) {
      case 'password': return <Key size={16} />;
      case 'google': return <span className="text-base">G</span>;
      case 'facebook': return <span className="text-base">f</span>;
      case 'apple': return <span className="text-base"></span>;
      case 'webauthn': return <Smartphone size={16} />;
      case 'totp': return <Lock size={16} />;
      default: return <Shield size={16} />;
    }
  };

  const getIdentityLabel = (identity: any) => {
    if (identity.label) return identity.label;
    switch (identity.type) {
      case 'password': return 'Lösenord';
      case 'google': return 'Google';
      case 'facebook': return 'Facebook';
      case 'apple': return 'Apple';
      case 'webauthn': return 'Nyckel (passkey)';
      case 'totp': return 'Autentiseringsapp';
      default: return identity.type;
    }
  };

  const totpEnabled = identities.some(i => i.type === 'totp');

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="animate-spin w-8 h-8 text-primary" />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
      <div className="max-w-3xl space-y-6">
        <Link to="/account" className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground">
          <ArrowLeft size={16} /> Tillbaka till kontot
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Säkerhet</h1>
        {/* Login Methods */}
        <section className="rounded-lg border border-border bg-card p-6 shadow-xs">
          <h2 className="text-base font-semibold text-foreground">Inloggningssätt</h2>
          <p className="mt-1 text-sm text-muted-foreground">Välj hur du loggar in på ditt konto.</p>
          <div className="mt-6 space-y-3">
            {identities.map((identity) => (
              <div key={identity.uuid} className="flex items-center justify-between p-3 border rounded-lg bg-card">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center text-primary">
                    {getIdentityIcon(identity.type)}
                  </div>
                  <div>
                    <div className="font-medium">{getIdentityLabel(identity)}</div>
                    {identity.type === 'webauthn' && (
                      <Button
                        variant="link"
                        size="sm"
                        className="h-auto p-0 text-muted-foreground"
                        onClick={() => { setRenamingIdentity(identity.uuid); setNewLabel(identity.label || 'Nyckel'); }}
                      >
                        <Edit2 size={12} className="mr-1" /> Byt namn
                      </Button>
                    )}
                    {identity.status === 'pending' && (
                      <Badge variant="outline" className="ml-2">Väntar</Badge>
                    )}
                  </div>
                </div>
                {identity.canDelete && identity.type !== 'totp' && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleRemoveIdentity(identity)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 size={16} />
                  </Button>
                )}
              </div>
            ))}

            <div className="flex flex-wrap gap-2 pt-2">
              <Button variant="outline" onClick={() => setShowAddPasskey(true)} className="gap-2">
                <Plus size={16} /> Lägg till nyckel
              </Button>
            </div>
          </div>
        </section>

        {/* Two-Factor Authentication */}
        <section className="rounded-lg border border-border bg-card p-6 shadow-xs">
          <h2 className="text-base font-semibold text-foreground">Verifieringskod</h2>
          <p className="mt-1 text-sm text-muted-foreground">Ett extra skydd för ditt konto: när du loggar in anger du också en kod från en app i din telefon.</p>
          <div className="mt-6 space-y-4">
            {totpEnabled ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-primary">
                  <CheckCircle2 size={18} />
                  <span className="font-medium">Verifieringskoden är påslagen</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" onClick={handleRegenerateCodes} className="gap-2">
                    <Copy size={16} /> Skapa nya reservkoder
                  </Button>
                  <Button variant="destructive" onClick={handleDisableTotp}>
                    Stäng av verifieringskoden
                  </Button>
                </div>
              </div>
            ) : (
              <Button onClick={handleEnrollTotp} disabled={enrollingTotp} className="gap-2">
                {enrollingTotp ? <Loader2 size={16} className="animate-spin" /> : <Lock size={16} />}
                Slå på verifieringskod
              </Button>
            )}
          </div>
        </section>

        {/* Change Password */}
        <section className="rounded-lg border border-border bg-card p-6 shadow-xs">
          <h2 className="text-base font-semibold text-foreground">Byt lösenord</h2>
          <p className="mt-1 text-sm text-muted-foreground">Byt lösenord för att hålla ditt konto säkert.</p>
          <div className="mt-6 space-y-3">
            <Input
              type="password"
              placeholder="Nuvarande lösenord"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
            />
            <Input
              type="password"
              placeholder="Nytt lösenord"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              minLength={8}
            />
            <Input
              type="password"
              placeholder="Upprepa det nya lösenordet"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
            <Button onClick={handleChangePassword} disabled={changingPassword || !currentPassword || !newPassword || !confirmPassword}>
              {changingPassword ? <Loader2 size={16} className="animate-spin mr-2" /> : null}
              Byt lösenord
            </Button>
          </div>
        </section>

        {/* Signed-in Devices */}
        <section className="rounded-lg border border-border bg-card p-6 shadow-xs">
          <h2 className="text-base font-semibold text-foreground">Inloggade enheter</h2>
          <p className="mt-1 text-sm text-muted-foreground">Här är ditt konto inloggat. Logga ut från alla andra enheter om du inte känner igen någon av dem.</p>
          <div className="mt-6">
            <SignedInDevices sessions={sessions} failed={sessionsFailed} />
          </div>
          <div className="mt-4">
            <Button variant="outline" onClick={handleLogoutAll} className="gap-2">
              <LogOut size={16} /> Logga ut från alla andra enheter
            </Button>
          </div>
        </section>
      </div>

      {/* Reauth Dialog */}
      <Dialog open={showReauth} onOpenChange={setShowReauth}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bekräfta att det är du</DialogTitle>
            <DialogDescription>
              För din säkerhet: skriv ditt lösenord eller använd en nyckel för att fortsätta.
            </DialogDescription>
          </DialogHeader>
          <Input
            type="password"
            placeholder="Ditt lösenord"
            value={reauthPassword}
            onChange={(e) => setReauthPassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleReauthSubmit()}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowReauth(false); setReauthPassword(''); setPendingAction(null); }}>
              Avbryt
            </Button>
            <Button variant="outline" onClick={handlePasskeyReauth}>Använd en nyckel i stället</Button>
            <Button onClick={handleReauthSubmit}>Bekräfta</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Passkey Dialog */}
      <Dialog open={showAddPasskey} onOpenChange={setShowAddPasskey}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Lägg till en nyckel (passkey)</DialogTitle>
            <DialogDescription>
              Med en nyckel kan du logga in utan lösenord – med fingeravtryck, ansiktsigenkänning eller PIN-koden på din enhet.
            </DialogDescription>
          </DialogHeader>
          <Input
            placeholder="Namn på nyckeln (valfritt)"
            value={passkeyName}
            onChange={(e) => setPasskeyName(e.target.value)}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowAddPasskey(false); setPasskeyName(''); }}>
              Avbryt
            </Button>
            <Button onClick={handleAddPasskey} disabled={addingPasskey}>
              {addingPasskey ? <Loader2 size={16} className="animate-spin mr-2" /> : null}
              Lägg till nyckel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* TOTP Enrollment Dialog */}
      <Dialog open={showTotpEnroll} onOpenChange={setShowTotpEnroll}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Ställ in autentiseringsapp</DialogTitle>
            <DialogDescription>
              {isInlineQrImage(totpEnrollment?.qrCodeDataUri)
                ? 'Skanna QR-koden med din autentiseringsapp (till exempel Google Authenticator eller Authy).'
                : 'Lägg till det här kontot i din autentiseringsapp (till exempel Google Authenticator eller Authy).'}
            </DialogDescription>
          </DialogHeader>
          {totpEnrollment && (
            <div className="space-y-4">
              {isInlineQrImage(totpEnrollment.qrCodeDataUri) && (
                <div className="flex justify-center p-4 bg-card rounded-lg border">
                  <img
                    src={totpEnrollment.qrCodeDataUri}
                    alt="QR-kod för din autentiseringsapp"
                    className="w-48 h-48"
                  />
                </div>
              )}
              <div className="text-center">
                <p className="text-sm text-muted-foreground mb-2">
                  {isInlineQrImage(totpEnrollment.qrCodeDataUri) ? 'Eller skriv in den här koden för hand:' : 'Skriv in den här koden i din autentiseringsapp:'}
                </p>
                <code className="bg-muted px-3 py-2 rounded text-sm select-all">{totpEnrollment.secret}</code>
                <Button
                  variant="link"
                  size="sm"
                  className="ml-2"
                  onClick={() => copyToClipboard(totpEnrollment.secret)}
                >
                  <Copy size={12} className="mr-1" /> Kopiera
                </Button>
              </div>
              <Input
                placeholder="Verifieringskod (6 siffror)"
                value={totpCode}
                onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                maxLength={6}
                className="text-center text-lg tracking-widest"
              />
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowTotpEnroll(false); setTotpEnrollment(null); setTotpCode(''); }}>
              Avbryt
            </Button>
            <Button onClick={handleConfirmTotp} disabled={enrollingTotp || !totpCode || totpCode.length !== 6}>
              {enrollingTotp ? <Loader2 size={16} className="animate-spin mr-2" /> : null}
              Bekräfta och slå på
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Recovery Codes Dialog */}
      <Dialog open={showRecoveryCodes} onOpenChange={setShowRecoveryCodes}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reservkoder</DialogTitle>
            <DialogDescription>
              Spara koderna på ett säkert ställe. Du kan använda dem för att logga in om du inte kommer åt din autentiseringsapp.
            </DialogDescription>
          </DialogHeader>
          <div className="bg-muted border border-border rounded-lg p-4 flex gap-3">
            <AlertCircle className="text-muted-foreground shrink-0" size={20} />
            <div className="text-sm text-muted-foreground">
              <strong>Viktigt:</strong> Varje kod kan bara användas en gång. Förvara dem säkert.
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 font-mono text-sm">
            {recoveryCodes.map((code, i) => (
              <div key={i} className="bg-muted p-2 rounded select-all">{code}</div>
            ))}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => copyToClipboard(recoveryCodes.join('\n'))} className="flex-1 gap-2">
              <Copy size={16} /> Kopiera alla
            </Button>
            <Button variant="outline" onClick={downloadRecoveryCodes} className="flex-1 gap-2">
              <Download size={16} /> Ladda ner
            </Button>
          </div>
          <DialogFooter>
            <Button onClick={() => { setShowRecoveryCodes(false); setRecoveryCodes([]); }}>
              Jag har sparat dem
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename Identity Dialog */}
      <Dialog open={!!renamingIdentity} onOpenChange={() => { setRenamingIdentity(null); setNewLabel(''); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Byt namn på nyckeln</DialogTitle>
          </DialogHeader>
          <Input
            placeholder="Namn på nyckeln"
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleRenameIdentity()}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => { setRenamingIdentity(null); setNewLabel(''); }}>
              Avbryt
            </Button>
            <Button onClick={handleRenameIdentity} disabled={savingRename || !newLabel.trim()}>
              {savingRename ? <Loader2 size={16} className="animate-spin mr-2" /> : null}
              Spara
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SecurityPage;
