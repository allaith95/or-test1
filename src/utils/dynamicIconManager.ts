/**
 * Dynamic App Icon & Favicon Manager
 * Automatically updates browser tab favicon, Apple Touch Icon (Desktop/Home screen shortcut),
 * and Web App Manifest (PWA Icon) whenever a custom logo is uploaded or changed.
 */

let activeManifestBlobUrl: string | null = null;

export interface DynamicIconOptions {
  logoUrl?: string;
  companyName?: string;
  companySubtitle?: string;
}

/**
 * Determine MIME type from URL or data URL
 */
function getMimeType(url: string): string {
  if (url.startsWith('data:image/svg')) return 'image/svg+xml';
  if (url.startsWith('data:image/png')) return 'image/png';
  if (url.startsWith('data:image/jpeg') || url.startsWith('data:image/jpg')) return 'image/jpeg';
  if (url.startsWith('data:image/webp')) return 'image/webp';
  if (url.endsWith('.svg')) return 'image/svg+xml';
  if (url.endsWith('.png')) return 'image/png';
  if (url.endsWith('.webp')) return 'image/webp';
  return 'image/jpeg';
}

/**
 * Updates browser favicon, apple-touch-icon, and dynamic Web App Manifest icons
 */
export function applyDynamicAppIcon(options: DynamicIconOptions): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  const rawLogo = options.logoUrl?.trim() || '/orca_express_logo.jpg';
  const companyName = options.companyName?.trim() || 'أوركا للشحن';
  const subtitle = options.companySubtitle?.trim() || 'منظومة الشحن والخدمات اللوجستية';
  const mimeType = getMimeType(rawLogo);

  try {
    // 1. Persist in localStorage for instant pre-hydration application on page reloads
    localStorage.setItem('orca_custom_app_icon', rawLogo);
    localStorage.setItem('orca_custom_app_name', companyName);
  } catch {
    // Storage access might be restricted in some iframe contexts
  }

  // 2. Update or Create Favicon link tags
  try {
    // Remove existing icon links to force browser refresh
    const existingIcons = document.querySelectorAll("link[rel*='icon']");
    existingIcons.forEach((el) => el.remove());

    // Standard Icon
    const iconLink = document.createElement('link');
    iconLink.rel = 'icon';
    iconLink.type = mimeType;
    iconLink.href = rawLogo;
    document.head.appendChild(iconLink);

    // Shortcut Icon
    const shortcutLink = document.createElement('link');
    shortcutLink.rel = 'shortcut icon';
    shortcutLink.type = mimeType;
    shortcutLink.href = rawLogo;
    document.head.appendChild(shortcutLink);

    // Apple Touch Icon (used for iOS Safari and Desktop PWA Shortcuts)
    const existingAppleIcons = document.querySelectorAll("link[rel='apple-touch-icon']");
    existingAppleIcons.forEach((el) => el.remove());

    const appleTouchLink = document.createElement('link');
    appleTouchLink.rel = 'apple-touch-icon';
    appleTouchLink.href = rawLogo;
    document.head.appendChild(appleTouchLink);

    // Update Apple Mobile Web App Title
    let appleTitleMeta = document.querySelector("meta[name='apple-mobile-web-app-title']");
    if (!appleTitleMeta) {
      appleTitleMeta = document.createElement('meta');
      appleTitleMeta.setAttribute('name', 'apple-mobile-web-app-title');
      document.head.appendChild(appleTitleMeta);
    }
    appleTitleMeta.setAttribute('content', companyName);

    // Update OpenGraph Image
    let ogImageMeta = document.querySelector("meta[property='og:image']");
    if (!ogImageMeta) {
      ogImageMeta = document.createElement('meta');
      ogImageMeta.setAttribute('property', 'og:image');
      document.head.appendChild(ogImageMeta);
    }
    ogImageMeta.setAttribute('content', rawLogo);
  } catch (err) {
    console.error('Failed to update tab favicon / apple-touch-icon:', err);
  }

  // 3. Generate & Inject Dynamic Web App Manifest (for Desktop & Mobile Shortcuts)
  try {
    const manifest = {
      id: '/',
      name: companyName,
      short_name: companyName.length > 12 ? companyName.substring(0, 12) : companyName,
      description: subtitle,
      theme_color: '#0f172a',
      background_color: '#0f172a',
      display: 'standalone',
      start_url: '/',
      scope: '/',
      icons: [
        {
          src: rawLogo,
          sizes: '192x192',
          type: mimeType,
          purpose: 'any',
        },
        {
          src: rawLogo,
          sizes: '512x512',
          type: mimeType,
          purpose: 'any',
        },
        {
          src: rawLogo,
          sizes: '512x512',
          type: mimeType,
          purpose: 'maskable',
        },
      ],
    };

    const manifestJson = JSON.stringify(manifest, null, 2);
    let manifestUrl: string;
    try {
      const manifestBlob = new Blob([manifestJson], {
        type: 'application/manifest+json',
      });
      if (activeManifestBlobUrl) {
        URL.revokeObjectURL(activeManifestBlobUrl);
      }
      activeManifestBlobUrl = URL.createObjectURL(manifestBlob);
      manifestUrl = activeManifestBlobUrl;
    } catch {
      manifestUrl = `data:application/manifest+json;charset=utf-8,${encodeURIComponent(manifestJson)}`;
    }

    let manifestLink = document.querySelector("link[rel='manifest']") as HTMLLinkElement | null;
    if (!manifestLink) {
      manifestLink = document.createElement('link');
      manifestLink.rel = 'manifest';
      document.head.appendChild(manifestLink);
    }
    manifestLink.href = manifestUrl;
  } catch (err) {
    console.error('Failed to generate dynamic Web App Manifest:', err);
  }
}

/**
 * Initializes dynamic app icons from localStorage on app boot
 */
export function initDynamicAppIconFromStorage(): void {
  if (typeof window === 'undefined') return;
  try {
    const storedIcon = localStorage.getItem('orca_custom_app_icon');
    const storedName = localStorage.getItem('orca_custom_app_name');
    if (storedIcon) {
      applyDynamicAppIcon({
        logoUrl: storedIcon,
        companyName: storedName || undefined,
      });
    }
  } catch {
    // Storage access might be restricted
  }
}
