module.exports = {
  root: true,
  env: {
    node: true,
    browser: true,
    es2022: true,
  },
  extends: [
    'eslint:recommended',
    '@typescript-eslint/recommended',
    'plugin:react/recommended',
    'plugin:react-hooks/recommended',
    'plugin:jsx-a11y/recommended',
    'plugin:security/recommended',
    'prettier',
  ],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    ecmaFeatures: {
      jsx: true,
    },
  },
  plugins: [
    '@typescript-eslint',
    'react',
    'react-hooks',
    'jsx-a11y',
    'security',
    'prettier',
  ],
  settings: {
    react: {
      version: 'detect',
    },
  },
  rules: {
    // Prettier
    'prettier/prettier': 'error',

    // TypeScript
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/explicit-module-boundary-types': 'off',
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/prefer-const': 'error',
    '@typescript-eslint/no-var-requires': 'off',

    // React
    'react/react-in-jsx-scope': 'off',
    'react/prop-types': 'off',
    'react/jsx-uses-react': 'off',
    'react/jsx-uses-vars': 'error',
    'react/jsx-key': 'error',
    'react/jsx-no-duplicate-props': 'error',
    'react/jsx-no-undef': 'error',
    'react/no-array-index-key': 'warn',
    'react/no-danger': 'warn',
    'react/no-deprecated': 'error',
    'react/no-direct-mutation-state': 'error',
    'react/no-find-dom-node': 'error',
    'react/no-is-mounted': 'error',
    'react/no-render-return-value': 'error',
    'react/no-string-refs': 'error',
    'react/no-unescaped-entities': 'warn',
    'react/no-unknown-property': 'error',
    'react/no-unsafe': 'warn',
    'react/self-closing-comp': 'error',

    // React Hooks
    'react-hooks/rules-of-hooks': 'error',
    'react-hooks/exhaustive-deps': 'warn',

    // Accessibility
    'jsx-a11y/alt-text': 'error',
    'jsx-a11y/anchor-has-content': 'error',
    'jsx-a11y/anchor-is-valid': 'error',
    'jsx-a11y/aria-props': 'error',
    'jsx-a11y/aria-proptypes': 'error',
    'jsx-a11y/aria-unsupported-elements': 'error',
    'jsx-a11y/heading-has-content': 'error',
    'jsx-a11y/iframe-has-title': 'error',
    'jsx-a11y/img-redundant-alt': 'error',
    'jsx-a11y/no-access-key': 'error',
    'jsx-a11y/no-distracting-elements': 'error',
    'jsx-a11y/no-redundant-roles': 'error',
    'jsx-a11y/role-has-required-aria-props': 'error',
    'jsx-a11y/role-supports-aria-props': 'error',
    'jsx-a11y/scope': 'error',

    // Security
    'security/detect-object-injection': 'warn',
    'security/detect-non-literal-regexp': 'warn',
    'security/detect-unsafe-regex': 'error',
    'security/detect-buffer-noassert': 'error',
    'security/detect-child-process': 'warn',
    'security/detect-disable-mustache-escape': 'error',
    'security/detect-eval-with-expression': 'error',
    'security/detect-no-csrf-before-method-override': 'error',
    'security/detect-non-literal-fs-filename': 'warn',
    'security/detect-non-literal-require': 'warn',
    'security/detect-possible-timing-attacks': 'warn',
    'security/detect-pseudoRandomBytes': 'error',

    // General
    'no-console': process.env.NODE_ENV === 'production' ? 'warn' : 'off',
    'no-debugger': process.env.NODE_ENV === 'production' ? 'error' : 'off',
    'no-alert': process.env.NODE_ENV === 'production' ? 'error' : 'off',
    'no-var': 'error',
    'prefer-const': 'error',
    'no-unused-vars': 'off', // Use TypeScript version
    'no-undef': 'off', // TypeScript handles this
    'no-redeclare': 'off', // TypeScript handles this
    'no-shadow': 'off', // TypeScript handles this
    'no-use-before-define': 'off', // TypeScript handles this
    'no-unreachable': 'error',
    'no-constant-condition': 'error',
    'no-dupe-args': 'error',
    'no-dupe-keys': 'error',
    'no-dupe-else-if': 'error',
    'no-duplicate-case': 'error',
    'no-empty': 'error',
    'no-extra-boolean-cast': 'error',
    'no-extra-semi': 'error',
    'no-func-assign': 'error',
    'no-import-assign': 'error',
    'no-inner-declarations': 'error',
    'no-invalid-regexp': 'error',
    'no-irregular-whitespace': 'error',
    'no-loss-of-precision': 'error',
    'no-misleading-character-class': 'error',
    'no-mixed-spaces-and-tabs': 'error',
    'no-new-symbol': 'error',
    'no-obj-calls': 'error',
    'no-octal': 'error',
    'no-prototype-builtins': 'error',
    'no-regex-spaces': 'error',
    'no-self-assign': 'error',
    'no-setter-return': 'error',
    'no-sparse-arrays': 'error',
    'no-this-before-super': 'error',
    'no-undef': 'error',
    'no-unexpected-multiline': 'error',
    'no-unreachable': 'error',
    'no-unsafe-finally': 'error',
    'no-unsafe-negation': 'error',
    'no-unsafe-optional-chaining': 'error',
    'no-useless-backreference': 'error',
    'require-yield': 'error',
    'use-isnan': 'error',
    'valid-typeof': 'error',

    // Best practices
    'array-callback-return': 'error',
    'block-scoped-var': 'error',
    'class-methods-use-this': 'warn',
    'complexity': ['warn', 10],
    'consistent-return': 'error',
    'curly': 'error',
    'default-case': 'error',
    'default-case-last': 'error',
    'dot-notation': 'error',
    'eqeqeq': 'error',
    'grouped-accessor-pairs': 'error',
    'guard-for-in': 'error',
    'max-classes-per-file': ['warn', 1],
    'no-caller': 'error',
    'no-case-declarations': 'error',
    'no-constructor-return': 'error',
    'no-div-regex': 'error',
    'no-else-return': 'error',
    'no-empty-function': 'error',
    'no-empty-pattern': 'error',
    'no-eval': 'error',
    'no-extend-native': 'error',
    'no-extra-bind': 'error',
    'no-extra-label': 'error',
    'no-fallthrough': 'error',
    'no-floating-decimal': 'error',
    'no-global-assign': 'error',
    'no-implicit-coercion': 'error',
    'no-implicit-globals': 'error',
    'no-implied-eval': 'error',
    'no-invalid-this': 'error',
    'no-iterator': 'error',
    'no-labels': 'error',
    'no-lone-blocks': 'error',
    'no-loop-func': 'error',
    'no-magic-numbers': 'off', // Allow magic numbers for healthcare data
    'no-multi-spaces': 'error',
    'no-multi-str': 'error',
    'no-new': 'error',
    'no-new-func': 'error',
    'no-new-wrappers': 'error',
    'no-octal-escape': 'error',
    'no-param-reassign': 'error',
    'no-proto': 'error',
    'no-return-assign': 'error',
    'no-return-await': 'error',
    'no-script-url': 'error',
    'no-self-compare': 'error',
    'no-sequences': 'error',
    'no-throw-literal': 'error',
    'no-unmodified-loop-condition': 'error',
    'no-unused-expressions': 'error',
    'no-unused-labels': 'error',
    'no-useless-call': 'error',
    'no-useless-catch': 'error',
    'no-useless-concat': 'error',
    'no-useless-escape': 'error',
    'no-useless-return': 'error',
    'no-void': 'error',
    'no-warning-comments': 'warn',
    'no-with': 'error',
    'prefer-named-capture-group': 'error',
    'prefer-promise-reject-errors': 'error',
    'radix': 'error',
    'require-await': 'error',
    'require-unicode-regexp': 'error',
    'vars-on-top': 'error',
    'wrap-iife': 'error',
    'yoda': 'error',

    // Variables
    'init-declarations': 'off',
    'no-delete-var': 'error',
    'no-label-var': 'error',
    'no-restricted-globals': 'error',
    'no-shadow-restricted-names': 'error',
    'no-undef-init': 'error',
    'no-undefined': 'off',
    'no-unused-vars': 'off', // Use TypeScript version
    'no-use-before-define': 'off', // TypeScript handles this

    // Node.js specific
    'callback-return': 'error',
    'global-require': 'error',
    'handle-callback-err': 'error',
    'no-buffer-constructor': 'error',
    'no-mixed-requires': 'error',
    'no-new-require': 'error',
    'no-path-concat': 'error',
    'no-process-env': 'off', // Allow process.env for configuration
    'no-process-exit': 'error',
    'no-restricted-modules': 'off',
    'no-sync': 'warn',

    // Stylistic
    'array-bracket-newline': 'off', // Prettier handles this
    'array-bracket-spacing': 'off', // Prettier handles this
    'array-element-newline': 'off', // Prettier handles this
    'block-spacing': 'off', // Prettier handles this
    'brace-style': 'off', // Prettier handles this
    'camelcase': 'error',
    'capitalized-comments': 'off',
    'comma-dangle': 'off', // Prettier handles this
    'comma-spacing': 'off', // Prettier handles this
    'comma-style': 'off', // Prettier handles this
    'computed-property-spacing': 'off', // Prettier handles this
    'consistent-this': 'error',
    'eol-last': 'off', // Prettier handles this
    'func-call-spacing': 'off', // Prettier handles this
    'func-name-matching': 'error',
    'func-names': 'off',
    'func-style': 'off',
    'function-paren-newline': 'off', // Prettier handles this
    'id-blacklist': 'off',
    'id-length': 'off',
    'id-match': 'off',
    'implicit-arrow-linebreak': 'off', // Prettier handles this
    'indent': 'off', // Prettier handles this
    'jsx-quotes': 'off', // Prettier handles this
    'key-spacing': 'off', // Prettier handles this
    'keyword-spacing': 'off', // Prettier handles this
    'line-comment-position': 'off',
    'linebreak-style': 'off',
    'lines-around-comment': 'off',
    'lines-between-class-members': 'error',
    'max-depth': 'off',
    'max-len': 'off', // Prettier handles this
    'max-lines': 'off',
    'max-lines-per-function': 'off',
    'max-nested-callbacks': 'off',
    'max-params': 'off',
    'max-statements': 'off',
    'max-statements-per-line': 'off',
    'multiline-comment-style': 'off',
    'multiline-ternary': 'off', // Prettier handles this
    'new-cap': 'error',
    'new-parens': 'off', // Prettier handles this
    'newline-per-chained-call': 'off',
    'no-array-constructor': 'error',
    'no-bitwise': 'off',
    'no-continue': 'off',
    'no-inline-comments': 'off',
    'no-lonely-if': 'error',
    'no-mixed-operators': 'off', // Prettier handles this
    'no-multi-assign': 'error',
    'no-multiple-empty-lines': 'off', // Prettier handles this
    'no-negated-condition': 'off',
    'no-nested-ternary': 'error',
    'no-new-object': 'error',
    'no-plusplus': 'off',
    'no-restricted-syntax': 'off',
    'no-tabs': 'off', // Prettier handles this
    'no-ternary': 'off',
    'no-trailing-spaces': 'off', // Prettier handles this
    'no-underscore-dangle': 'off',
    'no-unneeded-ternary': 'error',
    'no-whitespace-before-property': 'off', // Prettier handles this
    'nonblock-statement-body-position': 'off', // Prettier handles this
    'object-curly-newline': 'off', // Prettier handles this
    'object-curly-spacing': 'off', // Prettier handles this
    'object-property-newline': 'off', // Prettier handles this
    'one-var': 'off',
    'one-var-declaration-per-line': 'off', // Prettier handles this
    'operator-assignment': 'error',
    'operator-linebreak': 'off', // Prettier handles this
    'padded-blocks': 'off', // Prettier handles this
    'padding-line-between-statements': 'off',
    'prefer-exponentiation-operator': 'error',
    'prefer-object-spread': 'error',
    'quote-props': 'off', // Prettier handles this
    'quotes': 'off', // Prettier handles this
    'semi': 'off', // Prettier handles this
    'semi-spacing': 'off', // Prettier handles this
    'semi-style': 'off', // Prettier handles this
    'sort-keys': 'off',
    'sort-vars': 'off',
    'space-before-blocks': 'off', // Prettier handles this
    'space-before-function-paren': 'off', // Prettier handles this
    'space-in-parens': 'off', // Prettier handles this
    'space-infix-ops': 'off', // Prettier handles this
    'space-unary-ops': 'off', // Prettier handles this
    'spaced-comment': 'off',
    'switch-colon-spacing': 'off', // Prettier handles this
    'template-tag-spacing': 'off', // Prettier handles this
    'unicode-bom': 'off',
    'wrap-regex': 'off',
  },
  overrides: [
    {
      files: ['**/*.test.js', '**/*.test.ts', '**/*.test.jsx', '**/*.test.tsx'],
      env: {
        jest: true,
      },
      rules: {
        'no-console': 'off',
        '@typescript-eslint/no-explicit-any': 'off',
      },
    },
    {
      files: ['**/*.config.js', '**/*.config.ts'],
      rules: {
        'no-console': 'off',
        '@typescript-eslint/no-var-requires': 'off',
      },
    },
  ],
};