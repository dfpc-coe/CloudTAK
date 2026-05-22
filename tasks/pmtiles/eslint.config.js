import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import stylistic from '@stylistic/eslint-plugin'; 

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
    stylistic.configs.customize({
        indent: 4,
        quotes: 'single',
        semi: true,
    }),
  {
    "rules": {
        "@typescript-eslint/no-explicit-any": "warn"
    }
  }
);
