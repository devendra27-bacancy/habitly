"use client";

import Image from "next/image";
import { FirebaseError } from "firebase/app";
import { useState } from "react";
import { signInWithGoogle, signInWithEmail, signUpWithEmail } from "../lib/auth";

function getAuthErrorMessage(error: unknown) {
  if (!(error instanceof FirebaseError)) {
    return error instanceof Error ? error.message : "Authentication failed";
  }

  switch (error.code) {
    case "auth/configuration-not-found":
      return "Sign-in is not configured for this project yet. Enable the sign-in method and authorize this app domain in your project settings.";
    case "auth/operation-not-allowed":
      return "This sign-in method is currently disabled. Enable it in your project authentication settings.";
    case "auth/unauthorized-domain":
      return "This domain is not authorized for sign-in yet. Add it to the authorized domains in your project settings.";
    default:
      return error.message || "Authentication failed";
  }
}

export default function Login() {
  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleGoogleLogin = async () => {
    setError("");
    setLoading(true);
    try {
      await signInWithGoogle();
    } catch (authError: unknown) {
      setError(getAuthErrorMessage(authError));
    } finally {
      setLoading(false);
    }
  };

  const handleEmailAuth = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!email || !password) return;
    setError("");
    setLoading(true);
    try {
      if (isSignUp) {
        await signUpWithEmail(email, password);
      } else {
        await signInWithEmail(email, password);
      }
    } catch (authError: unknown) {
      setError(getAuthErrorMessage(authError));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-shell">
      <div className="login-glow login-glow-a" />
      <div className="login-glow login-glow-b" />
      <div className="login-layout">
        <section className="login-story">
          <div className="login-mascot-card">
            <div className="login-mascot-bubble">Lizzo is ready for today.</div>
            <div className="login-mascot-art">
              <Image
                src="/mascot/mascot_morning_start.png"
                alt="Lizzo the habitly mascot"
                width={340}
                height={340}
                priority
              />
            </div>
            <div className="login-mascot-notes">
              <div className="login-note-card">
                <span className="login-note-label">Streaks</span>
                <span className="login-note-value">Stay in rhythm</span>
              </div>
              <div className="login-note-card">
                <span className="login-note-label">XP</span>
                <span className="login-note-value">Every check moves you</span>
              </div>
              <div className="login-note-card">
                <span className="login-note-label">History</span>
                <span className="login-note-value">See wins and misses clearly</span>
              </div>
            </div>
          </div>
        </section>

        <section className="login-panel">
          <div className="login-panel-head">
            <div className="login-eyebrow">{isSignUp ? "Create your account" : "Welcome back"}</div>
            <h2>{isSignUp ? "Start your habit garden" : "Sign in to habitly"}</h2>
            <p>{isSignUp ? "Set up your account and begin building momentum." : "Pick up your streaks, levels, and habits where you left off."}</p>
          </div>

          {error ? <div className="login-error">{error}</div> : null}

          <form onSubmit={handleEmailAuth} className="login-form">
            <label className="login-field">
              <span>Email</span>
              <input
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                className="login-input"
              />
            </label>

            <label className="login-field">
              <span>Password</span>
              <input
                type="password"
                placeholder={isSignUp ? "Create a password" : "Enter your password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                className="login-input"
              />
            </label>

            <button type="submit" className="login-btn login-btn-primary" disabled={loading}>
              {loading ? "Please wait..." : isSignUp ? "Create account" : "Continue with email"}
            </button>
          </form>

          <div className="login-divider">
            <span>or</span>
          </div>

          <button
            type="button"
            className="login-btn login-btn-secondary"
            onClick={handleGoogleLogin}
            disabled={loading}
          >
            <span className="google-icon" aria-hidden="true">
              <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
                <path d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.56 2.68-3.86 2.68-6.62Z" fill="#4285F4" />
                <path d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.33-1.58-5.04-3.7H.96v2.34A9 9 0 0 0 9 18Z" fill="#34A853" />
                <path d="M3.96 10.72A5.4 5.4 0 0 1 3.68 9c0-.6.1-1.18.28-1.72V4.94H.96A9 9 0 0 0 0 9c0 1.45.35 2.82.96 4.06l3-2.34Z" fill="#FBBC05" />
                <path d="M9 3.58c1.32 0 2.5.46 3.44 1.36l2.58-2.58C13.46.9 11.43 0 9 0A9 9 0 0 0 .96 4.94l3 2.34c.7-2.12 2.7-3.7 5.04-3.7Z" fill="#EA4335" />
              </svg>
            </span>
            Continue with Google
          </button>

          <div className="login-switch">
            <span>{isSignUp ? "Already have an account?" : "New here?"}</span>
            <button type="button" className="login-switch-btn" onClick={() => setIsSignUp((value) => !value)}>
              {isSignUp ? "Sign in instead" : "Create an account"}
            </button>
          </div>
        </section>
      </div>

      <style jsx>{`
        .login-shell {
          position: relative;
          min-height: 100vh;
          overflow: hidden;
          padding: 28px 18px;
          background:
            radial-gradient(circle at top left, rgba(255, 255, 255, 0.75), transparent 28%),
            linear-gradient(180deg, #f7f2e6 0%, #e7f1e4 100%);
          font-family: var(--font-nunito), sans-serif;
        }

        .login-glow {
          position: absolute;
          border-radius: 999px;
          filter: blur(70px);
          opacity: 0.45;
          pointer-events: none;
        }

        .login-glow-a {
          width: 260px;
          height: 260px;
          top: -40px;
          left: -30px;
          background: rgba(165, 214, 167, 0.7);
        }

        .login-glow-b {
          width: 300px;
          height: 300px;
          right: -80px;
          bottom: -120px;
          background: rgba(245, 221, 155, 0.58);
        }

        .login-layout {
          position: relative;
          z-index: 1;
          width: min(1120px, 100%);
          min-height: calc(100vh - 56px);
          margin: 0 auto;
          display: grid;
          grid-template-columns: 1.1fr 0.9fr;
          gap: 22px;
          align-items: center;
        }

        .login-story,
        .login-panel {
          border-radius: 34px;
          border: 1px solid rgba(92, 126, 88, 0.12);
          box-shadow: 0 26px 80px rgba(45, 70, 47, 0.12);
          backdrop-filter: blur(16px);
        }

        .login-story {
          display: flex;
          padding: 34px;
          background:
            radial-gradient(circle at top, rgba(255, 255, 255, 0.55), transparent 40%),
            linear-gradient(145deg, rgba(255, 252, 245, 0.9), rgba(235, 247, 231, 0.95));
        }

        .login-mascot-card {
          position: relative;
          flex: 1;
          width: 100%;
          min-height: 100%;
          padding: 28px 24px 22px;
          border-radius: 30px;
          background:
            radial-gradient(circle at top left, rgba(255, 255, 255, 0.8), transparent 34%),
            linear-gradient(180deg, rgba(250, 252, 245, 0.94), rgba(231, 245, 228, 0.98));
          overflow: hidden;
          display: flex;
          flex-direction: column;
          justify-content: center;
        }

        .login-mascot-bubble {
          display: inline-flex;
          margin-bottom: 12px;
          padding: 10px 14px;
          border-radius: 18px 18px 6px 18px;
          background: rgba(255, 255, 255, 0.92);
          color: #35553b;
          font-size: 13px;
          font-weight: 800;
        }

        .login-mascot-art {
          display: flex;
          justify-content: center;
          margin: 6px 0 16px;
          flex: 1;
          align-items: center;
        }

        .login-mascot-art :global(img) {
          width: min(100%, 340px);
          height: auto;
          object-fit: contain;
          filter: drop-shadow(0 24px 36px rgba(52, 83, 57, 0.18));
        }

        .login-mascot-notes {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 10px;
        }

        .login-note-card {
          padding: 14px 12px;
          border-radius: 18px;
          background: rgba(255, 255, 255, 0.72);
        }

        .login-note-label {
          display: block;
          color: #6d836f;
          font-size: 11px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          margin-bottom: 6px;
        }

        .login-note-value {
          color: #29452f;
          font-size: 14px;
          line-height: 1.4;
          font-weight: 700;
        }

        .login-panel {
          padding: 32px 28px;
          background: rgba(255, 252, 245, 0.92);
          align-self: center;
        }

        .login-panel-head h2 {
          margin: 6px 0 8px;
          color: #29452f;
          font-family: var(--font-fredoka), cursive;
          font-size: clamp(30px, 5vw, 40px);
          line-height: 1;
        }

        .login-panel-head p {
          margin: 0 0 22px;
          color: #687b6b;
          line-height: 1.6;
          font-size: 15px;
          font-weight: 600;
        }

        .login-eyebrow {
          color: #6f8e73;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.1em;
          text-transform: uppercase;
        }

        .login-error {
          margin-bottom: 18px;
          padding: 12px 14px;
          border-radius: 16px;
          background: rgba(255, 107, 157, 0.12);
          color: #923b61;
          font-size: 14px;
          line-height: 1.5;
          font-weight: 700;
        }

        .login-form {
          display: flex;
          flex-direction: column;
          gap: 14px;
        }

        .login-field {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .login-field span {
          color: #617564;
          font-size: 11px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.08em;
        }

        .login-input {
          width: 100%;
          border: 1px solid rgba(92, 126, 88, 0.16);
          border-radius: 18px;
          padding: 16px 16px;
          background: rgba(255, 255, 255, 0.88);
          color: #243828;
          font-size: 15px;
          font-weight: 700;
          outline: none;
          transition: border-color 0.2s, box-shadow 0.2s, transform 0.2s;
        }

        .login-input:focus {
          border-color: rgba(74, 122, 82, 0.6);
          box-shadow: 0 0 0 4px rgba(184, 221, 176, 0.35);
        }

        .login-btn {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          border: none;
          border-radius: 999px;
          padding: 16px 18px;
          font-size: 15px;
          font-weight: 800;
          cursor: pointer;
          transition: transform 0.2s, box-shadow 0.2s, opacity 0.2s;
        }

        .login-btn:disabled {
          cursor: not-allowed;
          opacity: 0.72;
          transform: none;
        }

        .login-btn-primary {
          margin-top: 4px;
          color: #fffdf8;
          background: linear-gradient(135deg, #4f8455, #2e5b36);
          box-shadow: 0 18px 28px rgba(58, 101, 62, 0.2);
        }

        .login-btn-primary:hover:not(:disabled),
        .login-btn-secondary:hover:not(:disabled),
        .login-switch-btn:hover {
          transform: translateY(-1px);
        }

        .login-divider {
          display: flex;
          align-items: center;
          gap: 12px;
          margin: 20px 0 18px;
          color: #8a9a8c;
          font-size: 12px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.08em;
        }

        .login-divider::before,
        .login-divider::after {
          content: "";
          flex: 1;
          height: 1px;
          background: rgba(92, 126, 88, 0.16);
        }

        .login-btn-secondary {
          background: rgba(255, 255, 255, 0.94);
          color: #35523b;
          border: 1px solid rgba(92, 126, 88, 0.16);
        }

        .google-icon {
          display: inline-flex;
          justify-content: center;
          align-items: center;
          width: 18px;
          height: 18px;
          flex-shrink: 0;
        }

        .login-switch {
          margin-top: 18px;
          display: flex;
          justify-content: space-between;
          gap: 10px;
          align-items: center;
          color: #6e816f;
          font-size: 14px;
          font-weight: 700;
        }

        .login-switch-btn {
          border: none;
          background: none;
          color: #355c3c;
          font-size: 14px;
          font-weight: 800;
          cursor: pointer;
        }

        @media (max-width: 920px) {
          .login-layout {
            grid-template-columns: 1fr;
            min-height: auto;
          }

          .login-story {
            padding: 28px 22px;
          }

          .login-panel {
            padding: 26px 22px;
          }
        }

        @media (max-width: 640px) {
          .login-shell {
            padding: 14px;
            display: grid;
            place-items: center;
          }

          .login-story {
            display: none;
          }

          .login-layout {
            width: 100%;
            min-height: calc(100vh - 28px);
            align-items: center;
          }

          .login-mascot-card {
            padding: 20px 16px 16px;
          }

          .login-mascot-notes {
            grid-template-columns: 1fr;
          }

          .login-panel-head h2 {
            font-size: 32px;
          }

          .login-switch {
            flex-direction: column;
            align-items: flex-start;
          }
        }
      `}</style>
    </div>
  );
}
