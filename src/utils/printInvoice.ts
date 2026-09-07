import { getStateFromGSTIN } from './gstStateCodes';

export interface InvoiceItem {
  medicineName: string;
  manufacturer: string;
  packSize: string;
  batchNumber: string;
  expiryDate?: string;
  quantity: number;
  sellingPrice: number;
  gstPercentage: number;
  discount: number;
  discountPercent?: number;
  totalAmount: number;
}

export interface InvoiceData {
  billNumber: string;
  saleDate: string;
  customerName: string;
  customerMobile: string;
  customerAddress: string;
  doctorName: string;
  items: InvoiceItem[];
  subtotal: number;
  gstAmount: number;
  cgstAmount: number;
  sgstAmount: number;
  discountAmount: number;
  discountPercent?: number;
  totalAmount: number;
  paymentMode: string;
}

// Shared by Billing.tsx (printing a bill right after creating it) and
// SalesList.tsx (reprinting any past invoice) — one A4 tax-invoice layout,
// not two copies that could drift apart.
export const printInvoice = (
  bill: InvoiceData, storeName: string, storeAddress: string, storeGST: string, storeDLNo: string
) => {
  const win = window.open('', '_blank', 'width=900,height=1000,scrollbars=yes');
  if (!win) return;

  const dateStr = new Date(bill.saleDate).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

  const placeOfSupply = getStateFromGSTIN(storeGST);

  const fmtExpiry = (d?: string) => d ? new Date(d).toLocaleDateString('en-IN', { month: '2-digit', year: '2-digit' }) : '—';

  const itemRows = bill.items.map((item, i) => `
    <tr>
      <td>${i + 1}</td>
      <td>${item.medicineName}</td>
      <td>${item.manufacturer || '—'}</td>
      <td>${item.batchNumber || '—'}</td>
      <td>${item.packSize || '—'}</td>
      <td>${fmtExpiry(item.expiryDate)}</td>
      <td class="r">${item.quantity}</td>
      <td class="r">₹${item.sellingPrice.toFixed(2)}</td>
      <td class="r">${item.gstPercentage}%</td>
      <td class="r">${item.discountPercent ? `-${item.discountPercent}%` : item.discount > 0 ? `-₹${item.discount.toFixed(2)}` : '—'}</td>
      <td class="r">₹${item.totalAmount.toFixed(2)}</td>
    </tr>
  `).join('');

  const discountDisplay = bill.discountPercent
    ? `-${bill.discountPercent}%`
    : `-₹${bill.discountAmount.toFixed(2)}`;
  const discountPart = bill.discountAmount > 0
    ? `Discount: <span style="color:#d32f2f">${discountDisplay}</span> &nbsp;|&nbsp; `
    : '';

  win.document.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>Bill ${bill.billNumber}</title>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family: Arial, sans-serif; font-size: 10px; color: #000; padding: 10px; max-width: 800px; margin: auto; }
    .header-row { display:flex; justify-content:space-between; align-items:flex-start; }
    .header-side { font-size:10px; color:#333; width:180px; }
    .header-side.right { text-align:right; }
    .header-center { flex:1; text-align:center; }
    .store-name { font-size:16px; font-weight:700; letter-spacing:0.5px; }
    .store-sub { font-size:10px; color:#333; margin-top:1px; }
    .invoice-title { text-align:center; font-size:11px; font-weight:700; letter-spacing:1.5px; text-transform:uppercase; margin-top:4px; }
    .solid { border-top:1.5px solid #000; margin:4px 0; }
    .dashed { border-top:1px dashed #999; margin:4px 0; }
    .meta-grid { display:flex; justify-content:space-between; font-size:10px; margin:2px 0; }
    .meta-grid b { font-weight:700; }
    .customer-box { display:flex; justify-content:space-between; font-size:10px; margin:2px 0; gap: 10px; }
    table { width:100%; border-collapse:collapse; margin:4px 0; }
    th { font-size:9px; text-align:left; padding:3px; border-bottom:1.5px solid #000; border-top:1.5px solid #000; background:#f5f5f5; }
    td { font-size:9.5px; padding:3px; vertical-align:top; border-bottom:1px solid #eee; }
    .r { text-align:right; }
    .totals-line { text-align:right; font-size:10px; color:#333; margin:4px 0 2px; }
    .totals-table { width:220px; margin-left:auto; }
    .totals-table td { padding:1.5px 4px; font-size:10px; }
    .total-row td { font-weight:700; font-size:12.5px; border-top:1.5px solid #000; padding-top:3px; }
    .footer { text-align:center; margin-top:8px; font-size:9px; color:#555; }
    .payment-badge { display:inline-block; border:1px solid #000; border-radius:3px; padding:1px 6px; font-weight:700; font-size:9.5px; }
    @media print {
      @page { size: A4; margin: 8mm; }
      body { max-width:100%; padding:0; }
    }
  </style>
</head>
<body>
  <div class="header-row">
    <div class="header-side">
      ${storeGST ? `GSTIN: ${storeGST}` : ''}${storeGST && storeDLNo ? '<br/>' : ''}${storeDLNo ? `D.L. No: ${storeDLNo}` : ''}
    </div>
    <div class="header-center">
      <div class="store-name">${storeName || 'MedMek Pharmacy'}</div>
      <div class="invoice-title">Tax Invoice</div>
    </div>
    <div class="header-side right">${storeAddress || ''}</div>
  </div>
  <div class="solid"></div>
  <div class="meta-grid"><span>Bill No: <b>${bill.billNumber}</b></span><span>Date: <b>${dateStr}</b></span></div>
  ${placeOfSupply ? `<div class="meta-grid"><span>Place of Supply: <b>${placeOfSupply}</b></span><span>Reverse Charge: <b>N</b></span></div>` : ''}
  <div class="dashed"></div>
  <div class="customer-box">
    <span>
      <b>M/s:</b> ${bill.customerName}${bill.customerMobile ? ` (${bill.customerMobile})` : ''}
      ${bill.customerAddress ? `<br/><span style="color:#444">${bill.customerAddress}</span>` : ''}
    </span>
    ${bill.doctorName ? `<span><b>Doctor:</b> ${bill.doctorName}</span>` : ''}
  </div>
  <table>
    <thead>
      <tr>
        <th>Sr.</th>
        <th>Product Name</th>
        <th>Mfg</th>
        <th>Batch</th>
        <th>Pack</th>
        <th>Expiry</th>
        <th class="r">Qty</th>
        <th class="r">MRP</th>
        <th class="r">GST%</th>
        <th class="r">Disc</th>
        <th class="r">Amount</th>
      </tr>
    </thead>
    <tbody>${itemRows}</tbody>
  </table>
  <div class="totals-line">
    ${discountPart}SGST: ₹${bill.sgstAmount.toFixed(2)} &nbsp;|&nbsp; CGST: ₹${bill.cgstAmount.toFixed(2)} &nbsp;|&nbsp; Subtotal: ₹${bill.subtotal.toFixed(2)}
  </div>
  <table class="totals-table">
    <tr class="total-row"><td>Grand Total</td><td class="r">₹${bill.totalAmount.toFixed(2)}</td></tr>
  </table>
  <div class="dashed"></div>
  <div>Payment Mode: <span class="payment-badge">${bill.paymentMode.toUpperCase()}</span></div>
  <div class="footer">
    <div>— Thank you for your visit! Get well soon. —</div>
    <div>This is a computer-generated invoice.</div>
  </div>
  <script>
    window.onload = function() { window.print(); };
  </script>
</body>
</html>`);
  win.document.close();
};
