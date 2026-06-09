import type { Linter } from 'eslint';

import { includeIgnoreFile } from '@eslint/compat';
import eslint from '@eslint/js';
import { defineConfig } from 'eslint/config';
import { existsSync } from 'node:fs';
import { join } from 'node:path/posix';
import process from 'node:process';
import tseslint from 'typescript-eslint';

function getGitIgnoreConfigs(): Linter.Config[] {
  const rootFolder = process.cwd().replaceAll('\\', '/');
  const gitignorePath = join(rootFolder, '.gitignore');
  if (!existsSync(gitignorePath)) {
    return [];
  }
  return [includeIgnoreFile(gitignorePath)];
}

export const configs = defineConfig(
  ...getGitIgnoreConfigs(),
  {
    ignores: [
      'commitlint.config.ts',
      'main.js',
      'styles.css',
      'node_modules/**',
      'scripts/commitlint-config.ts'
    ]
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    files: [
      '**/*.mts',
      '**/*.ts'
    ],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: process.cwd()
      }
    },
    rules: {
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
          varsIgnorePattern: '^_'
        }
      ],
      'no-console': [
        'error',
        {
          allow: [
            'error',
            'warn'
          ]
        }
      ]
    }
  },
  {
    files: [
      'scripts/**/*.ts',
      'vitest.config.ts'
    ],
    rules: {
      'no-console': 'off'
    }
  }
);
