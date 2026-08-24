export function runtimeAssetUrl(path: string): URL {
  const cleanPath = path.replace(/^\/+/, '');
  const moduleUrl = new URL(import.meta.url);
  if (moduleUrl.pathname.includes('/src/')) return new URL(`/${cleanPath}`, window.location.origin);
  return new URL(`../${cleanPath}`, moduleUrl);
}
