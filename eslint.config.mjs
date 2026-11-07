import next from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const config = [
  { ignores: [".next/**", "out/**", ".wrangler/**", "next-env.d.ts"] },
  ...next,
  ...nextTs,
  {
    rules: {
      // Las imágenes ya vienen optimizadas por el editor y usan srcset propio.
      "@next/next/no-img-element": "off",
    },
  },
];

export default config;
