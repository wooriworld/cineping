import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { sendTelegramMessage } from './core/telegram.js';
import { runPipeline } from './core/pipeline.js';

// ── 환경변수 검증 ──────────────────────────────────────────────────
const required = [
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'TELEGRAM_BOT_TOKEN',
  'TELEGRAM_CHAT_ID',
];
for (const key of required) {
  if (!process.env[key]) {
    console.error(`[오류] 환경변수 ${key} 가 설정되지 않았습니다.`);
    process.exit(1);
  }
}

// ── Supabase 초기화 ───────────────────────────────────────────────
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// ── 메인 실행 ──────────────────────────────────────────────────────
async function main() {
  try {
    await runPipeline(supabase);
    process.exit(0);
  } catch (err) {
    console.error('[전체 수집 오류]', err.message);
    await sendTelegramMessage(`🚨 전체 수집 실패\n\n${err.message}`).catch(() => {});
    process.exit(1);
  }
}

main();
