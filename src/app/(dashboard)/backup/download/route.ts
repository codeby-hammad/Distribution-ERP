import { zipSync, strToU8 } from 'fflate';
import { requireProfile } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const TABLES: { name: string; order?: string; cols?: string }[] = [
  { name: 'profiles', cols: 'id, full_name, role, is_active' },
  { name: 'companies' },
  { name: 'products' },
  { name: 'routes' },
  { name: 'shops' },
  { name: 'warehouses' },
  { name: 'orders' },
  { name: 'order_items' },
  { name: 'order_schemes' },
  { name: 'order_edits' },
  { name: 'delivery_trips' },
  { name: 'trip_orders', order: 'trip_id' },
  { name: 'trip_load_checks' },
  { name: 'trip_cash_entries' },
  { name: 'invoices' },
  { name: 'invoice_items' },
  { name: 'shop_ledger' },
  { name: 'collections' },
  { name: 'cash_handovers' },
  { name: 'stock_movements' },
  { name: 'grns' },
  { name: 'grn_items' },
  { name: 'visits' },
  { name: 'expenses' },
  { name: 'schemes' },
  { name: 'sales_returns' },
  { name: 'sales_return_items' },
  { name: 'return_requests' },
  { name: 'return_request_items' },
];

const PAGE = 1000;
const MAX_PAGES = 200;

export async function GET() {
  const { supabase, profile } = await requireProfile();
  if (profile.role !== 'owner') return new Response('Only the owner can download a full backup', { status: 403 });

  const files: Record<string, Uint8Array> = {};
  const manifest: Record<string, unknown> = {
    created_at: new Date().toISOString(),
    by: profile.full_name,
    note: 'Data export of business tables. Not a database backup. Passwords and logins are not included.',
    tables: {} as Record<string, unknown>,
  };
  const tables = manifest.tables as Record<string, unknown>;

  for (const t of TABLES) {
    const rows: unknown[] = [];
    let error = '';
    for (let page = 0; page < MAX_PAGES; page++) {
      const { data, error: e } = await supabase
        .from(t.name)
        .select(t.cols ?? '*')
        .order(t.order ?? 'id')
        .range(page * PAGE, page * PAGE + PAGE - 1);
      if (e) {
        error = e.message;
        break;
      }
      rows.push(...(data ?? []));
      if (!data || data.length < PAGE) break;
    }
    files[`${t.name}.json`] = strToU8(JSON.stringify(rows));
    tables[t.name] = error ? { rows: rows.length, error } : { rows: rows.length };
  }

  files['manifest.json'] = strToU8(JSON.stringify(manifest, null, 2));
  const zip = zipSync(files, { level: 6 });

  const stamp = new Date(Date.now() + 5 * 3600 * 1000).toISOString().slice(0, 10);
  return new Response(zip as unknown as BodyInit, {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="erp-data-backup-${stamp}.zip"`,
      'Cache-Control': 'no-store',
    },
  });
}