// Tiny inline SVGs. Use with className="w-4 h-4" (or w-5 h-5).
// Stroke/fill inherit currentColor for easy theming.

export const IconVideo = (p) => (
  <svg viewBox="0 0 24 24" aria-hidden="true" {...p}>
    <path fill="currentColor" d="M4 5h10a2 2 0 0 1 2 2v1l3.2-1.8a1 1 0 0 1 1.5.86v8a1 1 0 0 1-1.5.86L16 15v1a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z"/>
  </svg>
);

export const IconRepo = (p) => (
  <svg viewBox="0 0 24 24" aria-hidden="true" {...p}>
    <path fill="currentColor" d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z"/>
  </svg>
);

export const IconArch = (p) => (
  <svg viewBox="0 0 24 24" aria-hidden="true" {...p}>
    <path fill="currentColor" d="M3 5h18v2H3zM5 9h14v2H5zM7 13h10v2H7zM9 17h6v2H9z"/>
  </svg>
);

export const IconAIStudio = (p) => (
  <svg viewBox="0 0 24 24" aria-hidden="true" {...p}>
    <path fill="currentColor" d="M12 2 3 7v10l9 5 9-5V7l-9-5Zm0 2.3 6.6 3.7v7L12 18.7 5.4 13V6l6.6-3.7Z"/>
    <circle cx="12" cy="12" r="2.25" fill="currentColor"/>
  </svg>
);

export const IconExternal = (p) => (
  <svg viewBox="0 0 24 24" aria-hidden="true" {...p}>
    <path fill="currentColor" d="M14 3h7v7h-2V7.4l-8.3 8.3-1.4-1.4L17.6 6H14V3ZM5 5h6v2H7v10h10v-4h2v6H5V5Z"/>
  </svg>
);

