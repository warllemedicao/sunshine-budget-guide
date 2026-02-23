import { ChevronLeft, ChevronRight } from "lucide-react";
import { MESES } from "@/lib/formatters";

interface MonthSelectorProps {
  mes: number;
  ano: number;
  onChange: (mes: number, ano: number) => void;
}

const MonthSelector = ({ mes, ano, onChange }: MonthSelectorProps) => {
  const prev = () => {
    if (mes === 0) onChange(11, ano - 1);
    else onChange(mes - 1, ano);
  };

  const next = () => {
    if (mes === 11) onChange(0, ano + 1);
    else onChange(mes + 1, ano);
  };

  return (
    <div className="flex items-center justify-between px-1">
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
