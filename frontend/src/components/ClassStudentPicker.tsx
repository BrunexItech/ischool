"use client";

import { useState } from "react";
import { SchoolClass, Student } from "@/lib/api";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";

/** Picking a learner out of a whole-school list means scrolling or typing an
 * admission number from memory. Narrowing by class first, then a short name
 * list, means nobody ever has to type a student's name. */
export function ClassStudentPicker({
  classes,
  students,
  value,
  onChange,
  classLabel = "Class",
  studentLabel = "Student",
}: {
  classes: SchoolClass[];
  students: Student[];
  value: string;
  onChange: (studentId: string) => void;
  classLabel?: string;
  studentLabel?: string;
}) {
  const [classId, setClassId] = useState("");
  const inClass = classId ? students.filter((s) => s.class_id === Number(classId)) : [];

  return (
    <>
      <div className="grid gap-1.5">
        <Label>{classLabel}</Label>
        <Select
          value={classId}
          onValueChange={(v) => {
            if (!v) return;
            setClassId(v);
            onChange("");
          }}
        >
          <SelectTrigger className="w-full"><SelectValue placeholder="Choose a class" /></SelectTrigger>
          <SelectContent>
            {classes.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="grid gap-1.5">
        <Label>{studentLabel}</Label>
        <Select value={value} onValueChange={(v) => v && onChange(v)} disabled={!classId}>
          <SelectTrigger className="w-full"><SelectValue placeholder={classId ? "Choose a student" : "Pick a class first"} /></SelectTrigger>
          <SelectContent>
            {inClass.map((s) => <SelectItem key={s.id} value={String(s.id)}>{s.first_name} {s.last_name} ({s.admission_number})</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
    </>
  );
}
