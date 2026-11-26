/** Types shared by the server and the browser. Keep this file free of imports. */

/** Tutor languages. Questions always stay in English so test scores compare fairly. */
export type Language = "en" | "te" | "mix" | "hi" | "hinglish";

export const LANGUAGES: Language[] = ["en", "te", "hi", "mix", "hinglish"];

/** Study mode assigns every session to one of these groups. */
export type StudyGroup = "stuckpoint" | "control";

/** The two tests scored against the fixed answer key. */
export type TestPhase = "pretest" | "posttest";

/** Where a session is in the five step flow. */
export type Phase = TestPhase | "diagnosis" | "tutor" | "mastery" | "results";

export const LANGUAGE_LABEL: Record<Language, string> = {
  en: "English",
  te: "Telugu",
  hi: "Hindi",
  mix: "Telugu-English",
  hinglish: "Hindi-English",
};
