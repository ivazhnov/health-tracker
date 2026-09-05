export const SPECIMEN_OPTIONS = [
  { code: "venous_whole_blood", label: "Венозная кровь" },
  { code: "capillary_whole_blood", label: "Капиллярная кровь" },
  { code: "serum", label: "Сыворотка" },
  { code: "plasma", label: "Плазма" },
  { code: "urine", label: "Моча" },
  { code: "stool", label: "Кал" },
  { code: "saliva", label: "Слюна" },
  { code: "swab", label: "Мазок" },
  { code: "sputum", label: "Мокрота" },
  { code: "semen", label: "Эякулят" },
  { code: "csf", label: "Спинномозговая жидкость" },
  { code: "hair", label: "Волосы" },
  { code: "nails", label: "Ногти" },
  { code: "other", label: "Другое" },
  { code: "unknown", label: "Не определён" },
] as const;

export type SpecimenCode = (typeof SPECIMEN_OPTIONS)[number]["code"];

const LABELS = new Map<string, string>(
  SPECIMEN_OPTIONS.map(({ code, label }) => [code, label]),
);

export function isSpecimenCode(value: string): value is SpecimenCode {
  return LABELS.has(value);
}

export function specimenLabel(code: SpecimenCode) {
  return LABELS.get(code)!;
}

export function recognizeSpecimen(
  value: string | null | undefined,
): SpecimenCode {
  const normalized = (value ?? "").normalize("NFKC").toLocaleLowerCase();
  if (!normalized.trim()) return "unknown";
  if (/(?:капилл|capillary)/u.test(normalized)) return "capillary_whole_blood";
  if (/(?:сыворот|serum|sérum|siero)/u.test(normalized)) return "serum";
  if (/(?:плазм|plasma)/u.test(normalized)) return "plasma";
  if (/(?:моча|urine|urin\b|urina)/u.test(normalized)) return "urine";
  if (/(?:кал\b|stool|faec|feces|feci)/u.test(normalized)) return "stool";
  if (/(?:слюн|saliva)/u.test(normalized)) return "saliva";
  if (/(?:мазок|swab|abstrich|tampone|écouvillon)/u.test(normalized))
    return "swab";
  if (/(?:мокрот|sputum)/u.test(normalized)) return "sputum";
  if (/(?:эякулят|сперм|semen|sperm)/u.test(normalized)) return "semen";
  if (
    /(?:спинномозг|ликвор|cerebrospinal|cerebro-spinal|csf)/u.test(normalized)
  )
    return "csf";
  if (/(?:волос|hair|capelli|cheveux)/u.test(normalized)) return "hair";
  if (/(?:ногт|nail|unghie|ongles)/u.test(normalized)) return "nails";
  if (/(?:кров|blood|blut|sangue|sang\b)/u.test(normalized))
    return "venous_whole_blood";
  return "other";
}
