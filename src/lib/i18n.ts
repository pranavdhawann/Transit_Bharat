"use client";

import { useCallback, useEffect, useState } from "react";

export type Lang = "en" | "hi";

const STORAGE_KEY = "tb:lang";
const EVENT = "tb:lang-change";

/**
 * Lightweight bilingual toggle (EN / हिंदी) for key journey strings.
 * Deliberately partial - see LIMITATIONS.md; we do not advertise full
 * bilingual support.
 */
export function useLang(): [Lang, (l: Lang) => void] {
  const [lang, setLangState] = useState<Lang>("en");

  useEffect(() => {
    let stored: string | null = null;
    try {
      stored = window.localStorage.getItem(STORAGE_KEY);
    } catch {
      stored = null;
    }
    if (stored === "hi" || stored === "en") setLangState(stored);
    const onChange = (e: Event) => {
      const detail = (e as CustomEvent<Lang>).detail;
      setLangState(detail);
    };
    window.addEventListener(EVENT, onChange);
    return () => window.removeEventListener(EVENT, onChange);
  }, []);

  const setLang = useCallback((l: Lang) => {
    try {
      window.localStorage.setItem(STORAGE_KEY, l);
    } catch {
      // Storage unavailable (e.g. private mode) - keep session-only language.
    }
    document.documentElement.lang = l === "hi" ? "hi-IN" : "en-IN";
    window.dispatchEvent(new CustomEvent<Lang>(EVENT, { detail: l }));
  }, []);

  return [lang, setLang];
}

type Dict = Record<string, { en: string; hi: string }>;

export const T: Dict = {
  heroTitle1: { en: "Know exactly how to", hi: "पूरा रास्ता जानिए —" },
  heroTitle2: { en: "get there", hi: "भरोसे के साथ" },
  heroSub: {
    en: "Plan a complete door-to-door bus + metro journey on the Delhi pilot network. See where your bus is — and how fresh the information is.",
    hi: "दिल्ली पायलट नेटवर्क पर घर-से-मंज़िल बस + मेट्रो यात्रा की योजना बनाएं। जानें आपकी बस कहाँ है — और जानकारी कितनी ताज़ा है।",
  },
  findRoute: { en: "Find my route", hi: "मेरा रास्ता खोजें" },
  lessWalking: { en: "Less walking", hi: "कम पैदल चलना" },
  leaveNow: { en: "Leave now · Delhi pilot network", hi: "अभी चलें · दिल्ली पायलट" },
  tryDemo: { en: "Try a demo journey", hi: "डेमो यात्रा आज़माएँ" },
  describeTrip: { en: "Or just describe your trip", hi: "या अपनी यात्रा बताइए" },
  trustHeading: {
    en: "Every arrival tells you how much to trust it",
    hi: "हर जानकारी के साथ भरोसे का स्तर भी",
  },
  startJourney: { en: "Start journey", hi: "यात्रा शुरू करें" },
  advance: { en: "Advance", hi: "आगे बढ़ें" },
  arrived: { en: "You have reached your destination.", hi: "आप मंज़िल पर पहुँच गए।" },
  simulateDelay: { en: "Simulate delay (demo)", hi: "देरी दिखाएँ (डेमो)" },
  switchRoute: { en: "Switch route", hi: "रास्ता बदलें" },
  exitGo: { en: "Exit GO", hi: "GO बंद करें" },
};

export function t(lang: Lang, key: keyof typeof T | string): string {
  const entry = T[key];
  if (!entry) return key;
  return entry[lang];
}
