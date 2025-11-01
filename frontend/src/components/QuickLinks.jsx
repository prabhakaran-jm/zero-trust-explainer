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
  // Read from runtime config (injected by entrypoint.sh) or fallback to build-time env vars
  const config = window.__APP_CONFIG__ || {};
  
  // Debug logging
  console.log('QuickLinks config:', {
    hasWindowConfig: !!window.__APP_CONFIG__,
    config: config,
    envVars: {
      DEMO_VIDEO_URL: import.meta.env.VITE_DEMO_VIDEO_URL,
      REPO_URL: import.meta.env.VITE_REPO_URL,
      ARCH_URL: import.meta.env.VITE_ARCH_URL,
      AI_STUDIO_URL: import.meta.env.VITE_AI_STUDIO_URL
    }
  });
  
  const links = [
    { label: 'Video', href: config.DEMO_VIDEO_URL || import.meta.env.VITE_DEMO_VIDEO_URL, icon: IconVideo },
    { label: 'Repo', href: config.REPO_URL || import.meta.env.VITE_REPO_URL, icon: IconRepo },
    { label: 'Architecture', href: config.ARCH_URL || import.meta.env.VITE_ARCH_URL, icon: IconArch },
    { label: 'AI Studio', href: config.AI_STUDIO_URL || import.meta.env.VITE_AI_STUDIO_URL, icon: IconAIStudio },
  ].filter(x => {
    const hasHref = (x?.href || '').trim().length > 0;
    if (!hasHref) {
      console.log(`QuickLinks: Filtering out "${x.label}" - no URL provided`);
    }
    return hasHref;
  });
  
  console.log('QuickLinks filtered links:', links);

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

