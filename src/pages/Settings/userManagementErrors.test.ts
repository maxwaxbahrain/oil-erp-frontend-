import { describe, expect, it } from 'vitest';

import { extractUserManagementError } from './userManagementErrors';

describe('extractUserManagementError', () => {
  it('shows backend detail for 400 duplicate (not axios status text)', () => {
    const err = {
      message: 'Request failed with status code 400',
      response: {
        status: 400,
        data: { detail: 'Username or email already registered' },
      },
    };
    expect(extractUserManagementError(err)).toBe('Username or email already registered');
  });

  it('shows edit duplicate username / email details', () => {
    expect(
      extractUserManagementError({
        message: 'Request failed with status code 400',
        response: { data: { detail: 'Username already taken' } },
      }),
    ).toBe('Username already taken');
    expect(
      extractUserManagementError({
        message: 'Request failed with status code 400',
        response: { data: { detail: 'Email already registered' } },
      }),
    ).toBe('Email already registered');
  });

  it('shows validation msg for weak password (422 detail array)', () => {
    const err = {
      message: 'Request failed with status code 422',
      response: {
        status: 422,
        data: {
          detail: [
            {
              type: 'string_too_short',
              loc: ['body', 'password'],
              msg: 'String should have at least 8 characters',
            },
          ],
        },
      },
    };
    expect(extractUserManagementError(err)).toBe(
      'password: String should have at least 8 characters',
    );
  });
});
