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


export function scrapeNaverMoviesViaApi(): Promise<ScrapeResult> {
  return postScraper<ScrapeResult>('/api/scrape/movies-api');
}

export function scrapeNaverSchedules(): Promise<ScrapeScheduleResult> {
  return postScraper<ScrapeScheduleResult>('/api/scrape/schedules');
}

export interface ScrapeMovieScheduleResult {
  success: boolean;
  added: number;
  updated: number;
  deleted: number;
}

export function scrapeNaverScheduleForMovieViaApi(movieId: string): Promise<ScrapeMovieScheduleResult> {
  return postScraper<ScrapeMovieScheduleResult>(`/api/scrape/schedules-api/${movieId}`);
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
  kofaUpdated: number;
  kofaSkipped: number;
  kofaSchedulesAdded: number;
  kofaSchedulesDeleted: number;
  kofaErrors: string[];
  elapsedMs: number;
}

export function scrapeAll(): Promise<ScrapeAllResult> {
  return postScraper<ScrapeAllResult>('/api/scrape/all');
}

export interface ScrapeKofaResult {
  success: boolean;
  added: number;
  updated: number;
  skipped: number;
  total: number;
  addedTitles: string[];
  schedulesAdded: number;
  schedulesDeleted: number;
  schedulesTotal: number;
  errors: string[];
}

export function scrapeKofaMovies(): Promise<ScrapeKofaResult> {
  return postScraper<ScrapeKofaResult>('/api/scrape/kofa-movies');
}
