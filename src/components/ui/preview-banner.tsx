import { Sparkles } from "lucide-react";

export function PreviewBanner({ children = "This is a preview. Care actions are not connected yet." }: { children?: string }) {
  return <div className="preview-banner"><Sparkles size={17} aria-hidden="true" /><span>{children}</span></div>;
}
