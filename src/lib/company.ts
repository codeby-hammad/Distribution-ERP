import type { SupabaseClient } from '@supabase/supabase-js';

export type Company = {
  name: string;
  address: string | null;
  phone: string | null;
  ntn: string | null;
  strn: string | null;
  invoice_footer: string | null;
  logoUrl: string | null;
  taxEnabled: boolean;
  taxRate: number;
  taxRateFiler: number;
  taxRateNonFiler: number;
};

export async function getCompany(supabase: SupabaseClient): Promise<Company> {
  const { data } = await supabase
    .from('tenants')
    .select('name, address, phone, ntn, strn, invoice_footer, logo_path,  tax_enabled, sales_tax_rate, tax_rate_filer, tax_rate_nonfiler')
    .maybeSingle();

  const logoUrl = data?.logo_path
    ? supabase.storage.from('company-logo').getPublicUrl(data.logo_path as string).data.publicUrl
    : null;

  return {
    name: (data?.name as string) ?? 'Distribution',
    address: (data?.address as string) ?? null,
    phone: (data?.phone as string) ?? null,
    ntn: (data?.ntn as string) ?? null,
    strn: (data?.strn as string) ?? null,
    invoice_footer: (data?.invoice_footer as string) ?? null,
    logoUrl,
    taxEnabled: Boolean(data?.tax_enabled),
    taxRate: Number(data?.sales_tax_rate ?? 18),
    taxRateFiler: Number(data?.tax_rate_filer ?? data?.sales_tax_rate ?? 18),
    taxRateNonFiler: Number(data?.tax_rate_nonfiler ?? data?.sales_tax_rate ?? 18),
  };
}