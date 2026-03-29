const STORAGE_KEY = 'freesound:api-key';

function createFreesoundKeyStore() {
  let apiKey = $state(localStorage.getItem(STORAGE_KEY) ?? '');

  return {
    get apiKey() {
      return apiKey;
    },
    get hasKey() {
      return apiKey.trim().length > 0;
    },
    setApiKey(key: string) {
      apiKey = key.trim();
      if (apiKey) {
        localStorage.setItem(STORAGE_KEY, apiKey);
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
    }
  };
}

export const freesoundKeyStore = createFreesoundKeyStore();
