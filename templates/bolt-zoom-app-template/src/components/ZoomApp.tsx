import { useZoom } from '../hooks/useZoom';

interface UserContext {
  screenName?: string;
  role?: string;
}

interface MeetingContext {
  meetingID?: string;
  meetingTopic?: string;
}

export function ZoomApp() {
  const { isReady, isLoading, isPreviewMode, error, userContext, meetingContext, notify } = useZoom();

  const user = userContext as UserContext | null;
  const meeting = meetingContext as MeetingContext | null;

  // Loading state
  if (isLoading) {
    return (
      <div className="loading">
        <div className="spinner" />
        <p>Connecting to Zoom...</p>
      </div>
    );
  }

  // Preview mode - running outside Zoom client
  if (isPreviewMode) {
    return (
      <div className="zoom-app preview-mode">
        <header>
          <h1>🎥 Zoom App - Preview Mode</h1>
          <span className="status preview">○ Preview</span>
        </header>

        <main>
          <section className="card info-card">
            <h2>📱 Preview Mode</h2>
            <p>
              This app is designed to run inside the <strong>Zoom Desktop Client</strong>.
            </p>
            <p>You're currently viewing a standalone preview.</p>
          </section>

          <section className="card">
            <h2>How to Test in Zoom</h2>
            <ol>
              <li>
                Open <strong>Zoom Desktop Client</strong>
              </li>
              <li>
                Go to <strong>Apps</strong> tab
              </li>
              <li>Find your app in the list</li>
              <li>Click to open it inside Zoom</li>
            </ol>
          </section>

          <section className="card mock-data">
            <h2>Mock User Info</h2>
            <p>
              <strong>Name:</strong> Preview User
            </p>
            <p>
              <strong>Role:</strong> Host
            </p>
          </section>

          <section className="card mock-data">
            <h2>Mock Meeting Info</h2>
            <p>
              <strong>Meeting ID:</strong> 123-456-7890
            </p>
            <p>
              <strong>Topic:</strong> Preview Meeting
            </p>
          </section>

          <section className="actions">
            <button onClick={() => notify('Test Notification', 'This is a preview notification')}>
              Test Notification (Preview)
            </button>
          </section>
        </main>

        <footer>
          <p>Built with bolt.diy + @zoom/appssdk</p>
          <p className="hint">Open in Zoom Desktop Client for full functionality</p>
        </footer>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="error">
        <h2>Connection Error</h2>
        <p>{error.message}</p>
        <p className="hint">Make sure you're running this app inside a Zoom client.</p>
      </div>
    );
  }

  // Connected to Zoom - normal mode
  const handleNotify = () => {
    notify('Hello!', 'This notification was sent from your Zoom App');
  };

  return (
    <div className="zoom-app">
      <header>
        <h1>🎥 Zoom App</h1>
        <span className={`status ${isReady ? 'connected' : ''}`}>{isReady ? '● Connected' : '○ Disconnected'}</span>
      </header>

      <main>
        {user && (
          <section className="card">
            <h2>User Info</h2>
            <p>
              <strong>Name:</strong> {user.screenName || 'Unknown'}
            </p>
            <p>
              <strong>Role:</strong> {user.role || 'Unknown'}
            </p>
          </section>
        )}

        {meeting && (
          <section className="card">
            <h2>Meeting Info</h2>
            <p>
              <strong>Meeting ID:</strong> {meeting.meetingID || 'N/A'}
            </p>
            <p>
              <strong>Topic:</strong> {meeting.meetingTopic || 'N/A'}
            </p>
          </section>
        )}

        <section className="actions">
          <button onClick={handleNotify} disabled={!isReady}>
            Send Notification
          </button>
        </section>
      </main>

      <footer>
        <p>Built with bolt.diy + @zoom/appssdk</p>
      </footer>
    </div>
  );
}
