import { ref } from 'vue';
import { sendTelegramMessage } from 'src/services/telegramService';

export function useTelegram() {
  const isLoading = ref(false);

  async function sendTestMessage() {
    isLoading.value = true;
    try {
      const msg = `🎬 [영화명] 스케줄 업데이트
📍 CGV 강남 | IMAX
📅 2026.03.20 (금) 19:30
💺 잔여 좌석: 48석
🔗 예매 바로가기: [www.naver.com]`;
      await sendTelegramMessage(msg);
    } catch (err) {
      const message = err instanceof Error ? err.message : '알 수 없는 오류';
      console.error(message);
    } finally {
      isLoading.value = false;
    }
  }

  return { isLoading, sendTestMessage };
}
