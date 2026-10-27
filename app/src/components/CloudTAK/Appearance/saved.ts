import { ref } from 'vue';

/** Id of the Feature whose appearance was just saved - read once by the details view to confirm the save */
export const appearanceSaved = ref<string | null>(null);
