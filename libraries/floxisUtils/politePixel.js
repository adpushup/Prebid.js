import { triggerPixel } from '../../src/utils.js';

// Vendored from Prebid.js core utils (upstream PR #14802): cores older than the PR don't ship
// politeTriggerPixel/runBackgroundTask, so the Floxis adapter backport carries its own copy.

export function runBackgroundTask(task) {
  const scheduler = window.scheduler;
  if (scheduler?.postTask) {
    scheduler.postTask(task, { priority: 'background' }).catch(() => task());
    return;
  }
  if (typeof window.requestIdleCallback === 'function') {
    window.requestIdleCallback(() => task(), { timeout: 2000 });
    return;
  }
  task();
}

export function politeTriggerPixel(url, credentials = 'include') {
  const triggerSync = () => {
    if (window.fetch && window.Request) {
      try {
        const request = new Request(url, {
          method: 'GET',
          mode: 'no-cors',
          credentials,
          keepalive: true
        });
        window.fetch(request).catch(() => { if (credentials !== 'omit') triggerPixel(url); });
        return;
      } catch (e) {}
    }
    if (credentials !== 'omit') triggerPixel(url);
  };

  runBackgroundTask(triggerSync);
}
