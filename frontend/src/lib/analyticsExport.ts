import type { Insights } from "@/lib/api";

function save(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const fileName = (i: Insights, ext: string) => `analytics-${i.term.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "")}.${ext}`;
const REASON: Record<string, string> = { teacher_absent: "Teacher away", public_holiday: "Public holiday", exams: "Exams", school_event: "School event", other: "Other" };

function sections(i: Insights, scopeLabel: string) {
  const sc = i.scorecard;
  return {
    scorecard: [
      ["Measure", "This term", "Previous term"],
      ["School average", sc.average.value ?? "", sc.average.previous ?? ""],
      ["Attendance rate (%)", sc.attendance_rate.value ?? "", sc.attendance_rate.previous ?? ""],
      ["Syllabus covered (topics)", `${sc.coverage.completed} of ${sc.coverage.total}`, sc.coverage.expected !== null ? `${sc.coverage.expected} expected by now` : ""],
      ["Learners below expectation", sc.below_expectation ?? "", sc.below_expectation_previous ?? ""],
    ] as (string | number)[][],
    dropped: [["Learner", "Class", "Average", "Previous", "Fall"], ...i.attention.dropped_learners.map((d) => [d.name, d.class_name, d.average, d.previous, d.drop])] as (string | number)[][],
    absent: [["Learner", "Class", "Days absent in a row", "Since"], ...i.attention.absence_streaks.map((d) => [d.name, d.class_name, d.days, d.since])] as (string | number)[][],
    weak: [["Class", "Subject", "Average", "Previous"], ...i.attention.weak_subjects.map((w) => [w.class_name, w.subject_name, w.average, w.previous ?? ""])] as (string | number)[][],
    behind: [["Teacher", "Class", "Subject", "Covered", "Expected", "Behind by"], ...i.attention.behind_teachers.map((b) => [b.teacher_name, b.class_name, b.subject_name, b.completed, b.expected, b.behind])] as (string | number)[][],
    exams: [["Exam type", "Average", "Marks"], ...i.exam_types.map((e) => [e.exam_type, e.average, e.count])] as (string | number)[][],
    classes: [["Class", "Average", "Learners"], ...i.classes.map((c) => [c.class_name, c.average, c.count])] as (string | number)[][],
    levels: [["Subject", ...i.bands.map((b) => b.level_code), "Learners"], ...i.levels.map((l) => [l.subject, ...i.bands.map((b) => l.counts[b.level_code] ?? 0), l.total])] as (string | number)[][],
    delivery: [["Taught", "Partly", "Not taught", ...Object.keys(i.delivery.reasons).map((r) => `Missed: ${REASON[r] ?? r}`)], [i.delivery.taught, i.delivery.partly, i.delivery.not_taught, ...Object.values(i.delivery.reasons)]] as (string | number)[][],
    scope: scopeLabel,
  };
}

export async function downloadInsightsXlsx(i: Insights, scopeLabel: string) {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  const s = sections(i, scopeLabel);
  const add = (name: string, blocks: { title: string; rows: (string | number)[][] }[]) => {
    const ws = wb.addWorksheet(name);
    ws.addRow([`Milai Group of Schools — ${i.term} · ${scopeLabel}`]).font = { bold: true, size: 13 };
    ws.addRow([]);
    for (const b of blocks) {
      ws.addRow([b.title]).font = { bold: true };
      const head = ws.addRow(b.rows[0]);
      head.font = { bold: true, color: { argb: "FFFFFFFF" } };
      head.eachCell((c) => (c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF8B1A1D" } }));
      for (const r of b.rows.slice(1)) ws.addRow(r);
      if (b.rows.length === 1) ws.addRow(["Nothing to report"]);
      ws.addRow([]);
    }
    ws.columns.forEach((c) => (c.width = 24));
  };
  add("Scorecard", [{ title: "Scorecard", rows: s.scorecard }]);
  add("Needs attention", [
    { title: "Learners whose marks fell", rows: s.dropped },
    { title: "Absent three or more days in a row", rows: s.absent },
    { title: "Subjects needing support", rows: s.weak },
    { title: "Behind on the syllabus", rows: s.behind },
  ]);
  add("Comparisons", [
    { title: "Average by exam type", rows: s.exams },
    { title: "Average by class", rows: s.classes },
    { title: "Learners at each performance level", rows: s.levels },
    { title: "Teaching delivery", rows: s.delivery },
  ]);
  const buffer = await wb.xlsx.writeBuffer();
  save(new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), fileName(i, "xlsx"));
}

async function logoPng(): Promise<{ data: string; w: number; h: number } | null> {
  try {
    const img = new Image();
    img.src = "/Milai-School-Logo.svg";
    await img.decode();
    const canvas = document.createElement("canvas");
    canvas.width = 896;
    canvas.height = 400;
    canvas.getContext("2d")?.drawImage(img, 0, 0, 896, 400);
    return { data: canvas.toDataURL("image/png"), w: 224, h: 100 };
  } catch {
    return null;
  }
}

export async function downloadInsightsPdf(i: Insights, scopeLabel: string) {
  const { jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const margin = 36;
  const pageW = doc.internal.pageSize.getWidth();
  const s = sections(i, scopeLabel);
  const logo = await logoPng();
  if (logo) doc.addImage(logo.data, "PNG", margin, 28, (logo.w / logo.h) * 40, 40);
  doc.setFont("helvetica", "bold").setFontSize(15).setTextColor(139, 26, 29);
  doc.text("Analytics summary", pageW - margin, 46, { align: "right" });
  doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(60);
  doc.text(`${i.term}  |  ${scopeLabel}`, pageW - margin, 60, { align: "right" });

  let y = 88;
  const block = (title: string, rows: (string | number)[][]) => {
    doc.setFont("helvetica", "bold").setFontSize(11).setTextColor(30);
    doc.text(title, margin, y);
    autoTable(doc, {
      startY: y + 6,
      head: [rows[0]],
      body: rows.length > 1 ? rows.slice(1) : [["Nothing to report"]],
      margin: { left: margin, right: margin },
      styles: { fontSize: 8.5, cellPadding: 4 },
      headStyles: { fillColor: [139, 26, 29], textColor: 255 },
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    y = (doc as any).lastAutoTable.finalY + 18;
    if (y > 740) {
      doc.addPage();
      y = 48;
    }
  };
  block("Scorecard", s.scorecard);
  block("Learners whose marks fell", s.dropped);
  block("Absent three or more days in a row", s.absent);
  block("Subjects needing support", s.weak);
  block("Behind on the syllabus", s.behind);
  block("Average by exam type", s.exams);
  block("Average by class", s.classes);
  block("Learners at each performance level", s.levels);
  block("Teaching delivery", s.delivery);
  doc.save(fileName(i, "pdf"));
}
