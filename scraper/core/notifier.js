import { sendTelegramMessage } from './telegram.js';
import { createUrlToken } from './urlToken.js';

const MOVIES_URL = 'https://wooriworld.github.io/cineping/#';

function kstToday() {
  return new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export async function sendUpdateNotification(
  supabase,
  { addedTitles, addedNaverMovieIds, updatedMovies, kofaResult, emucineResult },
) {
  const today = kstToday();
  const notifyScheduleMovies = [
    ...new Map(
      [
        ...updatedMovies.filter((m) => (m.createdAt ?? '').slice(0, 10) < today),
        ...kofaResult.updatedMovies,
      ].map((m) => [m.id, m]),
    ).values(),
  ];
  const parts = [];

  const allAddedTitles = [...addedTitles, ...kofaResult.addedTitles, ...emucineResult.addedTitles];
  if (allAddedTitles.length > 0) {
    const lines = allAddedTitles.slice(0, 3).map((t) => `🎬 [ ${t} ]`);
    if (allAddedTitles.length > 3) lines.push(`... and ${allAddedTitles.length - 3} more`);
    parts.push(`New Movies (${allAddedTitles.length})\n${lines.join('\n')}`);
  }
  if (notifyScheduleMovies.length > 0) {
    const lines = notifyScheduleMovies.slice(0, 3).map((m) => `🎬 [ ${m.title} ]`);
    if (notifyScheduleMovies.length > 3)
      lines.push(`... and ${notifyScheduleMovies.length - 3} more`);
    parts.push(`Showtime Updates (${notifyScheduleMovies.length})\n${lines.join('\n')}`);
  }

  if (parts.length === 0) return;

  const allNaverIds = [
    ...new Set([
      ...addedNaverMovieIds,
      ...kofaResult.addedNaverMovieIds,
      ...emucineResult.addedSourceIds,
      ...notifyScheduleMovies.map((m) => m.sourceId).filter(Boolean),
    ]),
  ];
  const token = await createUrlToken(supabase, allNaverIds);
  const url = token ? `${MOVIES_URL}?t=${token}` : MOVIES_URL;
  const message = `🔥🔥 영화 업데이트 알림\n\n${parts.join('\n\n')}\n\n🔗 바로가기\n${url}`;
  await sendTelegramMessage(message);
  console.log('\n[Telegram 발송] 알림 발송');
}
