// El equipo de la empresa, para el dueño: invitar a un PM, ver los celulares de cada uno, quitar uno, dar de baja.
import { equipo } from '@ijm/servidor';
import { getFormatter, getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { comoMiembro, exigirDueno } from '@/lib/acceso';
import { cambiarActivo, quitarCelular } from '../acciones/equipo';
import { Marco, estilos } from '../componentes/marco';
import { BotonNuevaInvitacion } from './boton-nueva-invitacion';
import { FormularioInvitar } from './formulario-invitar';

export default async function Equipo() {
  const acceso = await exigirDueno();
  const r = await comoMiembro((tx) => equipo(tx), acceso);
  const miembros = r.ok ? r.datos : [];
  const [t, formato] = await Promise.all([getTranslations('equipo'), getFormatter()]);
  const fecha = (iso: string) => formato.dateTime(new Date(iso), { dateStyle: 'medium' });

  return (
    <Marco titulo={t('titulo')}>
      <Link href="/" className="text-sm font-medium text-marca">
        {t('volver')}
      </Link>
      <FormularioInvitar />
      <ul className="flex flex-col gap-3">
        {miembros.map((m) => (
          <li key={m.id} className={`${estilos.tarjeta} flex flex-col gap-2 ${m.activo ? '' : 'opacity-60'}`}>
            <div className="flex items-baseline justify-between gap-2">
              <p className="font-semibold">{m.nombre}</p>
              <p className="text-sm text-slate-600">{m.activo ? t(`rol.${m.rol}`) : t('dadoDeBaja')}</p>
            </div>
            {m.dispositivos.length === 0 ? (
              <p className="text-sm text-slate-500">{t('sinCelular')}</p>
            ) : (
              <ul className="flex flex-col gap-1">
                {m.dispositivos.map((d) => (
                  <li key={d.id} className="flex items-center justify-between gap-2 text-sm text-slate-700">
                    <span>
                      {d.ultimoUso
                        ? t('celular', { nombre: d.nombre, fecha: fecha(d.ultimoUso) })
                        : t('celularSinUso', { nombre: d.nombre, fecha: fecha(d.verificadoEn) })}
                    </span>
                    {d.id !== acceso.llave.dispositivoId ? (
                      <form action={quitarCelular.bind(null, d.id)}>
                        <button type="submit" className="min-h-11 px-2 font-medium text-red-700">
                          {t('quitar')}
                        </button>
                      </form>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
            {m.invitacion ? (
              <p className="text-sm text-slate-600">
                {t('pendiente', { fecha: fecha(m.invitacion.expira) })}
              </p>
            ) : null}
            {m.activo ? <BotonNuevaInvitacion miembro={{ id: m.id, nombre: m.nombre }} /> : null}
            {m.rol !== 'dueno' && m.id !== acceso.yo.miembroId ? (
              <form action={cambiarActivo.bind(null, m.id, !m.activo)}>
                <button type="submit" className={`${estilos.botonSecundario} w-full`}>
                  {m.activo ? t('darDeBaja') : t('reactivar')}
                </button>
              </form>
            ) : null}
          </li>
        ))}
      </ul>
    </Marco>
  );
}
