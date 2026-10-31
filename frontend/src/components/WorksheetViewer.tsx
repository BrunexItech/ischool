"use client";

import { useState } from "react";
import { Download, ExternalLink, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

/** A homework sheet or paper, opened right where the learner is: read it on the page, or open or download it. */
export function WorksheetViewer({ url, title, label = "View worksheet", size = "default" }: { url: string; title: string; label?: string; size?: "default" | "sm" }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="outline" size={size} className="h-10 gap-1.5" onClick={() => setOpen(true)}><FileText /> {label}</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="flex h-[88vh] max-w-4xl flex-col gap-3 sm:max-w-4xl">
          <DialogHeader><DialogTitle className="pr-8 break-words">{title}</DialogTitle></DialogHeader>
          <div className="min-h-0 flex-1 overflow-hidden rounded-xl border bg-muted/30">
            <iframe src={url} title={title} className="size-full" />
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button variant="outline" className="h-10 gap-1.5" render={<a href={url} target="_blank" rel="noreferrer"><ExternalLink /> Open in a new tab</a>} nativeButton={false} />
            <Button className="h-10 gap-1.5" render={<a href={url} download target="_blank" rel="noreferrer"><Download /> Download</a>} nativeButton={false} />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
