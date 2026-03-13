export type ChainType = 'CGV' | '롯데시네마' | '메가박스';

export interface Movie {
  id: string;
  title: string;
  naverMovieId: string;
  poster: string;
  isTracking: boolean;
  createdAt: string;
}

export interface Schedule {
  id: string;
  movieId: string;
  chain: ChainType;
  theater: string;
  date: string;
  startTime: string;
  endTime: string;
  screenType: string;
  availableSeats: number;
  bookingUrl: string;
  lastUpdatedAt: string;
}

export interface AlertConditions {
  newSchedule: boolean;
  deletedSchedule: boolean;
  modifiedSchedule: boolean;
  preferredChains: ChainType[];
}

export interface User {
  uid: string;
  telegramChatId: string;
  watchlist: string[];
  alertConditions: AlertConditions;
}
