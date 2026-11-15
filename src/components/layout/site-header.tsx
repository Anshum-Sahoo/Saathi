"use client";

import Link from "next/link";
import { HeartHandshake, Home, UsersRound, UserRound } from "lucide-react";
import { useLanguage } from "@/components/i18n/language-provider";

const links = [
  { href: "/elder", key: "nav.elder", icon: Home },
  { href: "/caregiver", key: "nav.caregiver", icon: HeartHandshake },
  { href: "/family", key: "nav.family", icon: UsersRound },
  { href: "/care-circle", key: "nav.circle", icon: UsersRound },
  { href: "/login", key: "nav.signIn", icon: UserRound },
  { href: "/demo", key: "nav.demo", icon: HeartHandshake },
];

export function SiteHeader() {
  const { language, setLanguage, t } = useLanguage();
  return (
    <header className="site-header">
      <Link className="brand" href="/" aria-label="SAATHI home">
        <span className="brand-mark" aria-hidden="true"><HeartHandshake size={21} strokeWidth={2.2} /></span>
        <span className="brand-name">saa<span>thi</span></span>
      </Link>
      <nav className="header-nav" aria-label="Main navigation">
        {links.map(({ href, key, icon: Icon }) => (
          <Link key={href} href={href}><Icon size={16} aria-hidden="true" />{t(key)}</Link>
        ))}
      </nav>
      <label className="language-select"><span className="sr-only">{t("common.language")}</span><select aria-label={t("common.language")} value={language} onChange={(event) => setLanguage(event.target.value === "hi" ? "hi" : "en")}><option value="en">English</option><option value="hi">हिन्दी</option></select></label>
      <span className="header-note">Care, together</span>
    </header>
  );
}
