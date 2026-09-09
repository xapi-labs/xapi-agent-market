// Adapted from xapi-frontend-v2/src/wallet.js: EIP-3009 and B402 Permit2 signing.
import { switchChain as switchChainAction, signTypedData as signTypedDataAction, getAccount as getAccountAction, readContract as readContractAction, writeContract as writeContractAction, waitForTransactionReceipt as waitForTransactionReceiptAction } from 'wagmi/actions';
import { x402Client } from '@x402/core/client';
import { ExactEvmScheme } from '@x402/evm/exact/client';
import { erc20Abi, getAddress } from 'viem';
import { wagmiConfig } from './wagmi-config.js';

const PERMIT2_ADDRESS = '0x000000000022D473030F116dDEE9F6B43aC78BA3';
const chainIdFromNetwork = (network) => Number(String(network || '').split(':')[1] || 0);

const randomUint256 = () => {
  const bytes = new Uint8Array(32);
  window.crypto.getRandomValues(bytes);
  return BigInt('0x' + Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('')).toString();
};

const buildSigner = (address, chainId, signal) => ({
  address,
  signTypedData: async (args) => {
    try {
      signal?.throwIfAborted();
      const current = getAccountAction(wagmiConfig);
      if (current.address?.toLowerCase() !== address.toLowerCase() || current.chainId !== chainId) throw new Error('WALLET_CHANGED');
      return await signTypedDataAction(wagmiConfig, {
        account: address,
        domain: args.domain,
        types: args.types,
        primaryType: args.primaryType,
        message: args.message,
      });
    } catch (err) {
      throw new Error(err && err.message ? err.message : 'Signature rejected');
    }
  },
});

export const ensurePermit2Approval = async (requirements, owner, signal) => {
  const chainId = chainIdFromNetwork(requirements.network);
  const token = getAddress(requirements.asset);
  const allowance = await readContractAction(wagmiConfig, {
    chainId,
    address: token,
    abi: erc20Abi,
    functionName: 'allowance',
    args: [getAddress(owner), PERMIT2_ADDRESS],
  });
  const currentAllowance = BigInt(allowance?.toString?.() || allowance || 0);
  const requestedAllowance = BigInt(requirements.amount);
  const requiredAllowance = requestedAllowance;
  if (currentAllowance >= requiredAllowance) return;

  const approve = async (amount) => {
    signal?.throwIfAborted();
    if (getAccountAction(wagmiConfig).address?.toLowerCase() !== owner.toLowerCase()) throw new Error('WALLET_CHANGED');
    const hash = await writeContractAction(wagmiConfig, {
      chainId,
      account: owner,
      address: token,
      abi: erc20Abi,
      functionName: 'approve',
      args: [PERMIT2_ADDRESS, amount],
    });
    const receipt = await waitForTransactionReceiptAction(wagmiConfig, { chainId, hash });
    if (receipt.status !== 'success') throw new Error('APPROVAL_FAILED');
  };

  if (currentAllowance > 0n) await approve(0n);
  await approve(requiredAllowance);
};

export class B402ExactEvmScheme {
  scheme = 'exact';

  constructor(signer, signal) {
    this.signal = signal;
    this.signer = signer;
    this.exact = new ExactEvmScheme(signer);
  }

  async createPaymentPayload(x402Version, requirements) {
    const method = (requirements.extra || {}).assetTransferMethod;
    if (method !== 'permit2-exact') {
      return this.exact.createPaymentPayload(x402Version, requirements);
    }
    return {
      x402Version,
      payload: await this.createPermit2ExactPayload(requirements),
    };
  }

  async createPermit2ExactPayload(requirements) {
    const spender = (requirements.extra || {}).spenderAddress;
    if (!spender) throw new Error('B402 Permit2 spender missing. Refresh supported configuration on the backend.');

    await ensurePermit2Approval(requirements, this.signer.address, this.signal);

    const chainId = chainIdFromNetwork(requirements.network);
    const nowSec = Math.floor(Date.now() / 1000);
    const nonce = randomUint256();
    const deadline = String(nowSec + Math.min(3600, Number(requirements.maxTimeoutSeconds) || 300));
    const validAfter = String(Math.max(0, nowSec - 60));

    const domain = {
      name: 'Permit2',
      chainId,
      verifyingContract: PERMIT2_ADDRESS,
    };
    const types = {
      PermitWitnessTransferFrom: [
        { name: 'permitted', type: 'TokenPermissions' },
        { name: 'spender', type: 'address' },
        { name: 'nonce', type: 'uint256' },
        { name: 'deadline', type: 'uint256' },
        { name: 'witness', type: 'Witness' },
      ],
      TokenPermissions: [
        { name: 'token', type: 'address' },
        { name: 'amount', type: 'uint256' },
      ],
      Witness: [
        { name: 'to', type: 'address' },
        { name: 'validAfter', type: 'uint256' },
      ],
    };
    const message = {
      permitted: {
        token: getAddress(requirements.asset),
        amount: BigInt(requirements.amount),
      },
      spender: getAddress(spender),
      nonce: BigInt(nonce),
      deadline: BigInt(deadline),
      witness: {
        to: getAddress(requirements.payTo),
        validAfter: BigInt(validAfter),
      },
    };

    const signature = await this.signer.signTypedData({
      domain,
      types,
      primaryType: 'PermitWitnessTransferFrom',
      message,
    });

    return {
      signature,
      permit2Authorization: {
        permitted: {
          token: requirements.asset,
          amount: requirements.amount,
        },
        from: this.signer.address,
        spender,
        nonce,
        deadline,
        witness: {
          to: requirements.payTo,
          validAfter,
        },
      },
    };
  }
}


export async function signAgentPayment(challenge, option, signal) {
  signal?.throwIfAborted();
  const account = getAccountAction(wagmiConfig);
  if (!account.address) throw new Error('WALLET_REQUIRED');
  if (account.chainId !== option.chainId) await switchChainAction(wagmiConfig, { chainId: option.chainId });
  const signer = buildSigner(account.address, option.chainId, signal);
  const client = new x402Client((_version, accepts) => {
    const selected = accepts.find(r => JSON.stringify(r) === JSON.stringify(option.requirements));
    if (!selected) throw new Error('QUOTE_CHANGED');
    return selected;
  });
  client.register(option.network, option.provider === 'b402' ? new B402ExactEvmScheme(signer, signal) : new ExactEvmScheme(signer));
  return client.createPaymentPayload(challenge);
}
