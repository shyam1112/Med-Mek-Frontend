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
      <td class="r">₹${item.totalAmount.toFixed(2)}</td>
    </tr>
  `).join('');

  const discountRow = bill.discountAmount > 0
    ? `<tr><td>Discount</td><td class="r" style="color:#d32f2f">-₹${bill.discountAmount.toFixed(2)}</td></tr>`
    : '';

  win.document.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>Bill ${bill.billNumber}</title>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family: Arial, sans-serif; font-size: 12px; color: #000; padding: 16px; max-width: 800px; margin: auto; }
    .header { text-align:center; }
    .store-name { font-size:22px; font-weight:700; letter-spacing:0.5px; }
    .store-sub { font-size:12px; color:#333; margin-top:2px; }
    .invoice-title { text-align:center; font-size:13px; font-weight:700; letter-spacing:2px; text-transform:uppercase; margin-top:8px; }
    .solid { border-top:2px solid #000; margin:8px 0; }
    .dashed { border-top:1px dashed #999; margin:8px 0; }
    .meta-grid { display:flex; justify-content:space-between; font-size:12px; margin:3px 0; }
    .meta-grid b { font-weight:700; }
    .customer-box { display:flex; justify-content:space-between; font-size:12px; margin:4px 0; gap: 16px; }
    table { width:100%; border-collapse:collapse; margin:8px 0; }
    th { font-size:10.5px; text-align:left; padding:5px 4px; border-bottom:1.5px solid #000; border-top:1.5px solid #000; background:#f5f5f5; }
    td { font-size:11px; padding:5px 4px; vertical-align:top; border-bottom:1px solid #eee; }
    .r { text-align:right; }
    .totals-table { width:280px; margin-left:auto; }
    .totals-table td { padding:3px 4px; font-size:12px; }
    .total-row td { font-weight:700; font-size:15px; border-top:1.5px solid #000; padding-top:6px; }
    .footer { text-align:center; margin-top:16px; font-size:10.5px; color:#555; }
    .payment-badge { display:inline-block; border:1px solid #000; border-radius:3px; padding:1px 8px; font-weight:700; font-size:11px; }
    @media print {
      @page { size: A4; margin: 12mm; }
      body { max-width:100%; padding:0; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="store-name">${storeName || 'MedMek Pharmacy'}</div>
    ${storeAddress ? `<div class="store-sub">${storeAddress}</div>` : ''}
    <div class="store-sub">
      ${storeGST ? `GSTIN: ${storeGST}` : ''}${storeGST && storeDLNo ? ' &nbsp;|&nbsp; ' : ''}${storeDLNo ? `D.L. No: ${storeDLNo}` : ''}
    </div>
    <div class="invoice-title">Tax Invoice</div>
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
        <th class="r">Amount</th>
      </tr>
    </thead>
    <tbody>${itemRows}</tbody>
  </table>
  <table class="totals-table">
    <tr><td>Subtotal</td><td class="r">₹${bill.subtotal.toFixed(2)}</td></tr>
    <tr><td>CGST</td><td class="r">₹${bill.cgstAmount.toFixed(2)}</td></tr>
    <tr><td>SGST</td><td class="r">₹${bill.sgstAmount.toFixed(2)}</td></tr>
    ${discountRow}
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
