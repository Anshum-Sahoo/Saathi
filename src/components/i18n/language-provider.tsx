"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useSyncExternalStore, type ReactNode } from "react";
import english from "../../../messages/en.json";
import hindi from "../../../messages/hi.json";

export type Language = "en" | "hi";
type Dictionary = Record<string, string>;
const dictionaries: Record<Language, Dictionary> = { en: english, hi: hindi };
const languageKey = "saathi-language";
const listeners = new Set<() => void>();
function subscribe(listener: () => void) { listeners.add(listener); window.addEventListener("storage", listener); return () => { listeners.delete(listener); window.removeEventListener("storage", listener); }; }
function getLanguage(): Language { try { return window.localStorage.getItem(languageKey) === "hi" ? "hi" : "en"; } catch { return "en"; } }
function setStoredLanguage(language: Language) { try { window.localStorage.setItem(languageKey, language); } catch { /* language remains active for this page */ } listeners.forEach((listener) => listener()); }
type LanguageContextValue = { language: Language; setLanguage: (language: Language) => void; t: (key: string, params?: Record<string, string | number>) => string };
const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const language = useSyncExternalStore<Language>(subscribe, getLanguage, () => "en");
  useEffect(() => { document.documentElement.lang = language; }, [language]);
  const setLanguage = useCallback((next: Language) => {
    setStoredLanguage(next);
  }, []);
  const t = useCallback((key: string, params: Record<string, string | number> = {}) => {
    const template = dictionaries[language][key] ?? dictionaries.en[key] ?? key;
    return template.replace(/\{([^}]+)\}/g, (match, name: string) => String(params[name] ?? match));
  }, [language]);
  const value = useMemo(() => ({ language, setLanguage, t }), [language, setLanguage, t]);
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error("useLanguage must be used inside LanguageProvider");
  return context;
}
