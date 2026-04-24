import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

// G701-style single-page change order document.
// NOT the official AIA G701 form — that requires an AIA license.
// Layout mirrors the industry-standard fields so an owner can recognize it.

const fmtMoney = (n) => {
  if (n == null) return '—'
  const abs = Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return (n < 0 ? '-$' : '$') + abs
}
const fmtDate = (s) => s ? new Date(s).toLocaleDateString('en-US', { year:'numeric', month:'long', day:'numeric' }) : '—'

export function exportCOPdf(co, ctx) {
  const { project, coType, category, priority, status, members = [] } = ctx || {}
  const doc = new jsPDF({ unit: 'pt', format: 'letter' })
  const W = doc.internal.pageSize.getWidth()
  const H = doc.internal.pageSize.getHeight()
  const M = 44 // margin

  // ── Header ─────────────────────────────────────────────────
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  doc.text('CHANGE ORDER', M, M + 6)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(110)
  doc.text('G701-style · ConstructPro', M, M + 22)
  // CO number box
  doc.setDrawColor(200); doc.setLineWidth(0.5)
  doc.rect(W - M - 160, M - 6, 160, 46)
  doc.setFontSize(8); doc.setTextColor(110)
  doc.text('CHANGE ORDER NUMBER', W - M - 152, M + 6)
  doc.setFont('helvetica', 'bold'); doc.setFontSize(16); doc.setTextColor(30)
  doc.text(co.num || '', W - M - 152, M + 26)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(110)
  doc.text('DATE: ' + fmtDate(co.submittedDate || new Date().toISOString()), W - M - 152, M + 38)
  doc.setTextColor(30)

  // ── Party block ───────────────────────────────────────────
  let y = M + 64
  const col1 = M
  const col2 = M + (W - 2*M) / 2 + 10
  const label = (text, x, y) => { doc.setFontSize(7); doc.setTextColor(120); doc.text(text.toUpperCase(), x, y); doc.setTextColor(30) }
  const field = (text, x, y) => { doc.setFontSize(10); doc.setFont('helvetica','bold'); doc.text(text || '—', x, y); doc.setFont('helvetica','normal') }

  label('Project', col1, y)
  field(project?.name || '—', col1, y + 13)
  label('To (Owner / Architect)', col2, y)
  field((members.find(m => m.id === co.reviewedBy)?.name) || 'Owner', col2, y + 13)

  y += 32
  label('Original Contract Sum', col1, y)
  field(project?.originalContract != null ? fmtMoney(project.originalContract) : '—', col1, y + 13)
  label('From (Contractor)', col2, y)
  field('ConstructPro', col2, y + 13)

  // ── Horizontal rule ──
  y += 30
  doc.setDrawColor(220); doc.line(M, y, W - M, y)

  // ── Description block ─────────────────────────────────────
  y += 18
  doc.setFontSize(11); doc.setFont('helvetica', 'bold')
  doc.text(co.title || '', M, y)
  y += 14
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(60)
  const descLines = doc.splitTextToSize(co.description || '—', W - 2*M)
  doc.text(descLines, M, y)
  y += descLines.length * 11 + 8

  if (co.justification) {
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(120)
    doc.text('JUSTIFICATION / BASIS', M, y); y += 11
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(60)
    const jLines = doc.splitTextToSize(co.justification, W - 2*M)
    doc.text(jLines, M, y)
    y += jLines.length * 11 + 8
  }

  // ── Meta strip ────────────────────────────────────────────
  doc.setFontSize(8); doc.setTextColor(110)
  const meta = [
    ['Type',     coType?.label || '—'],
    ['Trade',    category?.label || '—'],
    ['Priority', priority?.label || '—'],
    ['Status',   status?.label || '—'],
    ['Schedule', (co.scheduleImpact > 0 ? '+' : '') + (co.scheduleImpact || 0) + ' days'],
    ['Due',      fmtDate(co.dueDate)],
  ]
  const metaColW = (W - 2*M) / meta.length
  meta.forEach(([k, v], i) => {
    const x = M + i * metaColW
    doc.setTextColor(130); doc.setFontSize(7)
    doc.text(k.toUpperCase(), x, y)
    doc.setTextColor(30); doc.setFontSize(9); doc.setFont('helvetica','bold')
    doc.text(String(v), x, y + 12)
    doc.setFont('helvetica','normal')
  })
  y += 26

  // ── Line items table ──────────────────────────────────────
  const items = Array.isArray(co.lineItems) ? co.lineItems : []
  if (items.length > 0) {
    autoTable(doc, {
      startY: y,
      margin: { left: M, right: M },
      head: [['Description', 'Qty', 'Unit', 'Rate', 'Total']],
      body: items.map(li => [
        li.desc || '',
        String(li.qty ?? ''),
        li.unit || '',
        fmtMoney(li.rate),
        fmtMoney(li.total),
      ]),
      styles: { fontSize: 9, cellPadding: 5 },
      headStyles: { fillColor: [234, 88, 12], textColor: 255, fontStyle: 'bold' },
      columnStyles: {
        1: { halign: 'right', cellWidth: 50 },
        2: { halign: 'center', cellWidth: 50 },
        3: { halign: 'right', cellWidth: 80 },
        4: { halign: 'right', cellWidth: 90 },
      },
      theme: 'grid',
    })
    y = doc.lastAutoTable.finalY + 10
  }

  // ── Totals box ────────────────────────────────────────────
  const subtotal = items.reduce((a, li) => a + (li.total || 0), 0)
  const markupAmt = subtotal * (co.gcMarkup || 0)
  const computedTotal = subtotal + markupAmt
  const displayTotal = co.approvedAmt || co.requestedAmt || computedTotal

  const boxW = 230
  const boxX = W - M - boxW
  const rows = [
    ['Subtotal (cost)', fmtMoney(subtotal)],
    [`GC Markup (${Math.round((co.gcMarkup || 0) * 100)}%)`, fmtMoney(markupAmt)],
    ['Requested Amount', fmtMoney(co.requestedAmt)],
  ]
  if (co.approvedAmt && co.approvedAmt !== co.requestedAmt) rows.push(['Approved Amount', fmtMoney(co.approvedAmt)])

  doc.setFontSize(9); doc.setTextColor(60)
  rows.forEach((r, i) => {
    const ry = y + i * 14
    doc.text(r[0], boxX + 10, ry + 10)
    doc.setFont('helvetica', 'bold'); doc.setTextColor(30)
    doc.text(r[1], boxX + boxW - 10, ry + 10, { align: 'right' })
    doc.setFont('helvetica', 'normal'); doc.setTextColor(60)
  })
  y += rows.length * 14 + 6

  // Grand total band
  doc.setFillColor(234, 88, 12); doc.setTextColor(255)
  doc.rect(boxX, y, boxW, 24, 'F')
  doc.setFont('helvetica', 'bold'); doc.setFontSize(11)
  doc.text('CHANGE ORDER TOTAL', boxX + 10, y + 16)
  doc.text(fmtMoney(displayTotal), boxX + boxW - 10, y + 16, { align: 'right' })
  doc.setTextColor(30); doc.setFont('helvetica', 'normal')
  y += 40

  // ── Signature block ───────────────────────────────────────
  const sigY = Math.max(y, H - 140)
  const sigGap = 18
  const sigW = (W - 2 * M - sigGap * 2) / 3
  const sigs = ['CONTRACTOR', 'ARCHITECT', 'OWNER']
  sigs.forEach((s, i) => {
    const x = M + i * (sigW + sigGap)
    // Signature line
    doc.setDrawColor(180); doc.setLineWidth(0.5)
    doc.line(x, sigY + 22, x + sigW, sigY + 22)
    // Role label (under signature line, left)
    doc.setFontSize(7); doc.setTextColor(120)
    doc.text(s, x, sigY + 32)
    // Date line (below, spans full cell)
    doc.setDrawColor(200)
    doc.line(x + 30, sigY + 52, x + sigW, sigY + 52)
    doc.setFontSize(7); doc.setTextColor(120)
    doc.text('DATE', x, sigY + 54)
  })

  // ── Footer ─────────────────────────────────────────────────
  doc.setFontSize(7); doc.setTextColor(160)
  doc.text('This document is a G701-style change order generated by ConstructPro. It is not the licensed AIA G701 form.', M, H - 20)
  doc.text('Page 1', W - M, H - 20, { align: 'right' })

  doc.save(`${co.num || 'change-order'}.pdf`)
}

