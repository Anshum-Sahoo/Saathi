import { ArrowRight, BellRing, Clock3, HandHeart, UsersRound } from "lucide-react";
import { PreviewBanner } from "@/components/ui/preview-banner";

export default function CaregiverPage() {
  return (
    <div className="page-wrap">
      <PreviewBanner>Caregiver dashboard preview. Sample requests and people are fictional; no tasks can be claimed yet.</PreviewBanner>
      <div className="screen-heading">
        <div><span className="eyebrow">Your care circle</span><h1>Here when it matters.</h1><p>See what needs attention and who is looking after it. In the full app, a caregiver can claim a request so the circle knows it’s covered.</p></div>
        <span className="pill-preview"><UsersRound size={14} />Caregiver preview</span>
      </div>

      <div className="dashboard-grid">
        <div className="stack">
          <section className="surface surface-pad" aria-labelledby="requests-heading">
            <div className="surface-heading"><div><h2 id="requests-heading">Care Signals needing a person</h2><p>Requests from your circle</p></div><span className="pill-preview">1 sample</span></div>
            <article className="request-card">
              <div className="request-top"><span className="request-symbol"><HandHeart size={20} /></span><div><h3>Medication help requested</h3><p>Elaine asked for a little help with her morning medicine.</p></div></div>
              <div className="request-meta"><span><Clock3 size={14} />Sample request · 8:15 AM</span><span><BellRing size={14} />Waiting for a caregiver</span></div>
              <button className="claim-preview" type="button" disabled>I&apos;ve Got It <ArrowRight size={15} /></button>
            </article>
          </section>
          <section className="surface surface-pad" aria-labelledby="memory-heading">
            <div className="surface-heading"><div><h2 id="memory-heading">Care Memory</h2><p>Helpful context shared by the circle</p></div></div>
            <div className="memory-item"><Clock3 size={16} /><p>Elaine prefers a little extra time in the morning.<span>Sample note · Sophie</span></p></div>
            <div className="quiet-placeholder"><HandHeart size={16} /><span>In the full app, notes will stay with the care circle and show who added them.</span></div>
          </section>
        </div>
        <aside className="stack">
          <section className="surface surface-pad" aria-labelledby="ownership-heading">
            <div className="surface-heading"><div><h2 id="ownership-heading">Who’s in the circle</h2><p>Task ownership will be visible here</p></div></div>
            <div className="owner-row"><span className="avatar">EM</span><div><strong>Elaine Morgan</strong><span>Care recipient · sample</span></div></div>
            <div className="owner-row"><span className="avatar peach">SM</span><div><strong>Sophie Morgan</strong><span>Daughter · sample</span></div></div>
            <div className="owner-row"><span className="avatar blue">JM</span><div><strong>James Morgan</strong><span>Son · sample</span></div></div>
          </section>
          <section className="surface surface-pad"><div className="quiet-placeholder"><BellRing size={16} /><span>Escalation and activity history will appear here once connected to real care tasks.</span></div></section>
        </aside>
      </div>
    </div>
  );
}
