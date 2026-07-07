/* localStorage 기반 저장소 — 브라우저 환경에서 동작하는 storage.get/set/delete 어댑터 */

export const storage = {
  async get(key) {
    try {
      const value = window.localStorage.getItem(key);
      return value == null ? null : { value };
    } catch {
      return null;
    }
  },
  async set(key, value) {
    window.localStorage.setItem(key, value);
  },
  async delete(key) {
    window.localStorage.removeItem(key);
  },
};
