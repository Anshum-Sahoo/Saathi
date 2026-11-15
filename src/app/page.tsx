import Link from "next/link";
import { ArrowRight, HeartHandshake, ShieldCheck, Sprout, UsersRound } from "lucide-react";
import { site } from "@/lib/config/site";
import { PreviewBanner } from "@/components/ui/preview-banner";

function WelcomeGarden() {
  return (
    <svg className="hero-garden" viewBox="0 0 420 320" role="img" aria-labelledby="welcome-garden-title">
      <title id="welcome-garden-title">A calm garden growing together</title>
      <circle cx="320" cy="75" r="34" fill="#e8d99f" />
      <path d="M26 248c67-50 134-38 196-8 65 31 125 33 172 6v53H26z" fill="#dce9d7" />
      <path d="M0 278c76-47 145-17 211-2 69 16 140-5 209-26v70H0z" fill="#c9dcc8" />
      <path d="M207 263c-2-66 6-118 25-177m-18 129c-31-24-57-34-90-37m91 1c25-33 49-50 78-58m-84 104c29-17 56-22 92-19m-93-35c-15-36-35-59-58-76" fill="none" stroke="#54856c" strokeWidth="7" strokeLinecap="round" />
      <path d="M122 184c25-15 53-8 69 11-22 18-51 16-69-11zm94-32c-6-29 14-54 42-60 6 29-13 53-42 60zm-2 79c19-27 51-32 75-17-14 27-44 35-75 17zm-5-54c-26-7-44-30-39-57 29 4 48 26 39 57z" fill="#77a486" />
      <path d="M83 265c1-41-4-69-17-97m14 72c-24-17-44-22-69-22m69 11c18-21 35-31 56-36" fill="none" stroke="#789875" strokeWidth="6" strokeLinecap="round" />
      <path d="M12 222c19-11 39-5 52 9-18 13-40 11-52-9zm69-18c-4-22 12-41 34-45 4 22-11 40-34 45z" fill="#a2bf8d" />
      <path d="M338 256c-2-40 4-67 16-95m-12 69c-23-16-43-22-67-23m68 12c17-21 34-31 54-36" fill="none" stroke="#719478" strokeWidth="6" strokeLinecap="round" />
      <path d="M276 213c19-11 39-5 52 9-18 13-40 11-52-9zm68-18c-4-22 12-41 34-45 4 22-11 40-34 45z" fill="#93b78a" />
      <path d="M160 267h98" stroke="#92ab89" strokeWidth="3" strokeLinecap="round" />
      <circle cx="284" cy="254" r="9" fill="#dba07e" /><circle cx="284" cy="254" r="3" fill="#fff2df" />
      <circle cx="114" cy="248" r="8" fill="#dbb274" /><circle cx="114" cy="248" r="3" fill="#fff2df" />
    </svg>
  );
}

const roles = [
  { href: "/elder", title: "For elders", text: "A clear, comfortable place to share how you’re doing and keep care on your terms.", icon: ShieldCheck },
  { href: "/caregiver", title: "For caregivers", text: "Know what needs attention, then let the circle see when you’ve got it.", icon: HeartHandshake },
  { href: "/family", title: "For family", text: "Stay close to the little details and the people sharing care with you.", icon: UsersRound },
];

export default function HomePage() {
  return (
    <div className="page-wrap">
      <PreviewBanner>Private care circles · Adult accounts use Firebase Authentication · Elder devices pair once.</PreviewBanner>
      <section className="hero" aria-labelledby="welcome-title">
        <div className="hero-copy">
          <span className="eyebrow"><Sprout size={15} />Care feels better together</span>
          <h1 id="welcome-title">A care circle that keeps <span>showing up.</span></h1>
          <p>{site.tagline} SAATHI helps elders, caregivers, and family stay connected around everyday care—with the elder always at the centre.</p>
          <div className="hero-actions">
          <Link className="button button-primary" href="/register">Create a care circle <ArrowRight size={17} /></Link>
            <Link className="button button-secondary" href="/pair-device">Pair elder device</Link>
          </div>
        </div>
        <div className="hero-art"><div className="hero-orbit" aria-hidden="true" /><WelcomeGarden /><div className="hero-note"><span className="hero-note-mark"><HeartHandshake size={17} /></span><div><strong>Care, shared with care</strong><span>Everyone knows who’s there</span></div></div></div>
      </section>
      <section aria-labelledby="roles-title">
        <div className="section-heading"><div><h2 id="roles-title">A place for everyone in the circle</h2><p>Choose where you want to start.</p></div></div>
        <div className="role-grid">
          {roles.map(({ href, title, text, icon: Icon }) => (
            <Link className="role-card" href={href} key={href}><span className="role-icon"><Icon size={20} /></span><h3>{title}</h3><p>{text}</p></Link>
          ))}
        </div>
      </section>
    </div>
  );
}
