import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";

export default function NotFound() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
        <div className="max-w-xl rounded bg-surface-light px-7 py-8">
          <h1 className="condensed text-4xl font-extrabold uppercase">Esta página no existe</h1>
          <p className="mt-2">El producto pudo haberse retirado o el enlace está incompleto.</p>
          <Link href="/" className="mt-4 inline-block font-semibold underline underline-offset-4">
            Ir al catálogo
          </Link>
        </div>
      </main>
    </>
  );
}
