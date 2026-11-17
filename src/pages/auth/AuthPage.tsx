import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import AuthCard from '@/components/auth/AuthCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Lock, Key, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { onSignInElsewhere, rememberSignInTarget, takeSignInTarget, verificationFailure } from '@/lib/signInVerification';

// The target arrives in the URL, so anything that is not a site-relative path is
// discarded — including the protocol-relative "//host" form, which would send the
// user off-site after they signed in here.
const siteRelativeTarget = (target: string | null | undefined): string =>
  target && target.startsWith('/') && !target.startsWith('//') ? target : '/';

const AuthPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { refresh, signIn, signInWithPasskey, signUp, submitTotp, submitRecoveryCode, verifySignIn, getOAuthProviders, signInWithOAuth } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [totpRequired, setTotpRequired] = useState(false);
  const [totpCode, setTotpCode] = useState('');
  const [useRecoveryCode, setUseRecoveryCode] = useState(false);
  // Set when the app verifies sign-ins from new devices and this browser is not recognized: the
  // masked address the link and code were emailed to.
  const [verificationEmail, setVerificationEmail] = useState<string | null>(null);
  const [verificationCode, setVerificationCode] = useState('');
  const [oauthProviders, setOAuthProviders] = useState<any[]>([]);
  const [loadingProviders, setLoadingProviders] = useState(true);
  const [signingInWithPasskey, setSigningInWithPasskey] = useState(false);

  const routeState = location.state as { from?: string; message?: string } | null;

  // RequireAuth writes both: `?redirect=` survives a reload of this page or a
  // fresh tab, `state.from` does not. Prefer the parameter and keep the state
  // fallback so a guard from an older installed bundle still returns the user
  // where they were headed.
  const redirectTarget = siteRelativeTarget(searchParams.get('redirect') ?? routeState?.from);

  useEffect(() => {
    loadOAuthProviders();
  }, []);

  const loadOAuthProviders = async () => {
    try {
      const providers = await getOAuthProviders();
      setOAuthProviders(providers);
    } catch {
      // Providers are optional: if the lookup fails the buttons simply do not render, and
      // email/password sign-in below is unaffected. Nothing to tell the visitor.
    } finally {
      setLoadingProviders(false);
    }
  };

  const onAuthed = () => {
    navigate(redirectTarget, { replace: true });
  };

  const challenged = totpRequired || verificationEmail !== null;

  const leaveVerification = () => {
    setVerificationEmail(null);
    setVerificationCode('');
  };

  // The emailed link usually opens in another tab and signs this browser in there. While this tab
  // still says "Check your email", look again when that happens or when the member comes back here,
  // and continue as the code would have. Only the member who is verifying counts: a session another
  // member already had in this browser does not complete this sign-in.
  useEffect(() => {
    if (verificationEmail === null) return;
    const verifying = email.trim().toLowerCase();
    let active = true;
    const stop = onSignInElsewhere(async () => {
      const member = await refresh();
      if (!active || !member || (member.email ?? '').toLowerCase() !== verifying) return;
      takeSignInTarget();
      onAuthed();
    });
    return () => {
      active = false;
      stop();
    };
  }, [verificationEmail]);

  const submitVerificationCode = async () => {
    try {
      await verifySignIn({ code: verificationCode });
      takeSignInTarget();
      onAuthed();
    } catch (err: unknown) {
      const failure = verificationFailure(err, 'code');
      toast.error(failure.title, { description: failure.description });
      if (failure.restart) leaveVerification();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (verificationEmail !== null) {
        await submitVerificationCode();
      } else if (totpRequired) {
        const result = useRecoveryCode
          ? await submitRecoveryCode(email, password, totpCode)
          : await submitTotp(email, password, totpCode);

        if (result.status === 'authenticated') {
          onAuthed();
        } else {
          toast.error('Något gick fel', {
            description: useRecoveryCode ? 'Fel reservkod' : 'Fel kod från autentiseringsappen',
          });
        }
      } else if (isLogin) {
        const result = await signIn(email, password);

        if (result.status === 'authenticated') {
          onAuthed();
        } else if (result.status === 'totp_required') {
          setTotpRequired(true);
          toast('Verifieringskod krävs', {
            description: 'Ange koden från din autentiseringsapp.',
          });
        } else if (result.status === 'verification_required') {
          // The emailed link opens in a new tab, which has no ?redirect= of its own.
          rememberSignInTarget(redirectTarget);
          setVerificationEmail(result.email);
          setVerificationCode('');
        }
      } else {
        await signUp(email, password, name);
        onAuthed();
      }
    } catch (err: any) {
      if (err.message?.includes('invalid_code') || err.message?.includes('invalid_recovery_code')) {
        toast.error('Fel kod', {
          description: useRecoveryCode ? 'Fel reservkod' : 'Fel kod från autentiseringsappen',
        });
      } else if (err.message?.includes('bad_credentials')) {
        toast.error('Något gick fel', { description: 'Fel e-postadress eller lösenord' });
      } else if (err.message?.includes('email_exists')) {
        toast.error('Något gick fel', { description: 'Det finns redan ett konto med den här e-postadressen' });
      } else if (err.code === 'signup_disabled') {
        toast.error('Det går inte att skapa konto', { description: 'Det går inte att skapa konto på den här webbplatsen.' });
      } else if (err.code === 'verification_unavailable') {
        const failure = verificationFailure(err, 'code');
        toast.error(failure.title, { description: failure.description });
      } else if (err.code === 'too_many_attempts') {
        toast.error('För många försök', { description: 'För många inloggningsförsök. Försök igen senare.' });
      } else if (err.code === 'account_pending_deletion') {
        toast.error('Kontot är inte tillgängligt', { description: 'Det här kontot är på väg att tas bort. Kontakta oss om du behöver hjälp.' });
      } else {
        toast.error('Något gick fel', { description: 'Något gick fel. Försök igen.' });
      }
    } finally {
      setLoading(false);
    }
  };

  const handlePasskeySignIn = async () => {
    setSigningInWithPasskey(true);
    try {
      await signInWithPasskey();
      onAuthed();
    } catch (err: any) {
      const errMsg = err.message || '';
      const isFriendlyError =
        errMsg.toLowerCase().includes('not_validated') ||
        errMsg.toLowerCase().includes('challenge_not_found') ||
        err.name === 'NotAllowedError' ||
        errMsg.toLowerCase().includes('not allowed') ||
        errMsg.toLowerCase().includes('timed out');

      if (isFriendlyError) {
        toast('Inloggningen med nyckel avbröts', {
          description: 'Det finns ingen nyckel (passkey) för den här webbplatsen än, eller så avbröt du. Logga in på ett annat sätt och lägg sedan till en nyckel under Säkerhet.',
        });
      } else {
        toast.error('Något gick fel', {
          description: `Det gick inte att logga in med nyckel: ${(err && (err.name || err.message)) || 'okänt fel'}`,
        });
      }
    } finally {
      setSigningInWithPasskey(false);
    }
  };

  const handleOAuthSignIn = (provider: any) => {
    signInWithOAuth(provider.provider);
  };

  return (
    <AuthCard
      description={verificationEmail !== null
        ? 'Kolla din e-post'
        : totpRequired ? 'Ange din verifieringskod' : isLogin ? 'Logga in på ditt konto' : 'Skapa ditt konto'}
      icon={
        <div className="mb-3 w-12 h-12 rounded-xl bg-primary flex items-center justify-center">
          <Lock className="text-primary-foreground" size={24} />
        </div>
      }
      title="Välkommen"
    >
      {routeState?.message && !challenged && (
        <p className="text-center text-sm text-primary mb-4">{routeState.message}</p>
      )}

      {!challenged && (
        <>
          {/* Social Sign-in */}
          {!loadingProviders && oauthProviders.length > 0 && (
            <div className="space-y-2 mb-4">
              {oauthProviders.map((provider) => (
                <Button
                  key={provider.provider}
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={() => handleOAuthSignIn(provider)}
                >
                  Fortsätt med {provider.label}
                </Button>
              ))}
            </div>
          )}

          {/* Passkey Sign-in */}
          <Button
            type="button"
            variant="outline"
            className="w-full mb-4 gap-2"
            onClick={handlePasskeySignIn}
            disabled={signingInWithPasskey}
          >
            {signingInWithPasskey ? <Loader2 size={16} className="animate-spin" /> : <Key size={16} />}
            Logga in med nyckel (passkey)
          </Button>

          {/* Divider */}
          {(oauthProviders.length > 0) && (
            <div className="relative mb-4">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">Eller fortsätt med</span>
              </div>
            </div>
          )}
        </>
      )}

      {/* Email/Password or 2FA Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        {!challenged && !isLogin && (
          <Input
            placeholder="Ditt namn"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required={!isLogin}
            disabled={loading}
          />
        )}
        {!challenged && (
          <>
            <Input
              type="email"
              placeholder="E-post"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loading}
            />
            <Input
              type="password"
              placeholder="Lösenord"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              disabled={loading}
            />
            {isLogin && (
              <div className="text-right">
                <Link to="/auth/reset" className="text-xs text-muted-foreground underline-offset-4 hover:underline">
                  Glömt lösenordet?
                </Link>
              </div>
            )}
          </>
        )}
        {verificationEmail !== null && (
          <>
            <p className="text-sm text-muted-foreground">
              Vi har skickat en inloggningslänk och en verifieringskod med 6 siffror till <span className="font-medium text-foreground">{verificationEmail}</span>.
              Öppna länken i den här webbläsaren, eller skriv in koden nedan.
            </p>
            {/* No maxLength: the browser would cut a pasted "123 456" before the space is stripped. */}
            <Input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="Verifieringskod (6 siffror)"
              value={verificationCode}
              onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              className="text-center text-lg tracking-widest"
              disabled={loading}
              autoFocus
            />
          </>
        )}
        {totpRequired && (
          <>
            <Input
              type="text"
              placeholder={useRecoveryCode ? "Ange en reservkod" : "Verifieringskod (6 siffror)"}
              value={totpCode}
              onChange={(e) =>
                setTotpCode(
                  useRecoveryCode
                    ? e.target.value.toUpperCase().slice(0, 39)
                    : e.target.value.replace(/\D/g, '').slice(0, 6)
                )
              }
              maxLength={useRecoveryCode ? 39 : 6}
              className={useRecoveryCode ? "text-center text-base tracking-wider font-mono" : "text-center text-lg tracking-widest"}
              disabled={loading}
              autoFocus
            />
            <Button
              type="button"
              variant="link"
              className="text-sm px-0"
              onClick={() => { setUseRecoveryCode(!useRecoveryCode); setTotpCode(''); }}
            >
              {useRecoveryCode ? 'Använd autentiseringsappen i stället' : 'Använd en reservkod i stället'}
            </Button>
          </>
        )}
        <Button type="submit" className="w-full" disabled={loading || (verificationEmail !== null && verificationCode.length !== 6)}>
          {loading ? (
            <>
              <Loader2 size={16} className="animate-spin mr-2" />
              Ett ögonblick…
            </>
          ) : verificationEmail !== null ? (
            'Bekräfta koden'
          ) : totpRequired ? (
            useRecoveryCode ? 'Bekräfta reservkoden' : 'Bekräfta koden'
          ) : (
            isLogin ? 'Logga in' : 'Skapa konto'
          )}
        </Button>
      </form>

      {!challenged && (
        <p className="text-center text-sm text-muted-foreground mt-4">
          {isLogin ? 'Har du inget konto?' : 'Har du redan ett konto?'}{' '}
          <button
            type="button"
            onClick={() => setIsLogin(!isLogin)}
            className="text-primary hover:underline font-medium"
          >
            {isLogin ? 'Skapa konto' : 'Logga in'}
          </button>
        </p>
      )}

      {challenged && (
        <p className="text-center text-sm text-muted-foreground mt-4">
          <button
            type="button"
            onClick={() => { setTotpRequired(false); setTotpCode(''); setUseRecoveryCode(false); leaveVerification(); }}
            className="text-primary hover:underline font-medium"
          >
            Tillbaka till inloggningen
          </button>
        </p>
      )}
    </AuthCard>
  );
};

export default AuthPage;
