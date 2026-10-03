// Los errores de negocio no son textos: son un código con sus datos, y la pantalla los traduce (D-015).
// Por ejemplo { codigo: 'monto_negativo' } o { codigo: 'faltan', datos: { campos: ['cliente'] } }.

export interface Problema {
  readonly codigo: string;
  readonly datos?: Readonly<Record<string, unknown>>;
}

/** Un error de negocio: la regla rechaza la operación. Nunca un fallo del sistema. */
export class ErrorDeNegocio extends Error implements Problema {
  readonly codigo: string;
  readonly datos?: Readonly<Record<string, unknown>>;

  constructor(codigo: string, datos?: Record<string, unknown>) {
    super(datos ? `${codigo} ${JSON.stringify(datos)}` : codigo);
    this.name = 'ErrorDeNegocio';
    this.codigo = codigo;
    if (datos) this.datos = datos;
  }
}

export const esErrorDeNegocio = (e: unknown): e is ErrorDeNegocio => e instanceof ErrorDeNegocio;
