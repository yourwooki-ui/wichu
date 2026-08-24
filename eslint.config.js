const { defineConfig, globalIgnores } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const eslintPluginPrettierRecommended = require('eslint-plugin-prettier/recommended');

/**
 * 디자인 시스템 가드.
 *
 * 새 화면이 추가될 때마다 접근성 바닥이 되돌아가는 일이 반복돼서 린트로 고정한다.
 * 값 자체가 필요하면 `src/constants/theme.ts`의 토큰을 늘려서 쓴다.
 */
const designSystemRules = {
  'no-restricted-syntax': [
    'error',
    {
      selector: "Property[key.name='fontSize'][value.type='Literal'][value.value<10]",
      message:
        '글자 크기는 10px 미만을 쓰지 않습니다(접근성 바닥). typography 토큰을 쓰거나 10 이상으로 올려주세요.',
    },
    {
      selector: "Property[key.name='fontSize'] > UnaryExpression[operator='-'] > Literal",
      message: '글자 크기에 음수를 쓸 수 없습니다.',
    },
  ],
};

module.exports = defineConfig([
  globalIgnores(['dist/*', '.expo/*', 'supabase/.temp/*']),
  expoConfig,
  eslintPluginPrettierRecommended,
  {
    files: ['app/**/*.{ts,tsx}', 'src/**/*.{ts,tsx}'],
    // 토큰 정의 자체는 원시 값을 다뤄야 하므로 제외한다.
    ignores: ['src/constants/theme.ts'],
    rules: designSystemRules,
  },
]);
