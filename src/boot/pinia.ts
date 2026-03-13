import { createPinia } from 'pinia';
import { defineBoot } from '#q-app/wrappers';

export default defineBoot(({ app }) => {
  const pinia = createPinia();
  app.use(pinia);
});
