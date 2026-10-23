export type Role = 'owner' | 'manager' | 'salesman' | 'delivery' | 'cashier' | 'warehouse';

const RULES: [string, Role[]][] = [
  ['/today', ['owner', 'manager', 'salesman']],
  ['/orders', ['owner', 'manager', 'salesman']],
  ['/recovery', ['owner', 'manager', 'salesman', 'delivery', 'cashier']],
  ['/trips', ['owner', 'manager', 'warehouse', 'delivery', 'cashier']],
  ['/invoices', ['owner', 'manager', 'warehouse', 'delivery', 'cashier']],
  ['/cash', ['owner', 'manager', 'cashier']],
  ['/stock', ['owner', 'manager', 'warehouse']],
  ['/products', ['owner', 'manager', 'salesman', 'warehouse']],
  ['/routes', ['owner', 'manager']],
  ['/shops', ['owner', 'manager', 'cashier']],
  ['/suppliers', ['owner', 'manager']],
  ['/staff', ['owner']],
  ['/activity', ['owner', 'manager']],
  ['/new-shops', ['owner', 'manager']],
  ['/reports', ['owner', 'manager']],
  ['/expenses', ['owner', 'manager', 'cashier']],
  ['/schemes', ['owner', 'manager']],
  ['/settings', ['owner']],
  ['/returns', ['owner', 'manager']],
  ['/backup', ['owner', 'manager']],
];

export function canAccess(role: string, pathname: string): boolean {
  if (pathname === '/') return true;
  if (/^\/trips\/[^/]+\/settle/.test(pathname)) {
    return ['owner', 'manager', 'cashier'].includes(role);
  }
  if (/^\/trips\/[^/]+\/payments/.test(pathname)) {
    return ['owner', 'manager', 'cashier'].includes(role);
  }
  const rule = RULES.find(([p]) => pathname === p || pathname.startsWith(p + '/'));
  return rule ? rule[1].includes(role as Role) : true;
}