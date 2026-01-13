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
  const { isReady, isLoading, error, userContext, meetingContext, notify } = useZoom();

  const user = userContext as UserContext | null;
  const meeting = meetingContext as MeetingContext | null;

  if (isLoading) {
    return (
      <div className="loading">
        <div className="spinner" />
        <p>Connecting to Zoom...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="error">
        <h2>Connection Error</h2>
        <p>{error.message}</p>
        <p className="hint">Make sure you're running this app inside a Zoom client.</p>
      </div>
    );
  }

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
