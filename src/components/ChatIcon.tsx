/** Icono genérico de chat; decorativo porque el botón ya dice qué hace. */
export function ChatIcon({ className = "size-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
      <path d="M12 3C6.9 3 3 6.6 3 11.1c0 2.3 1 4.3 2.7 5.8-.1 1.2-.6 2.5-1.3 3.4-.2.3 0 .7.4.6 1.8-.3 3.3-1 4.5-1.9 1 .3 1.9.4 2.7.4 5.1 0 9-3.6 9-8S17.1 3 12 3Z" />
    </svg>
  );
}
