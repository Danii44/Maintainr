import { createContext, useContext, useEffect, useMemo, useState } from "react";

type Language = "en" | "ar";

type LanguageContextValue = {
  language: Language;
  direction: "ltr" | "rtl";
  setLanguage: (language: Language) => void;
  toggleLanguage: () => void;
  t: (english: string, arabic: string) => string;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => {
    if (typeof window === "undefined") return "en";
    const requested = new URLSearchParams(window.location.search).get("lang");
    if (requested === "ar") return "ar";
    return window.localStorage.getItem("maintainr-language") === "ar" ? "ar" : "en";
  });

  const setLanguage = (next: Language) => setLanguageState(next);
  const toggleLanguage = () => setLanguageState((current) => current === "en" ? "ar" : "en");
  const direction: "ltr" | "rtl" = language === "ar" ? "rtl" : "ltr";

  useEffect(() => {
    window.localStorage.setItem("maintainr-language", language);
    document.documentElement.lang = language;
    document.documentElement.dir = direction;
  }, [language, direction]);

  const value = useMemo(() => ({ language, direction, setLanguage, toggleLanguage, t: (english: string, arabic: string) => language === "ar" ? arabic : english }), [language, direction]);
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error("useLanguage must be used inside LanguageProvider");
  return context;
}
