// Читает коды правил из query или hash
export function parseRuleCodes(): string[] {
  const params = new URLSearchParams(window.location.search);
  const raw =
    params.get("rules") ?? params.get("rule") ?? window.location.hash.slice(1);
  return raw
    .split(/[,+\s]+/)
    .map((code) =>
      code
        .trim()
        .toUpperCase()
        .replace(/^([PE])(\d)/, "$1$2"),
    )
    .filter(Boolean);
}

// Обновляет hash без перезагрузки страницы
export function setRuleHash(codes: string[]) {
  const next = `${window.location.pathname}${window.location.search}#${codes.join(",")}`;
  window.history.replaceState(null, "", next);
}
