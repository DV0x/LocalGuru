# PWA Setup Instructions

## Required Icons for PWA

Currently, the PWA is set up without icons to avoid build errors. To properly set up your PWA with icons, follow these steps:

### 1. Create and Add Icon Files

Place the following files in the `public` directory:

- `favicon.ico` - Standard favicon for browsers (16x16, 32x32, or 64x64 pixels)
- `apple-touch-icon.png` - Icon for iOS devices (180x180 pixels)
- `icon-192x192.png` - Standard PWA icon for Android (192x192 pixels)
- `icon-512x512.png` - Larger PWA icon for Android (512x512 pixels)

You can create these icons using design tools like Figma, Photoshop, or use online services like:
- [Favicon.io](https://favicon.io/)
- [RealFaviconGenerator](https://realfavicongenerator.net/)

### 2. Update the Manifest File

After adding the icon files, update `manifest.json` to include them:

```json
{
  "name": "LocalGuru Mobile",
  "short_name": "LocalGuru",
  "description": "Your mobile companion for local recommendations",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#6F1ED6",
  "orientation": "portrait",
  "icons": [
    {
      "src": "/favicon.ico",
      "sizes": "64x64",
      "type": "image/x-icon"
    },
    {
      "src": "/icon-192x192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "any maskable"
    },
    {
      "src": "/icon-512x512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "any maskable"
    }
  ]
}
```

### 3. Update the Layout File

Uncomment or add the icon references in `app/layout.tsx`:

```typescript
export const metadata = {
  title: 'LocalGuru PWA',
  description: 'Mobile experience for LocalGuru',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'LocalGuru'
  },
  manifest: '/manifest.json',
  icons: {
    icon: '/favicon.ico',
    apple: '/apple-touch-icon.png'
  }
};
```

And add the link tag in the head section:

```html
<link rel="apple-touch-icon" href="/apple-touch-icon.png" />
```

### 4. Test Your PWA

After adding the icons, test your PWA using Lighthouse in Chrome DevTools to verify that all PWA requirements are met. 