import React from 'react';
import { Search, Bell, Plus } from 'lucide-react';

interface TopbarProps {
  title: string;
  onSearch: (query: string) => void;
}

export const Topbar: React.FC<TopbarProps> = ({ title, onSearch }) => {
  return (
    <header className="topbar">
      <div className="topbar-title-wrapper">
        <h1 id="view-title">
          {title}
        </h1>
        <span className="topbar-eyebrow">
          Brand Control Room
        </span>
      </div>

      <div className="topbar-actions">
        <label className="search-field">
          <Search size={14} style={{ color: '#94a3b8' }} />
          <input
            id="global-search"
            type="search"
            placeholder="Search orders, SKU..."
            onChange={(e) => onSearch(e.target.value)}
          />
        </label>
        <button
          className="icon-button"
          type="button"
          aria-label="Notifications"
          title="Notifications"
        >
          <Bell size={14} style={{ color: '#475569' }} />
        </button>
        <button className="primary-action" type="button">
          <Plus size={14} />
          <span>New Order</span>
        </button>
      </div>
    </header>
  );
};
