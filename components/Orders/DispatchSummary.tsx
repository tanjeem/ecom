import React from 'react';

interface DispatchSummaryProps {
  selectedCount: number;
  readyCount: number;
  totalPayable: number;
  onSyncWooCommerce: () => void;
  onBulkSendPathao: () => void;
  isLoading?: boolean;
}

export const DispatchSummary: React.FC<DispatchSummaryProps> = ({
  selectedCount,
  readyCount,
  totalPayable,
  onSyncWooCommerce,
  onBulkSendPathao,
  isLoading = false,
}) => {
  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <h2>Pathao Dispatch</h2>
          <p>Send checked orders to Pathao and sync courier status, payable amount, and consignment.</p>
        </div>
      </div>
      <div className="dispatch-summary">
        <div>
          <span>Selected</span>
          <strong id="selected-count">{selectedCount}</strong>
        </div>
        <div>
          <span>Ready for Pathao</span>
          <strong id="pathao-ready-count">{readyCount}</strong>
        </div>
        <div>
          <span>Total COD payable</span>
          <strong id="pathao-payable-total">BDT {totalPayable.toLocaleString()}</strong>
        </div>
      </div>
      <div className="toolbar-buttons dispatch-actions">
        <button
          className="secondary-action"
          id="sync-woocommerce"
          type="button"
          onClick={onSyncWooCommerce}
          disabled={isLoading}
        >
          <span>🔄 Sync Woo Orders</span>
        </button>
        <button
          className="primary-action"
          id="bulk-send-pathao"
          type="button"
          onClick={onBulkSendPathao}
          disabled={isLoading || selectedCount === 0}
        >
          <span>📤 Send Selected to Pathao</span>
        </button>
      </div>
      <div className="pathao-log" id="pathao-log">
        Waiting for courier action.
      </div>
    </section>
  );
};
