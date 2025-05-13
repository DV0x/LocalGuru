# PWA Icons

To complete the PWA setup, you'll need to add proper icons to the `public` directory.

## Required icons:

1. **favicon.ico** - Place in `public/` directory
   - Standard favicon, typically 16x16, 32x32, or 64x64 pixels
   - Used by browsers for tabs and bookmarks

2. **apple-touch-icon.png** - Place in `public/` directory
   - Required for iOS devices when adding to home screen
   - Recommended size: 180x180 pixels
   - Should be a PNG with no transparency

## How to generate icons:

1. Create your app icon design (1024x1024 pixels is a good master size)
2. Use a tool like [Favicon Generator](https://realfavicongenerator.net/) to create all required icon formats
3. Place the generated files in the appropriate locations

## Current manifest.json configuration:

The manifest currently references a basic favicon, but for a production PWA, you should expand this to include more icon sizes:

```json
"icons": [
  {
    "src": "/icons/icon-192x192.png",
    "sizes": "192x192", 
    "type": "image/png",
    "purpose": "any maskable"
  },
  {
    "src": "/icons/icon-512x512.png", 
    "sizes": "512x512",
    "type": "image/png", 
    "purpose": "any maskable"
  }
]
```

After generating the icons, update the manifest.json to include all the new icon files. 