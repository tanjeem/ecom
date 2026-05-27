/* eslint-disable @next/next/no-html-link-for-pages */
import React, { useState } from 'react';
import { Wand2 } from 'lucide-react';

interface InboxOrderFormProps {
  onSubmit: (data: InboxOrderData) => void;
  isLoading?: boolean;
  status?: 'draft' | 'pending' | 'success' | 'error';
}

export interface InboxOrderData {
  name: string;
  phone: string;
  address: string;
  product: string;
  price: number;
}

export const InboxOrderForm: React.FC<InboxOrderFormProps> = ({
  onSubmit,
  isLoading = false,
  status = 'draft',
}) => {
  const [formData, setFormData] = useState<InboxOrderData>({
    name: '',
    phone: '',
    address: '',
    product: '',
    price: 0,
  });

  const handleParseInboxText = (text: string) => {
    // Simple parsing logic for inbox text
    const lines = text.split('\n');
    const parsed: Partial<InboxOrderData> = {};

    lines.forEach((line) => {
      if (line.startsWith('Name:')) {
        parsed.name = line.replace('Name:', '').trim();
      } else if (line.startsWith('Phone:')) {
        parsed.phone = line.replace('Phone:', '').trim();
      } else if (line.startsWith('Address:')) {
        parsed.address = line.replace('Address:', '').trim();
      } else if (line.startsWith('Product:')) {
        parsed.product = line.replace('Product:', '').trim();
      } else if (line.startsWith('Price:')) {
        parsed.price = Number.parseInt(line.replace('Price:', '').trim(), 10);
      }
    });

    setFormData((prev) => ({ ...prev, ...parsed }));
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <form className="inbox-form" id="inbox-order-form" onSubmit={handleSubmit}>
      <label className="field-block full-span">
        <span>Paste inbox order</span>
        <textarea
          id="inbox-paste"
          rows={4}
          placeholder="Name: Ayesha&#10;Phone: 01700000000&#10;Address: Banani, Dhaka&#10;Product: Black Linen Shirt M&#10;Price: 2450"
          onChange={(e) => handleParseInboxText(e.target.value)}
        />
      </label>

      <button
        className="secondary-action full-span"
        id="parse-inbox-order"
        type="button"
        onClick={() => {
          const textarea = document.getElementById('inbox-paste') as HTMLTextAreaElement;
          if (textarea) {
            handleParseInboxText(textarea.value);
          }
        }}
      >
        <Wand2 size={18} />
        <span>Parse Paste</span>
      </button>

      <label className="field-block">
        <span>Name</span>
        <input
          id="inbox-name"
          type="text"
          placeholder="Customer name"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
        />
      </label>
      <label className="field-block">
        <span>Phone</span>
        <input
          id="inbox-phone"
          type="tel"
          placeholder="Phone number"
          value={formData.phone}
          onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
        />
      </label>
      <label className="field-block full-span">
        <span>Address</span>
        <input
          id="inbox-address"
          type="text"
          placeholder="Delivery address"
          value={formData.address}
          onChange={(e) => setFormData({ ...formData, address: e.target.value })}
        />
      </label>
      <label className="field-block">
        <span>Product</span>
        <input
          id="inbox-product"
          type="text"
          placeholder="Product and variation"
          value={formData.product}
          onChange={(e) => setFormData({ ...formData, product: e.target.value })}
        />
      </label>
      <label className="field-block">
        <span>Price</span>
        <input
          id="inbox-price"
          type="number"
          min="0"
          placeholder="0"
          value={formData.price}
          onChange={(e) => setFormData({ ...formData, price: Number.parseInt(e.target.value, 10) })}
        />
      </label>

      <button
        className="primary-action full-span"
        type="submit"
        disabled={isLoading}
      >
        <span>✓ Verify & Create Woo Order</span>
      </button>

      <div
        style={{
          marginTop: '0.5rem',
          padding: '0.5rem',
          borderRadius: '0.25rem',
          backgroundColor: status === 'error' ? '#ffe0e0' : '#e0f0ff',
          color: status === 'error' ? '#d32f2f' : '#0066cc',
          fontSize: '0.875rem',
        }}
      >
        Status: {status}
      </div>
    </form>
  );
};
