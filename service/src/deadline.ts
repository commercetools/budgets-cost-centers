// Internal time budget for platform calls inside an Extension. [BCC-CART-8]
export class DeadlineError extends Error {
  constructor(ms: number) {
    super(`Time budget of ${ms} ms exceeded`);
    this.name = 'DeadlineError';
  }
}

export function withDeadline<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new DeadlineError(ms)), ms);
  });
  return Promise.race([promise, deadline]).finally(() => clearTimeout(timer));
}
