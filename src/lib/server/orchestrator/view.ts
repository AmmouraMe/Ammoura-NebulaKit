/**
 * What the control-room screen may see of a client site, and how it reads the
 * "register a site" form. The orchestrator key never leaves the server, so the
 * view has no key field at all.
 */
import { SITE_SLUG, type ClientSite, type ClientSiteStatus } from './registry';

export interface ClientSiteView {
  id: string;
  name: string;
  slug: string;
  baseUrl: string;
  repo: string;
  status: ClientSiteStatus;
  templateVersion: string | null;
  packages: Record<string, string>;
  updates: ClientSite['updates'];
  lastSeenAt: string | null;
  lastError: string | null;
  createdAt: string;
}

export function toSiteView(site: ClientSite): ClientSiteView {
  const { apiKey: _apiKey, ...view } = site;
  return view;
}

export type Registration = Pick<ClientSite, 'name' | 'slug' | 'baseUrl' | 'repo' | 'apiKey'>;

/** The form's fields, trimmed and checked, or the first thing wrong with them. */
export function parseRegistration(
  form: FormData
): { ok: true; value: Registration } | { ok: false; error: string } {
  const field = (name: string) => String(form.get(name) ?? '').trim();
  const name = field('name');
  const slug = field('slug').toLowerCase();
  const baseUrl = field('baseUrl');
  const repo = field('repo');
  const apiKey = field('apiKey');

  if (!name) return { ok: false, error: 'Give the site a name.' };
  if (!SITE_SLUG.test(slug))
    return { ok: false, error: 'The short name can use lowercase letters, digits and dashes.' };
  let url: URL;
  try {
    url = new URL(baseUrl);
  } catch {
    return {
      ok: false,
      error: 'The site address must be a full URL, such as https://acme.example.'
    };
  }
  const local = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
  if (url.protocol !== 'https:' && !(local && url.protocol === 'http:'))
    return {
      ok: false,
      error: 'The site address must start with https:// (http is for localhost only).'
    };
  if (!apiKey) return { ok: false, error: 'Paste the orchestrator key from the site.' };

  return { ok: true, value: { name, slug, baseUrl: url.origin, repo, apiKey } };
}
