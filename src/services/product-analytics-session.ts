/** DB UUID 컬럼과 호환되는 분석 세션 ID를 네이티브 모듈 없이 만든다. */
export function createAnalyticsSessionId() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (token) => {
    const value = Math.floor(Math.random() * 16);
    return (token === 'x' ? value : (value & 0x3) | 0x8).toString(16);
  });
}
