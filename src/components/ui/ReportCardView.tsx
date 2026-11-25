import { jsPDF } from 'jspdf';
import { format } from 'date-fns';
import { Download, Printer, ShieldCheck, GraduationCap } from 'lucide-react';
import type { OfficialReportCardDetail } from '../../types';

export function downloadReportCardPdf(rc: OfficialReportCardDetail): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 16;
  const contentWidth = pageWidth - margin * 2;

  // Header Banner
  doc.setFillColor(81, 70, 216); // #5146D8
  doc.rect(0, 0, pageWidth, 30, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text('CAMPUSCORE — OFFICIAL ACADEMIC REPORT CARD', margin, 13);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(rc.college, margin, 20);
  doc.setFontSize(8.5);
  doc.text(`Report ID: ${rc.reportCode}   |   Version ${rc.publicationVersion}`, margin, 26);

  // Student & Academic Metadata Grid
  let y = 39;
  doc.setDrawColor(228, 229, 237);
  doc.setFillColor(248, 249, 252);
  doc.roundedRect(margin, y, contentWidth, 28, 2.5, 2.5, 'FD');

  doc.setTextColor(119, 125, 145);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text('STUDENT NAME', margin + 4, y + 6);
  doc.text('ENROLLMENT NUMBER', margin + 68, y + 6);
  doc.text('DEPARTMENT', margin + 124, y + 6);

  doc.setTextColor(32, 36, 58);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text(rc.studentName, margin + 4, y + 12);
  doc.text(rc.enrollmentNumber, margin + 68, y + 12);
  doc.text(rc.departmentName, margin + 124, y + 12);

  doc.setTextColor(119, 125, 145);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text('ACADEMIC YEAR', margin + 4, y + 19);
  doc.text('SEMESTER & DIVISION', margin + 68, y + 19);
  doc.text('PUBLICATION DATE', margin + 124, y + 19);

  doc.setTextColor(32, 36, 58);
  doc.setFontSize(9.5);
  doc.setFont('helvetica', 'normal');
  doc.text(rc.academicYear, margin + 4, y + 24.5);
  doc.text(`Semester ${rc.semester} — Div ${rc.division}`, margin + 68, y + 24.5);
  doc.text(format(new Date(rc.publishedAt), 'dd MMM yyyy, hh:mm a'), margin + 124, y + 24.5);

  // Subject Table Header
  y += 36;
  doc.setFillColor(233, 234, 242);
  doc.rect(margin, y, contentWidth, 9, 'F');
  doc.setTextColor(32, 36, 58);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);

  const cols = {
    code: margin + 3,
    name: margin + 28,
    max: margin + 114,
    obt: margin + 139,
    pct: margin + 162,
  };

  doc.text('Code', cols.code, y + 6);
  doc.text('Subject Name', cols.name, y + 6);
  doc.text('Max Marks', cols.max, y + 6);
  doc.text('Obtained', cols.obt, y + 6);
  doc.text('Percent', cols.pct, y + 6);

  y += 9;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);

  for (const sub of rc.subjects) {
    if (y > 245) {
      doc.addPage();
      y = 20;
    }
    doc.setDrawColor(228, 229, 237);
    doc.line(margin, y + 9, margin + contentWidth, y + 9);
    doc.setTextColor(32, 36, 58);
    doc.text(sub.subjectCode, cols.code, y + 6);
    doc.text(sub.subjectName.slice(0, 42), cols.name, y + 6);
    doc.text(String(sub.maxMarks), cols.max + 4, y + 6);
    doc.setFont('helvetica', 'bold');
    doc.text(String(sub.obtainedMarks), cols.obt + 3, y + 6);
    doc.setFont('helvetica', 'normal');
    doc.text(`${sub.percentage.toFixed(1)}%`, cols.pct, y + 6);
    y += 9;
  }

  // Summary Block
  y += 8;
  doc.setFillColor(239, 236, 255); // #EFECFF
  doc.roundedRect(margin, y, contentWidth, 20, 2.5, 2.5, 'F');
  doc.setTextColor(81, 70, 216);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text('TOTAL MARKS', margin + 5, y + 7);
  doc.text('OVERALL PERCENTAGE', margin + 56, y + 7);
  doc.text('GRADE', margin + 112, y + 7);
  doc.text('RESULT STATUS', margin + 136, y + 7);

  doc.setTextColor(32, 36, 58);
  doc.setFontSize(11);
  doc.text(`${rc.totalObtained} / ${rc.totalMaxMarks}`, margin + 5, y + 15);
  doc.text(`${rc.percentage.toFixed(2)}%`, margin + 56, y + 15);
  doc.text(rc.grade, margin + 112, y + 15);
  doc.setFontSize(9.5);
  doc.text(rc.resultStatus, margin + 136, y + 15);

  // Academic Remarks
  const remarksList = rc.subjects.filter((s) => s.remarkText);
  if (remarksList.length > 0) {
    y += 28;
    doc.setTextColor(32, 36, 58);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('Faculty Academic Remarks', margin, y);
    y += 5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);

    for (const s of remarksList) {
      if (y > 260) {
        doc.addPage();
        y = 20;
      }
      const line = `${s.subjectCode} (${s.subjectName}): ${s.remarkText}`;
      const wrapped = doc.splitTextToSize(line, contentWidth);
      doc.setTextColor(60, 65, 88);
      doc.text(wrapped, margin, y);
      y += wrapped.length * 4.5 + 2.5;
    }
  }

  // Authorized Behavioral Evaluation (ONLY if data exists)
  if (rc.behavioralEvaluation) {
    y += 4;
    if (y > 250) {
      doc.addPage();
      y = 20;
    }
    doc.setDrawColor(228, 229, 237);
    doc.setFillColor(248, 249, 252);
    doc.roundedRect(margin, y, contentWidth, 22, 2, 2, 'FD');
    doc.setTextColor(32, 36, 58);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.text('Authorized Behavioral & Attendance Evaluation', margin + 4, y + 6.5);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.text(
      `Attendance: ${rc.behavioralEvaluation.attendance}   |   Conduct: ${rc.behavioralEvaluation.discipline}`,
      margin + 4,
      y + 12.5
    );
    if (rc.behavioralEvaluation.notes) {
      doc.text(rc.behavioralEvaluation.notes.slice(0, 110), margin + 4, y + 18);
    }
  }

  // Footer
  const footerY = 282;
  doc.setDrawColor(228, 229, 237);
  doc.line(margin, footerY - 5, margin + contentWidth, footerY - 5);
  doc.setTextColor(119, 125, 145);
  doc.setFontSize(7.5);
  doc.text(
    `Digitally verified via CAMPUSCORE  |  Unique Report Card ID: ${rc.reportCode}  |  Generated ${format(new Date(), 'dd MMM yyyy')}`,
    margin,
    footerY
  );

  doc.save(`${rc.enrollmentNumber}_Sem${rc.semester}_ReportCard.pdf`);
}

