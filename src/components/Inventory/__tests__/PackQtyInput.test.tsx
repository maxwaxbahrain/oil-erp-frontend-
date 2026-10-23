import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import PackQtyInput from '../PackQtyInput';
import { planBarcodeScan, toLinePayload, type PackEntryValue } from '../../../utils/packEntry';

function setValue(el: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  setter?.call(el, value);
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
}

describe('PackQtyInput', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  function render(value: PackEntryValue, onChange = vi.fn(), priceEditable = true) {
    act(() => {
      root.render(
        <PackQtyInput
          product={{ packQty: 12, packUnit: 'case', baseUnit: 'qt' }}
          value={value}
          onChange={onChange}
          basePrice={10}
          priceEditable={priceEditable}
          packQtySnapshot={value.enteredUom === 'pack' ? 12 : null}
        />,
      );
    });
    return onChange;
  }

  it('shows the unit toggle only when the product has a pack size', () => {
    render({ enteredQty: 2, enteredUom: 'base', enteredUnitPrice: 10 });
    expect(container.querySelector('[aria-label="Unit"]')).toBeTruthy();
    expect(container.textContent).toContain('case');
    expect(container.textContent).toContain('qt');

    act(() => {
      root.render(
        <PackQtyInput
          product={{ packQty: null, baseUnit: 'qt' }}
          value={{ enteredQty: 2, enteredUom: 'base', enteredUnitPrice: 10 }}
          onChange={() => undefined}
          basePrice={10}
        />,
      );
    });
    expect(container.querySelector('[aria-label="Unit"]')).toBeNull();
    expect(container.querySelector('input[aria-label="Quantity"]')).toBeTruthy();
  });

  it('prefills the pack price with base price times pack qty', () => {
    const onChange = render({ enteredQty: 2, enteredUom: 'base', enteredUnitPrice: 10 });
    const pack = Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'case');
    act(() => pack?.click());
    expect(onChange).toHaveBeenCalledWith({
      enteredUom: 'pack',
      enteredQty: 2,
      enteredUnitPrice: 120,
    });
  });

  it('captions loaded pack rows from pack_qty_snapshot', () => {
    act(() => {
      root.render(
        <PackQtyInput
          product={{ packQty: 24, packUnit: 'case', baseUnit: 'qt' }}
          value={{ enteredQty: 2, enteredUom: 'pack', enteredUnitPrice: 120 }}
          onChange={() => undefined}
          basePrice={10}
          packQtySnapshot={12}
        />,
      );
    });
    expect(container.textContent).toContain('= 24 qt');
  });

  it('toLinePayload returns pack and base entry columns', () => {
    expect(toLinePayload({
      enteredQty: 2,
      enteredUom: 'pack',
      enteredUnitPrice: 120,
      packQty: 12,
      packQtySnapshot: 12,
    })).toMatchObject({
      quantity: 24,
      amount: 240,
      entered_qty: 2,
      entered_uom: 'pack',
      entered_unit_price: 120,
    });
    expect(toLinePayload({
      enteredQty: 3,
      enteredUom: 'base',
      enteredUnitPrice: 8,
    })).toMatchObject({
      quantity: 3,
      rate: 8,
      amount: 24,
      entered_uom: 'base',
      entered_qty: 3,
      entered_unit_price: 8,
    });
  });

  it('keeps a read-only pack price', () => {
    const onChange = render(
      { enteredQty: 1, enteredUom: 'pack', enteredUnitPrice: 96 },
      vi.fn(),
      false,
    );
    const price = container.querySelector('input[aria-label="Price per pack"]') as HTMLInputElement;
    expect(price.readOnly).toBe(true);
    expect(price.value).toBe('96');
    act(() => setValue(price, '10'));
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe('barcode scan plan', () => {
  const product = { id: '4', packQty: 12, packUnit: 'case', baseUnit: 'qt' };

  it('opens pack mode when the matched pack equals the product pack', () => {
    const plan = planBarcodeScan([], product, 12, 10);
    expect(plan.mode).toBe('pack');
    expect(plan.enteredQty).toBe(1);
    expect(plan.quantity).toBe(12);
    expect(plan.index).toBe(-1);
  });

  it('opens base mode for a different matched pack qty', () => {
    const plan = planBarcodeScan([], product, 6, 10);
    expect(plan.mode).toBe('base');
    expect(plan.quantity).toBe(6);
  });

  it('increments the pack counter when the same product is scanned again', () => {
    const again = planBarcodeScan(
      [{ productId: '4', enteredUom: 'pack', enteredQty: 1, quantity: 12, enteredUnitPrice: 120 }],
      product,
      12,
      10,
    );
    expect(again.index).toBe(0);
    expect(again.enteredQty).toBe(2);
    expect(again.quantity).toBe(24);
  });
});
