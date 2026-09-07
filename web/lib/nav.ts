import type { LucideIcon } from 'lucide-react';
import {
  Bell,
  Boxes,
  FileText,
  LayoutDashboard,
  LineChart,
  LifeBuoy,
  Package,
  Receipt,
  Settings,
  Users,
  UserSquare2,
  UsersRound,
} from 'lucide-react';

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  ownerOnly?: boolean;
}

export interface NavSection {
  title: string;
  items: NavItem[];
}

export const NAV: NavSection[] = [
  {
    title: 'Overview',
    items: [
      { href: '/', label: 'Dashboard', icon: LayoutDashboard },
      { href: '/catalog', label: 'Catalog', icon: Package },
      { href: '/stock', label: 'Stock', icon: Boxes },
      { href: '/stock/movements', label: 'Stock movements', icon: LineChart },
      { href: '/sales', label: 'Sales', icon: Receipt },
      { href: '/invoices', label: 'Invoices', icon: FileText },
      { href: '/customers', label: 'Customers', icon: UserSquare2 },
    ],
  },
  {
    title: 'Manage',
    items: [
      { href: '/members', label: 'Members', icon: Users, ownerOnly: true },
      { href: '/wingers', label: 'Wingers', icon: UsersRound, ownerOnly: true },
      { href: '/alerts', label: 'Alerts', icon: Bell, ownerOnly: true },
      { href: '/reports', label: 'Reports', icon: LineChart, ownerOnly: true },
      { href: '/settings', label: 'Settings', icon: Settings, ownerOnly: true },
      { href: '/support', label: 'Support', icon: LifeBuoy, ownerOnly: true },
    ],
  },
];
