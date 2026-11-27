import { act, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { usePolling } from './use-polling.ts';

function PollingHarness({ load }: { load: () => Promise<void> }) {
  usePolling(load, 1000);
  return null;
}

describe('usePolling', () => {
  afterEach(() => vi.useRealTimers());

  it('không gửi request mới khi lượt trước vẫn đang chạy', async () => {
    vi.useFakeTimers();
    let finishFirst!: () => void;
    const first = new Promise<void>((resolve) => { finishFirst = resolve; });
    const load = vi.fn()
      .mockReturnValueOnce(first)
      .mockResolvedValue(undefined);

    render(<PollingHarness load={load} />);
    expect(load).toHaveBeenCalledTimes(1);

    await act(() => vi.advanceTimersByTimeAsync(3000));
    expect(load).toHaveBeenCalledTimes(1);

    await act(async () => { finishFirst(); await first; });
    await act(() => vi.advanceTimersByTimeAsync(1000));
    expect(load).toHaveBeenCalledTimes(2);
  });
});