export function ReportCardView({
  reportCard,
  onDownloadError,
}: {
  reportCard: OfficialReportCardDetail;
  onDownloadError?: (msg: string) => void;
}) {
  const handleDownload = () => {
    try {
      downloadReportCardPdf(reportCard);
    } catch {
      onDownloadError?.('Failed to generate PDF report card. Please retry or use Print.');
    }
  };

  return (
    <div className="space-y-4">
      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <div className="text-xs text-[#777D91]">
          Report ID <span className="font-mono font-medium text-[#20243A]">{reportCard.reportCode}</span>
          {' · '}
          Published {format(new Date(reportCard.publishedAt), 'dd MMM yyyy, hh:mm a')}
        </div>
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 rounded-xl border border-[#E4E5ED] bg-white px-3.5 py-2 text-xs font-medium text-[#20243A] transition-colors hover:bg-[#F3F4F8]"
          >
            <Printer className="h-3.5 w-3.5" />
            <span>Print Report Card</span>
          </button>
          <button
            type="button"
            onClick={handleDownload}
            className="inline-flex items-center gap-2 rounded-xl bg-[#5146D8] px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-[#4237C2]"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Download Official PDF</span>
          </button>
        </div>
      </div>

      <article className="print-report-card overflow-hidden rounded-2xl border border-[#E4E5ED] bg-white shadow-xs">
        {/* Institutional Header */}
        <div className="border-b border-[#E4E5ED] bg-[#20243A] px-6 py-6 text-white sm:px-8">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#5146D8] text-white">
                <GraduationCap className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-medium text-white/75">CAMPUSCORE Official Academic Record</p>
                <h2 className="font-heading text-lg font-bold tracking-tight">{reportCard.college}</h2>
              </div>
            </div>
            <div className="text-left sm:text-right">
              <p className="font-mono text-xs text-white/80">{reportCard.reportCode}</p>
              <p className="mt-0.5 text-xs text-white/65">
                {reportCard.departmentName} · Academic Year {reportCard.academicYear}
              </p>
            </div>
          </div>
        </div>

        {/* Student Metadata */}
        <div className="grid grid-cols-2 gap-4 border-b border-[#E4E5ED] bg-[#F8F9FC] px-6 py-5 sm:grid-cols-4 sm:px-8">
          <div>
            <p className="text-xs text-[#777D91]">Student Name</p>
            <p className="mt-1 text-sm font-semibold text-[#20243A]">{reportCard.studentName}</p>
          </div>
          <div>
            <p className="text-xs text-[#777D91]">Enrollment Number</p>
            <p className="mt-1 font-mono text-sm font-semibold text-[#20243A]">
              {reportCard.enrollmentNumber}
            </p>
          </div>
          <div>
            <p className="text-xs text-[#777D91]">Semester &amp; Division</p>
            <p className="mt-1 text-sm font-semibold text-[#20243A]">
              Semester {reportCard.semester} · Div {reportCard.division}
            </p>
          </div>
          <div>
            <p className="text-xs text-[#777D91]">Batch</p>
            <p className="mt-1 text-sm font-semibold text-[#20243A]">{reportCard.batch}</p>
          </div>
        </div>

        {/* Subject Marks Table */}
        <div className="overflow-x-auto px-6 py-6 sm:px-8">
          <table className="w-full min-w-[540px] border-collapse text-left">
            <thead>
              <tr className="border-b border-[#E4E5ED] text-xs font-semibold text-[#777D91]">
                <th className="pb-3 pr-4">Subject Code</th>
                <th className="pb-3 pr-4">Subject Name</th>
                <th className="pb-3 pr-4 text-right">Maximum Marks</th>
                <th className="pb-3 pr-4 text-right">Obtained Marks</th>
                <th className="pb-3 text-right">Percentage</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E4E5ED] text-sm">
              {reportCard.subjects.map((sub) => (
                <tr key={sub.subjectCode}>
                  <td className="py-3.5 pr-4 font-mono text-xs font-semibold text-[#5146D8]">
                    {sub.subjectCode}
                  </td>
                  <td className="py-3.5 pr-4">
                    <p className="font-medium text-[#20243A]">{sub.subjectName}</p>
                    <p className="text-xs text-[#777D91]">{sub.assessmentType}</p>
                  </td>
                  <td className="py-3.5 pr-4 text-right font-mono tabular-nums text-[#777D91]">
                    {sub.maxMarks}
                  </td>
                  <td className="py-3.5 pr-4 text-right font-mono font-semibold tabular-nums text-[#20243A]">
                    {sub.obtainedMarks}
                  </td>
                  <td className="py-3.5 text-right font-mono tabular-nums text-[#20243A]">
                    {sub.percentage.toFixed(1)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Summary Row */}
          <div className="mt-6 grid grid-cols-2 gap-4 rounded-xl border border-[#E4E5ED] bg-[#EFECFF]/55 p-4 sm:grid-cols-4">
            <div>
              <p className="text-xs text-[#777D91]">Total Marks</p>
              <p className="mt-1 font-mono text-base font-bold text-[#20243A] tabular-nums">
                {reportCard.totalObtained} / {reportCard.totalMaxMarks}
              </p>
            </div>
            <div>
              <p className="text-xs text-[#777D91]">Overall Percentage</p>
              <p className="mt-1 font-mono text-base font-bold text-[#5146D8] tabular-nums">
                {reportCard.percentage.toFixed(2)}%
              </p>
            </div>
            <div>
              <p className="text-xs text-[#777D91]">Grade</p>
              <p className="mt-1 font-heading text-base font-bold text-[#20243A]">{reportCard.grade}</p>
            </div>
            <div>
              <p className="text-xs text-[#777D91]">Result Status</p>
              <p className="mt-1 text-sm font-semibold text-[#21966B]">{reportCard.resultStatus}</p>
            </div>
          </div>

          {/* Faculty & AI Academic Remarks */}
          {reportCard.subjects.some((s) => s.remarkText) && (
            <div className="mt-6 border-t border-[#E4E5ED] pt-5">
              <h3 className="font-heading text-sm font-bold text-[#20243A]">Academic Remarks</h3>
              <div className="mt-3 space-y-2.5">
                {reportCard.subjects
                  .filter((s) => s.remarkText)
                  .map((s) => (
                    <div
                      key={s.subjectCode}
                      className="rounded-xl border border-[#E4E5ED] bg-[#F8F9FC] px-4 py-3"
                    >
                      <p className="text-xs font-semibold text-[#20243A]">
                        {s.subjectCode} · {s.subjectName}
                        {s.professorName ? ` — ${s.professorName}` : ''}
                      </p>
                      <p className="mt-1 text-sm leading-relaxed text-[#474D66]">{s.remarkText}</p>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Authorized Behavioral Evaluation (only rendered when actual evaluation data exists) */}
          {reportCard.behavioralEvaluation && (
            <div className="mt-6 border-t border-[#E4E5ED] pt-5">
              <h3 className="font-heading text-sm font-bold text-[#20243A]">
                Authorized Behavioral Evaluation
              </h3>
              <div className="mt-3 grid grid-cols-1 gap-3 rounded-xl border border-[#E4E5ED] bg-[#F8F9FC] p-4 sm:grid-cols-3">
                <div>
                  <p className="text-xs text-[#777D91]">Attendance Record</p>
                  <p className="mt-0.5 text-sm font-semibold text-[#20243A]">
                    {reportCard.behavioralEvaluation.attendance}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-[#777D91]">Academic Conduct</p>
                  <p className="mt-0.5 text-sm font-semibold text-[#20243A]">
                    {reportCard.behavioralEvaluation.discipline}
                  </p>
                </div>
                {reportCard.behavioralEvaluation.notes && (
                  <div>
                    <p className="text-xs text-[#777D91]">Faculty Note</p>
                    <p className="mt-0.5 text-sm text-[#474D66]">
                      {reportCard.behavioralEvaluation.notes}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Verification Footer */}
          <div className="mt-6 flex flex-wrap items-center justify-between gap-2 border-t border-[#E4E5ED] pt-4 text-xs text-[#777D91]">
            <span className="inline-flex items-center gap-1.5 text-[#21966B]">
              <ShieldCheck className="h-4 w-4" />
              <span>HOD Verified &amp; Atomically Published Record</span>
            </span>
            <span>
              Issued {format(new Date(reportCard.publishedAt), 'dd MMM yyyy')} · Publication v
              {reportCard.publicationVersion}
            </span>
          </div>
        </div>
      </article>
    </div>
  );
}
