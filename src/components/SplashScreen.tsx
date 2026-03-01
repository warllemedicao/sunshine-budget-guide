import { useEffect, useState } from "react";

interface SplashScreenProps {
  onFinish: () => void;
}

const FADE_START_DELAY = 2200;
const SPLASH_DURATION = 2700;

const SplashScreen = ({ onFinish }: SplashScreenProps) => {
  const [phase, setPhase] = useState<"visible" | "fading">("visible");

  useEffect(() => {
    const fadeTimer = setTimeout(() => setPhase("fading"), FADE_START_DELAY);
    const doneTimer = setTimeout(() => onFinish(), SPLASH_DURATION);
    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(doneTimer);
    };
  }, [onFinish]);

  return (
    <div
      className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[hsl(243,75%,20%)] transition-opacity duration-500 ${
        phase === "fading" ? "opacity-0" : "opacity-100"
      }`}
    >
      <style>{`
        @keyframes coinBounce {
          0%, 100% { transform: translateY(0) rotate(0deg); opacity: 1; }
          50% { transform: translateY(-18px) rotate(15deg); opacity: 0.9; }
        }
        @keyframes barGrow {
          0% { transform: scaleY(0); opacity: 0; }
          100% { transform: scaleY(1); opacity: 1; }
        }
        @keyframes lineGrow {
          0% { stroke-dashoffset: 200; opacity: 0; }
          100% { stroke-dashoffset: 0; opacity: 1; }
        }
        @keyframes fadePop {
          0% { transform: scale(0.5); opacity: 0; }
          70% { transform: scale(1.1); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes floatUp {
          0% { transform: translateY(20px); opacity: 0; }
          100% { transform: translateY(0); opacity: 1; }
        }
        .anim-coin-1 { animation: coinBounce 1.2s ease-in-out 0.1s infinite; }
        .anim-coin-2 { animation: coinBounce 1.2s ease-in-out 0.35s infinite; }
        .anim-coin-3 { animation: coinBounce 1.2s ease-in-out 0.6s infinite; }
        .anim-bar-1 { transform-origin: bottom; animation: barGrow 0.5s ease-out 0.4s both; }
        .anim-bar-2 { transform-origin: bottom; animation: barGrow 0.5s ease-out 0.6s both; }
        .anim-bar-3 { transform-origin: bottom; animation: barGrow 0.5s ease-out 0.8s both; }
        .anim-bar-4 { transform-origin: bottom; animation: barGrow 0.5s ease-out 1.0s both; }
        .anim-line { stroke-dasharray: 200; animation: lineGrow 1s ease-out 0.5s both; }
        .anim-logo { animation: fadePop 0.6s ease-out 0.1s both; }
        .anim-title { animation: floatUp 0.6s ease-out 0.5s both; }
        .anim-subtitle { animation: floatUp 0.6s ease-out 0.75s both; }
      `}</style>

      {/* Logo icon */}
      <div className="anim-logo mb-6">
        <div className="relative flex h-24 w-24 items-center justify-center rounded-3xl bg-white/10 shadow-2xl">
          <svg viewBox="0 0 80 80" width="72" height="72" xmlns="http://www.w3.org/2000/svg">
            {/* Bar chart */}
            <rect className="anim-bar-1" x="8" y="50" width="12" height="22" rx="3" fill="#a78bfa" />
            <rect className="anim-bar-2" x="24" y="38" width="12" height="34" rx="3" fill="#818cf8" />
            <rect className="anim-bar-3" x="40" y="28" width="12" height="44" rx="3" fill="#6366f1" />
            <rect className="anim-bar-4" x="56" y="18" width="12" height="54" rx="3" fill="#4f46e5" />
            {/* Trend line */}
            <polyline
              className="anim-line"
              points="14,58 30,46 46,34 62,22"
              fill="none"
              stroke="#fbbf24"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {/* Arrow head */}
            <polyline
              className="anim-line"
              points="56,18 62,22 58,28"
              fill="none"
              stroke="#fbbf24"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      </div>

      {/* Animated coins row */}
      <div className="mb-8 flex items-end gap-4">
        <span className="anim-coin-1 text-4xl select-none">💰</span>
        <span className="anim-coin-2 text-5xl select-none">💎</span>
        <span className="anim-coin-3 text-4xl select-none">📈</span>
      </div>

      {/* App name */}
      <h1 className="anim-title text-3xl font-extrabold tracking-wide text-white drop-shadow-lg">
        Gil Financeiro
      </h1>

      {/* Tagline */}
      <p className="anim-subtitle mt-2 text-sm font-medium text-white/70">
        Controle suas finanças com inteligência
      </p>

      {/* Loading dots */}
      <div className="anim-subtitle mt-8 flex gap-2">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="h-2 w-2 rounded-full bg-white/50"
            style={{ animation: `coinBounce 0.9s ease-in-out ${i * 0.2}s infinite` }}
          />
        ))}
      </div>
    </div>
  );
};

export default SplashScreen;