// ────────────────────────────────────────────────────────────────
// Tabular export of multiple COs — mirrors exportCSV column set.
// Landscape letter, auto-paged, orange header band, totals footer.
// ctx: { coTypes, trades, statuses, priorities, projects }
// ────────────────────────────────────────────────────────────────
export function exportCOsPdf(cos, ctx) {
  const { coTypes = {}, trades = {}, statuses = [], priorities = {}, projects = [] } = ctx || {}
  const doc = new jsPDF({ unit: 'pt', format: 'letter', orientation: 'landscape' })
  const W = doc.internal.pageSize.getWidth()
  const H = doc.internal.pageSize.getHeight()
  const M = 20

  // ── Header ─────────────────────────────────────────────────
  doc.setFont('helvetica', 'bold'); doc.setFontSize(16); doc.setTextColor(30)
  doc.text('CHANGE ORDER LOG', M, M + 4)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(110)
  doc.text('ConstructPro · ' + new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }), M, M + 18)

  // Summary strip
  const totalReq      = cos.reduce((a, c) => a + (c.requestedAmt || 0), 0)
  const totalApproved = cos.reduce((a, c) => a + (c.approvedAmt  || 0), 0)
  const totalSched    = cos.reduce((a, c) => a + (c.scheduleImpact || 0), 0)
  const summary = `${cos.length} COs   ·   Requested: ${fmtMoney(totalReq)}   ·   Approved: ${fmtMoney(totalApproved)}   ·   Schedule: ${totalSched > 0 ? '+' : ''}${totalSched}d`
  doc.setFontSize(9); doc.setTextColor(30)
  doc.text(summary, W - M, M + 4, { align: 'right' })

  // ── Table ──────────────────────────────────────────────────
  const labelOf = (map, key) => (map[key]?.label) || key || '—'
  const statusLabel = (id) => (statuses.find(s => s.id === id)?.label) || id
  const projectLabel = (id) => (projects.find(p => p.id === id)?.name) || id

  // Forced two-line headers (use \n to guarantee line break).
  const head = [[
    'CO\nNumber',
    'Title\n ',
    'Change Order\nType',
    'Trade /\nCategory',
    'Priority\n ',
    'Status\n ',
    'Project\n ',
    'Requested\nAmount',
    'Approved\nAmount',
    'Schedule\nImpact',
    'Submitted\nDate',
    'Due\nDate',
    'Executed\nDate',
  ]]

  // Numeric MM-DD-YYYY (10 chars, fixed width, fits two-line header cells)
  const fmtDateNum = (s) => {
    if (!s) return '—'
    const d = new Date(s)
    if (isNaN(d)) return '—'
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const dd = String(d.getDate()).padStart(2, '0')
    return `${mm}-${dd}-${d.getFullYear()}`
  }

  const body = cos.map(co => [
    co.num || '',
    co.title || '',
    labelOf(coTypes, co.type),
    labelOf(trades, co.category),
    labelOf(priorities, co.priority),
    statusLabel(co.status),
    projectLabel(co.project),
    fmtMoney(co.requestedAmt),
    co.approvedAmt ? fmtMoney(co.approvedAmt) : '—',
    co.scheduleImpact ? ((co.scheduleImpact > 0 ? '+' : '') + co.scheduleImpact + 'd') : '—',
    fmtDateNum(co.submittedDate),
    fmtDateNum(co.dueDate),
    fmtDateNum(co.executedDate),
  ])

  // Totals row
  body.push([
    { content: 'TOTALS', colSpan: 7, styles: { fontStyle: 'bold', halign: 'right', fillColor: [255, 247, 237] } },
    { content: fmtMoney(totalReq),      styles: { fontStyle: 'bold', halign: 'right', fillColor: [255, 247, 237] } },
    { content: fmtMoney(totalApproved), styles: { fontStyle: 'bold', halign: 'right', fillColor: [255, 247, 237] } },
    { content: (totalSched > 0 ? '+' : '') + totalSched + 'd', styles: { fontStyle: 'bold', halign: 'right', fillColor: [255, 247, 237] } },
    { content: '', colSpan: 3, styles: { fillColor: [255, 247, 237] } },
  ])

  autoTable(doc, {
    startY: M + 30,
    margin: { left: M, right: M },
    tableWidth: W - M * 2,
    head,
    body,
    styles: { fontSize: 7.5, cellPadding: 3, overflow: 'linebreak', valign: 'middle' },
    headStyles: { fillColor: [234, 88, 12], textColor: 255, fontStyle: 'bold', fontSize: 7.5, halign: 'center', valign: 'middle' },
    alternateRowStyles: { fillColor: [250, 250, 249] },
    // Widths sum to ~720pt (landscape letter usable width). Totals align to columns 7-9.
    // Widths sum to 752pt exactly (landscape letter: 792 - 2*20 margins).
    // Each date column is 54pt so MM-DD-YYYY (10 chars at 7.5pt) fits without wrapping.
    columnStyles: {
      0:  { cellWidth: 44,  fontStyle: 'bold', textColor: [234, 88, 12] }, // CO #
      1:  { cellWidth: 110 },                                               // Title
      2:  { cellWidth: 60 },                                                // Type
      3:  { cellWidth: 48 },                                                // Trade
      4:  { cellWidth: 40 },                                                // Priority
      5:  { cellWidth: 54 },                                                // Status
      6:  { cellWidth: 76 },                                                // Project
      7:  { cellWidth: 60,  halign: 'right' },                              // Requested
      8:  { cellWidth: 60,  halign: 'right' },                              // Approved
      9:  { cellWidth: 40,  halign: 'right', fontStyle: 'normal' },         // Sched.
      10: { cellWidth: 54,  halign: 'center' },                             // Submitted (MM-DD-YYYY)
      11: { cellWidth: 54,  halign: 'center' },                             // Due
      12: { cellWidth: 52,  halign: 'center' },                             // Executed
    },
    theme: 'grid',
    didDrawPage: (data) => {
      const pageNum = doc.internal.getNumberOfPages()
      doc.setFontSize(7); doc.setTextColor(160)
      doc.text('Change Order Log · ConstructPro', M, H - 18)
      doc.text(`Page ${data.pageNumber} of ${pageNum}`, W - M, H - 18, { align: 'right' })
    },
  })

  doc.save(`change-orders-${new Date().toISOString().slice(0, 10)}.pdf`)
}
