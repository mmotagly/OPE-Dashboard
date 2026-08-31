import next from "eslint-config-next";
import nextTypescript from "eslint-config-next/typescript";
import nextCoreWebVitals from "eslint-config-next/core-web-vitals";

/** @type {import("eslint").Linter.Config[]} */
const config = [
  {
    // bridge/ is a separate standalone Node service (ROADMAP_NEXT.md item
    // 3), not part of this Next.js app — it has its own package.json/
    // tsconfig and its own lint/build, run from inside that directory.
    ignores: [".next/**", "node_modules/**", "next-env.d.ts", "bridge/**"],
  },
  ...next,
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    rules: {
      // Supabase rows are only as typed as the generated schema; a handful of
      // row mappers narrow `any` by hand and say so at the call site.
      "@typescript-eslint/no-explicit-any": "warn",
      // Server Actions used with useActionState must accept `prevState` and
      // `formData` whether or not they read them; `_name` marks that.
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
    },
  },
];

export default config;
