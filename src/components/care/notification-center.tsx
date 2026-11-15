"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { cookieRequest } from "@/lib/firebase/client-auth";
import { useLanguage } from "@/components/i18n/language-provider";

type Notice = { id: string; titleKey: string; bodyKey: string; params: Record<string, string>; href: string; createdAt: string; read: boolean };
type ResponseData = { items: Notice[]; unreadCount: number };

export function NotificationCenter() {
  const { t } = useLanguage();
  const [data, setData] = useState<ResponseData>({ items: [], unreadCount: 0 });
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    try { setData(await cookieRequest<ResponseData>("/api/notifications?limit=30", "GET")); setError(""); return true; }
    catch (failure) { setError(failure instanceof Error ? failure.message : t("error.offline")); return false; }
  }, [t]);
  useEffect(() => {
    let timer: number;
    let failures = 0;
    let stopped = false;
    const poll = async () => {
      const succeeded = await load();
      failures = succeeded ? 0 : failures + 1;
      const delay = succeeded ? 30_000 : Math.min(60_000 * 2 ** (failures - 1), 300_000);
      if (!stopped) timer = window.setTimeout(() => void poll(), delay);
    };
    timer = window.setTimeout(() => void poll(), 0);
    return () => { stopped = true; window.clearTimeout(timer); };
  }, [load]);
  async function markRead(item: Notice) {
    if (item.read) return;
    try { await cookieRequest(`/api/notifications/${encodeURIComponent(item.id)}`, "PATCH", { read: true }); await load(); }
    catch (failure) { setError(failure instanceof Error ? failure.message : t("error.save")); }
  }

  return <details className="notification-center">
    <summary aria-label={t("notification.title")}><span>{t("notification.title")}</span><span className="notification-count" aria-label={t("notification.unread", { count: data.unreadCount })}>{data.unreadCount}</span></summary>
    <div className="notification-popover" aria-label={t("notification.title")}>
      <h2>{t("notification.title")}</h2>
      <p className="notification-unread">{t("notification.unread", { count: data.unreadCount })}</p>
      {error && <p role="alert" className="form-error">{error}</p>}
      {!data.items.length && <p>{t("notification.empty")}</p>}
      <ul>{data.items.map((item) => <li key={item.id} className={item.read ? "read" : "unread"}>
        <Link href={item.href} onClick={() => void markRead(item)}><strong>{t(item.titleKey, item.params)}</strong><span>{t(item.bodyKey, item.params)}</span><time dateTime={item.createdAt}>{new Date(item.createdAt).toLocaleString()}</time></Link>
        {!item.read && <button type="button" className="text-action" onClick={() => void markRead(item)}>{t("notification.markRead")}</button>}
      </li>)}</ul>
    </div>
  </details>;
}
