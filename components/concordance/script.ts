/** Language attributes and font classes for original-language text. */
export function scriptProps(language: "hbo" | "arc" | "grc" | string) {
  return language === "grc"
    ? ({ lang: "grc", dir: "ltr", className: "font-greek" } as const)
    : ({ lang: language === "arc" ? "arc" : "he", dir: "rtl", className: "font-hebrew" } as const);
}
