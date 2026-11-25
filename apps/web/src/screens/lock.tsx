import { useId, useMemo, useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from 'react-router';
import { Button } from "../ui/components/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../ui/components/card";
import { Input } from "../ui/components/input";
import { Label } from "../ui/components/label";
import { useWallet } from '../state/wallet-context';
import { isPassphraseUsed } from "../wallet/passphrase";

const RETURN_TO_KEY = "bawa-lock-return-to";
const VALIDATION_ORIGIN = "https://bawa.invalid";

// A redirect target must not contain a backslash, a C0 control character
// (U+0000–U+001F) or DEL (U+007F): any of them can smuggle a different
// destination past the origin check. Written as a character-code scan
// rather than a regex: the no-control-regex lint rule forbids control
// characters (and their escapes) in regular expressions.
function hasUnsafeRedirectChar(value: string): boolean {
  for (const ch of value) {
    const code = ch.charCodeAt(0);
    if (ch === "\\" || code <= 0x1f || code === 0x7f) return true;
  }
  return false;
}

function safeReturnTo(candidate: unknown): string | null {
  // React Router state may contain either a path or a Location-like object.
  if (
    typeof candidate === "object" &&
    candidate !== null &&
    "pathname" in candidate
  ) {
    if (typeof candidate.pathname !== "string") return null;

    const search =
      "search" in candidate && typeof candidate.search === "string"
        ? candidate.search
        : "";
    const hash =
      "hash" in candidate && typeof candidate.hash === "string"
        ? candidate.hash
        : "";

    candidate = `${candidate.pathname}${search}${hash}`;
  }

  if (
    typeof candidate !== "string" ||
    !candidate.startsWith("/") ||
    candidate.startsWith("//") ||
    hasUnsafeRedirectChar(candidate)
  ) {
    return null;
  }

  try {
    const url = new URL(candidate, VALIDATION_ORIGIN);
    const pathname = decodeURIComponent(url.pathname);

    if (
      url.origin !== VALIDATION_ORIGIN ||
      url.pathname.startsWith("//") ||
      pathname.startsWith("//") ||
      hasUnsafeRedirectChar(pathname) ||
      pathname.replace(/\/+$/, "").toLowerCase() === "/lock"
    ) {
      return null;
    }

    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return null;
  }
}

function readStoredReturnTo(): string | null {
  try {
    return window.sessionStorage.getItem(RETURN_TO_KEY);
  } catch {
    return null;
  }
}

function vaultErrorMessage(error: unknown): string {
  if (typeof error === "string" && error) return error;

  if (typeof error === "object" && error !== null) {
    if (
      "message" in error &&
      typeof error.message === "string" &&
      error.message
    ) {
      return error.message;
    }

    if ("error" in error) {
      if (typeof error.error === "string" && error.error) {
        return error.error;
      }

      if (error.error instanceof Error && error.error.message) {
        return error.error.message;
      }
    }
  }

  return "Unable to unlock your wallet. Please try again.";
}

function PadlockDoodle() {
  const sunClipId = `lock-sun-${useId().replace(/:/g, "")}`;

  return (
    <svg
      width={64}
      height={64}
      viewBox="0 0 64 64"
      className="text-ink"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      style={{ display: "block", margin: "0 auto 0.75rem" }}
    >
      <defs>
        <clipPath id={sunClipId} clipPathUnits="userSpaceOnUse">
          <path
            d="M24 27.5 L23.5 19 C23 14 26.5 11 31.5 11.5 C36.5 11 40 14.5 39.5 20 L40 27.5 Z"
            fill="currentColor"
            stroke="none"
          />
        </clipPath>
      </defs>

      {/* Use the D1 Sun utility for the clipped fill, without duplicating its colour. */}
      <foreignObject
        x={0}
        y={0}
        width={64}
        height={64}
        clipPath={`url(#${sunClipId})`}
      >
        <div
          className="bg-sun"
          style={{ width: "100%", height: "100%" }}
        />
      </foreignObject>

      <path d="M19 28 L18.5 19 C18 11 24 6 31 7 C39 6.5 45 13 44 21 L44.5 28" />
      <path d="M16 28.5 L47 27.5 Q50 28 49.5 32 L50 50 Q49 54 45 53.5 L16 54.5 Q12 54 12.5 50 L12 32 Q12 28 16 28.5 Z" />
      <path d="M34 38.5 C34.4 42 28 42.2 28.4 38.3 C28.1 34.8 34 34.6 34 38.5 Z M31 41.5 L30.5 47" />
    </svg>
  );
}

export function LockScreen() {
  const { unlockVault, vaultState } = useWallet();
  const location = useLocation();
  const navigate = useNavigate();

  const [password, setPassword] = useState("");
  const [passphrase, setPassphrase] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isUnlocking, setIsUnlocking] = useState(false);

  const noVault = vaultState === "no-vault";
  const usesPassphrase = isPassphraseUsed();

  const returnTo = useMemo(() => {
    const state = location.state as { from?: unknown } | null;

    return (
      safeReturnTo(new URLSearchParams(location.search).get("from")) ??
      safeReturnTo(state?.from) ??
      safeReturnTo(readStoredReturnTo()) ??
      "/"
    );
  }, [location.search, location.state]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isUnlocking || noVault) return;

    setError(null);
    setIsUnlocking(true);

    try {
      const result: unknown = await unlockVault(password, passphrase);

      if (
        result === false ||
        (typeof result === "object" &&
          result !== null &&
          (("ok" in result && result.ok === false) ||
            ("success" in result && result.success === false)))
      ) {
        throw result;
      }

      try {
        window.sessionStorage.removeItem(RETURN_TO_KEY);
      } catch {
        // Unavailable session storage must not prevent successful navigation.
      }

      navigate(returnTo, { replace: true });
    } catch (failure) {
      setError(vaultErrorMessage(failure));
      setPassword("");
      setPassphrase("");
    } finally {
      setIsUnlocking(false);
    }
  }

  return (
    <div
      className="bg-paper text-ink"
      aria-labelledby="lock-title"
      style={{
        minHeight: "70vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "2rem 1rem",
        boxSizing: "border-box",
      }}
    >
      <Card
       
        style={{ width: "100%", maxWidth: "30rem", boxShadow: "none" }}
      >
        <CardHeader style={{ textAlign: "center" }}>
          <PadlockDoodle />
          <CardTitle
            id="lock-title"
            className="font-display"
            style={{ fontSize: "2.25rem", lineHeight: 1.15 }}
          >
            {noVault ? "Set up your wallet" : "Unlock your wallet"}
          </CardTitle>
          <p style={{ lineHeight: 1.5 }}>
            {noVault
              ? 'No vault exists yet.'
              : 'Locked means derived addresses are hidden and signing is unavailable. Watch-only remains usable.'}
          </p>
        </CardHeader>

        <CardContent style={{ display: "grid", gap: "1.25rem" }}>
          {noVault ? (
            <div style={{ display: "grid", gap: "0.75rem" }}>
              <Button asChild variant="sun">
                <Link to="/create-wallet">Create wallet</Link>
              </Button>
              <Button asChild>
                <Link to="/import-wallet">Import wallet</Link>
              </Button>
            </div>
          ) : (
            <>
              <form
                onSubmit={handleSubmit}
                aria-busy={isUnlocking}
                style={{ display: "grid", gap: "1.25rem" }}
              >
                <div style={{ display: "grid", gap: "0.5rem" }}>
                  <Label htmlFor="lock-password">Password</Label>
                  <Input
                    id="lock-password"
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    radius="bawa"
                    value={password}
                    onChange={(event) =>
                      setPassword(event.currentTarget.value)
                    }
                    aria-invalid={error !== null}
                    aria-describedby="lock-error"
                    disabled={isUnlocking}
                    required
                    autoFocus
                  />
                </div>

                {usesPassphrase && (
                  <div style={{ display: "grid", gap: "0.5rem" }}>
                    <Label htmlFor="lock-passphrase">
                      Recovery passphrase
                    </Label>
                    <Input
                      id="lock-passphrase"
                      name="passphrase"
                      type="password"
                      autoComplete="off"
                      radius="bawa"
                      value={passphrase}
                      onChange={(event) =>
                        setPassphrase(event.currentTarget.value)
                      }
                      aria-invalid={error !== null}
                      aria-describedby="lock-error"
                      disabled={isUnlocking}
                    />
                  </div>
                )}

                {error !== null && (
                  <p
                    id="lock-error"
                    role="alert"
                    className="bg-coral text-ink border-ink rounded-bawa"
                    style={{
                      margin: 0,
                      padding: "0.75rem",
                      borderWidth: 2,
                      borderStyle: "solid",
                      lineHeight: 1.5,
                    }}
                  >
                    {error}
                  </p>
                )}

                <Button
                  type="submit"
                  variant="sun"
                  disabled={isUnlocking}
                >
                  {isUnlocking ? "Unlocking…" : "Unlock"}
                </Button>
              </form>

              <p style={{ margin: 0, textAlign: "center", lineHeight: 1.5 }}>
                <Link
                  to="/import-wallet"
                  className="text-ink"
                  style={{
                    textDecoration: "underline",
                    textUnderlineOffset: "0.2em",
                  }}
                >
                  Forgotten password? Restore wallet
                </Link>
              </p>
            </>
          )}

          {/* Lane 5: the auto-lock note only applies with a vault. With
              no vault it told a user with no wallet to "configure it in
              Security settings" — dead guidance on the setup screen. */}
          {!noVault && (
          <p
            style={{
              margin: 0,
              fontSize: "0.875rem",
              lineHeight: 1.5,
              textAlign: "center",
            }}
          >
            Auto-lock affects signing access, not watch-only use. Configure it in
            Security settings.
          </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
