import { CalendarDays, HeartHandshake, NotebookPen, UsersRound } from "lucide-react";
import { PreviewBanner } from "@/components/ui/preview-banner";

export default function FamilyPage() {
  return (
    <div className="page-wrap">
      <PreviewBanner>Family view preview. Names and notes are fictional examples, not shared health records.</PreviewBanner>
      <div className="screen-heading">
        <div><span className="eyebrow">A little closer, wherever you are</span><h1>Care is a shared thing.</h1><p>Stay in the loop, see who has taken ownership, and keep the little details that make care feel personal.</p></div>
        <span className="pill-preview"><UsersRound size={14} />Family preview</span>
      </div>

      <div className="dashboard-grid">
        <div className="stack">
          <section className="surface surface-pad" aria-labelledby="family-signals">
            <div className="surface-heading"><div><h2 id="family-signals">Care Signals</h2><p>Requests and updates from the circle</p></div><span className="pill-preview">Preview</span></div>
            <div className="request-card">
              <div className="request-top"><span className="request-symbol"><HeartHandshake size={20} /></span><div><h3>Morning medicine · sample</h3><p>A caregiver can claim this request so everyone knows it is being handled.</p></div></div>
              <div className="request-meta"><span><CalendarDays size={14} />Today · sample</span><span><UsersRound size={14} />No owner yet</span></div>
              <div className="quiet-placeholder"><HeartHandshake size={16} /><span>Task ownership, acknowledgements, and escalation history will be shared here.</span></div>
            </div>
          </section>
          <section className="surface surface-pad" aria-labelledby="family-memory">
            <div className="surface-heading"><div><h2 id="family-memory">Care Memory</h2><p>Small details that help everyone care well</p></div><NotebookPen size={18} color="#62806b" /></div>
            <div className="memory-item"><NotebookPen size={16} /><p>“Please bring the blue cardigan for the appointment.”<span>Example note · James · sample</span></p></div>
            <div className="quiet-placeholder"><NotebookPen size={16} /><span>In the full app, each note will be private to the care circle and include its author and time.</span></div>
          </section>
        </div>
        <aside className="stack">
          <section className="surface surface-pad" aria-labelledby="family-members">
            <div className="surface-heading"><div><h2 id="family-members">People who care</h2><p>Example circle members</p></div><UsersRound size={18} color="#0f766e" /></div>
            <div className="owner-row"><span className="avatar">EM</span><div><strong>Elaine Morgan</strong><span>Elder · sample</span></div></div>
            <div className="owner-row"><span className="avatar peach">SM</span><div><strong>Sophie Morgan</strong><span>Daughter · sample</span></div></div>
            <div className="owner-row"><span className="avatar blue">JM</span><div><strong>James Morgan</strong><span>Son · sample</span></div></div>
          </section>
          <section className="surface surface-pad"><div className="quiet-placeholder"><CalendarDays size={16} /><span>Appointments and visit notes will be available in a later preview.</span></div></section>
        </aside>
      </div>
    </div>
  );
}
