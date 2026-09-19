interface ActivityTicket { epoch: number; sequence: number }
/** One active operation; candidate updates coalesce into a latest read, scope changes cancel delivery. */
export class ScopedRefreshQueue {
  private epoch = 0;
  private sequence = 0;
  private active: ActivityTicket | null = null;
  private latest: (() => void) | null = null;
  private requested = false;
  private scheduled = false;
  get isBusy() { return this.active !== null; }
  begin(): ActivityTicket | null {
    if (this.active) return null;
    this.active = { epoch:this.epoch,sequence:++this.sequence };
    return this.active;
  }
  isCurrent(ticket: ActivityTicket) { return ticket.epoch === this.epoch && this.active === ticket; }
  finish(ticket: ActivityTicket) {
    if (this.active !== ticket) return;
    this.active = null;
    this.schedule();
  }
  invalidate() {
    this.epoch += 1;
    this.latest = null;
    this.requested = false;
    // The old operation still owns the lane until completion; it cannot deliver old-scope state.
  }
  request(refresh: () => void) {
    this.latest = refresh;
    this.requested = true;
    this.schedule();
  }
  private schedule() {
    if (this.active || this.scheduled || !this.requested) return;
    this.scheduled = true;
    queueMicrotask(() => {
      this.scheduled = false;
      if (this.active || !this.requested || !this.latest) return;
      this.requested = false;
      this.latest();
    });
  }
}
