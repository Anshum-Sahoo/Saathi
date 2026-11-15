"use client";

import { useState } from "react";
import { Check, Clock3, HandHeart, Heart, Pill, Type, Volume2 } from "lucide-react";
import { PreviewBanner } from "@/components/ui/preview-banner";

function HealthGarden() {
  return (
    <svg className="garden-art" viewBox="0 0 440 190" role="img" aria-labelledby="garden-title garden-desc">
      <title id="garden-title">A small garden growing in the morning light</title>
      <desc id="garden-desc">Illustrated teal leaves and gentle flowers in a curved garden bed.</desc>
      <circle cx="350" cy="45" r="25" fill="#e9d89e" />
      <path d="M0 153c68-28 120-20 183-4 67 17 151 7 257-20v61H0z" fill="#dbe8d7" />
      <path d="M0 168c75-22 150-3 224-3 89 0 141-23 216-31v56H0z" fill="#c9dcc8" />
      <path d="M211 156c-4-44 2-72 13-106m-7 58c-22-15-37-22-57-25m58 3c16-22 31-35 48-43m-47 74c22-13 43-17 66-16m-68 4c-12-24-24-39-39-51" fill="none" stroke="#5c8a6d" strokeWidth="5" strokeLinecap="round" />
      <path d="M162 81c18-11 39-5 50 8-17 14-38 12-50-8zm61-7c-4-21 11-38 32-42 4 21-10 38-32 42zm4 40c14-19 37-23 55-12-10 19-32 25-55 12zm-24-17c-19-5-32-22-29-42 21 3 35 19 29 42z" fill="#79a987" />
      <path d="M90 159c4-26 1-41-7-57m5 38c-15-11-27-15-42-16m43 7c12-14 24-21 37-25" fill="none" stroke="#7c9c6e" strokeWidth="4" strokeLinecap="round" />
      <path d="M41 124c13-8 27-4 36 6-12 9-27 7-36-6zm49-9c-3-16 8-29 24-32 3 16-8 29-24 32z" fill="#9abf88" />
      <path d="M319 151c-2-27 2-45 10-64m-6 40c-15-10-27-15-42-17m43 5c11-14 23-22 37-26" fill="none" stroke="#70977b" strokeWidth="4" strokeLinecap="round" />
      <path d="M281 115c13-8 27-4 36 6-12 9-27 8-36-6zm48-3c-3-16 8-29 24-32 3 16-8 29-24 32z" fill="#94b98b" />
      <circle cx="276" cy="139" r="7" fill="#dfaa73" /><circle cx="276" cy="139" r="2" fill="#fff4df" />
      <circle cx="128" cy="149" r="6" fill="#d99c84" /><circle cx="128" cy="149" r="2" fill="#fff4df" />
      <path d="M175 179h96" stroke="#90a987" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function ElderPreview() {
  const [largeText, setLargeText] = useState(false);

  return (
    <div className={`page-wrap ${largeText ? "large-text" : ""}`}>
      <PreviewBanner>Preview only. These sample details are fictional and the Care Signal buttons are not connected.</PreviewBanner>
      <section className="elder-welcome" aria-labelledby="elder-title">
        <div><h1 id="elder-title">Good morning, Elaine</h1><p>Let’s take today one gentle step at a time.</p></div>
        <div className="elder-tools">
          <button className="tool-button" type="button" disabled aria-label="Read this page aloud, preview only"><Volume2 size={18} />Read aloud</button>
          <button className="tool-button text-control" type="button" onClick={() => setLargeText((value) => !value)} aria-pressed={largeText}><Type size={18} />{largeText ? "Smaller text" : "Larger text"}</button>
        </div>
      </section>

      <div className="elder-grid">
        <section className="surface surface-pad" aria-labelledby="medication-title">
          <div className="surface-heading"><div><h2 id="medication-title">Your next medicine</h2><p>Sample preview · Not a real prescription</p></div><span className="pill-preview"><Pill size={13} />Preview</span></div>
          <article className="medicine-preview">
            <span className="medicine-icon" aria-hidden="true"><Pill size={27} /></span>
            <div className="medicine-copy"><h3>Vitamin D3</h3><p>One sample tablet · 1000 IU</p><span className="medicine-time"><Clock3 size={14} />Morning · 8:00</span></div>
          </article>
          <h3 className="signal-heading">How are you feeling about this?</h3>
          <div className="signal-grid" aria-label="Care Signal preview buttons">
            <button className="signal-button" type="button" disabled><Check size={22} />I’m okay</button>
            <button className="signal-button" type="button" disabled><Clock3 size={22} />Not yet</button>
            <button className="signal-button" type="button" disabled><HandHeart size={22} />I need help</button>
          </div>
          <p className="signal-caption">These preview buttons will connect to your care circle in a later phase.</p>
        </section>

        <section className="surface garden-card" aria-labelledby="garden-heading">
          <div className="surface-pad"><div className="surface-heading"><div><h2 id="garden-heading">Your Garden of Health</h2><p>A little care, a little growth.</p></div><Heart size={19} color="#5c8a6d" aria-hidden="true" /></div></div>
          <HealthGarden />
          <p className="garden-caption">A peaceful place to notice your progress. Garden updates are part of the preview.</p>
        </section>
      </div>
    </div>
  );
}
