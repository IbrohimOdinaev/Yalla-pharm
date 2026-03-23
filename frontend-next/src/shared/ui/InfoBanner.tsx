export function InfoBanner({ text }: { text: string }) {
  return (
    <div className="inline-flex items-center gap-2 rounded-full bg-amber-200 px-4 py-2 text-xs font-bold text-amber-900">
      <span>⚡</span>
      <span>{text}</span>
    </div>
  );
}
