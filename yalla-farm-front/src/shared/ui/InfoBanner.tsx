export function InfoBanner({ text }: { text: string }) {
  return (
    <div className="inline-flex items-center gap-1.5 xs:gap-2 rounded-full bg-amber-200 px-2.5 xs:px-3 sm:px-4 py-1.5 xs:py-2 text-[10px] xs:text-xs font-bold text-amber-900">
      <span>⚡</span>
      <span>{text}</span>
    </div>
  );
}
