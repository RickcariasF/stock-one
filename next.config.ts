import type { NextConfig } from "next";

const config: NextConfig = {
  // Exporta HTML/CSS/JS puros a `out/`: en producción no corre ningún servidor.
  output: "export",
  // Genera /producto/x/index.html, la forma natural de servir archivos estáticos.
  trailingSlash: true,
  // No revela la tecnología usada en las respuestas.
  poweredByHeader: false,
  reactStrictMode: true,
};

export default config;
