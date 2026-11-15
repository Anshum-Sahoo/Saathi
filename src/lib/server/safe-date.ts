export function safeDate(value: unknown): Date | undefined {
  try {
    const date = value instanceof Date ? value
      : typeof value === "object" && value !== null && "toDate" in value && typeof value.toDate === "function"
        ? value.toDate()
        : undefined;
    return date instanceof Date && Number.isFinite(date.getTime()) ? date : undefined;
  } catch {
    return undefined;
  }
}
