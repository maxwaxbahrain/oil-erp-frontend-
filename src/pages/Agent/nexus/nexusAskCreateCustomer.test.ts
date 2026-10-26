import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  classifyCustomerDraftVoice,
  createPayloadFromDraft,
  draftFromExtract,
  duplicateBlocksCreate,
  isCreateCustomerIntent,
  isAddCustomerPromptOnly,
  mentionsOpeningBalance,
  fetchExtractCustomer,
  undoDeactivatePayload,
  type ExtractCustomerApi,
} from './nexusAskCreateCustomer';

describe('isCreateCustomerIntent', () => {
  it('matches create commands at sentence start (optional zava/please)', () => {
    expect(isCreateCustomerIntent('add a new customer Surjeet')).toBe(true);
    expect(isCreateCustomerIntent('create new customer Acme')).toBe(true);
    expect(isCreateCustomerIntent('add customer Surjeet A1')).toBe(true);
    expect(isCreateCustomerIntent('create customer Acme Corp')).toBe(true);
    expect(isCreateCustomerIntent('new customer Joe Garage')).toBe(true);
    expect(isCreateCustomerIntent('new customer: Surjeet A1')).toBe(true);
    expect(isCreateCustomerIntent('zava, add customer Surjeet')).toBe(true);
    expect(isCreateCustomerIntent('please create customer Acme')).toBe(true);
  });

  it('does not match questions or lookups about customers', () => {
    expect(isCreateCustomerIntent('did we get any new customer this week?')).toBe(false);
    expect(isCreateCustomerIntent('how many new customers this month?')).toBe(false);
    expect(isCreateCustomerIntent('show new customers')).toBe(false);
    expect(isCreateCustomerIntent('Who owes the most?')).toBe(false);
  });
});

describe('isAddCustomerPromptOnly', () => {
  it('blocks empty chip text from extract', () => {
    expect(isAddCustomerPromptOnly('')).toBe(true);
    expect(isAddCustomerPromptOnly('Add a new customer')).toBe(true);
    expect(isAddCustomerPromptOnly('add customer Surjeet')).toBe(false);
  });
});

describe('undoDeactivatePayload', () => {
  it('sends status only so name/phone/address stay on the server', () => {
    const body = undoDeactivatePayload();
    expect(body).toEqual({ status: 'Inactive' });
    expect(Object.keys(body)).toEqual(['status']);
  });
});

describe('classifyCustomerDraftVoice', () => {
  it('accepts explicit confirm phrases only', () => {
    expect(classifyCustomerDraftVoice('confirm')).toBe('confirm');
    expect(classifyCustomerDraftVoice('create customer')).toBe('confirm');
    expect(classifyCustomerDraftVoice('yes create')).toBe('confirm');
  });

  it('rejects plain yes/okay', () => {
    expect(classifyCustomerDraftVoice('yes')).toBe('weak_yes');
    expect(classifyCustomerDraftVoice('okay')).toBe('weak_yes');
  });

  it('cancels on cancel/no/stop', () => {
    expect(classifyCustomerDraftVoice('cancel')).toBe('cancel');
    expect(classifyCustomerDraftVoice('no')).toBe('cancel');
  });
});

describe('draftFromExtract', () => {
  const api: ExtractCustomerApi = {
    name: 'Surjeet A1',
    email: null,
    phone: '7185550177',
    address: '37th Ave',
    category: 'workshop',
    credit_limit: 3000,
    opening_balance: { side: 'dr', amount: 840, as_of: null },
    notes: null,
    filled_fields: ['name', 'phone'],
    warnings: ['Unknown category'],
    possible_duplicates: [{ id: 1, name: 'Surjeet A1' }],
  };

  it('flags opening balance but create payload omits it', () => {
    const raw = 'they already owe us 840';
    expect(mentionsOpeningBalance(raw)).toBe(true);
    const view = draftFromExtract(raw, api);
    expect(view.openingBalanceMentioned || view.openingBalanceFromApi).toBe(true);
    const payload = createPayloadFromDraft(view.fields);
    expect(payload).not.toHaveProperty('opening_balance');
    expect(payload).not.toHaveProperty('opening_side');
    expect(payload.name).toBe('Surjeet A1');
    expect(payload.credit_limit).toBe(3000);
  });

  it('duplicate blocks create until create anyway', () => {
    expect(duplicateBlocksCreate([{ id: 1, name: 'X' }], 'pending')).toBe(true);
    expect(duplicateBlocksCreate([{ id: 1, name: 'X' }], 'create_anyway')).toBe(false);
  });
});

describe('fetchExtractCustomer', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('posts to extract-customer', async () => {
    vi.doMock('../../../api/axios', () => ({
      default: {
        post: vi.fn().mockResolvedValue({
          data: { name: 'A', filled_fields: ['name'], warnings: [], possible_duplicates: [] },
        }),
      },
    }));
    const { fetchExtractCustomer: fetch } = await import('./nexusAskCreateCustomer');
    const api = (await import('../../../api/axios')).default;
    await fetch('add customer A');
    expect(api.post).toHaveBeenCalledWith(
      '/api/agent/extract-customer',
      { text: 'add customer A' },
      expect.objectContaining({ timeout: 70_000 }),
    );
  });
});
