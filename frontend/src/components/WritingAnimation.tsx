/** A static, closed book — properly rectangular (portrait), no animation. */
export function WritingAnimation() {
  return (
    <div className="relative mx-auto aspect-[3/4] w-36 sm:w-40">
      {/* page edges peeking out on the right, like a closed book */}
      <div className="absolute inset-y-[3%] right-[-4%] w-[92%] rounded-md bg-[#f3f1ea]" />
      <div className="absolute inset-y-[2%] right-[-6%] w-[90%] rounded-md bg-[#f7f5ef]" />

      {/* cover */}
      <div className="absolute inset-0 overflow-hidden rounded-md bg-primary shadow-[0_10px_24px_-6px_rgba(0,0,0,0.35)]">
        <div className="absolute inset-2 rounded border border-white/25" />
        {/* spine */}
        <div className="absolute inset-y-0 left-0 w-[14%] bg-black/10" />
        <div className="flex h-full flex-col items-center justify-center gap-1 px-4 text-center">
          <span className="text-sm font-semibold text-white">Milai School</span>
          <span className="text-[0.6rem] tracking-widest text-white/70 uppercase">Nurturing Today · Empowering Tomorrow</span>
        </div>
      </div>
    </div>
  );
}
