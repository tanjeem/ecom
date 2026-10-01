import React from 'react';
import { Search, Plus } from 'lucide-react';

interface TopbarProps {
  title: string;
  searchQuery: string;
  onSearch: (query: string) => void;
  onNewOrder: () => void;
}

export const Topbar: React.FC<TopbarProps> = ({ title, searchQuery, onSearch, onNewOrder }) => {
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
            placeholder="Search orders, customer, phone…"
            value={searchQuery}
            onChange={(e) => onSearch(e.target.value)}
          />
        </label>
        <button className="primary-action" type="button" onClick={onNewOrder}>
          <Plus size={14} />
          <span>New Order</span>
        </button>
      </div>
    </header>
  );
};
