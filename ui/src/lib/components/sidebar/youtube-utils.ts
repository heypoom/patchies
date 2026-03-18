const YOUTUBE_URL_RE =
  /https?:\/\/(?:www\.|m\.)?(?:youtube\.com\/(?:watch\?(?:\S*&)*v=[\w-]+|shorts\/[\w-]+)|youtu\.be\/[\w-]+)(?:[?&]\S*)?/gi;

/** Extract all YouTube URLs from a text string. */
export function extractYouTubeUrls(text: string): { urls: string[]; stripped: string } {
  const urls: string[] = [];
  const stripped = text.replace(YOUTUBE_URL_RE, (match) => {
    urls.push(match);
    return '';
  });
  return { urls, stripped: stripped.replace(/\s+/g, ' ').trim() };
}

export function getYouTubeLabel(url: string): string {
  try {
    const u = new URL(url);
    return u.hostname.includes('youtu.be') ? u.pathname.slice(1) : (u.searchParams.get('v') ?? url);
  } catch {
    return url;
  }
}
