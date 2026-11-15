"use client";

import { useLanguage } from "@/components/i18n/language-provider";

export function SiteFooter() {
  const { t } = useLanguage();
  return <footer className="page-footer">{t("footer.safety")}</footer>;
}
