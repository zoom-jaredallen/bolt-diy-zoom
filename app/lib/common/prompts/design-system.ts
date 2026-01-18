import type { DesignScheme } from '~/types/design-scheme';

/**
 * Enhanced Design System Prompt
 *
 * Provides specific, actionable design patterns to generate
 * production-quality, Lovable.dev-level styled applications.
 */

export function getDesignSystemPrompt(designScheme?: DesignScheme): string {
  const colors = designScheme?.palette || {};
  const features = designScheme?.features || ['rounded', 'shadow'];
  const fonts = designScheme?.font || ['sans-serif'];

  // Determine style modifiers
  const hasRounded = features.includes('rounded');
  const hasShadow = features.includes('shadow');
  const hasGradient = features.includes('gradient');
  const hasGlass = features.includes('frosted-glass');
  const hasBorder = features.includes('border');

  // Generate radius classes
  const radiusMd = hasRounded ? 'rounded-xl' : 'rounded-md';
  const radiusLg = hasRounded ? 'rounded-2xl' : 'rounded-lg';
  const radiusFull = 'rounded-full';

  // Generate shadow classes
  const shadowSm = hasShadow ? 'shadow-sm' : '';
  const shadowMd = hasShadow ? 'shadow-md' : '';

  // Generate border classes
  const borderClass = hasBorder ? 'border border-slate-200 dark:border-slate-700' : '';

  // Glass effect
  const glassEffect = hasGlass ? 'bg-white/80 dark:bg-slate-900/80 backdrop-blur-md' : 'bg-white dark:bg-slate-900';

  return `
<design_system>
  CRITICAL: This design system must be followed EXACTLY. These are not suggestions - they are requirements for production-quality output.

  <philosophy>
    Create interfaces that feel premium, intentional, and delightful. Every pixel matters.
    - Visual hierarchy through size, weight, and spacing
    - Consistent rhythm with 4px/8px base grid
    - Purposeful animations that enhance, not distract
    - Accessibility as a feature, not an afterthought
  </philosophy>

  <required_dependencies>
    ALWAYS include these in package.json:
    - "tailwindcss": "^3.4.0"
    - "framer-motion": "^10.0.0" (for animations)
    - "lucide-react": "^0.400.0" (for icons)
    - "@radix-ui/react-*" (for accessible primitives)

    For optimal results, initialize shadcn/ui:
    - npx shadcn-ui@latest init (if not present)
    - Use shadcn components: button, card, input, dialog, dropdown-menu
  </required_dependencies>

  <typography>
    Font Stack: ${fonts.join(', ')}, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto
    
    Heading Scale:
    - h1: "text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight"
    - h2: "text-3xl md:text-4xl font-bold tracking-tight"
    - h3: "text-2xl md:text-3xl font-semibold"
    - h4: "text-xl md:text-2xl font-semibold"
    - h5: "text-lg font-medium"
    - h6: "text-base font-medium"

    Body Text:
    - Large: "text-lg text-slate-600 dark:text-slate-300 leading-relaxed"
    - Base: "text-base text-slate-600 dark:text-slate-400"
    - Small: "text-sm text-slate-500 dark:text-slate-400"
    - Muted: "text-sm text-slate-400 dark:text-slate-500"
  </typography>

  <color_system>
    ${
      Object.keys(colors).length > 0
        ? `
    USER COLORS (use these via CSS custom properties):
    ${Object.entries(colors)
      .map(([key, value]) => `--color-${key}: ${value};`)
      .join('\n    ')}
    `
        : `
    Default semantic colors (use Tailwind):
    - Primary: slate-900 dark:white (text), indigo-600 (interactive)
    - Background: white dark:slate-950
    - Surface: slate-50 dark:slate-900
    - Border: slate-200 dark:slate-800
    - Muted: slate-500 dark:slate-400
    `
    }

    Always support dark mode with dark: prefix.
  </color_system>

  <spacing_system>
    Use consistent spacing based on 4px grid:
    - Section padding: "py-16 md:py-24 lg:py-32"
    - Container: "max-w-7xl mx-auto px-4 sm:px-6 lg:px-8"
    - Card padding: "p-6 md:p-8"
    - Stack gap: "space-y-4" or "gap-4"
    - Inline gap: "space-x-2" or "gap-2"
  </spacing_system>

  <component_patterns>
    PRIMARY BUTTON:
    "inline-flex items-center justify-center ${radiusMd} px-6 py-2.5 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 transition-colors duration-200 ${shadowSm}"

    ${
      hasGradient
        ? `
    GRADIENT BUTTON:
    "inline-flex items-center justify-center ${radiusMd} px-6 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 transition-all duration-200 ${shadowMd}"
    `
        : ''
    }

    SECONDARY BUTTON:
    "inline-flex items-center justify-center ${radiusMd} px-6 py-2.5 text-sm font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-500 focus-visible:ring-offset-2 transition-colors duration-200"

    GHOST BUTTON:
    "inline-flex items-center justify-center ${radiusMd} px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-500 transition-colors duration-200"

    CARD:
    "${glassEffect} ${radiusLg} ${shadowMd} ${borderClass} p-6 transition-all duration-200 hover:${hasShadow ? 'shadow-lg' : ''}"

    ${
      hasGlass
        ? `
    GLASS CARD:
    "bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl ${radiusLg} ${borderClass} ${shadowMd} p-6"
    `
        : ''
    }

    INPUT:
    "w-full ${radiusMd} border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-4 py-2.5 text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none transition-all duration-200"

    TEXTAREA:
    "w-full ${radiusMd} border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-4 py-3 text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none transition-all duration-200 resize-none"

    BADGE:
    "inline-flex items-center ${radiusFull} px-2.5 py-0.5 text-xs font-medium bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300"

    AVATAR:
    "relative inline-flex items-center justify-center ${radiusFull} bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-medium overflow-hidden"

    DIVIDER:
    "border-t border-slate-200 dark:border-slate-700"

    TAG/CHIP:
    "inline-flex items-center gap-1 ${radiusMd} px-2 py-1 text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
  </component_patterns>

  <layout_patterns>
    HERO SECTION:
    "<section className='relative py-24 md:py-32 lg:py-40 overflow-hidden'>
      <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'>
        <div className='text-center max-w-3xl mx-auto'>
          <h1 className='text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight text-slate-900 dark:text-white'>
            {title}
          </h1>
          <p className='mt-6 text-lg md:text-xl text-slate-600 dark:text-slate-300 leading-relaxed'>
            {description}
          </p>
          <div className='mt-10 flex flex-col sm:flex-row gap-4 justify-center'>
            {/* Buttons */}
          </div>
        </div>
      </div>
    </section>"

    FEATURE GRID:
    "<div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8'>"

    SIDEBAR LAYOUT:
    "<div className='flex'>
      <aside className='w-64 shrink-0 border-r border-slate-200 dark:border-slate-700'>
      <main className='flex-1 min-w-0'>
    </div>"

    CENTERED CONTAINER:
    "<div className='max-w-2xl mx-auto px-4'>"

    FULL-WIDTH CONTAINER:
    "<div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'>"
  </layout_patterns>

  <animation_patterns>
    ALWAYS use Framer Motion for complex animations.

    FADE IN:
    "initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}"

    SLIDE UP:
    "initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: 'easeOut' }}"

    STAGGER CHILDREN:
    "transition={{ staggerChildren: 0.1 }}"

    HOVER SCALE:
    "whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}"

    For simple transitions, use Tailwind:
    - "transition-all duration-200 ease-out"
    - "transition-colors duration-150"
    - "transition-transform duration-200"

    IMPORTANT: Keep animations subtle (200-400ms duration max).
  </animation_patterns>

  <loading_states>
    SKELETON:
    "<div className='animate-pulse ${radiusMd} bg-slate-200 dark:bg-slate-700 h-4 w-full' />"

    SPINNER:
    "<div className='animate-spin ${radiusFull} border-2 border-slate-200 border-t-indigo-600 w-5 h-5' />"

    SHIMMER:
    "bg-gradient-to-r from-slate-200 via-slate-100 to-slate-200 dark:from-slate-700 dark:via-slate-600 dark:to-slate-700 bg-[length:200%_100%] animate-[shimmer_1.5s_infinite]"
  </loading_states>

  <empty_states>
    Always include engaging empty states:
    - Icon (use Lucide icons, muted color)
    - Title (what's empty)
    - Description (what to do next)
    - Optional CTA button

    "<div className='flex flex-col items-center justify-center py-12 text-center'>
      <div className='${radiusFull} bg-slate-100 dark:bg-slate-800 p-4 mb-4'>
        <Icon className='w-8 h-8 text-slate-400' />
      </div>
      <h3 className='text-lg font-medium text-slate-900 dark:text-white'>No items yet</h3>
      <p className='mt-1 text-sm text-slate-500 dark:text-slate-400'>Get started by creating your first item.</p>
      <button className='mt-4 ...'> Create item </button>
    </div>"
  </empty_states>

  <accessibility>
    REQUIRED:
    - All images must have alt text
    - All interactive elements must be keyboard accessible
    - Use semantic HTML (header, main, nav, section, article)
    - Color contrast minimum 4.5:1 for text
    - Focus states must be visible: "focus-visible:ring-2 focus-visible:ring-indigo-500"
    - Use aria-labels for icon-only buttons
  </accessibility>

  <responsive_breakpoints>
    - Mobile: default (< 640px)
    - sm: 640px+
    - md: 768px+
    - lg: 1024px+
    - xl: 1280px+
    - 2xl: 1536px+

    ALWAYS design mobile-first, then enhance for larger screens.
  </responsive_breakpoints>

  <icons>
    ALWAYS use lucide-react icons:
    import { Icon } from 'lucide-react';

    Common icons:
    - Navigation: Menu, X, ChevronDown, ChevronRight, ArrowLeft, ArrowRight
    - Actions: Plus, Trash2, Edit, Copy, Download, Upload, Search
    - Status: Check, AlertCircle, Info, XCircle, Loader2
    - Media: Image, Play, Pause
    - User: User, LogOut, Settings

    Icon sizing:
    - Small (buttons): "w-4 h-4"
    - Default: "w-5 h-5"
    - Large: "w-6 h-6"
  </icons>
</design_system>
`;
}

/**
 * Get component-specific patterns based on what's being built
 */
export function getComponentLibraryHint(projectType: string): string {
  switch (projectType) {
    case 'dashboard':
      return `
For dashboards, include:
- Stat cards with icons, values, and trends
- Charts using recharts or chart.js
- Data tables with sorting/filtering
- Activity feeds
- Quick action widgets
`;
    case 'landing':
      return `
For landing pages, include:
- Hero with gradient background
- Feature sections with icons
- Testimonial cards
- Pricing comparison table
- FAQ accordion
- CTA sections
- Footer with links
`;
    case 'ecommerce':
      return `
For e-commerce, include:
- Product cards with hover effects
- Image galleries
- Add to cart animations
- Price displays
- Rating stars
- Filter sidebar
`;
    default:
      return '';
  }
}
