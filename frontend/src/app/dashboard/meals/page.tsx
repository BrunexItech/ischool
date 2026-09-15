"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Trash2, UtensilsCrossed, ChevronLeft, ChevronRight } from "lucide-react";
import { api, ApiError, MealMenuEntry } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/PageHeader";
import { PageLoader, Spinner } from "@/components/Spinner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const MEAL_TYPES: MealMenuEntry["meal_type"][] = ["breakfast", "lunch", "snack"];

function startOfWeek(d: Date) {
  const date = new Date(d);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day; // Monday as the first day
  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

function toISODate(d: Date) {
  return d.toISOString().slice(0, 10);
}

export default function MealsPage() {
  const router = useRouter();
  const { user, token, loading } = useAuth();
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [entries, setEntries] = useState<MealMenuEntry[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [form, setForm] = useState({ date: "", meal_type: "lunch" as MealMenuEntry["meal_type"], description: "" });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && user && !["school_admin", "staff", "super_admin"].includes(user.role)) router.replace("/dashboard");
  }, [loading, user, router]);

  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d;
  });

  useEffect(() => {
    if (!token || !user?.school_id) return;
    api
      .listMealMenu(token, user.school_id, toISODate(weekDays[0]), toISODate(weekDays[6]))
      .then(setEntries)
      .catch(() => setEntries([]))
      .finally(() => setDataLoading(false));
  }, [token, user?.school_id, weekStart]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !user?.school_id || !form.date) return;
    setSubmitting(true);
    try {
      const created = await api.createMealMenuEntry(token, user.school_id, form);
      setEntries((e) => [...e, created]);
      setForm({ date: "", meal_type: "lunch", description: "" });
      toast.success("Menu entry added");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to add menu entry");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: number) {
    if (!token || !user?.school_id) return;
    try {
      await api.deleteMealMenuEntry(token, user.school_id, id);
      setEntries((e) => e.filter((entry) => entry.id !== id));
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to delete menu entry");
    }
  }

  function entryFor(date: Date, mealType: MealMenuEntry["meal_type"]) {
    const iso = toISODate(date);
    return entries.find((e) => e.date === iso && e.meal_type === mealType);
  }

  if (loading) return <PageLoader />;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Meals" description="Plan the weekly breakfast, lunch, and snack menu." />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><Plus className="size-4.5" /> Add a menu entry</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3">
            <div className="grid gap-1.5">
              <Label>Date</Label>
              <Input required type="date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} className="w-40" />
            </div>
            <div className="grid gap-1.5">
              <Label>Meal</Label>
              <Select value={form.meal_type} onValueChange={(v) => v && setForm((f) => ({ ...f, meal_type: v as MealMenuEntry["meal_type"] }))}>
                <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MEAL_TYPES.map((t) => <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid flex-1 gap-1.5">
              <Label>What&apos;s being served</Label>
              <Input required placeholder="e.g. Rice, beans, and steamed vegetables" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
            </div>
            <Button type="submit" disabled={submitting}>
              {submitting && <Spinner size={16} className="text-current" />} {submitting ? "Adding..." : "Add"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <UtensilsCrossed className="size-4.5" /> Week of {weekDays[0].toLocaleDateString(undefined, { month: "short", day: "numeric" })}
          </CardTitle>
          <div className="flex gap-1.5">
            <Button variant="outline" size="icon-sm" onClick={() => setWeekStart((d) => { const n = new Date(d); n.setDate(n.getDate() - 7); return n; })}>
              <ChevronLeft />
            </Button>
            <Button variant="outline" size="icon-sm" onClick={() => setWeekStart((d) => { const n = new Date(d); n.setDate(n.getDate() + 7); return n; })}>
              <ChevronRight />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {dataLoading ? (
            <PageLoader />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {weekDays.map((day) => (
                <div key={toISODate(day)} className="rounded-lg border p-3">
                  <p className="mb-2 text-sm font-medium">{day.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })}</p>
                  <div className="flex flex-col gap-2">
                    {MEAL_TYPES.map((mealType) => {
                      const entry = entryFor(day, mealType);
                      return (
                        <div key={mealType} className="flex items-start justify-between gap-2 text-sm">
                          <div>
                            <Badge variant="outline" className="mb-1 capitalize">{mealType}</Badge>
                            <p className="text-muted-foreground">{entry?.description ?? "Not set"}</p>
                          </div>
                          {entry && (
                            <Button variant="ghost" size="icon-xs" onClick={() => handleDelete(entry.id)}>
                              <Trash2 />
                            </Button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
