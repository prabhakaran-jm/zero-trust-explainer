import { IconVideo, IconRepo, IconArch, IconAIStudio, IconExternal } from './Icons';

function withUtm(url, label) {
  try {
    const u = new URL(url);
    u.searchParams.set('utm_source', 'zte-ui');
    u.searchParams.set('utm_medium', 'header');
    u.searchParams.set('utm_campaign', 'cloudrun-hackathon');
    u.searchParams.set('utm_content', label.toLowerCase());
    return u.toString();
  } catch {
    return url;
  }
}

export default function QuickLinks() {
  const links = [
    { label: 'Video', href: import.meta.env.VITE_DEMO_VIDEO_URL, icon: IconVideo },
    { label: 'Repo', href: import.meta.env.VITE_REPO_URL, icon: IconRepo },
    { label: 'Architecture', href: import.meta.env.VITE_ARCH_URL, icon: IconArch },
    { label: 'AI Studio', href: import.meta.env.VITE_AI_STUDIO_URL, icon: IconAIStudio },
  ].filter(x => (x?.href || '').trim().length > 0);

  if (!links.length) return null;

  return (
    <nav className="quick-links-nav">
      {links.map(({ label, href, icon: Icon }) => (
        <a
          key={label}
          className="quick-link-item"
          href={withUtm(href, label)}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Open ${label} in new tab`}
          title={label}
        >
          <Icon className="quick-link-icon" />
          <span>{label}</span>
          <IconExternal className="quick-link-external-icon" />
        </a>
      ))}
    </nav>
  );
}

