// Resolves which school's site we're on. In production this is the subdomain
// (greenwood.ischool.co.ke); for local dev without wildcard DNS, fall back to
// a ?school= query param so a single localhost origin can still be tested.
// A school using its own custom domain (portal.theirschool.ac.ke, CNAMEd to
// us) never matches the subdomain pattern, so the full hostname is passed
// through as-is — the backend's by-slug lookup checks both slug and
// custom_domain, so either form resolves to the right tenant.
export function getTenantSlug(): string | null {
  if (typeof window === "undefined") return null;

  const params = new URLSearchParams(window.location.search);
  const fromQuery = params.get("school");
  if (fromQuery) return fromQuery;

  const host = window.location.hostname;
  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "localhost";
  if (host === rootDomain || host === "localhost" || host === "127.0.0.1") return null;

  const labels = host.split(".");
  const rootLabels = rootDomain.split(".").length;
  if (labels.length > rootLabels && host.endsWith(rootDomain)) return labels[0];

  // Doesn't end in our root domain at all — must be a school's own custom
  // domain rather than one of our subdomains.
  if (!host.endsWith(rootDomain)) return host;

  return null;
}
