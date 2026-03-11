# Enrollment Form - Design System Reference

## Color Palette

### Primary Colors
```css
--primary-dark: #1a472a;        /* Darkest green - Headers, footers */
--primary: #2d7a3a;              /* Primary green - Buttons, accents */
--primary-light: #3d8a4a;        /* Light green - Hover states */
```

### Text Colors
```css
--text-primary: #2c3e50;         /* Main text */
--text-secondary: #5a6b7a;       /* Secondary text */
--text-tertiary: #7a8b99;        /* Tertiary text (labels, hints) */
--text-light: #adb5c1;           /* Light text (placeholders) */
```

### Background Colors
```css
--bg-light: #f8fafb;             /* Light background */
--bg-lighter: #f0f5f9;           /* Lighter background */
--bg-lightest: #ffffff;          /* White */
```

### Border Colors
```css
--border-primary: #e8ecf1;       /* Main borders */
--border-secondary: #dce4ed;     /* Input borders */
--border-light: #c5d3e0;         /* Hover state borders */
```

### Status Colors
```css
--error: #e74c3c;                /* Error red */
--error-dark: #c0392b;           /* Dark error red */
--error-light: #fff8e6;          /* Light error background */
--warning: #f39c12;              /* Warning yellow */
```

## Typography

### Font Family
```css
font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', sans-serif;
```

### Font Sizes
```css
h1: 32px / 28px (mobile)         /* Form title */
h2: 19px / 16px (mobile)         /* Section headers */
h3: 15px / 15px (mobile)         /* Subsection headers */
body: 14px                        /* Default text */
small: 13px / 12px               /* Helper text */
```

### Font Weights
```css
Regular: 400                      /* Body text, inputs */
Medium: 500                       /* Radio/checkbox labels */
Semibold: 600                     /* Labels */
Bold: 700                         /* Headers, button text */
```

### Line Heights
```css
body: 1.5                         /* Main text */
headings: 1.2                     /* Compact headings */
paragraphs: 1.7                   /* Easy reading */
```

### Letter Spacing
```css
normal: 0                         /* Body text */
uppercase: 0.4-0.6px             /* Uppercase text */
headers: -0.5px                   /* Tighter headers */
```

## Spacing System

### Padding
```css
Small: 8px / 10px                 /* Form elements internal */
Medium: 12-16px                   /* Component padding */
Large: 20-24px                    /* Section padding */
XLarge: 35-50px                   /* Major sections (header, modals) */
```

### Margins
```css
Small: 6px / 8px                  /* Between elements */
Medium: 12-14px                   /* Component gaps */
Large: 20-25px                    /* Section gaps */
XLarge: 40-50px                   /* Major section gaps */
```

### Gaps (Grid/Flex)
```css
Form row gap: 24px                /* Between form columns */
Radio/checkbox gap: 14px          /* Between options */
Disability options: 12px          /* Between categories */
Modal buttons: 12px               /* Between buttons */
```

## Border Radius

```css
Small: 6-8px                      /* Minor elements */
Medium: 8-10px                    /* Buttons, small boxes */
Large: 16px                       /* Main containers */
```

## Shadows

### Subtle
```css
0 4px 12px rgba(0, 0, 0, 0.08)   /* Hover states */
```

### Standard
```css
0 6px 20px rgba(26, 71, 42, 0.18) /* Buttons */
0 10px 40px rgba(26, 71, 42, 0.08) /* Containers */
```

### Prominent
```css
0 20px 60px rgba(0, 0, 0, 0.25)  /* Modals */
0 25px 80px rgba(0, 0, 0, 0.5)   /* Zoom modals */
```

## Gradients

### Primary Gradient
```css
linear-gradient(135deg, #1a472a 0%, #2d7a3a 100%)
/* Used for: Navbar, headers, buttons, footers */
```

### Error Gradient
```css
linear-gradient(135deg, #e74c3c 0%, #c0392b 100%)
/* Used for: Error notifications, delete buttons */
```

### Background Gradient
```css
linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%)
/* Used for: Body background */
```

### Section Gradient
```css
linear-gradient(135deg, #f8fafb 0%, #f0f5f9 100%)
/* Used for: Boxes, cards */
```

## Transitions

```css
Default: all 0.3s ease            /* Most elements */
Quick: all 0.2s ease              /* Buttons, small elements */
Slow: all 0.3s ease               /* Modals, large changes */
```

## Responsive Breakpoints

```css
Desktop: 1200px+                  /* Full width */
Tablet: 768px - 1199px            /* Adjusted layout */
Mobile: Below 768px               /* Single column */
Small Mobile: Below 480px         /* Compact layout */
```

## Common Component Spacing

### Form Groups
```css
margin-bottom: 24px               /* Between inputs */
```

### Form Sections
```css
margin-bottom: 45px               /* Between sections */
padding-bottom: 45px              /* Visual separation */
```

### Form Row (Grid)
```css
grid-template-columns: repeat(auto-fit, minmax(280px, 1fr))
gap: 24px                         /* Between columns */
```

### Buttons
```css
padding: 14px 32px                /* Internal spacing */
border-radius: 10px               /* Rounded corners */
gap: 16px                         /* Between buttons */
```

## States

### Hover
```css
border-color: #c5d3e0             /* Input hover */
background: #e8ecf1               /* Button hover */
transform: translateY(-3px)       /* Button lift */
box-shadow: enhanced              /* Better depth */
```

### Focus
```css
outline: none                      /* Remove default */
border-color: #2d7a3a             /* Green focus */
box-shadow: 0 0 0 4px rgba(45, 122, 58, 0.08)
background-color: #f8fafb         /* Light background */
```

### Active/Pressed
```css
transform: translateY(-1px)       /* Slight lift */
box-shadow: stronger              /* More depth */
```

### Disabled
```css
opacity: 0.5                      /* Faded out */
cursor: not-allowed               /* Not clickable */
```

## Implementation Tips

1. **Use the color palette**: Apply colors consistently
2. **Follow spacing**: Use the margin/padding system
3. **Maintain consistency**: Use same shadows and radii
4. **Responsive**: Follow breakpoints
5. **Typography**: Use the defined sizes and weights
6. **Transitions**: Apply smooth 0.3s transitions

## Customization Guide

### To Change Primary Color:
Replace `#1a472a` and `#2d7a3a` with your color throughout

### To Change Accent Color:
Replace `#2d7a3a` (accent) with your color

### To Increase Spacing:
Multiply all spacing values by 1.2 or 1.5

### To Adjust Typography:
Update font-family and base font-size

### To Change Shadows:
Modify rgba alpha values or offsets

---

This design system ensures consistency and makes future modifications easier!


