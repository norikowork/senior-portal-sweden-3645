import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import AuthCard from "@/components/auth/AuthCard";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { takeSignInTarget, verificationFailure, type VerificationFailure } from "@/lib/signInVerification";

const INCOMPLETE: VerificationFailure = {
  title: "Inloggningslänken är ofullständig",
  description: "Öppna länken i mejlet igen, eller skriv in verifieringskoden med 6 siffror från mejlet på inloggningssidan.",
  restart: true,
};

// The page the sign-in verification email links to: /verify-sign-in?token=...
export default function VerifySignIn() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const { verifySignIn } = useAuth();
  const [failure, setFailure] = useState<VerificationFailure | null>(token ? null : INCOMPLETE);
  // The token is single-use: a second request (React StrictMode runs effects twice) would be refused.
  const verifiedToken = useRef<string | null>(null);

  useEffect(() => {
    if (!token) {
      setFailure(INCOMPLETE);
      return;
    }
    if (verifiedToken.current === token) return;
    verifiedToken.current = token;
    setFailure(null);
    verifySignIn({ token })
      .then(() => navigate(takeSignInTarget(), { replace: true }))
      .catch((err: unknown) => setFailure(verificationFailure(err, "link")));
  }, [token]);

  if (!failure) {
    return (
      <AuthCard
        icon={<Loader2 className="mb-3 h-6 w-6 animate-spin text-primary" />}
        title="Bekräftar din inloggning"
      />
    );
  }

  return (
    <AuthCard description={failure.description} title={failure.title}>
      <Button asChild className="w-full" variant={failure.restart ? "default" : "outline"}>
        <Link to="/login">Tillbaka till inloggningen</Link>
      </Button>
    </AuthCard>
  );
}
