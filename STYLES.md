# NetGuava Styles Guide

This guide explains the CSS architecture for NetGuava landing pages.

## File Structure

### `styles.css` - Shared Stylesheet
This is the main stylesheet that contains common styles used across all NetGuava landing pages.

**What's included:**
- CSS Reset and base styles
- CSS Variables for brand colors
- Typography styles
- Common layout components (`.section-title`, `.container`)
- Button styles (`.cta-button`)
- Hero section structure
- Card styles (`.card`)
- Grid layouts (`.grid`, `.grid-auto-fit`)
- Section backgrounds (`.section-light`, `.section-gradient`)
- Spacing utilities (`.section-padding`)
- Responsive breakpoints

### Page-Specific Styles
Each landing page should include `styles.css` and can add page-specific styles either:
1. In a `<style>` tag in the HTML file
2. In a separate CSS file (e.g., `business-consulting-styles.css`)

## Usage Example

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <!-- Shared NetGuava Styles -->
    <link rel="stylesheet" href="/styles.css">
    
    <!-- Page-specific Styles (optional) -->
    <link rel="stylesheet" href="/my-page-styles.css">
    
    <!-- Or inline page-specific styles -->
    <style>
        /* Page-specific overrides and additions */
        .my-custom-section {
            /* ... */
        }
    </style>
</head>
<body>
    <!-- Use shared classes -->
    <section class="hero">
        <div class="hero-content">
            <h1>Your Heading</h1>
            <p>Your description</p>
            <a href="#contact" class="cta-button">Get Started</a>
        </div>
    </section>
</body>
</html>
```

## Brand Colors

The following CSS variables are available for use:

- `--primary-color: #2d5f3f` - NetGuava dark green
- `--secondary-color: #4a8c5f` - NetGuava medium green
- `--accent-color: #6fb88a` - NetGuava light green
- `--text-dark: #1a3329` - Dark text
- `--text-light: #f5f5f5` - Light text
- `--bg-light: #fafafa` - Light background
- `--bg-white: #ffffff` - White background

## Common Classes

### Layout
- `.container` - Max-width container with padding
- `.section-padding` - Standard section padding (5rem 2rem)
- `.section-padding-sm` - Small section padding (3rem 2rem)
- `.section-padding-lg` - Large section padding (7rem 2rem)

### Typography
- `.section-title` - Centered section heading

### Buttons
- `.cta-button` - Primary call-to-action button

### Backgrounds
- `.section-light` - Light gray background
- `.section-white` - White background
- `.section-gradient` - Green gradient background

### Hero Section
- `.hero` - Hero section with gradient background
- `.hero-content` - Centered content wrapper
- Use with `h1`, `p`, and `.cta-button` for complete hero

### Cards
- `.card` - Standard card with shadow and hover effect

### Grids
- `.grid` - Base grid layout
- `.grid-auto-fit` - Auto-fit grid (250px min columns)
- `.grid-auto-fit-lg` - Auto-fit grid (300px min columns)

## Best Practices

1. **Always include `styles.css`** in your HTML files
2. **Use CSS variables** for colors instead of hardcoding hex values
3. **Use shared classes** when possible before creating custom styles
4. **Keep page-specific styles separate** from shared styles
5. **Test responsive design** on mobile, tablet, and desktop
6. **Document any new shared components** by adding them to `styles.css`

## Modifying Shared Styles

When adding new shared styles:
1. Add to `styles.css`
2. Use semantic class names
3. Follow existing naming conventions
4. Test on all existing pages to ensure no breaking changes
5. Update this README with new classes/components
