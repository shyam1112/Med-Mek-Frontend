export interface PurchaseOrderItem {
  medicineName: string;
  batchNumber: string;
  expiryDate?: string;
  quantity: number;
  purchasePrice: number;
  gstPercentage: number;
  totalAmount: number;
}

export interface PurchaseOrderSupplier {
  name: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  address?: string;
  gstNumber?: string;
}

export interface PurchaseOrderData {
  invoiceNumber: string;
  purchaseDate: string;
  supplierName: string;
  supplier?: PurchaseOrderSupplier;
  items: PurchaseOrderItem[];
  subtotal: number;
  gstAmount: number;
  totalAmount: number;
  paidAmount: number;
  balanceAmount: number;
  paymentStatus: string;
  notes?: string;
}

// The store is the buyer here (opposite of printInvoice, where the store is
// the seller) — same header treatment as the sales invoice for a consistent
// look across every printed document this app produces.
export const printPurchaseOrder = (
  po: PurchaseOrderData, storeName: string, storeAddress: string, storeGST: string, storeDLNo: string
) => {
  const win = window.open('', '_blank', 'width=900,height=1000,scrollbars=yes');
  if (!win) return;

  const dateStr = new Date(po.purchaseDate).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
  });

  const fmtExpiry = (d?: string) => d ? new Date(d).toLocaleDateString('en-IN', { month: '2-digit', year: '2-digit' }) : '—';

  const itemRows = po.items.map((item, i) => `
    <tr>
      <td>${i + 1}</td>
      <td>${item.medicineName}</td>
      <td>${item.batchNumber || '—'}</td>
      <td>${fmtExpiry(item.expiryDate)}</td>
      <td class="r">${item.quantity}</td>
      <td class="r">₹${item.purchasePrice.toFixed(2)}</td>
      <td class="r">${item.gstPercentage}%</td>
      <td class="r">₹${item.totalAmount.toFixed(2)}</td>
    </tr>
  `).join('');

  const supplier = po.supplier;
  const supplierLines = [
    supplier?.contactPerson ? `Attn: ${supplier.contactPerson}` : '',
    supplier?.address || '',
    supplier?.phone ? `Phone: ${supplier.phone}` : '',
    supplier?.email ? `Email: ${supplier.email}` : '',
    supplier?.gstNumber ? `GSTIN: ${supplier.gstNumber}` : '',
  ].filter(Boolean).map((line) => `<div class="store-sub">${line}</div>`).join('');

  const statusColors: Record<string, string> = { paid: '#2e7d32', partial: '#ed6c02', pending: '#d32f2f' };

  win.document.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>Purchase Order ${po.invoiceNumber}</title>
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
    .supplier-box { margin:8px 0; }
    .supplier-box .label { font-size:10.5px; text-transform:uppercase; letter-spacing:1px; color:#666; margin-bottom:2px; }
    .supplier-box .name { font-size:14px; font-weight:700; }
    table { width:100%; border-collapse:collapse; margin:8px 0; }
    th { font-size:10.5px; text-align:left; padding:5px 4px; border-bottom:1.5px solid #000; border-top:1.5px solid #000; background:#f5f5f5; }
    td { font-size:11px; padding:5px 4px; vertical-align:top; border-bottom:1px solid #eee; }
    .r { text-align:right; }
    .totals-table { width:280px; margin-left:auto; }
    .totals-table td { padding:3px 4px; font-size:12px; }
    .total-row td { font-weight:700; font-size:15px; border-top:1.5px solid #000; padding-top:6px; }
    .payment-box { display:flex; justify-content:space-between; align-items:center; margin-top:12px; padding-top:8px; border-top:1px dashed #999; }
    .status-badge { display:inline-block; border-radius:3px; padding:2px 10px; font-weight:700; font-size:11px; color:#fff; }
    .footer { text-align:center; margin-top:16px; font-size:10.5px; color:#555; }
    .notes { margin-top:10px; font-size:11px; color:#444; }
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
    <div class="invoice-title">Purchase Order</div>
  </div>
  <div class="solid"></div>
  <div class="meta-grid"><span>PO No: <b>${po.invoiceNumber}</b></span><span>Date: <b>${dateStr}</b></span></div>
  <div class="dashed"></div>
  <div class="supplier-box">
    <div class="label">Supplier</div>
    <div class="name">${po.supplierName}</div>
    ${supplierLines}
  </div>
  <table>
    <thead>
      <tr>
        <th>Sr.</th>
        <th>Medicine</th>
        <th>Batch</th>
        <th>Expiry</th>
        <th class="r">Qty</th>
        <th class="r">Rate</th>
        <th class="r">GST%</th>
        <th class="r">Amount</th>
      </tr>
    </thead>
    <tbody>${itemRows}</tbody>
  </table>
  <table class="totals-table">
    <tr><td>Subtotal</td><td class="r">₹${po.subtotal.toFixed(2)}</td></tr>
    <tr><td>GST</td><td class="r">₹${po.gstAmount.toFixed(2)}</td></tr>
    <tr class="total-row"><td>Grand Total</td><td class="r">₹${po.totalAmount.toFixed(2)}</td></tr>
  </table>
  <div class="payment-box">
    <span>Paid: <b>₹${po.paidAmount.toFixed(2)}</b> &nbsp;|&nbsp; Balance Due: <b>₹${po.balanceAmount.toFixed(2)}</b></span>
    <span class="status-badge" style="background:${statusColors[po.paymentStatus] || '#666'}">${po.paymentStatus.toUpperCase()}</span>
  </div>
  ${po.notes ? `<div class="notes"><b>Notes:</b> ${po.notes}</div>` : ''}
  <div class="footer">
    <div>This is a computer-generated purchase order.</div>
  </div>
  <script>
    window.onload = function() { window.print(); };
  </script>
</body>
</html>`);
  win.document.close();
};
