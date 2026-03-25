import { randomBytes } from 'crypto';

const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

function generateToken(length = 8) {
  const bytes = randomBytes(length);
  let result = '';
  for (let i = 0; i < length; i++) {
    result += CHARS[bytes[i] % CHARS.length];
  }
  return result;
}

/**
 * naverMovieIds 배열을 Supabase url_tokens 테이블에 저장하고 토큰을 반환한다.
 * 실패하면 null 반환 (Telegram 발송을 막지 않음).
 */
export async function createUrlToken(supabase, naverMovieIds) {
  if (!naverMovieIds || naverMovieIds.length === 0) return null;
  const token = generateToken(8);
  const { error } = await supabase
    .from('url_tokens')
    .insert({ token, ids: naverMovieIds });
  if (error) {
    console.error('[urlToken] 토큰 저장 실패:', error.message);
    return null;
  }
  return token;
}
