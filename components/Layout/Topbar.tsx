import React from 'react';
import { Search, Bell, Plus } from 'lucide-react';

interface TopbarProps {
  title: string;
  onSearch: (query: string) => void;
}

export const Topbar: React.FC<TopbarProps> = ({ title, onSearch }) => {
  return (
    <header className="topbar">
      <div>
        <p className="eyebrow">Clothing brand control room</p>
        <h1 id="view-title">{title}</h1>
      </div>

      <div className="topbar-actions">
        <label className="search-field">
          <Search size={18} />
          <input
            id="global-search"
            type="search"
            placeholder="Search orders, SKU, customer"
            onChange={(e) => onSearch(e.target.value)}
          />
        </label>
        <button
          className="icon-button"
          type="button"
          aria-label="Notifications"
          title="Notifications"
        >
          <Bell size={20} />
        </button>
        <button className="primary-action" type="button">
          <Plus size={18} />
          <span>New Order</span>
        </button>
      </div>
    </header>
  );
};
