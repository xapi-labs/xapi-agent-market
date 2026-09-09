import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ensurePermit2Approval, signAgentPayment } from './payment-wallet.js';
import { PAYMENT_ASSETS } from './payments.js';
import { getAccount, readContract, writeContract, waitForTransactionReceipt, signTypedData, switchChain } from 'wagmi/actions';
vi.mock('./wagmi-config.js', () => ({ wagmiConfig: {} }));
vi.mock('wagmi/actions', () => ({ getAccount: vi.fn(), readContract: vi.fn(), writeContract: vi.fn(), waitForTransactionReceipt: vi.fn(), signTypedData: vi.fn(), switchChain: vi.fn() }));
const owner = '0x1111111111111111111111111111111111111111';
const requirements = asset => ({ scheme: 'exact', network: asset.network, asset: asset.address, amount: asset.decimals === 6 ? '100000' : '100000000000000000', payTo: '0x2222222222222222222222222222222222222222', maxTimeoutSeconds: 300, extra: { name: 'Test Token', version: '1', assetTransferMethod: asset.method, spenderAddress: '0x3333333333333333333333333333333333333333' } });
beforeEach(() => {
  vi.clearAllMocks();
  getAccount.mockReturnValue({ address: owner, chainId: 56 });
  readContract.mockResolvedValue(0n);
  writeContract.mockResolvedValue('0xabc');
  waitForTransactionReceipt.mockResolvedValue({ status: 'success' });
  signTypedData.mockResolvedValue('0x' + '11'.repeat(65));
});
describe('wallet signing adapted from the main frontend', () => {
  it('approves only the cost of this call and resets an insufficient existing approval', async () => {
    readContract.mockResolvedValueOnce(1n);
    await ensurePermit2Approval(requirements(PAYMENT_ASSETS[3]), owner);
    expect(writeContract.mock.calls.map(([, request]) => request.args[1])).toEqual([0n, 100000000000000000n]);
  });
  it('does not approve again when allowance covers this call', async () => {
    readContract.mockResolvedValueOnce(100000000000000000n);
    await ensurePermit2Approval(requirements(PAYMENT_ASSETS[3]), owner);
    expect(writeContract).not.toHaveBeenCalled();
  });
  it('stops if approval reverted', async () => {
    waitForTransactionReceipt.mockResolvedValueOnce({ status: 'reverted' });
    await expect(ensurePermit2Approval(requirements(PAYMENT_ASSETS[3]), owner)).rejects.toThrow('APPROVAL_FAILED');
  });
  it.each(PAYMENT_ASSETS)('builds the correct signed payload for $id', async asset => {
    getAccount.mockReturnValue({ address: owner, chainId: asset.chainId });
    const option = { ...asset, requirements: requirements(asset) };
    const challenge = { x402Version: 2, resource: { url: 'https://agent-market-grid.p.test.xapi.to/x402' }, accepts: [option.requirements] };
    const result = await signAgentPayment(challenge, option);
    expect(result.accepted).toEqual(option.requirements);
    expect(result.resource).toEqual(challenge.resource);
    const typed = signTypedData.mock.calls[0][1];
    expect(typed.domain.chainId).toBe(asset.chainId);
    if (asset.method === 'permit2-exact') {
      expect(typed.primaryType).toBe('PermitWitnessTransferFrom');
      expect(result.payload.permit2Authorization.permitted.amount).toBe(option.requirements.amount);
      expect(writeContract).toHaveBeenCalledOnce();
    } else {
      expect(typed.primaryType).toBe('TransferWithAuthorization');
      expect(writeContract).not.toHaveBeenCalled();
    }
  });
  it('stops if the wallet switches accounts during chain switching', async () => {
    switchChain.mockImplementationOnce(async () => getAccount.mockReturnValue({ address: '0x4444444444444444444444444444444444444444', chainId: 8453 }));
    const asset = PAYMENT_ASSETS[0]; const r = requirements(asset);
    await expect(signAgentPayment({ x402Version: 2, accepts: [r] }, { ...asset, requirements: r })).rejects.toThrow('WALLET_CHANGED');
    expect(signTypedData).not.toHaveBeenCalled();
  });
});
