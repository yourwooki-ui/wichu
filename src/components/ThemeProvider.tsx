import { createContext, PropsWithChildren, useContext, useMemo } from 'react';
import { useColorScheme } from 'react-native';

import { AppTheme, darkTheme, lightTheme } from '@/constants/theme';

/**
 * 앱 전체 색 구성 설정.
 *
 * `app.config.js`의 `userInterfaceStyle: "light"`는 네이티브에만 적용되고 web에는 적용되지 않는다.
 * web에서 `useColorScheme()`은 브라우저의 `prefers-color-scheme`을 그대로 따르므로,
 * OS가 다크인 방문자에게는 `darkTheme`(배경 #000000)이 적용되는 반면
 * 대부분의 화면은 텍스트를 `palette.ink`(#111111)로 고정해 두어 글자가 배경에 묻힌다.
 *
 * 화면들이 전부 의미 기반 색(`theme.colors.*`)으로 전환되기 전까지는
 * 선언된 제품 의도대로 모든 플랫폼에서 light를 사용한다.
 * 다크 모드를 실제로 열 때는 이 값을 `'system'`으로 바꾸고
 * `app.config.js`의 `userInterfaceStyle`도 함께 조정한다.
 */
const COLOR_SCHEME: 'light' | 'dark' | 'system' = 'light';

const ThemeContext = createContext<AppTheme>(lightTheme);

export function ThemeProvider({ children }: PropsWithChildren) {
  const systemColorScheme = useColorScheme();
  const theme = useMemo(() => {
    const resolved = COLOR_SCHEME === 'system' ? systemColorScheme : COLOR_SCHEME;
    return resolved === 'dark' ? darkTheme : lightTheme;
  }, [systemColorScheme]);

  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}

export function useAppTheme() {
  return useContext(ThemeContext);
}
