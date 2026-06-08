import React from 'react';
import { LayoutDashboard, PackageCheck, Boxes, Landmark, Megaphone, Workflow, Coins } from 'lucide-react';

interface SidebarProps {
  activeView: string;
  onNavigate: (view: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeView, onNavigate }) => {
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'orders', label: 'Orders', icon: PackageCheck },
    { id: 'inventory', label: 'Inventory', icon: Boxes },
    { id: 'accounting', label: 'Accounting', icon: Landmark },
    { id: 'finance', label: 'Finance', icon: Coins },
    { id: 'ads', label: 'Meta Ads', icon: Megaphone },
    { id: 'scale', label: 'Scale Ops', icon: Workflow },
  ];

  return (
    <aside className="sidebar" aria-label="Primary navigation">
      <div className="brand-lockup">
        <div className="brand-mark">TO</div>
        <div>
          <strong>ThreadOps</strong>
          <span>Commerce OS</span>
        </div>
      </div>

      <nav className="nav-stack">
        {navItems.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            className={`nav-item ${activeView === id ? 'is-active' : ''}`}
            data-view={id}
            onClick={() => onNavigate(id)}
            type="button"
            aria-current={activeView === id ? 'page' : undefined}
          >
            <Icon size={20} />
            <span>{label}</span>
          </button>
        ))}
      </nav>

      <div className="sync-panel">
        <span className="sync-dot"></span>
        <div>
          <strong>Last sync 4m ago</strong>
          <span>WooCommerce, Pathao, bank, Meta</span>
        </div>
      </div>
    </aside>
  );
};
