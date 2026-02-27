import { useState, useEffect, useMemo } from "react";
import { cn } from "@/lib/utils";

// Map of common Brazilian banks and stores to their domains for logo lookup
const KNOWN_DOMAINS: Array<[string, string]> = [
  ["nubank", "nubank.com.br"],
  ["itaú", "itau.com.br"],
  ["itau", "itau.com.br"],
  ["bradesco", "bradesco.com.br"],
  ["santander", "santander.com.br"],
  ["caixa econômica", "caixa.gov.br"],
  ["caixa economica", "caixa.gov.br"],
  ["caixa", "caixa.gov.br"],
  ["banco do brasil", "bb.com.br"],
  ["inter", "bancointer.com.br"],
  ["banco inter", "bancointer.com.br"],
  ["c6 bank", "c6bank.com.br"],
  ["c6bank", "c6bank.com.br"],
  ["next", "next.me"],
  ["original", "bancooriginal.com.br"],
  ["sicoob", "sicoob.com.br"],
  ["sicredi", "sicredi.com.br"],
  ["xp investimentos", "xpi.com.br"],
  ["pagbank", "pagbank.com.br"],
  ["pag bank", "pagbank.com.br"],
  ["picpay", "picpay.com"],
  ["mercado pago", "mercadopago.com.br"],
  ["stone", "stone.com.br"],
  ["pagseguro", "pagseguro.com.br"],
  ["neon", "banconeon.com.br"],
  ["agibank", "agibank.com.br"],
  ["banco pan", "bancopan.com.br"],
  ["pan", "bancopan.com.br"],
  ["digio", "digio.com.br"],
  ["safra", "safra.com.br"],
  ["bmg", "bancobmg.com.br"],
  ["modal", "bancomodal.com.br"],
  ["amazon", "amazon.com.br"],
  ["americanas", "americanas.com.br"],
  ["magazine luiza", "magazineluiza.com.br"],
  ["magalu", "magazineluiza.com.br"],
  ["shopee", "shopee.com.br"],
  ["mercado livre", "mercadolivre.com.br"],
  ["casas bahia", "casasbahia.com.br"],
  ["ifood", "ifood.com.br"],
  ["rappi", "rappi.com.br"],
  ["uber", "uber.com"],
  ["netflix", "netflix.com"],
  ["spotify", "spotify.com"],
  ["amazon prime", "amazon.com.br"],
  ["globo", "globo.com"],
  ["vivo", "vivo.com.br"],
  ["claro", "claro.com.br"],
  ["tim", "tim.com.br"],
  ["oi", "oi.com.br"],
  ["google", "google.com"],
  ["apple", "apple.com"],
  ["microsoft", "microsoft.com"],
];

export function getLogoDomain(name: string): string {
  if (!name?.trim()) return "";
  const key = name.toLowerCase().trim();
  for (const [pattern, domain] of KNOWN_DOMAINS) {
    if (key.includes(pattern)) return domain;
  }
  const slug = key.replace(/\s+/g, "").replace(/[^a-z0-9]/gi, "");
  return slug.length >= 3 ? `${slug}.com.br` : "";
}

export function getLogoUrl(name: string): string {
  const domain = getLogoDomain(name);
  return domain ? `https://logo.clearbit.com/${domain}` : "";
}

export function getInitials(name: string): string {
  if (!name?.trim()) return "?";
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

const SIZE_CLASSES = {
  xs: "h-5 w-5 min-w-[1.25rem] text-[9px]",
  sm: "h-7 w-7 min-w-[1.75rem] text-[10px]",
  md: "h-9 w-9 min-w-[2.25rem] text-xs",
};

interface LogoImageProps {
  name: string;
  size?: "xs" | "sm" | "md";
  className?: string;
}

export const LogoImage = ({ name, size = "sm", className }: LogoImageProps) => {
  const [fallbackIndex, setFallbackIndex] = useState(0);
  const sizeClass = SIZE_CLASSES[size];

  const domain = useMemo(() => getLogoDomain(name), [name]);

  // Reset fallback when the domain changes (different name prop)
  useEffect(() => {
    setFallbackIndex(0);
  }, [domain]);

  const urls = useMemo(() => {
    if (!domain) return [];
    return [
      `https://logo.clearbit.com/${domain}`,
      `https://www.google.com/s2/favicons?domain=${domain}&sz=128`,
    ];
  }, [domain]);

  const currentUrl = urls[fallbackIndex];

  if (!currentUrl) {
    return (
      <div
        className={cn(
          "flex flex-shrink-0 items-center justify-center rounded-md bg-muted font-semibold text-muted-foreground",
          sizeClass,
          className
        )}
      >
        {getInitials(name)}
      </div>
    );
  }

  return (
    <img
      src={currentUrl}
      alt={name}
      onError={() => setFallbackIndex((prev) => prev + 1)}
      className={cn(
        "flex-shrink-0 rounded-md border border-border/50 bg-white object-contain p-[1px]",
        sizeClass,
        className
      )}
    />
  );
};
