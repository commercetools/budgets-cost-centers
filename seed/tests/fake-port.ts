// In-memory SeedPort, a project that keeps what the seed writes. [BCC-SEED-2]
import type { ResourceKind, SeedPort, StoredObject } from '../src/apply';

export type Write = { op: 'create' | 'putCustomObject' | 'createApprovalRule'; label: string; version?: number };

export class FakePort implements SeedPort {
  types = new Set<string>(['bcc-order', 'bcc-shopping-list']);
  resources = new Map<string, { id: string; draft: unknown }>();
  objects = new Map<string, StoredObject>();
  rules = new Map<string, { id: string; associateId: string; draft: unknown }>();
  writes: Write[] = [];
  reads = 0;
  private next = 1;

  private id = () => `id-${this.next++}`;

  async typeExists(key: string) {
    this.reads++;
    return this.types.has(key);
  }
  async findByKey(kind: ResourceKind, key: string) {
    this.reads++;
    const r = this.resources.get(`${kind}/${key}`);
    return r ? { id: r.id } : undefined;
  }
  async create(kind: ResourceKind, draft: { key: string }) {
    this.writes.push({ op: 'create', label: `${kind}/${draft.key}` });
    const id = this.id();
    this.resources.set(`${kind}/${draft.key}`, { id, draft });
    return { id };
  }
  async getCustomObject(container: string, key: string) {
    this.reads++;
    const o = this.objects.get(`${container}/${key}`);
    return o ? { value: JSON.parse(JSON.stringify(o.value)), version: o.version } : undefined;
  }
  async putCustomObject(container: string, key: string, value: unknown, version?: number) {
    this.writes.push({ op: 'putCustomObject', label: `${container}/${key}`, ...(version !== undefined ? { version } : {}) });
    const prev = this.objects.get(`${container}/${key}`);
    if (prev && prev.version !== version) throw new Error('ConcurrentModification');
    this.objects.set(`${container}/${key}`, { value: JSON.parse(JSON.stringify(value)), version: (prev?.version ?? 0) + 1 });
  }
  async findApprovalRule(_associateId: string, businessUnitKey: string, key: string) {
    this.reads++;
    const r = this.rules.get(`${businessUnitKey}/${key}`);
    return r ? { id: r.id } : undefined;
  }
  async createApprovalRule(associateId: string, businessUnitKey: string, draft: { key: string }) {
    this.writes.push({ op: 'createApprovalRule', label: `${businessUnitKey}/${draft.key}` });
    const id = this.id();
    this.rules.set(`${businessUnitKey}/${draft.key}`, { id, associateId, draft });
    return { id };
  }
}
