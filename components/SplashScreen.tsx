"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

export default function SplashScreen({ onComplete }: { onComplete: () => void }) {
  const [hide, setHide] = useState(false);
  const [remove, setRemove] = useState(false);

  useEffect(() => {
    const hasData = localStorage.getItem("habitflow_v3_next");
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
    <div id="splash" className={hide ? "hide" : ""}>
      <div className="splash-mascot" aria-hidden="true">
        <Image
          src="/mascot/mascot_idle_default.png"
          alt="Habitly mascot"
          width={176}
          height={176}
          priority
        />
      </div>
      <div className="splash-title">
        Meet Lizzo,
        <br />
        <span>your habit sidekick</span>
      </div>
      <div className="splash-sub">
        Build steady routines, protect your streak, and make progress one check-in at a time.
      </div>
      <button className="splash-btn" onClick={handleGo}>
        Start with Habitly
      </button>
    </div>
  );
}
