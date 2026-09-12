"use client";

import { useState } from "react";
import { toast } from "sonner";
import { KeyRound } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

export function ResetPasswordDialog({ userId, label }: { userId: number; label: string }) {
  const { token, user } = useAuth();
  const [open, setOpen] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !user?.school_id) return;
    setSubmitting(true);
    try {
      await api.adminResetPassword(token, user.school_id, userId, newPassword);
      toast.success(`Password reset for ${label} — they'll be asked to set a new one at next login`);
      setOpen(false);
      setNewPassword("");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to reset password");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm"><KeyRound /> Reset password</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reset password for {label}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex items-end gap-2">
          <Input required type="password" minLength={8} placeholder="New temporary password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
          <Button type="submit" disabled={submitting}>{submitting ? "Resetting..." : "Reset"}</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
