/* Tiny event bus. See ARCHITECTURE.md for the list of events the core emits. */
export function createBus() {
  const map = new Map();
  const bus = {
    on(type, fn) {
      if (!map.has(type)) map.set(type, new Set());
      map.get(type).add(fn);
      return () => bus.off(type, fn);
    },
    once(type, fn) { const off = bus.on(type, d => { off(); fn(d); }); return off; },
    off(type, fn) { const s = map.get(type); if (s) s.delete(fn); },
    emit(type, data) {
      const s = map.get(type);
      if (s) for (const fn of [...s]) { try { fn(data, type); } catch (e) { console.error('[bus] ' + type, e); } }
      const any = map.get('*');
      if (any) for (const fn of [...any]) { try { fn(data, type); } catch (e) { console.error('[bus] *', e); } }
    }
  };
  return bus;
}
