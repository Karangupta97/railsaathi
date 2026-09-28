/**
 * Supported languages. The selected language drives BOTH the speech
 * recognition locale and the language the assistant replies in.
 */
export type LanguageCode = "en" | "hi" | "mr";

export type Language = {
  code: LanguageCode;
  /** Endonym shown in the selector. */
  label: string;
  /** BCP-47 locale passed to the Web Speech API. */
  speechLang: "en-IN" | "hi-IN" | "mr-IN";
  /** Language name used in the system prompt ("Reply in {replyName}"). */
  replyName: "English" | "Hindi" | "Marathi";
};

export const LANGUAGES: Readonly<Record<LanguageCode, Language>> = {
  en: { code: "en", label: "English", speechLang: "en-IN", replyName: "English" },
  hi: { code: "hi", label: "हिन्दी", speechLang: "hi-IN", replyName: "Hindi" },
  mr: { code: "mr", label: "मराठी", speechLang: "mr-IN", replyName: "Marathi" },
};

export const LANGUAGE_CODES = ["en", "hi", "mr"] as const satisfies readonly LanguageCode[];

export const DEFAULT_LANGUAGE: LanguageCode = "en";

export function isLanguageCode(value: unknown): value is LanguageCode {
  return value === "en" || value === "hi" || value === "mr";
}
