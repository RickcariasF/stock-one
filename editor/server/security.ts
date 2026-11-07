// Defensas del editor. Aunque solo escucha en este equipo, cualquier página abierta en el
// navegador podría intentar hablarle a 127.0.0.1, así que cada petición se verifica.
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import type { MiddlewareHandler } from "hono";

export type GuardConfig = { port: number; token: string };

export const TOKEN_HEADER = "x-stock-one-token";

/** Token de sesión: nuevo en cada arranque y conocido solo por la pestaña que abrió el editor. */
export const createToken = () => randomBytes(32).toString("base64url");

/** Compara huellas de igual tamaño para no revelar el token por diferencias de tiempo. */
function sameToken(received: string | undefined, expected: string): boolean {
  if (!received) return false;
  const digest = (value: string) => createHash("sha256").update(value).digest();
  return timingSafeEqual(digest(received), digest(expected));
}

/** Devuelve el motivo del rechazo, o `null` si la petición es válida. */
export function rejectReason(
  request: {
    path: string;
    host?: string;
    origin?: string;
    fetchSite?: string;
    token?: string;
  },
  { port, token }: GuardConfig,
): string | null {
  const self = `127.0.0.1:${port}`;
  // DNS rebinding: un dominio externo apuntando a 127.0.0.1 llega con otro Host.
  if (request.host !== self) return "Host no permitido";
  // CSRF: otra página puede enviar peticiones, pero el navegador declara su origen real.
  if (request.origin && request.origin !== `http://${self}`) return "Origen no permitido";
  if (request.path.startsWith("/api/")) {
    if (request.fetchSite && request.fetchSite !== "same-origin") return "Sitio no permitido";
    if (!sameToken(request.token, token)) return "Token inválido";
  }
  return null;
}

export function guard(config: GuardConfig): MiddlewareHandler {
  return async (c, next) => {
    const reason = rejectReason(
      {
        path: c.req.path,
        host: c.req.header("host"),
        origin: c.req.header("origin"),
        fetchSite: c.req.header("sec-fetch-site"),
        token: c.req.header(TOKEN_HEADER),
      },
      config,
    );
    if (reason) return c.json({ error: reason }, 403);
    return next();
  };
}

const CSP = [
  "default-src 'none'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' blob:",
  "connect-src 'self'",
  "base-uri 'none'",
  "form-action 'none'",
  "frame-ancestors 'none'",
].join("; ");

/** Cabeceras para cada respuesta; `no-store` evita guardar datos del editor en caché. */
export const securityHeaders: MiddlewareHandler = async (c, next) => {
  await next();
  c.header("Content-Security-Policy", CSP);
  c.header("X-Content-Type-Options", "nosniff");
  c.header("Referrer-Policy", "no-referrer");
  c.header("Cross-Origin-Opener-Policy", "same-origin");
  c.header("Cross-Origin-Resource-Policy", "same-origin");
  c.header("Cache-Control", "no-store");
};
