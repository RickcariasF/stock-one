import { site } from "@/lib/catalog";

export function SiteFooter() {
  return (
    <footer className="mt-20 bg-ink text-[#cccccc]">
      <div className="mx-auto flex max-w-7xl flex-col gap-1 px-4 py-10 sm:flex-row sm:justify-between sm:px-6">
        <p>Haces tu pedido por WhatsApp y te atendemos directamente.</p>
        <p>
          © {new Date().getFullYear()} {site.name}
        </p>
      </div>
    </footer>
  );
}
