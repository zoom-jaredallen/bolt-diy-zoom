/**
 * Zoom Client Mockup Component
 *
 * A low-fidelity representation of the Zoom Desktop client for previewing
 * Zoom Apps within the development environment. Shows the app's placement
 * in the Zoom client's right-side panel.
 *
 * Features:
 * - Window chrome with macOS-style title bar
 * - Left sidebar with abstract navigation icons
 * - Main content area with dial pad placeholder
 * - Right app panel with iframe container (collapsed/expanded)
 * - Dark/light theme support
 */

import { memo, type RefObject } from 'react';

interface ZoomClientMockupProps {
  iframeRef: RefObject<HTMLIFrameElement>;
  iframeUrl: string | undefined;
  isExpanded: boolean;
  onToggleExpanded: () => void;
  appName?: string;
}

export const ZoomClientMockup = memo(
  ({ iframeRef, iframeUrl, isExpanded, onToggleExpanded, appName = 'Your App' }: ZoomClientMockupProps) => {
    // Panel widths based on Zoom client specifications
    const collapsedWidth = 280;
    const expandedWidth = 400;
    const panelWidth = isExpanded ? expandedWidth : collapsedWidth;

    return (
      <div className="zoom-client-mockup w-full h-full flex items-center justify-center bg-bolt-elements-background-depth-1 p-4 overflow-auto">
        <div
          className="zoom-client-frame rounded-lg overflow-hidden shadow-2xl flex flex-col"
          style={{
            width: '100%',
            maxWidth: '1200px',
            height: '100%',
            maxHeight: '800px',
            minHeight: '500px',
            backgroundColor: 'var(--zoom-bg, #1a1a2e)',
          }}
        >
          {/* Window Title Bar */}
          <TitleBar />

          {/* Main Content Area */}
          <div className="flex flex-1 overflow-hidden">
            {/* Left Sidebar */}
            <Sidebar />

            {/* Main Content - Phone Tab */}
            <MainContent />

            {/* Right App Panel */}
            <AppPanel
              iframeRef={iframeRef}
              iframeUrl={iframeUrl}
              width={panelWidth}
              isExpanded={isExpanded}
              onToggleExpanded={onToggleExpanded}
              appName={appName}
            />
          </div>
        </div>
      </div>
    );
  },
);

/**
 * macOS-style window title bar
 */
const TitleBar = memo(() => (
  <div
    className="title-bar flex items-center px-4 py-2 gap-4"
    style={{
      backgroundColor: 'var(--zoom-titlebar-bg, #0e72ed)',
      height: '40px',
    }}
  >
    {/* macOS Window Buttons */}
    <div className="flex gap-2">
      <div className="w-3 h-3 rounded-full bg-[#ff5f57]" />
      <div className="w-3 h-3 rounded-full bg-[#febc2e]" />
      <div className="w-3 h-3 rounded-full bg-[#28c840]" />
    </div>

    {/* Zoom Logo/Text */}
    <div className="text-white text-sm font-medium ml-2">zoom</div>

    {/* Spacer */}
    <div className="flex-1" />

    {/* Search Bar Placeholder */}
    <div
      className="flex items-center gap-2 px-3 py-1 rounded-full"
      style={{
        backgroundColor: 'rgba(255,255,255,0.2)',
        width: '200px',
      }}
    >
      <div className="w-4 h-4 rounded-full border border-white/50" />
      <span className="text-white/70 text-xs">Search</span>
    </div>

    {/* Spacer */}
    <div className="flex-1" />

    {/* Profile Placeholder */}
    <div className="w-8 h-8 rounded-full bg-white/30" />
  </div>
));

/**
 * Left sidebar with abstract navigation icons
 */
