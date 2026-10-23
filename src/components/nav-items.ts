import {
  Banknote,
  BarChart3,
  Building2,
  CalendarCheck,
  ClipboardList,
  DatabaseBackup,
  Gift,
  LayoutDashboard,
  MapPin,
  Package,
  Receipt,
  RotateCcw,
  Route as RouteIcon,
  Settings,
  Store,
  Truck,
  UserPlus,
  Users,
  Wallet,
} from 'lucide-react';
import { canAccess } from '@/lib/access';

export type NavItem = { href: string; label: string; icon: typeof LayoutDashboard };
export type NavGroup = { title: string; items: NavItem[] };

export const NAV_GROUPS: NavGroup[] = [
  {
    title: 'Overview',
    items: [
      { href: '/', label: 'Home', icon: LayoutDashboard },
      { href: '/today', label: 'Today', icon: CalendarCheck },
    ],
  },
  {
    title: 'Sales',
    items: [
      { href: '/orders', label: 'Orders', icon: ClipboardList },
      { href: '/schemes', label: 'Schemes', icon: Gift },
      { href: '/returns', label: 'Returns', icon: RotateCcw },
      { href: '/recovery', label: 'Recovery', icon: Banknote },
    ],
  },
  {
    title: 'Delivery',
    items: [{ href: '/trips', label: 'Trips', icon: Truck }],
  },
  {
    title: 'Stock',
    items: [
      { href: '/products', label: 'Products & Stock', icon: Package },
      { href: '/suppliers', label: 'Suppliers', icon: Building2 },
    ],
  },
  {
    title: 'Money',
    items: [
      { href: '/cash', label: 'Cash', icon: Wallet },
      { href: '/expenses', label: 'Expenses', icon: Receipt },
      { href: '/reports', label: 'Reports', icon: BarChart3 },
    ],
  },
  {
    title: 'Customers & field',
    items: [
      { href: '/shops', label: 'Shops', icon: Store },
      { href: '/new-shops', label: 'New shops', icon: UserPlus },
      { href: '/routes', label: 'Routes', icon: RouteIcon },
      { href: '/activity', label: 'Field activity', icon: MapPin },
    ],
  },
  {
    title: 'Admin',
    items: [
      { href: '/staff', label: 'Staff', icon: Users },
      { href: '/settings', label: 'Settings', icon: Settings },
      { href: '/backup', label: 'Backup & data', icon: DatabaseBackup },
    ],
  },
];

// flat list, same order as the groups (used by the dashboard and the mobile bar)
export const NAV: NavItem[] = NAV_GROUPS.flatMap((g) => g.items);

export const navFor = (role: string) => NAV.filter((n) => canAccess(role, n.href));

export const groupsFor = (role: string) =>
  NAV_GROUPS.map((g) => ({ ...g, items: g.items.filter((n) => canAccess(role, n.href)) })).filter(
    (g) => g.items.length > 0
  );

export const isActive = (pathname: string, href: string) =>
  href === '/' ? pathname === '/' : pathname.startsWith(href);