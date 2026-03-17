const SCRAPER_URL = 'http://localhost:3001';

export interface ScrapeResult {
  success: boolean;
  added: number;
  skipped: number;
  total: number;
}

export interface ScrapeScheduleResult {
  success: boolean;
  moviesProcessed: number;
  schedulesAdded: number;
  errors: string[];
}

async function postScraper<T>(path: string): Promise<T> {
  const res = await fetch(`${SCRAPER_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? `서버 오류 (${res.status})`);
  }
  return res.json() as Promise<T>;
}

async function postScraperWithBody<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${SCRAPER_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const b = await res.json().catch(() => ({}));
    throw new Error((b as { error?: string }).error ?? `서버 오류 (${res.status})`);
  }
  return res.json() as Promise<T>;
}

export function scrapeNaverMovies(): Promise<ScrapeResult> {
  return postScraper<ScrapeResult>('/api/scrape/movies');
}

export function scrapeNaverMoviesViaApi(url: string): Promise<ScrapeResult> {
  return postScraperWithBody<ScrapeResult>('/api/scrape/movies-api', { url });
}

export function scrapeNaverSchedules(): Promise<ScrapeScheduleResult> {
  return postScraper<ScrapeScheduleResult>('/api/scrape/schedules');
}

export interface ScrapeMovieScheduleResult {
  success: boolean;
  schedulesAdded: number;
}

export function scrapeNaverScheduleForMovieViaApi(movieId: string): Promise<ScrapeMovieScheduleResult> {
  return postScraper<ScrapeMovieScheduleResult>(`/api/scrape/schedules-api/${movieId}`);
}
