import zoomSdk from '@zoom/appssdk';

export interface ZoomConfig {
  runningContext?: string;
  unsupportedApis?: string[];
}

let isConfigured = false;
let zoomConfig: ZoomConfig = {};

export async function initZoomSdk(): Promise<ZoomConfig> {
  if (isConfigured) return zoomConfig;

  try {
    const configResponse = await zoomSdk.config({
      capabilities: [
        'getMeetingContext',
        'getUserContext',
        'openUrl',
        'showNotification',
        'getMeetingParticipants',
        'sendAppInvitation',
        'getRunningContext',
      ],
    });

    isConfigured = true;
    zoomConfig = configResponse;
    console.log('Zoom SDK configured:', configResponse);
    return configResponse;
  } catch (error) {
    console.error('Failed to configure Zoom SDK:', error);
    throw error;
  }
}

export async function getMeetingContext() {
  return zoomSdk.getMeetingContext();
}

export async function getUserContext() {
  return zoomSdk.getUserContext();
}

export async function showNotification(title: string, message: string) {
  return zoomSdk.showNotification({ title, message, type: 'info' });
}

export function isZoomConfigured(): boolean {
  return isConfigured;
}

export function getZoomConfig(): ZoomConfig {
  return zoomConfig;
}
