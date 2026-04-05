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

export function scrapeNaverMovies(): Promise<ScrapeResult> {
  return postScraper<ScrapeResult>('/api/scrape/naver-api');
}

export function scrapeNaverSchedules(): Promise<ScrapeScheduleResult> {
  return postScraper<ScrapeScheduleResult>('/api/scrape/naver-schedules-api');
}

export interface ScrapeAllResult {
  success: boolean;
  movieAdded: number;
  movieSkipped: number;
  movieTotal: number;
  moviesProcessed: number;
  schedulesAdded: number;
  errors: string[];
  kofaAdded: number;
  kofaSkipped: number;
  kofaSchedulesAdded: number;
  kofaSchedulesDeleted: number;
  kofaErrors: string[];
  emucineAdded: number;
  emucineSkipped: number;
  emucineSchedulesAdded: number;
  emucineErrors: string[];
  elapsedMs: number;
}

export function scrapeAll(): Promise<ScrapeAllResult> {
  return postScraper<ScrapeAllResult>('/api/scrape/all');
}

export function scrapeKofaMovies(): Promise<void> {
  return postScraper<void>('/api/scrape/kofa-api');
}

export interface ScrapeEmucineResult {
  success: boolean;
  added: number;
  skipped: number;
  schedulesAdded: number;
  schedulesDeleted: number;
  addedTitles: string[];
  errors: string[];
}

export function scrapeEmucineMovies(): Promise<ScrapeEmucineResult> {
  return postScraper<ScrapeEmucineResult>('/api/scrape/emucine-movies');
}
