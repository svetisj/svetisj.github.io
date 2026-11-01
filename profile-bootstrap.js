'use strict';

// Keep each profile's server-rendered metadata and readable fallback, then open
// the same application and profile dialog used when browsing the collection.
(async () => {
  if (location.protocol === 'file:') return;
  const library = new URL('./', document.currentScript.src);
  const originalBody = document.body;
  const originalTitle = document.title;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  let base;
  document.documentElement.classList.add('profile-loading');
  try {
    const response = await fetch(new URL('index.html', library), { signal: controller.signal });
    if (!response.ok) throw new Error(`Collection page ${response.status}`);
    const page = new DOMParser().parseFromString(await response.text(), 'text/html');
    if (!page.querySelector('#profile-dialog') || !page.querySelector('#saint-grid')) throw new Error('Invalid collection shell');
    // Freeze the existing fallback stylesheet/icon URLs before setting the
    // collection base, including when hosted below a subdirectory.
    for (const link of document.head.querySelectorAll('link[href]')) link.href = link.href;
    base = document.createElement('base');
    base.id = 'site-base'; base.href = library.href;
    document.head.prepend(base);
    window.SAINT_LIBRARY_URL = library.href;
    for (const link of page.head.querySelectorAll('link[rel="stylesheet"], link[rel="manifest"]')) {
      const href = new URL(link.getAttribute('href'), library).href;
      if ([...document.head.querySelectorAll('link[href]')].some(existing => existing.href === href)) continue;
      const asset = document.createElement('link'); asset.rel = link.rel; asset.href = href; document.head.append(asset);
    }
    document.body.replaceWith(document.importNode(page.body, true));
    for (const source of page.head.querySelectorAll('script[src]')) {
      const url = new URL(source.getAttribute('src'), library);
      if (url.origin !== library.origin || !url.href.startsWith(library.href)) throw new Error('Unexpected application script');
      await new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = url.href; script.async = false;
        const aborted = () => { script.remove(); reject(new Error('Application loading timed out')); };
        const finish = callback => { controller.signal.removeEventListener('abort', aborted); callback(); };
        script.onload = () => finish(resolve);
        script.onerror = () => finish(() => reject(new Error(`Application asset ${url.pathname}`)));
        if (controller.signal.aborted) { aborted(); return; }
        controller.signal.addEventListener('abort', aborted, {once:true});
        document.head.append(script);
      });
    }
    if (!document.querySelector('#profile-dialog')?.open) throw new Error('Profile could not open');
  } catch (error) {
    if (document.body !== originalBody) document.body.replaceWith(originalBody);
    base?.remove();
    document.title = originalTitle;
    console.warn('Interactive profile unavailable; readable biography retained.', error);
  } finally {
    clearTimeout(timeout);
    document.documentElement.classList.remove('profile-loading');
  }
})();
