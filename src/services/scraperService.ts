const SCRAPER_URL = 'http://localhost:3001';

export interface ScrapeResult {
  success: boolean;
  added: number;
  skipped: number;
  total: number;
}

export async function scrapeNaverMovies(): Promise<ScrapeResult> {
  const res = await fetch(`${SCRAPER_URL}/api/scrape/movies`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? `서버 오류 (${res.status})`);
  }

  return res.json() as Promise<ScrapeResult>;
}
