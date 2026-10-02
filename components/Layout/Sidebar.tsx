import React, { useEffect, useState } from 'react';
import { LayoutDashboard, PackageCheck, Boxes, Workflow, Coins, LogOut } from 'lucide-react';

interface SidebarProps {
  activeView: string;
  onNavigate: (view: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeView, onNavigate }) => {
  const [me, setMe] = useState<{ user: string | null; role: string } | null>(null);
  useEffect(() => {
    fetch('/api/auth/me').then(r => r.json()).then(setMe).catch(() => {});
  }, []);
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'orders', label: 'Orders', icon: PackageCheck },
    { id: 'inventory', label: 'Inventory', icon: Boxes },
    { id: 'finance', label: 'Finance', icon: Coins },
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

      <button
        type="button"
        className="nav-item nav-signout"
        onClick={async () => {
          await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
          window.location.href = '/login';
        }}
      >
        <LogOut size={20} />
        <span>
          Sign out<span className="nav-extra">{me?.user ? ` (${me.user})` : ''}</span>
          {me?.role === 'viewer' && (
            <span style={{ marginLeft: 6, fontSize: '0.66rem', fontWeight: 800, padding: '1px 6px', borderRadius: 99, background: '#fef3c7', color: '#92400e' }}>View only</span>
          )}
        </span>
      </button>
    </aside>
  );
};
