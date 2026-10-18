// La semana de la cuadrilla, para el dueño (D-094): cuántas horas (o días) trabajó cada uno de lunes a domingo y lo que
// cuesta, para la nómina; al tocar su nombre, en qué obras y qué días. Con ?semana=AAAA-MM-DD, la semana de ese día.
import { semanaDeLaCuadrilla } from '@ijm/servidor';
import type { DateTimeFormatOptions } from 'next-intl';
import { getFormatter, getLocale, getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { comoMiembro, exigirDueno } from '@/lib/acceso';
import { formatoDinero } from '@/lib/dinero';
import { Marco, estilos } from '../../componentes/marco';
import { MensajeError } from '../../componentes/mensaje-error';

export default async function SemanaCuadrilla({ searchParams }: PageProps<'/cuadrilla/semana'>) {
  const consulta = await searchParams;
  const semana = typeof consulta.semana === 'string' ? consulta.semana : null;
  const acceso = await exigirDueno();
  const r = await comoMiembro((tx) => semanaDeLaCuadrilla(tx, { semana }), acceso);
  const [t, idioma, formato] = await Promise.all([
    getTranslations('semanaCuadrilla'),
    getLocale(),
    getFormatter(),
  ]);
  const volver = { href: '/cuadrilla', texto: t('volver') };
  if (!r.ok)
    return (
      <Marco titulo={t('titulo')} volver={volver}>
        <MensajeError problema={r} />
      </Marco>
    );
  const s = r.datos;
  const dinero = (n: number) => formatoDinero(idioma).format(n);
  // un día de negocio a mediodía, para que ninguna zona horaria lo mueva de día
  const dia = (d: string, o: DateTimeFormatOptions) => formato.dateTime(new Date(`${d}T12:00:00`), o);
  const cantidad = (n: number, tipo: 'hora' | 'dia') =>
    tipo === 'hora' ? t('horas', { n }) : t('dias', { n });
  const costoTotal = s.trabajadores.reduce((a, x) => a + (x.costo ?? 0), 0);
  const horasTotal = s.trabajadores.filter((x) => x.tipoPago === 'hora').reduce((a, x) => a + x.total, 0);
  const diasTotal = s.trabajadores.filter((x) => x.tipoPago === 'dia').reduce((a, x) => a + x.total, 0);

  return (
    <Marco
      titulo={t('titulo')}
      subtitulo={t('rango', {
        inicio: dia(s.inicio, { day: 'numeric', month: 'short' }),
        fin: dia(s.fin, { day: 'numeric', month: 'short', year: 'numeric' }),
      })}
      volver={volver}
    >
      <nav className="grid grid-cols-2 gap-2">
        <Link
          href={`/cuadrilla/semana?semana=${s.anterior}`}
          className={`${estilos.botonSecundario} flex items-center justify-center`}
        >
          {t('anterior')}
        </Link>
        {s.siguiente ? (
          <Link
            href={`/cuadrilla/semana?semana=${s.siguiente}`}
            className={`${estilos.botonSecundario} flex items-center justify-center`}
          >
            {t('siguiente')}
          </Link>
        ) : null}
      </nav>

      {s.trabajadores.length ? (
        <>
          <dl className={`${estilos.tarjeta} grid grid-cols-2 gap-2 text-center`}>
            <div>
              <dt className="text-sm text-slate-600">{t('totalCuadrilla')}</dt>
              <dd className="font-bold">
                {[
                  horasTotal ? t('horas', { n: horasTotal }) : null,
                  diasTotal ? t('dias', { n: diasTotal }) : null,
                ]
                  .filter(Boolean)
                  .join(t('separador'))}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-slate-600">{t('costo')}</dt>
              <dd className="font-bold">{dinero(costoTotal)}</dd>
            </div>
          </dl>
          <p className="text-sm text-slate-600">{t('ayuda')}</p>
          <ul className="flex flex-col gap-2">
            {s.trabajadores.map((x) => (
              <li key={x.id}>
                <details className={`${estilos.tarjeta} group`}>
                  <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-2">
                    <span className="flex flex-col">
                      <span className="font-semibold text-marca underline">{x.nombre}</span>
                      {x.puesto ? <span className="text-xs text-slate-500">{x.puesto}</span> : null}
                    </span>
                    <span className="flex flex-col items-end">
                      <span className="font-bold">{cantidad(x.total, x.tipoPago)}</span>
                      <span className="text-sm text-slate-600">
                        {x.costo === null ? t('sinTarifa') : dinero(x.costo)}
                      </span>
                    </span>
                  </summary>
                  <ul className="mt-2 flex flex-col gap-2 border-t border-slate-100 pt-2">
                    {x.obras.map((o) => (
                      <li key={o.obraId} className="flex flex-col gap-0.5 text-sm">
                        <div className="flex justify-between gap-2">
                          <span className="font-medium">
                            {t('obra', { folio: o.folio, cliente: o.cliente })}
                          </span>
                          <span className="font-semibold">{cantidad(o.cantidad, x.tipoPago)}</span>
                        </div>
                        <span className="text-slate-600">
                          {o.dias
                            .map((d) =>
                              t('diaCantidad', {
                                dia: dia(d.dia, { weekday: 'short', day: 'numeric' }),
                                cantidad: cantidad(d.cantidad, x.tipoPago),
                              }),
                            )
                            .join(t('separador'))}
                        </span>
                      </li>
                    ))}
                  </ul>
                </details>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className={estilos.tarjeta}>{t('nadie')}</p>
      )}
    </Marco>
  );
}
