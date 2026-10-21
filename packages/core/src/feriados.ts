// Los feriados federales de Estados Unidos que se suelen descansar en la construcción (D-108), para darlos de alta de
// un toque. Si cae en sábado se descansa el viernes; en domingo, el lunes (como el gobierno federal). La empresa
// después marca los que sí trabaja.
import { type Dia, diaSemana, sumarDias } from './fechas';

export interface FeriadoSugerido {
  readonly dia: Dia;
  readonly es: string;
  readonly en: string;
}

const dia = (anio: number, mes: number, d: number): Dia =>
  `${anio}-${String(mes).padStart(2, '0')}-${String(d).padStart(2, '0')}` as Dia;

/** El n-ésimo día de la semana (1 = lunes … 7 = domingo) del mes; n = -1, el último. */
function nEsimo(anio: number, mes: number, semana: number, n: number): Dia {
  if (n > 0) {
    const primero = dia(anio, mes, 1);
    const desfase = (semana - diaSemana(primero) + 7) % 7;
    return sumarDias(primero, desfase + 7 * (n - 1));
  }
  const ultimo = sumarDias(dia(mes === 12 ? anio + 1 : anio, mes === 12 ? 1 : mes + 1, 1), -1);
  return sumarDias(ultimo, -((diaSemana(ultimo) - semana + 7) % 7));
}

/** El día que se descansa: el de la fecha, o el viernes antes si cae en sábado, o el lunes si cae en domingo. */
function observado(d: Dia): { dia: Dia; movido: boolean } {
  const s = diaSemana(d);
  if (s === 6) return { dia: sumarDias(d, -1), movido: true };
  if (s === 7) return { dia: sumarDias(d, 1), movido: true };
  return { dia: d, movido: false };
}

/** Los feriados de un año, por fecha. El Año Nuevo que se descansa en diciembre cuenta para el año anterior. */
export function feriadosDeEstadosUnidos(anio: number): FeriadoSugerido[] {
  const fijo = (d: Dia, es: string, en: string): FeriadoSugerido[] => {
    const o = observado(d);
    return [
      o.movido ? { dia: o.dia, es: `${es} (se recorre)`, en: `${en} (observed)` } : { dia: o.dia, es, en },
    ];
  };
  const accion = nEsimo(anio, 11, 4, 4);
  const lista: FeriadoSugerido[] = [
    // el del año que sigue, si se descansa el 31 de diciembre de este
    ...fijo(dia(anio + 1, 1, 1), 'Año Nuevo', "New Year's Day").filter((f) => f.dia.startsWith(`${anio}-`)),
    ...fijo(dia(anio, 1, 1), 'Año Nuevo', "New Year's Day").filter((f) => f.dia.startsWith(`${anio}-`)),
    { dia: nEsimo(anio, 5, 1, -1), es: 'Memorial Day', en: 'Memorial Day' },
    ...fijo(dia(anio, 7, 4), 'Día de la Independencia', 'Independence Day'),
    { dia: nEsimo(anio, 9, 1, 1), es: 'Labor Day', en: 'Labor Day' },
    { dia: accion, es: 'Día de Acción de Gracias', en: 'Thanksgiving Day' },
    { dia: sumarDias(accion, 1), es: 'Día después de Acción de Gracias', en: 'Day after Thanksgiving' },
    ...fijo(dia(anio, 12, 25), 'Navidad', 'Christmas Day'),
  ];
  // Nochebuena, si no es el día en que ya se descansa la Navidad ni cae en fin de semana
  const nochebuena = dia(anio, 12, 24);
  if (!lista.some((f) => f.dia === nochebuena) && diaSemana(nochebuena) < 6)
    lista.push({ dia: nochebuena, es: 'Nochebuena', en: 'Christmas Eve' });
  return lista.sort((a, b) => (a.dia < b.dia ? -1 : 1));
}
