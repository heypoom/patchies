export function getYouTubeLabel(url: string): string {
  try {
    const u = new URL(url);
    return u.hostname.includes('youtu.be') ? u.pathname.slice(1) : (u.searchParams.get('v') ?? url);
  } catch {
    return url;
  }
}
