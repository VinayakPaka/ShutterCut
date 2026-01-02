# ShutterCut Logo

This document describes the logo files for the ShutterCut video editing app.

## Logo Files

### SVG Files (Vector)

- **`logo.svg`** (200x200) - Main logo with dark background theme
  - Uses app theme colors: `#4492F1` (primary blue) and `#F68540` (accent orange)
  - Features film strip with play button (top) and lightning bolt (bottom)
  - Perfect for README, documentation, and web use

- **`logo-dark.svg`** (200x200) - Alternative version for light backgrounds
  - Same design with lighter background gradient
  - Suitable for light-themed websites or documents

- **`logo-icon.svg`** (512x512) - Square app icon format
  - Optimized for mobile app icons
  - Larger, cleaner design elements for small sizes

### PNG Files (Raster)

All PNG files are generated from the logo design with the app's dark theme:

- **`frontend/assets/icon.png`** (1024x1024) - Main iOS/Android app icon
- **`frontend/assets/adaptive-icon.png`** (1024x1024) - Android adaptive icon foreground
- **`frontend/assets/splash-icon.png`** (1024x1024) - App splash screen icon
- **`frontend/assets/favicon.png`** (48x48) - Web favicon

## Design Elements

### Colors
- **Primary Blue**: `#4492F1` - Main brand color (film strip, borders)
- **Accent Orange**: `#F68540` - Secondary color (lightning bolt)
- **Background Dark**: `#191719` - App background
- **Surface**: `#2C2B2C` - Elevated surface color

### Symbolism
- **Film Strip with Play Button**: Represents video content and playback
- **Lightning Bolt**: Represents fast, powerful editing/cutting
- **Rounded Corners**: Modern, friendly design matching app UI
- **Glow Effects**: Premium, polished appearance

## Usage Guidelines

### README and Documentation
Use `logo.svg` in markdown:
```markdown
![ShutterCut Logo](logo.svg)
```

### Mobile App
The app automatically uses the PNG icons defined in `frontend/app.json`:
- iOS: `icon.png`
- Android: `adaptive-icon.png` with `#191719` background
- Splash screen: `splash-icon.png` with dark background

### Web/Favicon
The favicon is automatically loaded for web deployment.

## Regenerating PNG Icons

If you need to regenerate the PNG files from SVG, you can use:

**Option 1: Online converters**
- Upload `logo-icon.svg` to https://cloudconvert.com/svg-to-png
- Export at 1024x1024 resolution

**Option 2: Using Inkscape**
```bash
inkscape logo-icon.svg --export-type=png --export-filename=icon.png --export-width=1024 --export-height=1024
```

**Option 3: Using ImageMagick**
```bash
magick convert -background none -resize 1024x1024 logo-icon.svg icon.png
```

## Brand Consistency

Always use the official logo files provided. Do not:
- Modify the colors (except for specific brand variations)
- Distort the aspect ratio
- Add effects or filters
- Place on busy backgrounds that reduce visibility
- Use low-resolution versions when high-res is available

For any questions about logo usage, refer to the app's theme configuration in `frontend/src/constants/theme.js`.