const Sidebar = memo(() => {
  const icons = [
    { id: 'home', active: false },
    { id: 'chat', active: false },
    { id: 'phone', active: true },
    { id: 'calendar', active: false },
    { id: 'docs', active: false },
    { id: 'more', active: false },
  ];

  return (
    <div
      className="sidebar flex flex-col items-center py-4 gap-4"
      style={{
        width: '60px',
        backgroundColor: 'var(--zoom-sidebar-bg, #0e72ed)',
      }}
    >
      {icons.map((icon) => (
        <div
          key={icon.id}
          className="w-10 h-10 rounded-lg flex items-center justify-center"
          style={{
            backgroundColor: icon.active ? 'rgba(255,255,255,0.2)' : 'transparent',
          }}
        >
          <div
            className="w-6 h-6 rounded"
            style={{
              backgroundColor: 'rgba(255,255,255,0.7)',
            }}
          />
        </div>
      ))}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Settings Icon */}
      <div className="w-10 h-10 rounded-lg flex items-center justify-center">
        <div
          className="w-6 h-6 rounded-full"
          style={{
            backgroundColor: 'rgba(255,255,255,0.5)',
          }}
        />
      </div>
    </div>
  );
});

/**
 * Main content area with Phone tab dial pad placeholder
 */
const MainContent = memo(() => (
  <div
    className="main-content flex-1 flex flex-col"
    style={{
      backgroundColor: 'var(--zoom-content-bg, #ffffff)',
    }}
  >
    {/* Phone Tab Header */}
    <div
      className="px-4 py-3 border-b"
      style={{
        borderColor: 'var(--zoom-border, #e5e5e5)',
      }}
    >
      <div className="text-lg font-semibold" style={{ color: 'var(--zoom-text, #1a1a2e)' }}>
        Phone
      </div>
      {/* Tab bar placeholder */}
      <div className="flex gap-4 mt-2">
        {['History', 'Voicemail', 'Lines', 'SMS', 'Fax'].map((tab, i) => (
          <div
            key={tab}
            className="h-2 rounded"
            style={{
              width: i === 0 ? '50px' : '40px',
              backgroundColor: i === 0 ? 'var(--zoom-accent, #0e72ed)' : 'var(--zoom-placeholder, #e5e5e5)',
            }}
          />
        ))}
      </div>
    </div>

    {/* Content Area */}
    <div className="flex flex-1 overflow-hidden">
      {/* Call History List Placeholder */}
      <div
        className="w-1/3 border-r p-4 flex flex-col gap-2"
        style={{
          borderColor: 'var(--zoom-border, #e5e5e5)',
        }}
      >
        {[...Array(8)].map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full" style={{ backgroundColor: 'var(--zoom-placeholder, #e5e5e5)' }} />
            <div className="flex-1 flex flex-col gap-1">
              <div
                className="h-2 rounded"
                style={{
                  width: `${60 + Math.random() * 30}%`,
                  backgroundColor: 'var(--zoom-placeholder, #e5e5e5)',
                }}
              />
              <div
                className="h-2 rounded"
                style={{
                  width: '40%',
                  backgroundColor: 'var(--zoom-placeholder-light, #f0f0f0)',
                }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Dial Pad Area */}
      <div className="flex-1 flex flex-col items-center justify-center p-8">
        {/* Input placeholder */}
        <div
          className="h-3 rounded mb-8"
          style={{
            width: '200px',
            backgroundColor: 'var(--zoom-placeholder, #e5e5e5)',
          }}
        />

        {/* Dial Pad */}
        <div className="grid grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, '*', 0, '#'].map((key) => (
            <div
              key={key}
              className="w-14 h-14 rounded-full flex items-center justify-center"
              style={{
                backgroundColor: 'var(--zoom-dialpad-bg, #f5f5f5)',
                border: '1px solid var(--zoom-border, #e5e5e5)',
              }}
            >
              <span className="text-lg font-medium" style={{ color: 'var(--zoom-text, #1a1a2e)' }}>
                {key}
              </span>
            </div>
          ))}
        </div>

        {/* Call Button */}
        <div
          className="w-14 h-14 rounded-full flex items-center justify-center mt-6"
          style={{
            backgroundColor: 'var(--zoom-call-button, #28c840)',
          }}
        >
          <div className="w-6 h-6 rounded" style={{ backgroundColor: 'white' }} />
        </div>
      </div>
    </div>
  </div>
));

