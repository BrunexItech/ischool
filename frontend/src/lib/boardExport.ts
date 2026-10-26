import type { ResultsBoard } from "@/lib/api";

/** Level colours shared by the on-screen board and both downloads. */
export const LEVEL_HEX = [
  { fill: "D1FAE5", text: "065F46" },
  { fill: "E0F2FE", text: "075985" },
  { fill: "FEF3C7", text: "92400E" },
  { fill: "FFE4E6", text: "9F1239" },
];

function levelIndex(board: ResultsBoard, code: string | null) {
  const i = board.bands.findIndex((b) => b.level_code === code);
  return i < 0 ? -1 : i % LEVEL_HEX.length;
}

function fileBase(board: ResultsBoard) {
  const safe = `${board.class_name}-${board.term}`.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "");
  return `class-results-${safe}`;
}

function compiledFrom(board: ResultsBoard) {
  return board.selected_exam_types.length ? board.selected_exam_types.join(", ") : "All exams (average)";
}

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

function fmt(n: number | null) {
  return n === null ? "" : Number(n.toFixed(1));
}

export async function downloadBoardXlsx(board: ResultsBoard) {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Class results");
  const header = ["Pos", "Adm. no.", "Learner", ...board.subjects.map((s) => s.name), "Total", "Average", "Level"];
  const width = header.length;

  ws.addRow([`Milai Group of Schools — ${board.class_name} class results`]).font = { bold: true, size: 14 };
  ws.addRow([`${board.term} · Compiled from: ${compiledFrom(board)}`]);
  ws.addRow([`Class average: ${board.class_average ?? "—"} · Learners: ${board.students.length}`]);
  ws.addRow([]);
  const head = ws.addRow(header);
  head.font = { bold: true, color: { argb: "FFFFFFFF" } };
  head.eachCell((c) => {
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF8B1A1D" } };
    c.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
  });

  for (const s of board.students) {
    const row = ws.addRow([
      s.rank ?? "",
      s.admission_number,
      s.name,
      ...board.subjects.map((sub) => fmt(s.scores[sub.id] ?? null)),
      fmt(s.subjects_marked ? s.total : null),
      fmt(s.average),
      s.level ?? "",
    ]);
    board.subjects.forEach((sub, i) => {
      const idx = levelIndex(board, s.levels[sub.id] ?? null);
      if (idx >= 0) {
        const cell = row.getCell(4 + i);
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${LEVEL_HEX[idx].fill}` } };
        cell.font = { color: { argb: `FF${LEVEL_HEX[idx].text}` } };
      }
      row.getCell(4 + i).alignment = { horizontal: "center" };
    });
    row.getCell(1).alignment = { horizontal: "center" };
    row.getCell(width).alignment = { horizontal: "center" };
  }

  ws.addRow([]);
  ws.addRow(["Key: " + board.bands.map((b) => `${b.level_code} = ${b.label} (${b.min_score}-${b.max_score})`).join("   ")]);
  ws.getColumn(1).width = 6;
  ws.getColumn(2).width = 14;
  ws.getColumn(3).width = 28;
  for (let c = 4; c <= width; c++) ws.getColumn(c).width = 13;
  ws.views = [{ state: "frozen", xSplit: 3, ySplit: 5 }];

  const buffer = await wb.xlsx.writeBuffer();
  save(new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), `${fileBase(board)}.xlsx`);
}

async function logoPng(): Promise<{ data: string; w: number; h: number } | null> {
  try {
    const img = new Image();
    img.src = "/Milai-School-Logo.svg";
    await img.decode();
    const scale = 4;
    const canvas = document.createElement("canvas");
    canvas.width = 224 * scale;
    canvas.height = 100 * scale;
    canvas.getContext("2d")?.drawImage(img, 0, 0, canvas.width, canvas.height);
    return { data: canvas.toDataURL("image/png"), w: 224, h: 100 };
  } catch {
    return null;
  }
}

export async function downloadBoardPdf(board: ResultsBoard) {
  const { jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 28;

  const logo = await logoPng();
  let y = margin;
  if (logo) {
    const h = 42;
    doc.addImage(logo.data, "PNG", margin, y, (logo.w / logo.h) * h, h);
  }
  doc.setFont("helvetica", "bold").setFontSize(15).setTextColor(139, 26, 29);
  doc.text(`${board.class_name} - Class results`, pageW - margin, y + 16, { align: "right" });
  doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(60);
  doc.text(`${board.term}  |  Compiled from: ${compiledFrom(board)}`, pageW - margin, y + 31, { align: "right" });
  doc.text(`Learners: ${board.students.length}  |  Class average: ${board.class_average ?? "-"}`, pageW - margin, y + 43, { align: "right" });
  y += 56;

  const head = ["Pos", "Learner", ...board.subjects.map((s) => s.name), "Total", "Avg", "Level"];
  const body = board.students.map((s) => [
    s.rank ?? "-",
    `${s.name}\n${s.admission_number}`,
    ...board.subjects.map((sub) => {
      const v = s.scores[sub.id];
      return v === null || v === undefined ? "-" : `${fmt(v)}${s.levels[sub.id] ? `  ${s.levels[sub.id]}` : ""}`;
    }),
    s.subjects_marked ? fmt(s.total) : "-",
    s.average === null ? "-" : fmt(s.average),
    s.level ?? "-",
  ]);

  autoTable(doc, {
    startY: y,
    head: [head],
    body,
    margin: { left: margin, right: margin },
    styles: { fontSize: 8, cellPadding: 4, halign: "center", valign: "middle", lineColor: [220, 220, 220], lineWidth: 0.4 },
    headStyles: { fillColor: [139, 26, 29], textColor: 255, fontStyle: "bold" },
    columnStyles: { 1: { halign: "left", cellWidth: 110 } },
    didParseCell: (data) => {
      if (data.section !== "body") return;
      const student = board.students[data.row.index];
      const subIndex = data.column.index - 2;
      let code: string | null = null;
      if (subIndex >= 0 && subIndex < board.subjects.length) code = student.levels[board.subjects[subIndex].id] ?? null;
      else if (data.column.index === head.length - 1) code = student.level;
      const idx = levelIndex(board, code);
      if (idx >= 0) {
        const hex = LEVEL_HEX[idx];
        data.cell.styles.fillColor = [parseInt(hex.fill.slice(0, 2), 16), parseInt(hex.fill.slice(2, 4), 16), parseInt(hex.fill.slice(4, 6), 16)];
        data.cell.styles.textColor = [parseInt(hex.text.slice(0, 2), 16), parseInt(hex.text.slice(2, 4), 16), parseInt(hex.text.slice(4, 6), 16)];
      }
    },
    didDrawPage: () => {
      doc.setFontSize(8).setTextColor(120);
      doc.text(
        "Key: " + board.bands.map((b) => `${b.level_code} = ${b.label} (${b.min_score}-${b.max_score})`).join("   "),
        margin,
        doc.internal.pageSize.getHeight() - 14
      );
    },
  });

  doc.save(`${fileBase(board)}.pdf`);
}
