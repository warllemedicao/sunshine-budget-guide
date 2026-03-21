import { ChevronLeft, ChevronRight } from "lucide-react";
import { useRef } from "react";
import { MESES } from "@/lib/formatters";

interface MonthSelectorProps {
  mes: number;
  ano: number;
  onChange: (mes: number, ano: number) => void;
}

const MonthSelector = ({ mes, ano, onChange }: MonthSelectorProps) => {
  const touchStartX = useRef<number | null>(null);
  const dragStartX = useRef<number | null>(null);

  const prev = () => {
    if (mes === 0) onChange(11, ano - 1);
    else onChange(mes - 1, ano);
  };

  const next = () => {
    if (mes === 11) onChange(0, ano + 1);
    else onChange(mes + 1, ano);
  };

  const handleSwipe = (deltaX: number) => {
    const SWIPE_THRESHOLD = 40;
    if (Math.abs(deltaX) < SWIPE_THRESHOLD) return;
    if (deltaX > 0) prev();
    else next();
  };

  return (
    <div
      className="flex items-center justify-between px-1 pt-[calc(env(safe-area-inset-top)+8px)]"
      onTouchStart={(e) => {
        touchStartX.current = e.touches[0]?.clientX ?? null;
      }}
      onTouchEnd={(e) => {
        const startX = touchStartX.current;
        const endX = e.changedTouches[0]?.clientX;
        touchStartX.current = null;
        if (startX == null || endX == null) return;
        handleSwipe(endX - startX);
      }}
      onMouseDown={(e) => {
        dragStartX.current = e.clientX;
      }}
      onMouseUp={(e) => {
        const startX = dragStartX.current;
        dragStartX.current = null;
        if (startX == null) return;
        handleSwipe(e.clientX - startX);
      }}
      onMouseLeave={() => {
        dragStartX.current = null;
      }}
    >
      <button onClick={prev} className="p-2 rounded-full hover:bg-secondary transition-colors">
        <ChevronLeft className="h-5 w-5 text-muted-foreground" />
      </button>
      <h2 className="text-lg font-semibold">
        {MESES[mes]} {ano}
      </h2>
      <button onClick={next} className="p-2 rounded-full hover:bg-secondary transition-colors">
        <ChevronRight className="h-5 w-5 text-muted-foreground" />
      </button>
    </div>
  );
};

export default MonthSelector;
