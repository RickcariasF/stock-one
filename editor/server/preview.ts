// Vista previa local. Ejecuta Next con el mismo Node (sin shell) y solo en 127.0.0.1.
import { spawn, type ChildProcess } from "node:child_process";
import { join } from "node:path";

const PORT = 4556;
const URL_PREVIEW = `http://127.0.0.1:${PORT}/`;

export function createPreview(root: string) {
  let child: ChildProcess | null = null;

  const isUp = () =>
    fetch(URL_PREVIEW, { signal: AbortSignal.timeout(5000) }).then(
      () => true,
      () => false,
    );

  /** Arranca el servidor una sola vez y espera a que responda. */
  async function start() {
    if (!child) {
      const bin = join(root, "node_modules", "next", "dist", "bin", "next");
      child = spawn(process.execPath, [bin, "dev", "--hostname", "127.0.0.1", "--port", String(PORT)], {
        cwd: root,
        stdio: "ignore",
      });
      child.once("exit", () => {
        child = null;
      });
    }
    for (let attempt = 0; attempt < 60; attempt += 1) {
      if (await isUp()) return URL_PREVIEW;
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    throw new Error("La vista previa no arrancó");
  }

  return { start, stop: () => child?.kill() };
}

export type Preview = ReturnType<typeof createPreview>;
