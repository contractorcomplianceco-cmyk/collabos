import React from "react";

/** Match full URLs or bare domains (e.g. investor.ccacontact.com) in recommendation copy. */
const URL_OR_DOMAIN_RE =
  /((?:https?:\/\/)?(?:(?:[a-z0-9-]+\.)+[a-z]{2,})(?::\d{2,5})?(?:\/[^\s<>"'()]*)?)/gi;

function hrefForMatch(raw: string): string | null {
  const trimmed = raw.replace(/[.,;:!?)]+$/, "");
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (/^(?:[a-z0-9-]+\.)+[a-z]{2,}(?:\/|$)/i.test(trimmed) || /^(?:[a-z0-9-]+\.)+[a-z]{2,}$/i.test(trimmed)) {
    return `https://${trimmed}`;
  }
  return null;
}

/** Turn bare URLs/domains in recommendation text into real links (new tab). */
export function linkifyRecommendation(text: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  let last = 0;
  let match: RegExpExecArray | null;
  const re = new RegExp(URL_OR_DOMAIN_RE.source, URL_OR_DOMAIN_RE.flags);
  while ((match = re.exec(text)) !== null) {
    const raw = match[1];
    const start = match.index;
    // Skip if this looks like the domain of an email (char before is @)
    if (start > 0 && text[start - 1] === "@") continue;
    const href = hrefForMatch(raw);
    if (!href) continue;
    if (start > last) parts.push(text.slice(last, start));
    const display = raw.replace(/[.,;:!?)]+$/, "");
    const trailing = raw.slice(display.length);
    parts.push(
      <a
        key={`${start}-${display}`}
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        className="font-semibold text-sky-700 underline decoration-sky-300 underline-offset-2 hover:text-sky-900"
      >
        {display}
      </a>,
    );
    if (trailing) parts.push(trailing);
    last = start + raw.length;
  }
  if (last === 0) return text;
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}
