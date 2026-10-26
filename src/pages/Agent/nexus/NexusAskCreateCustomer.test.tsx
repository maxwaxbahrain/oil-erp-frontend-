import { createRoot, type Root } from 'react-dom/client';
import { act, type ReactElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const { createCustomer, updateCustomer, apiPost, speakZava } = vi.hoisted(() => ({
  createCustomer: vi.fn(),
  updateCustomer: vi.fn(),
  apiPost: vi.fn(),
  speakZava: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../services/customerService', () => ({
  createCustomer,
  updateCustomer,
}));

vi.mock('../../../api/axios', () => ({
  default: { post: (...args: unknown[]) => apiPost(...args), get: vi.fn() },
}));

import NexusAsk from './NexusAsk';
import { setNexusTranscriptHook } from './nexusVoiceIntercept';

function setValue(el: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  setter?.call(el, value);
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
}

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
      act(() => root.unmount());
      host.remove();
      setNexusTranscriptHook(null);
    },
  };
}

describe('Nexus Ask create customer', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    vi.clearAllMocks();
  });

  beforeEach(() => {
    apiPost.mockImplementation((url: string) => {
      if (url === '/api/agent/extract-customer') {
        return Promise.resolve({
          data: {
            name: 'Surjeet A1',
            email: null,
            phone: '7185550177',
            address: '37th Ave',
            category: null,
            credit_limit: 3000,
            opening_balance: null,
            notes: null,
            filled_fields: ['name', 'phone', 'credit_limit'],
            warnings: [],
            possible_duplicates: [],
          },
        });
      }
      return Promise.reject(new Error(url));
    });
    createCustomer.mockResolvedValue({ id: '412', name: 'Surjeet A1' });
  });

  it('shows draft and creates once via button', async () => {
    const { host, cleanup } = mount(
      <NexusAsk
        onNavigate={vi.fn()}
        onMicTap={vi.fn()}
        canCreateCustomers
        speakZava={speakZava}
        handsFreeActive={false}
      />,
    );
    const input = host.querySelector('[aria-label="Ask Zava"]') as HTMLInputElement;
    await act(async () => {
      setValue(input, 'Add a new customer Surjeet A1 7185550177 limit 3000');
      (host.querySelector('form') as HTMLFormElement).requestSubmit();
    });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
    expect(host.querySelector('[data-testid="nexus-customer-draft"]')).toBeTruthy();
    await act(async () => {
      (host.querySelector('[data-testid="nexus-draft-create"]') as HTMLButtonElement).click();
      await Promise.resolve();
    });
    expect(createCustomer).toHaveBeenCalledTimes(1);
    expect(host.querySelector('[data-testid="nexus-customer-created"]')).toBeTruthy();
    cleanup();
  });

  it('does not create on cancel or plain yes voice', async () => {
    const { host, cleanup } = mount(
      <NexusAsk
        onNavigate={vi.fn()}
        onMicTap={vi.fn()}
        canCreateCustomers
        speakZava={speakZava}
        handsFreeActive={false}
      />,
    );
    const input = host.querySelector('[aria-label="Ask Zava"]') as HTMLInputElement;
    await act(async () => {
      setValue(input, 'create a new customer Test Co');
      (host.querySelector('form') as HTMLFormElement).requestSubmit();
    });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
    let hook = false;
    await act(async () => {
      const { tryNexusTranscriptHook } = await import('./nexusVoiceIntercept');
      hook = await tryNexusTranscriptHook('yes');
    });
    expect(hook).toBe(true);
    expect(createCustomer).not.toHaveBeenCalled();
    await act(async () => {
      const { tryNexusTranscriptHook } = await import('./nexusVoiceIntercept');
      await tryNexusTranscriptHook('cancel');
    });
    expect(host.querySelector('[data-testid="nexus-customer-draft"]')).toBeNull();
    cleanup();
  });

  it('undo sends status-only update; failure keeps created card', async () => {
    updateCustomer.mockRejectedValueOnce(new Error('network'));
    const { host, cleanup } = mount(
      <NexusAsk
        onNavigate={vi.fn()}
        onMicTap={vi.fn()}
        canCreateCustomers
        speakZava={speakZava}
        handsFreeActive={false}
      />,
    );
    const input = host.querySelector('[aria-label="Ask Zava"]') as HTMLInputElement;
    await act(async () => {
      setValue(input, 'add customer Surjeet A1');
      (host.querySelector('form') as HTMLFormElement).requestSubmit();
    });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
    await act(async () => {
      (host.querySelector('[data-testid="nexus-draft-create"]') as HTMLButtonElement).click();
      await Promise.resolve();
    });
    await act(async () => {
      (host.querySelector('[data-testid="nexus-created-undo"]') as HTMLButtonElement).click();
      await Promise.resolve();
    });
    expect(updateCustomer).toHaveBeenCalledWith('412', { status: 'Inactive' });
    expect(host.querySelector('[data-testid="nexus-customer-created"]')).toBeTruthy();
    expect(host.querySelector('[data-testid="nexus-created-undo-error"]')?.textContent).toContain(
      'Inactive',
    );
    cleanup();
  });

  it('add customer chip prompts and does not extract empty text', async () => {
    const onMic = vi.fn();
    const { host, cleanup } = mount(
      <NexusAsk
        onNavigate={vi.fn()}
        onMicTap={onMic}
        canCreateCustomers
        speakZava={speakZava}
        handsFreeActive={false}
      />,
    );
    await act(async () => {
      (host.querySelector('[data-testid="ask-chips"] button') as HTMLButtonElement).click();
    });
    expect(apiPost).not.toHaveBeenCalledWith('/api/agent/extract-customer', expect.anything(), expect.anything());
    expect(host.textContent).toContain('Tell me the customer');
    expect(onMic).toHaveBeenCalled();
    cleanup();
  });

  it('hides create flow without management role', async () => {
    const { host, cleanup } = mount(
      <NexusAsk onNavigate={vi.fn()} onMicTap={vi.fn()} canCreateCustomers={false} />,
    );
    const input = host.querySelector('[aria-label="Ask Zava"]') as HTMLInputElement;
    await act(async () => {
      setValue(input, 'add a new customer X');
      (host.querySelector('form') as HTMLFormElement).requestSubmit();
    });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
    expect(apiPost).not.toHaveBeenCalled();
    expect(host.textContent).toContain("don't have permission");
    cleanup();
  });
});
