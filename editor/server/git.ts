// Conexión con GitHub. Git se ejecuta sin shell y con argumentos fijos, y solo publica las
// carpetas de contenido: el editor no puede alterar el código del sitio por accidente.
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { UserError } from "./errors.ts";

const run = promisify(execFile);

/** Lo único que el editor puede modificar y publicar. */
export const CONTENT_PATHS = ["content", "public/products"];
export const BRANCH = "main";

export type GitStatus = {
  connected: boolean;
  branch: string | null;
  /** Archivos de contenido con cambios todavía sin publicar. */
  pendingChanges: number;
};

export function createGit(root: string) {
  async function git(args: string[], timeout = 120_000) {
    const { stdout } = await run("git", args, {
      cwd: root,
      timeout,
      // Si faltan credenciales, falla en vez de quedarse esperando una respuesta invisible.
      env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
    });
    return stdout.trim();
  }

  /** Igual que `git`, pero devuelve `null` si el comando falla. */
  const tryGit = (args: string[]) => git(args).catch(() => null);

  async function status(): Promise<GitStatus> {
    const branch = await tryGit(["rev-parse", "--abbrev-ref", "HEAD"]);
    const remote = await tryGit(["remote", "get-url", "origin"]);
    const changes = await tryGit(["status", "--porcelain", "--untracked-files=all", "--", ...CONTENT_PATHS]);
    return {
      connected: Boolean(branch && remote),
      branch,
      pendingChanges: changes ? changes.split("\n").length : 0,
    };
  }

  async function assertReady() {
    const current = await status();
    if (!current.connected) {
      throw new UserError("Esta carpeta no está conectada a GitHub. Revisa la guía de instalación.");
    }
    if (current.branch !== BRANCH) {
      throw new UserError(`El proyecto está en la rama ${current.branch}. Cambia a ${BRANCH} para continuar.`);
    }
    return current;
  }

  /** Trae lo último de GitHub. Solo avanza si no hay nada que mezclar. */
  async function update() {
    const current = await assertReady();
    if (current.pendingChanges > 0) {
      throw new UserError("Tienes cambios sin publicar. Publícalos o descártalos antes de actualizar.");
    }
    const before = await git(["rev-parse", "HEAD"]);
    try {
      await git(["pull", "--ff-only", "origin", BRANCH]);
    } catch {
      throw new UserError("No se pudo actualizar desde GitHub. Revisa tu internet e intenta de nuevo.");
    }
    return { changed: before !== (await git(["rev-parse", "HEAD"])) };
  }

  /** Guarda el contenido en un commit y lo envía; GitHub Actions hace el despliegue. */
  async function publish(summary: string) {
    await assertReady();

    await git(["add", "--", ...CONTENT_PATHS]);
    const hasChanges = await git(["diff", "--cached", "--quiet", "--", ...CONTENT_PATHS]).then(
      () => false,
      () => true,
    );
    if (hasChanges) await git(["commit", "-m", summary, "--", ...CONTENT_PATHS]);

    try {
      // Incorpora lo publicado por otra persona antes de enviar. `--autostash` aparta
      // cualquier cambio ajeno al contenido para que no bloquee la operación.
      await git(["pull", "--rebase", "--autostash", "origin", BRANCH]);
    } catch {
      await tryGit(["rebase", "--abort"]);
      throw new UserError("Tus cambios chocan con otros más recientes en GitHub. Pide ayuda antes de seguir.");
    }

    const ahead = await git(["rev-list", "--count", `origin/${BRANCH}..HEAD`]);
    if (ahead === "0") return { published: false, sha: await git(["rev-parse", "HEAD"]) };

    try {
      await git(["push", "origin", BRANCH]);
    } catch {
      throw new UserError("GitHub rechazó el envío. Revisa tu internet y tu sesión de GitHub.");
    }
    return { published: true, sha: await git(["rev-parse", "HEAD"]) };
  }

  /** Vuelve a la última versión publicada. Solo afecta a las carpetas de contenido. */
  async function discard() {
    await assertReady();
    await git(["restore", "--staged", "--worktree", "--source=HEAD", "--", ...CONTENT_PATHS]);
    await git(["clean", "-fd", "--", ...CONTENT_PATHS]);
  }

  return { status, update, publish, discard };
}

export type Git = ReturnType<typeof createGit>;