/**
 * Right-side app panel with iframe container
 */
interface AppPanelProps {
  iframeRef: RefObject<HTMLIFrameElement>;
  iframeUrl: string | undefined;
  width: number;
  isExpanded: boolean;
  onToggleExpanded: () => void;
  appName: string;
}

const AppPanel = memo(({ iframeRef, iframeUrl, width, isExpanded, onToggleExpanded, appName }: AppPanelProps) => (
  <div
    className="app-panel flex flex-col transition-all duration-300"
    style={{
      width: `${width}px`,
      minWidth: `${width}px`,
      backgroundColor: 'var(--zoom-panel-bg, #1a1a2e)',
      borderLeft: '1px solid var(--zoom-border-dark, #333)',
    }}
  >
    {/* Panel Header */}
    <div
      className="flex items-center justify-between px-3 py-2"
      style={{
        borderBottom: '1px solid var(--zoom-border-dark, #333)',
      }}
    >
      <div className="flex items-center gap-2">
        <div className="w-5 h-5 rounded bg-blue-500" />
        <span className="text-white text-sm font-medium truncate" style={{ maxWidth: '120px' }}>
          {appName}
        </span>
        <span className="text-white/50 text-xs">▾</span>
      </div>

      <div className="flex items-center gap-1">
        {/* Expand/Collapse Toggle */}
        <button
          onClick={onToggleExpanded}
          className="w-7 h-7 rounded flex items-center justify-center hover:bg-white/10 transition-colors"
          title={isExpanded ? 'Collapse panel' : 'Expand panel'}
        >
          <span className="text-white/70 text-sm">{isExpanded ? '‹›' : '›‹'}</span>
        </button>

        {/* Close Button Placeholder */}
        <div className="w-7 h-7 rounded flex items-center justify-center hover:bg-white/10">
          <span className="text-white/50 text-lg">×</span>
        </div>
      </div>
    </div>

    {/* App Content (Iframe) */}
    <div className="flex-1 overflow-hidden">
      {iframeUrl ? (
        <iframe
          ref={iframeRef}
          title="Zoom App Preview"
          className="w-full h-full border-none"
          src={iframeUrl}
          sandbox="allow-scripts allow-forms allow-popups allow-modals allow-storage-access-by-user-activation allow-same-origin"
          allow="cross-origin-isolated"
          style={{
            backgroundColor: '#ffffff',
          }}
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center text-white/50">No preview available</div>
      )}
    </div>
  </div>
));

// CSS Variables for theming (injected via style tag or globals)
export const zoomClientStyles = `
  .zoom-client-mockup {
    --zoom-bg: #1a1a2e;
    --zoom-titlebar-bg: #0e72ed;
    --zoom-sidebar-bg: #0e72ed;
    --zoom-content-bg: #ffffff;
    --zoom-panel-bg: #1a1a2e;
    --zoom-text: #1a1a2e;
    --zoom-border: #e5e5e5;
    --zoom-border-dark: #333;
    --zoom-placeholder: #e5e5e5;
    --zoom-placeholder-light: #f0f0f0;
    --zoom-accent: #0e72ed;
    --zoom-dialpad-bg: #f5f5f5;
    --zoom-call-button: #28c840;
  }

  .dark .zoom-client-mockup {
    --zoom-content-bg: #2d2d3a;
    --zoom-text: #ffffff;
    --zoom-border: #404050;
    --zoom-placeholder: #404050;
    --zoom-placeholder-light: #353545;
    --zoom-dialpad-bg: #353545;
  }
`;
