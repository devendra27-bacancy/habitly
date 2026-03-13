"use client";

import { useEffect, useState } from 'react';

export default function SplashScreen({ onComplete }: { onComplete: () => void }) {
  const [hide, setHide] = useState(false);
  const [remove, setRemove] = useState(false);

  useEffect(() => {
    const hasData = localStorage.getItem('habitflow_v3_next');
    if (hasData) {
      setHide(true);
      setTimeout(() => {
        setRemove(true);
        onComplete();
      }, 600);
    }
  }, [onComplete]);

  const handleGo = () => {
    setHide(true);
    setTimeout(() => {
      setRemove(true);
      onComplete();
    }, 600);
  };

  if (remove) return null;

  return (
    <div id="splash" className={hide ? 'hide' : ''}>
      <div className="splash-mascot" aria-hidden="true">
        <svg width="100" height="100" viewBox="0 0 100 100">
          <polygon points="50,8 92,35 78,82 22,82 8,35" fill="#3d8b4e" />
          <circle cx="38" cy="46" r="5" fill="white" />
          <circle cx="62" cy="46" r="5" fill="white" />
          <circle cx="39" cy="47" r="2.5" fill="#1c1c1c" />
          <circle cx="63" cy="47" r="2.5" fill="#1c1c1c" />
          <path d="M38 60 Q50 70 62 60" stroke="white" strokeWidth="3" fill="none" strokeLinecap="round" />
          <line x1="38" y1="82" x2="32" y2="96" stroke="#3d8b4e" strokeWidth="5" strokeLinecap="round" />
          <line x1="62" y1="82" x2="68" y2="96" stroke="#3d8b4e" strokeWidth="5" strokeLinecap="round" />
          <ellipse cx="30" cy="97" rx="7" ry="4" fill="#2d6e3a" />
          <ellipse cx="70" cy="97" rx="7" ry="4" fill="#2d6e3a" />
        </svg>
      </div>
      <div className="splash-title">
        GO FOR
        <br />
        <span>BETTER<br />HABITS</span>
        <br />
        WITH MOE
      </div>
      <div className="splash-sub">It&apos;s more fun together! 🌿</div>
      <button className="splash-btn" onClick={handleGo}>Let&apos;s Go! →</button>
    </div>
  );
}
