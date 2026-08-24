export type MemoryKind = 'short' | 'long' | 'semantic' | 'episodic' | 'task';
export interface MemoryEntry {
  id: string; tenantId: string; agentId?: string; kind: MemoryKind; key?: string;
  content: string; metadata?: Record<string, unknown>; createdAt: Date; expiresAt?: Date;
}
const store: MemoryEntry[] = [];
function id() { return `mem_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`; }
export function writeMemory(input: { tenantId: string; agentId?: string; kind: MemoryKind; content: string; key?: string; metadata?: Record<string, unknown>; ttlSeconds?: number; }): MemoryEntry {
  const entry: MemoryEntry = { id: id(), tenantId: input.tenantId, agentId: input.agentId, kind: input.kind, key: input.key, content: input.content, metadata: input.metadata, createdAt: new Date(), expiresAt: input.ttlSeconds ? new Date(Date.now() + input.ttlSeconds * 1000) : undefined };
  store.push(entry); return entry;
}
export function readMemory(opts: { tenantId: string; agentId?: string; kind?: MemoryKind; key?: string; limit?: number; }): MemoryEntry[] {
  const now = Date.now();
  return store.filter((e) => {
    if (e.tenantId !== opts.tenantId) return false;
    if (opts.agentId && e.agentId && e.agentId !== opts.agentId) return false;
    if (opts.kind && e.kind !== opts.kind) return false;
    if (opts.key && e.key !== opts.key) return false;
    if (e.expiresAt && e.expiresAt.getTime() < now) return false;
    return true;
  }).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).slice(0, opts.limit ?? 20);
}
export function clearExpired() { const now = Date.now(); for (let i = store.length - 1; i >= 0; i--) { if (store[i].expiresAt && store[i].expiresAt!.getTime() < now) store.splice(i, 1); } }
export function clearTenantMemory(tenantId: string) { for (let i = store.length - 1; i >= 0; i--) { if (store[i].tenantId === tenantId) store.splice(i, 1); } }
