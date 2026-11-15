import Link from "next/link";
import { HeartHandshake, Home, UsersRound } from "lucide-react";

const links = [
  { href: "/elder", label: "Elder Mode", icon: Home },
  { href: "/caregiver", label: "Caregiver", icon: HeartHandshake },
  { href: "/family", label: "Family", icon: UsersRound },
];

export function SiteHeader() {
  return (
    <header className="site-header">
      <Link className="brand" href="/" aria-label="SAATHI home">
        <span className="brand-mark" aria-hidden="true"><HeartHandshake size={21} strokeWidth={2.2} /></span>
        <span className="brand-name">saa<span>thi</span></span>
      </Link>
      <nav className="header-nav" aria-label="Main navigation">
        {links.map(({ href, label, icon: Icon }) => (
          <Link key={href} href={href}><Icon size={16} aria-hidden="true" />{label}</Link>
        ))}
      </nav>
      <span className="header-note">Care, together</span>
    </header>
  );
}
