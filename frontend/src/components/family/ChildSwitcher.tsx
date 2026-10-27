"use client";

import { useRouter } from "next/navigation";
import { FamilyChildCard } from "@/lib/api";
import { setActiveChildId } from "@/lib/family";
import { ChildAvatar } from "@/components/family/FamilyUi";

/** Pills to hop between children without going back to a list. */
export function ChildSwitcher({ cards, currentId }: { cards: FamilyChildCard[]; currentId: number }) {
  const router = useRouter();
  if (cards.length < 2) return null;
  return (
    <div className="flex flex-wrap items-center gap-2" role="tablist" aria-label="Switch child">
      <span className="mr-1 text-xs font-medium tracking-wide text-white/75 uppercase">Switch child</span>
      {cards.map((c, i) => {
        const on = c.student.id === currentId;
        return (
          <button
            key={c.student.id}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => { setActiveChildId(c.student.id); router.push(`/dashboard/children/${c.student.id}`); }}
            className={`flex h-10 items-center gap-2 rounded-full pr-4 pl-1 text-sm font-medium transition-colors ${on ? "bg-white text-[#7a1417]" : "bg-white/15 text-white hover:bg-white/25"}`}
          >
            <ChildAvatar first={c.student.first_name} last={c.student.last_name} index={i} size={32} />
            {c.student.first_name}
          </button>
        );
      })}
    </div>
  );
}
