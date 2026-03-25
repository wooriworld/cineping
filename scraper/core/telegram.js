const TELEGRAM_API = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`;

export async function sendTelegramMessage(text) {
  try {
    const res = await fetch(TELEGRAM_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: process.env.TELEGRAM_CHAT_ID, text }),
    });
    if (!res.ok) {
      const err = await res.json();
      console.error('[Telegram 오류]', err.description ?? res.status);
    }
  } catch (err) {
    console.error('[Telegram 오류]', err.message);
  }
}
