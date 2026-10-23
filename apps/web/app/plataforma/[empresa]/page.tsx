// La cuenta de una empresa en la plataforma (D-080): su estado, su dueño, cuánto la usa, editar sus datos y los de su
// dueño (D-097), su suscripción, sus pagos, reinvitar a su dueño y suspenderla. Solo quien administra la plataforma.
import { formatoCelular, siguienteVencimiento } from '@ijm/core';
import { empresaDeLaPlataforma, hoyDeLaPlataforma } from '@ijm/servidor';
import { getFormatter, getLocale, getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { comoMiembro } from '@/lib/acceso';
import { formatoDinero } from '@/lib/dinero';
import { exigirPlataforma } from '@/lib/plataforma';
import { Marco, estilos } from '../../componentes/marco';
import { MensajeError } from '../../componentes/mensaje-error';
import { COLOR_ESTADO } from '../estados';
import { ModulosDeLaEmpresa } from './modulos';
import {
  FormularioEmpresa,
  FormularioPago,
  FormularioSuscripcion,
  ReinvitarDueno,
  SuspenderEmpresa,
} from './formularios';

export default async function CuentaDeEmpresa({ params }: { params: Promise<{ empresa: string }> }) {
  const { empresa: empresaId } = await params;
  const acceso = await exigirPlataforma();
  const r = await comoMiembro((tx) => empresaDeLaPlataforma(tx, { empresaId }), acceso);
  const [t, idioma, formato] = await Promise.all([
    getTranslations('plataforma'),
    getLocale(),
    getFormatter(),
  ]);
  const volver = { href: '/plataforma', texto: t('volverLista') };
  if (!r.ok)
    return (
      <Marco titulo={t('titulo')} volver={volver}>
        <MensajeError problema={r} />
      </Marco>
    );
  if (!r.datos) notFound();
  const { empresa: e, pagos } = r.datos;
  const dinero = formatoDinero(idioma);
  // un día de negocio a mediodía, para que ninguna zona horaria lo mueva de día
  const fecha = (d: string) => formato.dateTime(new Date(`${d}T12:00:00`), { dateStyle: 'medium' });
  const hoy = hoyDeLaPlataforma();

  return (
    <Marco titulo={e.nombre} subtitulo={e.ciudad ?? undefined} volver={volver}>
      <div className={`${estilos.tarjeta} flex flex-col gap-1`}>
        <span
          className={`self-start rounded-full px-2 py-0.5 text-sm font-semibold ${COLOR_ESTADO[e.estado]}`}
        >
          {t(`estados.${e.estado}`)}
        </span>
        <span>{e.venceEl ? t('vence', { dia: fecha(e.venceEl) }) : t('sinVencimiento')}</span>
        <span className="text-slate-700">
          {t('duenoContacto', {
            dueno: e.dueno ?? '—',
            contacto:
              [e.telefono ? formatoCelular(e.telefono) : null, e.correo].filter(Boolean).join(' · ') || '—',
          })}
        </span>
        <span className="text-slate-700">{t('uso', { pms: e.pms, obras: e.obrasEnCurso })}</span>
        <span className="text-slate-700">{t('obrasTotal', { n: e.obras })}</span>
        <span className="text-slate-700">
          {e.ultimoUso
            ? t('ultimoUso', { dia: formato.relativeTime(e.ultimoUso, new Date()) })
            : t('nuncaEntro')}
        </span>
        <span className="text-sm text-slate-600">
          {t('creada', { dia: formato.dateTime(e.creadaEn, { dateStyle: 'medium' }) })}
        </span>
      </div>

      <FormularioEmpresa
        empresaId={e.id}
        valores={{
          empresa: e.nombre,
          ciudad: e.ciudad ?? '',
          dueno: e.dueno ?? '',
          celular: e.telefono ? formatoCelular(e.telefono) : '',
          correo: e.correo ?? '',
        }}
      />

      <FormularioPago
        empresaId={e.id}
        monto={e.precio}
        hoy={hoy}
        venceEl={siguienteVencimiento(e.venceEl, hoy, e.ciclo)}
      />

      <FormularioSuscripcion
        empresaId={e.id}
        valores={{ plan: e.plan, precio: e.precio, ciclo: e.ciclo, enPrueba: e.enPrueba, venceEl: e.venceEl }}
        notas={e.notas ?? ''}
      />

      <ModulosDeLaEmpresa empresaId={e.id} modulos={r.datos.modulos} />

      <section className="flex flex-col gap-2">
        <h2 className="text-xl font-bold text-marca">{t('pagos')}</h2>
        {pagos.length ? (
          <ul className="flex flex-col gap-2">
            {pagos.map((p) => (
              <li key={p.id} className={`${estilos.tarjeta} flex flex-col gap-1`}>
                <span className="flex justify-between gap-2 font-semibold">
                  <span>{fecha(p.pagadoEl)}</span>
                  <span>{dinero.format(p.monto)}</span>
                </span>
                <span className="text-sm text-slate-700">
                  {p.referencia
                    ? t('metodoReferencia', { metodo: t(`metodos.${p.metodo}`), referencia: p.referencia })
                    : t(`metodos.${p.metodo}`)}
                </span>
                <span className="text-sm text-slate-600">{t('cubrio', { dia: fecha(p.venceEl) })}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-slate-600">{t('sinPagos')}</p>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-xl font-bold text-marca">{t('acceso')}</h2>
        <ReinvitarDueno empresaId={e.id} />
        <SuspenderEmpresa empresaId={e.id} activa={e.activa} />
      </section>
    </Marco>
  );
}
