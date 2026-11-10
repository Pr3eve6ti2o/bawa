// Unit tests for scripts/classify-request.mjs (F-20/21/22/31).
// Pure-function tests: no generation, no I/O.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyRequest, findRefusal, negated } from '../scripts/classify-request.mjs';

describe('negated()', () => {
  test('a token preceded by "no" within 30 chars does not count', () => {
    assert.equal(negated('web', 'CLI wallet with no web UI'), true);
    assert.equal(negated('web', 'Create a Web wallet'), false);
  });

  test('"without secrets or signing" negates signing', () => {
    assert.equal(
      negated('signing', 'Derive addresses only from extended public keys, without secrets or signing'),
      true,
    );
    assert.equal(negated('signing', 'Add signing support'), false);
  });

  test('a negator more than 30 chars away does not negate', () => {
    assert.equal(
      negated('web', 'No, I do not want anything else at all — build a web wallet'),
      false,
    );
  });

  test('matching is case-insensitive and whole-word', () => {
    assert.equal(negated('WEB', 'CLI wallet with NO web UI'), true);
    // "noweb" is not the word "web".
    assert.equal(negated('web', 'noweb wallet'), false);
  });
});

describe('classifyRequest()', () => {
  test('the seven profiles route as before', () => {
    assert.deepEqual(classifyRequest('Create a Web wallet'), { profile: 'web-wallet' });
    assert.deepEqual(classifyRequest('Create an Android wallet'), { profile: 'android-wallet' });
    assert.deepEqual(classifyRequest('Create a CLI wallet'), { profile: 'hd-wallet-cli' });
    assert.deepEqual(classifyRequest('Create an EVM wallet'), { profile: 'evm-wallet' });
    assert.deepEqual(
      classifyRequest('Create a multichain wallet'),
      { profile: 'multichain-wallet' },
    );
    assert.deepEqual(
      classifyRequest('Create a Bitcoin wallet'),
      { profile: 'bitcoin-wallet' },
    );
  });

  test('F-22: "CLI wallet with no web UI" selects hd-wallet-cli, not web-wallet', () => {
    assert.deepEqual(
      classifyRequest('CLI wallet with no web UI'),
      { profile: 'hd-wallet-cli' },
    );
    assert.deepEqual(
      classifyRequest('A web wallet with no Android app'),
      { profile: 'web-wallet' },
    );
  });

  test('F-21: "Create a Bitcoin wallet from my xpub" selects watch-only-wallet', () => {
    assert.deepEqual(
      classifyRequest('Create a Bitcoin wallet from my xpub'),
      { profile: 'watch-only-wallet' },
    );
    // Generation language still wins for a Bitcoin generation request.
    assert.deepEqual(
      classifyRequest('Generate a Bitcoin wallet from a new seed'),
      { profile: 'bitcoin-wallet' },
    );
  });

  test('web + Android in one request is a split, not a profile', () => {
    assert.deepEqual(
      classifyRequest('Create a web and Android wallet'),
      { ambiguous: 'split' },
    );
  });

  test('F-20: a non-wallet request is unclassifiable with a reason', () => {
    assert.deepEqual(classifyRequest('What is the weather?'), {
      unclassifiable: true,
      reason: 'cannot classify request',
    });
  });
});

describe('findRefusal()', () => {
  test('TON send is refused with the exact sentence', () => {
    assert.equal(
      findRefusal('Build a TON send feature'),
      'I cannot provide TON send; TON is generation-only in the proposed multichain profile.',
    );
  });

  test('TON xpub is refused', () => {
    assert.equal(
      findRefusal('Derive a TON address from my xpub'),
      'I cannot provide TON xpub support; the proposed TON scope has no xpub support.',
    );
  });

  test('generic signing / broadcast / send is refused', () => {
    assert.equal(
      findRefusal('Add signing support to the web wallet'),
      'I cannot claim signing or broadcast support without an engine that implements them; no signing or broadcast code exists in this repository.',
    );
    assert.equal(
      findRefusal('Add broadcast support'),
      'I cannot claim signing or broadcast support without an engine that implements them; no signing or broadcast code exists in this repository.',
    );
  });

  test('negated signing does NOT trigger the signing refusal', () => {
    assert.equal(
      findRefusal('Derive addresses only from extended public keys, without secrets or signing'),
      null,
    );
  });

  test('"sign in" (login) does NOT trigger the signing refusal', () => {
    assert.equal(findRefusal('Build a web wallet with sign in'), null);
  });

  test('mainnet is refused', () => {
    assert.equal(
      findRefusal('Deploy the wallet on mainnet'),
      'I cannot support mainnet use without separate approval; the default scope is testnet.',
    );
  });

  test('swaps / staking / bridges are refused', () => {
    assert.equal(
      findRefusal('Add swaps to the wallet'),
      'I cannot provide swaps, staking or bridges; they are out of scope for this programme.',
    );
  });

  test('an unlisted profile is refused', () => {
    assert.equal(
      findRefusal('Build a desktop wallet'),
      'I cannot route this request to an unlisted profile; only the seven profiles listed here are eligible for routing.',
    );
  });

  test('a bare "Build a wallet" is NOT a refusal (it is unclassifiable)', () => {
    assert.equal(findRefusal('Build a wallet'), null);
    assert.deepEqual(classifyRequest('Build a wallet'), {
      unclassifiable: true,
      reason: 'cannot classify request',
    });
  });

  test('the seven profiles are not refused', () => {
    for (const request of [
      'Create a Web wallet',
      'Create an Android wallet',
      'Create a CLI wallet',
      'Create an EVM wallet',
      'Create a multichain wallet',
      'Create a Bitcoin wallet',
      'Create a Bitcoin wallet from my xpub',
    ]) {
      assert.equal(findRefusal(request), null, request);
    }
  });

  test('check order: TON send beats generic send', () => {
    assert.equal(
      findRefusal('Build a TON send feature'),
      'I cannot provide TON send; TON is generation-only in the proposed multichain profile.',
    );
  });
});
