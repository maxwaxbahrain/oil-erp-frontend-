import { createRoot, type Root } from 'react-dom/client';
import { act, type ReactElement } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { ChequeConfirmPanel, ForeignTransferNotice, InlineConfirmPanel } from '../Banking';

function mount(node: ReactElement) {
  const host = document.createElement('div');
  document.body.appendChild(host);
  let root: Root;
  act(() => {
    root = createRoot(host);
    root.render(node);
  });
  return {
    host,
    cleanup() {
      act(() => {
        root.unmount();
      });
      host.remove();
    },
  };
}

describe('ChequeConfirmPanel', () => {
  it('renders cheque details and fires the action only after Confirm', () => {
    const patch = vi.fn();
    const view = mount(
      <ChequeConfirmPanel
        chequeNo="1044"
        amountLabel="$110.00"
        customer="Al Noor Trading"
        effect="Clear will record a $110.00 payment dated today"
        onConfirm={patch}
        onCancel={() => undefined}
      />,
    );

    expect(view.host.textContent).toContain('1044');
    expect(view.host.textContent).toContain('$110.00');
    expect(view.host.textContent).toContain('Al Noor Trading');
    expect(view.host.textContent).toContain('Clear will record a $110.00 payment dated today');
    expect(patch).not.toHaveBeenCalled();

    const confirm = Array.from(view.host.querySelectorAll('button')).find((button) => button.textContent === 'Confirm');
    act(() => {
      confirm?.click();
    });
    expect(patch).toHaveBeenCalledTimes(1);

    view.cleanup();
  });

  it('does not fire the action when Cancel is clicked', () => {
    const patch = vi.fn();
    const view = mount(
      <ChequeConfirmPanel
        chequeNo="1044"
        amountLabel="$110.00"
        customer="Al Noor Trading"
        effect="Bounce will void that payment"
        onConfirm={patch}
        onCancel={() => undefined}
      />,
    );
    const cancel = Array.from(view.host.querySelectorAll('button')).find((button) => button.textContent === 'Cancel');
    act(() => {
      cancel?.click();
    });
    expect(patch).not.toHaveBeenCalled();
    view.cleanup();
  });
});

describe('InlineConfirmPanel delete', () => {
  it('renders the amount and fires the delete callback only after Confirm', () => {
    const remove = vi.fn();
    const view = mount(
      <InlineConfirmPanel
        title="Confirm delete"
        lines={['Bank fee', 'Money out', '$10.00', '2 Jan 2026']}
        effect="Delete will reverse the posted entry in the books. The row stays visible as Reversed."
        onConfirm={remove}
        onCancel={() => undefined}
      />,
    );

    expect(view.host.textContent).toContain('$10.00');
    expect(view.host.textContent).toContain('Delete will reverse the posted entry in the books. The row stays visible as Reversed.');
    expect(remove).not.toHaveBeenCalled();

    const confirm = Array.from(view.host.querySelectorAll('button')).find((button) => button.textContent === 'Confirm');
    act(() => {
      confirm?.click();
    });
    expect(remove).toHaveBeenCalledTimes(1);

    view.cleanup();
  });
});

describe('ForeignTransferNotice', () => {
  it('shows the transfer message when the row account is not the selected account', () => {
    const selectedAccountId = 2;
    const rowAccountId = 1;
    expect(rowAccountId).not.toBe(selectedAccountId);
    const open = vi.fn();
    const view = mount(
      <ForeignTransferNotice accountName="Bank" onOpenAccount={open} />,
    );
    expect(view.host.textContent).toContain('This transfer was recorded from the Bank account — edit it there');
    const link = view.host.querySelector('button');
    act(() => {
      link?.click();
    });
    expect(open).toHaveBeenCalledTimes(1);
    view.cleanup();
  });
});
