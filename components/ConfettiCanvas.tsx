"use client";

import { useEffect, useRef } from 'react';

type ConfettiPiece = {
  x: number; y: number; vx: number; vy: number;
  rot: number; rotV: number; size: number;
  color: string; shape: string; alpha: number;
};

export function ConfettiCanvas({ trigger }: { trigger: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (trigger === 0 || !canvasRef.current) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    const pieces: ConfettiPiece[] = [];
    const colors = ['#3d8b4e','#ff6b9d','#ffd166','#4ecdc4','#c084fc','#ff9f43'];
    const shapes = ['rect','circle','triangle'];
    
    for (let i = 0; i < 70; i++) {
      pieces.push({
        x: Math.random() * canvas.width,
        y: -20 - Math.random() * 200,
        vx: (Math.random() - 0.5) * 4,
        vy: 2 + Math.random() * 4,
        rot: Math.random() * 360,
        rotV: (Math.random() - 0.5) * 8,
        size: 6 + Math.random() * 10,
        color: colors[Math.floor(Math.random() * colors.length)],
        shape: shapes[Math.floor(Math.random() * shapes.length)],
        alpha: 1,
      });
    }

    let frame = 0;
    
    function draw() {
      if (!ctx || !canvas) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      pieces.forEach(p => {
        p.x += p.vx; p.y += p.vy; p.rot += p.rotV;
        if (frame > 80) p.alpha -= 0.015;
        
        ctx.save();
        ctx.globalAlpha = Math.max(0, p.alpha);
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rot * Math.PI) / 180);
        ctx.fillStyle = p.color;
        
        if (p.shape === 'rect') { 
          ctx.fillRect(-p.size / 2, -p.size / 3, p.size, p.size * 0.6); 
        } else if (p.shape === 'circle') { 
          ctx.beginPath(); ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2); ctx.fill(); 
        } else { 
          ctx.beginPath(); ctx.moveTo(0, -p.size / 2); ctx.lineTo(p.size / 2, p.size / 2); ctx.lineTo(-p.size / 2, p.size / 2); ctx.closePath(); ctx.fill(); 
        }
        ctx.restore();
      });
      
      frame++;
      if (frame < 120) {
        requestAnimationFrame(draw);
      } else {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    }
    
    draw();
    
    const handleResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    }
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [trigger]);

  return <canvas ref={canvasRef} className="confetti-canvas" />;
}
