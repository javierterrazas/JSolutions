// La cuadrilla de la empresa, para el dueño (D-061): cada trabajador con su puesto, cómo cobra y su salario, para
// darlo de alta, editarlo, cambiarle el salario (con su historial) y darlo de baja o reactivarlo. El PM los ve en el
// cierre del día, nunca su salario.
import { accesosDeTrabajadores, cuadrilla } from '@ijm/servidor';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { comoMiembro, conModulo, exigirDueno } from '@/lib/acceso';
import { Marco, estilos } from '../componentes/marco';
import { MensajeError } from '../componentes/mensaje-error';
import { AgregarTrabajador } from './agregar-trabajador';
import { ChecadaDelTrabajador } from './checada-del-trabajador';
import { TarjetaTrabajador } from './tarjeta-trabajador';

export default async function Cuadrilla() {
  const acceso = await exigirDueno();
  const r = await comoMiembro((tx) => cuadrilla(tx), acceso);
  const t = await getTranslations('cuadrilla');
  // la checada de cada uno: su celular activo o su invitación pendiente (D-117)
  const conChecada = conModulo(acceso, 'checada');
  const a = conChecada ? await comoMiembro((tx) => accesosDeTrabajadores(tx), acceso) : null;
  const accesos = a?.ok ? a.datos : new Map();
  const todos = r.ok ? r.datos.trabajadores : [];
  const hoy = r.ok ? r.datos.hoy : '';
  const activos = todos.filter((x) => x.activo);
  const deBaja = todos.filter((x) => !x.activo);
  // los puestos que ya existen, como sugerencias al escribir uno
  const puestos = [...new Set(todos.map((x) => x.puesto).filter((p): p is string => !!p))].sort();

  return (
    <Marco titulo={t('titulo')} volver={{ href: '/', texto: t('volver') }}>
      <p className="text-sm text-slate-600">{t('ayuda')}</p>
      {/* las horas de cada uno en la semana, para la nómina (D-094) */}
      {conModulo(acceso, 'nomina') ? (
        <Link href="/cuadrilla/semana" className={`${estilos.boton} flex items-center justify-center`}>
          {t('semana')}
        </Link>
      ) : null}
      {!r.ok ? <MensajeError problema={r} /> : null}
      <datalist id="puestos">
        {puestos.map((p) => (
          <option key={p} value={p} />
        ))}
      </datalist>
      <AgregarTrabajador />
      {r.ok && activos.length === 0 ? <p className={estilos.tarjeta}>{t('vacio')}</p> : null}
      <ul className="flex flex-col gap-3">
        {activos.map((x) => (
          <TarjetaTrabajador key={x.id} trabajador={x} hoy={hoy}>
            {conChecada ? (
              <ChecadaDelTrabajador
                trabajador={{ id: x.id, nombre: x.nombre }}
                acceso={
                  accesos.get(x.id)
                    ? {
                        estado: accesos.get(x.id)!.estado,
                        dispositivo: accesos.get(x.id)!.dispositivo,
                        ultimoUso: accesos.get(x.id)!.ultimoUso?.toISOString() ?? null,
                      }
                    : null
                }
              />
            ) : null}
          </TarjetaTrabajador>
        ))}
      </ul>
      {deBaja.length ? (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-bold text-marca">{t('dadosDeBaja')}</h2>
          <ul className="flex flex-col gap-3">
            {deBaja.map((x) => (
              <TarjetaTrabajador key={x.id} trabajador={x} hoy={hoy} />
            ))}
          </ul>
        </section>
      ) : null}
    </Marco>
  );
}
