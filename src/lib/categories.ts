import {
  Home, ShoppingCart, Coffee, Fuel, Bus, UtensilsCrossed,
  GraduationCap, Wrench, Shirt, Heart, Gamepad2, Dumbbell,
  MoreHorizontal, Croissant, Wallet, TrendingUp, TrendingDown,
} from "lucide-react";

export const CATEGORIAS = [
  { id: "moradia", label: "Moradia", icon: Home, color: "hsl(243, 75%, 59%)" },
  { id: "padaria", label: "Padaria", icon: Croissant, color: "hsl(38, 92%, 50%)" },
  { id: "mercado", label: "Mercado", icon: ShoppingCart, color: "hsl(142, 71%, 45%)" },
  { id: "posto", label: "Posto", icon: Fuel, color: "hsl(0, 72%, 51%)" },
  { id: "transporte", label: "Transporte", icon: Bus, color: "hsl(200, 65%, 50%)" },
  { id: "alimentacao", label: "Alimentação", icon: UtensilsCrossed, color: "hsl(25, 95%, 53%)" },
  { id: "educacao", label: "Educação", icon: GraduationCap, color: "hsl(262, 83%, 58%)" },
  { id: "servicos", label: "Serviços", icon: Wrench, color: "hsl(220, 10%, 46%)" },
  { id: "roupas", label: "Roupas", icon: Shirt, color: "hsl(330, 70%, 55%)" },
  { id: "saude", label: "Saúde", icon: Heart, color: "hsl(0, 84%, 60%)" },
  { id: "lazer", label: "Lazer", icon: Gamepad2, color: "hsl(170, 60%, 45%)" },
  { id: "esporte", label: "Esporte", icon: Dumbbell, color: "hsl(45, 93%, 47%)" },
  { id: "outros", label: "Outros", icon: MoreHorizontal, color: "hsl(220, 14%, 50%)" },
] as const;

export const getCategoriaInfo = (id: string) =>
  CATEGORIAS.find((c) => c.id === id) || CATEGORIAS[CATEGORIAS.length - 1];

export const TIPO_ICONS = {
  receita: TrendingUp,
  despesa: TrendingDown,
} as const;
