"use client";

type LocalMigrationPromptProps = {
  open: boolean;
  habitCount: number;
  onConfirm: () => void;
  onSkip: () => void;
  isMigrating: boolean;
  error?: string | null;
};

export function LocalMigrationPrompt({
  open,
  habitCount,
  onConfirm,
  onSkip,
  isMigrating,
  error,
}: LocalMigrationPromptProps) {
  if (!open) return null;

  return (
    <div className="migration-shell" role="dialog" aria-modal="true" aria-labelledby="migration-title">
      <div className="migration-backdrop" />
      <div className="migration-card">
        <div className="migration-eyebrow">Welcome back</div>
        <h2 id="migration-title">Bring your saved habits into habitly?</h2>
        <p>
          We found {habitCount} habit{habitCount === 1 ? '' : 's'} on this device from your earlier local version.
          You can sync them into this account now, or start fresh.
        </p>
        {error ? <div className="migration-error">{error}</div> : null}
        <div className="migration-actions">
          <button type="button" className="migration-secondary" onClick={onSkip} disabled={isMigrating}>
            Start fresh
          </button>
          <button type="button" className="migration-primary" onClick={onConfirm} disabled={isMigrating}>
            {isMigrating ? 'Syncing...' : error ? 'Retry sync' : 'Sync my data'}
          </button>
        </div>
      </div>

      <style jsx>{`
        .migration-shell {
          position: fixed;
          inset: 0;
          z-index: 120;
          display: grid;
          place-items: center;
          padding: 24px;
        }
        .migration-backdrop {
          position: absolute;
          inset: 0;
          background:
            radial-gradient(circle at top, rgba(184, 221, 176, 0.34), transparent 45%),
            rgba(18, 34, 20, 0.28);
          backdrop-filter: blur(16px);
        }
        .migration-card {
          position: relative;
          width: min(100%, 520px);
          padding: 30px 28px;
          border-radius: 28px;
          background: linear-gradient(180deg, rgba(255, 252, 245, 0.95), rgba(246, 238, 223, 0.98));
          border: 1px solid rgba(92, 126, 88, 0.14);
          box-shadow: 0 30px 80px rgba(39, 72, 44, 0.18);
          color: #29432f;
          animation: floatIn 280ms ease-out;
        }
        .migration-eyebrow {
          display: inline-flex;
          margin-bottom: 10px;
          padding: 8px 12px;
          border-radius: 999px;
          background: rgba(108, 148, 92, 0.12);
          color: #4f724e;
          font-size: 12px;
          font-weight: 800;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }
        h2 {
          margin: 0 0 10px;
          font-size: clamp(28px, 4vw, 36px);
          line-height: 1.04;
          font-family: var(--font-fredoka), cursive;
        }
        p {
          margin: 0;
          color: #506456;
          font-size: 15px;
          line-height: 1.6;
        }
        .migration-error {
          margin-top: 14px;
          padding: 12px 14px;
          border-radius: 14px;
          background: rgba(255, 107, 157, 0.12);
          color: #8e3155;
          font-size: 13px;
          font-weight: 700;
          line-height: 1.5;
        }
        .migration-actions {
          display: flex;
          justify-content: flex-end;
          gap: 12px;
          margin-top: 24px;
        }
        .migration-primary,
        .migration-secondary {
          border: none;
          border-radius: 16px;
          padding: 13px 18px;
          font-size: 15px;
          font-weight: 800;
          cursor: pointer;
          transition: transform 180ms ease, box-shadow 180ms ease, background 180ms ease;
        }
        .migration-primary {
          background: linear-gradient(135deg, #5f8e59, #3f6944);
          color: #fffdf7;
          box-shadow: 0 18px 30px rgba(72, 108, 69, 0.22);
        }
        .migration-secondary {
          background: rgba(255, 255, 255, 0.7);
          color: #4d6350;
          box-shadow: inset 0 0 0 1px rgba(92, 126, 88, 0.14);
        }
        .migration-primary:hover,
        .migration-secondary:hover {
          transform: translateY(-1px);
        }
        .migration-primary:disabled,
        .migration-secondary:disabled {
          cursor: wait;
          opacity: 0.7;
          transform: none;
        }
        @keyframes floatIn {
          from {
            opacity: 0;
            transform: translateY(14px) scale(0.98);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        @media (max-width: 640px) {
          .migration-card {
            padding: 24px 20px;
            border-radius: 24px;
          }
          .migration-actions {
            flex-direction: column-reverse;
          }
          .migration-primary,
          .migration-secondary {
            width: 100%;
          }
        }
      `}</style>
    </div>
  );
}
