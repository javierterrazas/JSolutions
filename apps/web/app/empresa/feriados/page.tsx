// Los feriados de la empresa, para el dueño (D-108): los de este año en adelante, cada uno con si se descansa o se
// trabaja; agregar uno, o los de Estados Unidos de un año de un toque. Cuentan para los días laborables del cronograma,
// de los cierres del PM y de los indicadores.
import { feriadosDeLaEmpresa } from '@ijm/servidor';
import { getFormatter, getTranslations } from 'next-intl/server';
import { marcarFeriado } from '@/app/acciones/feriados';
import { comoMiembro, exigirDueno } from '@/lib/acceso';
import { Marco, estilos } from '../../componentes/marco';
import { MensajeError } from '../../componentes/mensaje-error';
import { AgregarFeriado, FeriadosDeEstadosUnidos } from './formularios';

export default async function Feriados() {
  const acceso = await exigirDueno();
  const r = await comoMiembro((tx) => feriadosDeLaEmpresa(tx), acceso);
  const [t, formato] = await Promise.all([getTranslations('feriados'), getFormatter()]);
  const volver = { href: '/empresa', texto: t('volver') };
  if (!r.ok)
    return (
      <Marco titulo={t('titulo')} volver={volver}>
        <MensajeError problema={r} />
      </Marco>
    );
  const { hoy, feriados } = r.datos;
  const anio = Number(hoy.slice(0, 4));
  const fecha = (d: string) =>
    formato.dateTime(new Date(`${d}T12:00:00`), { weekday: 'short', day: 'numeric', month: 'short' });
  const anios = [...new Set(feriados.map((f) => f.dia.slice(0, 4)))];

  return (
    <Marco titulo={t('titulo')} volver={volver}>
      <p className="text-sm text-slate-700">{t('ayuda')}</p>
      <div className="grid grid-cols-2 gap-2">
        {[anio, anio + 1].map((a) => (
          <FeriadosDeEstadosUnidos key={a} anio={a} />
        ))}
      </div>

      {feriados.length === 0 ? <p className={estilos.tarjeta}>{t('ninguno')}</p> : null}
      {anios.map((a) => (
        <section key={a} className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold text-marca">{a}</h2>
          <ul className="flex flex-col gap-2">
            {feriados
              .filter((f) => f.dia.startsWith(a))
              .map((f) => (
                <li
                  key={f.id}
                  className={`${estilos.tarjeta} flex items-center justify-between gap-3 ${f.dia < hoy ? 'opacity-60' : ''}`}
                >
                  <span className="text-sm">
                    <span className="block font-semibold first-letter:uppercase">{fecha(f.dia)}</span>
                    {f.nombre}
                  </span>
                  <form action={marcarFeriado.bind(null, f.id, !f.seTrabaja)}>
                    <button
                      type="submit"
                      aria-label={t(f.seTrabaja ? 'cambiarADescanso' : 'cambiarATrabajo', {
                        nombre: f.nombre,
                      })}
                      className={`min-h-11 shrink-0 rounded-full px-3 text-sm font-semibold whitespace-nowrap ${f.seTrabaja ? 'bg-amber-100 text-amber-900' : 'bg-emerald-100 text-emerald-900'}`}
                    >
                      {t(f.seTrabaja ? 'seTrabaja' : 'seDescansa')}
                    </button>
                  </form>
                </li>
              ))}
          </ul>
        </section>
      ))}

      <AgregarFeriado />
    </Marco>
  );
}
