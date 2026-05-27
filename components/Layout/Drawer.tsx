import React from 'react';

interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  content?: React.ReactNode;
  title?: string;
}

export const Drawer: React.FC<DrawerProps> = ({ isOpen, onClose, content, title }) => {
  return (
    <aside
      className={`drawer ${isOpen ? 'is-open' : ''}`}
      id="order-drawer"
      aria-label="Order details"
    >
      <div className="drawer-header">
        <h2>{title || 'Details'}</h2>
        <button
          className="icon-button drawer-close"
          id="drawer-close"
          onClick={onClose}
          type="button"
          aria-label="Close order details"
          title="Close"
        >
          ✕
        </button>
      </div>
      <div id="drawer-content">
        {content}
      </div>
    </aside>
  );
};
