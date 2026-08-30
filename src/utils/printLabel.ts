interface LabelMedicine {
  name: string;
  batchNumber?: string;
  barcode?: string;
  location?: string;
}

// Opens a small print window sized for a sticky shelf label — same
// window.open + window.print() pattern used for invoices and reports.
// Location is the largest element on purpose: this label exists to be
// read from across a shelf, not studied up close.
export const printShelfLabel = (medicine: LabelMedicine, storeName?: string) => {
  const win = window.open('', '_blank', 'width=400,height=300');
  if (!win) return;

  win.document.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>Shelf Label — ${medicine.name}</title>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family: Arial, sans-serif; color:#000; padding: 8px; }
    .label { border: 1.5px dashed #999; padding: 10px; text-align: center; }
    .store { font-size: 10px; color:#555; text-transform: uppercase; letter-spacing: 1px; }
    .name { font-size: 15px; font-weight: 700; margin-top: 4px; word-break: break-word; }
    .location { font-size: 26px; font-weight: 800; margin: 8px 0; letter-spacing: 0.5px; }
    .location.empty { font-size: 13px; font-weight: 400; color: #999; font-style: italic; }
    .meta { font-size: 10px; color: #333; border-top: 1px dashed #999; padding-top: 6px; margin-top: 4px; }
    .barcode { font-family: 'Courier New', monospace; font-size: 13px; font-weight: 700; letter-spacing: 2px; margin-top: 2px; }
    @media print {
      @page { size: 76mm 51mm; margin: 2mm; }
      body { padding: 0; }
      .label { border: none; }
    }
  </style>
</head>
<body>
  <div class="label">
    ${storeName ? `<div class="store">${storeName}</div>` : ''}
    <div class="name">${medicine.name}</div>
    <div class="location${medicine.location ? '' : ' empty'}">${medicine.location || 'Location not set'}</div>
    <div class="meta">
      ${medicine.batchNumber ? `Batch: ${medicine.batchNumber}` : ''}
    </div>
    ${medicine.barcode ? `<div class="barcode">${medicine.barcode}</div>` : ''}
  </div>
  <script>
    window.onload = function() { window.print(); };
  </script>
</body>
</html>`);
  win.document.close();
};
