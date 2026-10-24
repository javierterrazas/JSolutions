// Los módulos que se le prenden o apagan a cada empresa (D-110). La base (obras, cierre del día, gastos, avisos,
// fotos, bitácora, managers, cuadrilla en el cierre, feriados) siempre está; cada módulo agrega sus pantallas. Algunos
// necesitan otro: prenderlo prende el que necesita, y apagar uno apaga los que dependen de él.

export const MODULOS = [
  'dinero',
  'portal',
  'cambios',
  'subcontratistas',
  'calidad',
  'nomina',
  'indicadores',
  'historico',
  'desempeno',
  'posventa',
  'marca',
  // el asistente de IA del dueño, por MCP (D-114)
  'asistente',
] as const;
export type Modulo = (typeof MODULOS)[number];

/** Lo que cada módulo necesita para funcionar. */
export const REQUIERE: Readonly<Partial<Record<Modulo, readonly Modulo[]>>> = {
  // el cliente firma la orden en su portal, y la orden lleva costo y precio
  cambios: ['portal', 'dinero'],
  // las órdenes de trabajo llevan su precio y se pagan
  subcontratistas: ['dinero'],
  // el histórico y el cierre de la obra comparan el costo real con el presupuesto
  historico: ['dinero'],
  posventa: ['dinero'],
  // lo que el asistente analiza es sobre todo dinero: ventas, costos y márgenes
  asistente: ['dinero'],
};

/** Los planes de la plataforma (D-080) y lo que prenden de un toque. */
export const MODULOS_DEL_PLAN: Readonly<Record<'basico' | 'pro' | 'empresa', readonly Modulo[]>> = {
  basico: [],
  pro: ['dinero', 'portal', 'cambios', 'subcontratistas', 'calidad', 'nomina'],
  empresa: MODULOS,
};

const ordenar = (ms: Iterable<Modulo>): Modulo[] => {
  const s = new Set(ms);
  return MODULOS.filter((m) => s.has(m));
};

/** Los módulos con lo que necesitan, en su orden. */
export function conLoQueNecesitan(ms: Iterable<Modulo>): Modulo[] {
  const s = new Set(ms);
  let crecio = true;
  while (crecio) {
    crecio = false;
    for (const m of [...s])
      for (const r of REQUIERE[m] ?? [])
        if (!s.has(r)) {
          s.add(r);
          crecio = true;
        }
  }
  return ordenar(s);
}

/** Los módulos sin `quitado` ni los que dependen de él. */
export function sinElModulo(ms: Iterable<Modulo>, quitado: Modulo): Modulo[] {
  const s = new Set(ms);
  s.delete(quitado);
  let bajo = true;
  while (bajo) {
    bajo = false;
    for (const m of [...s])
      if ((REQUIERE[m] ?? []).some((r) => !s.has(r))) {
        s.delete(m);
        bajo = true;
      }
  }
  return ordenar(s);
}

/** Si la empresa tiene el módulo. */
export const tieneModulo = (modulos: readonly string[], m: Modulo): boolean => modulos.includes(m);
