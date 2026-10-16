// Captures the browser's "install app" prompt (Chrome/Edge/Android) as soon as the page loads, so Settings can offer it later.
let deferred = null;
const listeners = new Set();
const emit = () => listeners.forEach((f) => f());
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferred = e; emit(); });
  window.addEventListener('appinstalled', () => { deferred = null; emit(); });
}
export const canPromptInstall = () => !!deferred;
export const promptInstall = async () => {
  if (!deferred) return false;
  deferred.prompt();
  const choice = await deferred.userChoice;
  deferred = null;
  emit();
  return choice.outcome === 'accepted';
};
export const onInstallChange = (f) => { listeners.add(f); return () => listeners.delete(f); };
export const isStandalone = () =>
  (typeof window !== 'undefined') && (window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true);
export const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
