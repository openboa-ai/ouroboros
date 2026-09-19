import { describe, expect, it, vi } from "vitest";
import { ScopedRefreshQueue } from "./scoped-refresh-queue";
const flush = () => new Promise<void>(resolve => queueMicrotask(resolve));

describe("configuration observation scheduling",()=>{
  it("allows an activation to finish and then reads only the latest changed candidate set",async()=>{
    const queue=new ScopedRefreshQueue(), activation=queue.begin()!;
    const oldRead=vi.fn(),latestRead=vi.fn();let visibleBusy=true;
    queue.request(oldRead);queue.request(latestRead);
    await flush();expect(oldRead).not.toHaveBeenCalled();expect(latestRead).not.toHaveBeenCalled();
    // A changed publication revision must not invalidate the active same-company result.
    if(queue.isCurrent(activation))visibleBusy=false;
    queue.finish(activation);await flush();
    expect(visibleBusy).toBe(false);expect(oldRead).not.toHaveBeenCalled();expect(latestRead).toHaveBeenCalledOnce();expect(queue.isBusy).toBe(false);
  });
  it("rejects old-environment delivery but schedules the new environment after the old operation settles",async()=>{
    const queue=new ScopedRefreshQueue(),old=queue.begin()!;let displayed="new environment";
    const readNew=vi.fn();queue.invalidate();queue.request(readNew);
    if(queue.isCurrent(old))displayed="old company";
    await flush();expect(readNew).not.toHaveBeenCalled();
    queue.finish(old);await flush();expect(displayed).toBe("new environment");expect(readNew).toHaveBeenCalledOnce();
  });
  it("does not execute a queued observation after unmount",async()=>{
    const queue=new ScopedRefreshQueue(),read=vi.fn();queue.request(read);queue.invalidate();await flush();expect(read).not.toHaveBeenCalled();
  });
  it("does not let an old completion release a newer operation",()=>{
    const queue=new ScopedRefreshQueue(),first=queue.begin()!;
    expect(queue.begin()).toBeNull();queue.finish(first);
    const second=queue.begin()!;queue.finish(first);
    expect(queue.isBusy).toBe(true);expect(queue.isCurrent(second)).toBe(true);
    queue.finish(second);expect(queue.isBusy).toBe(false);
  });
});
