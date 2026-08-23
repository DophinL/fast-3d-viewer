import type { GeometryPayload, MeshDiagnostics, RepairOptions, RepairResult } from './types';

interface PendingRequest<T> {
  resolve: (value: T) => void;
  reject: (reason: Error) => void;
}

interface WorkerResponse<T> {
  id: string;
  ok: boolean;
  result?: T;
  error?: string;
}

export class DiagnosticsService {
  private worker: Worker | null = null;
  private pending = new Map<string, PendingRequest<unknown>>();

  private getWorker(): Worker {
    if (this.worker) return this.worker;
    this.worker = new Worker(new URL('../workers/mesh-diagnostics.worker.ts', import.meta.url), { type: 'module' });
    this.worker.addEventListener('message', (event: MessageEvent<WorkerResponse<unknown>>) => {
      const request = this.pending.get(event.data.id);
      if (!request) return;
      this.pending.delete(event.data.id);
      if (event.data.ok && event.data.result !== undefined) request.resolve(event.data.result);
      else request.reject(new Error(event.data.error || 'Mesh analysis failed.'));
    });
    this.worker.addEventListener('error', (event) => {
      const error = new Error(event.message || 'The mesh worker stopped unexpectedly.');
      this.pending.forEach((request) => request.reject(error));
      this.pending.clear();
      this.worker?.terminate();
      this.worker = null;
    });
    return this.worker;
  }

  analyze(payloads: GeometryPayload[], scanLimited: boolean): Promise<MeshDiagnostics> {
    return this.request<MeshDiagnostics>('analyze', { payloads, scanLimited });
  }

  repair(payloads: GeometryPayload[], options: RepairOptions): Promise<RepairResult> {
    return this.request<RepairResult>('repair', { payloads, options });
  }

  private request<T>(type: 'analyze' | 'repair', data: Record<string, unknown>): Promise<T> {
    const id = crypto.randomUUID();
    const worker = this.getWorker();
    return new Promise<T>((resolve, reject) => {
      this.pending.set(id, { resolve: resolve as (value: unknown) => void, reject });
      const payloads = data.payloads as GeometryPayload[];
      const transfers: Transferable[] = [];
      // Copy before transferring so a second diagnostic pass can be created from the scene.
      const cloned = payloads.map((payload) => {
        const positions = payload.positions.slice();
        const indices = payload.indices?.slice() ?? null;
        const matrix = payload.matrix.slice();
        transfers.push(positions.buffer, matrix.buffer);
        if (indices) transfers.push(indices.buffer);
        return { ...payload, positions, indices, matrix };
      });
      worker.postMessage({ id, type, ...data, payloads: cloned }, transfers);
    });
  }

  dispose(): void {
    this.worker?.terminate();
    this.worker = null;
    const error = new Error('Mesh diagnostics were cancelled.');
    this.pending.forEach((request) => request.reject(error));
    this.pending.clear();
  }
}
