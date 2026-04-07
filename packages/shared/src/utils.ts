import type { BlockedTarget } from "./schemas";

const normalizeDomain = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "")
    .replace(/:\d+$/, "");

export const matchesBlockedDomain = (candidateUrl: string, target: BlockedTarget): boolean => {
  if (target.kind !== "website" || !target.enabled) {
    return false;
  }

  const candidate = normalizeDomain(candidateUrl);
  return (target.match.domains ?? []).some((domain) => {
    const normalizedDomain = normalizeDomain(domain);
    return candidate === normalizedDomain || candidate.endsWith(`.${normalizedDomain}`);
  });
};

export const matchesBlockedApp = (
  app: {
    bundleId?: string;
    processName?: string;
  },
  target: BlockedTarget
): boolean => {
  if (target.kind !== "app" || !target.enabled) {
    return false;
  }

  const bundleId = app.bundleId?.toLowerCase();
  const processName = app.processName?.toLowerCase();

  return (
    (target.match.bundleIds ?? []).some((value) => value.toLowerCase() === bundleId) ||
    (target.match.processNames ?? []).some((value) => value.toLowerCase() === processName)
  );
};
