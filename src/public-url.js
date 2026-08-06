export function publicUrl(path) {
  if (!path || /^(?:https?:|data:|blob:)/.test(path)) return path;
  const baseUrl = import.meta.env?.BASE_URL ?? '/';
  return `${baseUrl}${path.replace(/^\/+/, '')}`;
}
