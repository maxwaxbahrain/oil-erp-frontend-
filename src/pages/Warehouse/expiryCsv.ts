import type { Product } from '../../services/productService';
import type { ExpiringLot } from '../../services/stockLotService';

function csvCell(value: string | number | null | undefined): string {
  const text = value == null ? '' : String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function expiringCsv(
  rows: ExpiringLot[],
  products: Map<number, Pick<Product, 'name' | 'sku'>>,
  codes: Map<number, string>,
): string {
  const header = ['Product', 'SKU', 'Lot', 'Expiry', 'Days left', 'Location', 'Qty', 'Expired'];
  const body = rows.map((row) => [
    products.get(row.product_id)?.name ?? row.product_id,
    products.get(row.product_id)?.sku ?? '',
    row.lot_number,
    row.expiry_date ?? '',
    row.days_left,
    row.location_id == null ? '' : (codes.get(row.location_id) ?? row.location_id),
    row.qty,
    row.expired ? 'yes' : 'no',
  ]);
  return [header, ...body].map((line) => line.map(csvCell).join(',')).join('\n');
}
