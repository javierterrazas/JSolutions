import {
  avisosAbiertos,
  congelarPlanSemanal,
  copiaSinSenal,
  esAdminPlataforma,
  gastosEnRevision,
  inicioDelPm,
  miSuscripcion,
  obrasEnGarantia,
} from '@ijm/servidor';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { comoMiembro, exigirAcceso } from '@/lib/acceso';
import { salir } from './acciones/entrar';
import { AvisoSuscripcion } from './aviso-suscripcion';
import { Marco, estilos } from './componentes/marco';
import { MensajeError } from './componentes/mensaje-error';
import { EstadoCola } from './estado-cola';
import { GuardarCopia } from './guardar-copia';
import { InicioDelPm } from './inicio-pm';

export default async function Inicio() {
  const acceso = await exigirAcceso();
  const { yo } = acceso;
  const t = await getTranslations('inicio');
  const pm = yo.rol === 'pm' ? await comoMiembro((tx) => inicioDelPm(tx), acceso) : null;
  // la copia para abrir la app sin señal (D-047)
  const copia = yo.rol === 'pm' ? await comoMiembro((tx) => copiaSinSenal(tx), acceso) : null;
  // sus obras terminadas en garantía, con sus fotos (D-060)
  const terminadas = yo.rol === 'pm' ? await comoMiembro((tx) => obrasEnGarantia(tx), acceso) : null;
  // las compras del PM arriba de su límite que el dueño tiene que revisar (D-049)
  const enRevision = yo.rol !== 'pm' ? await comoMiembro((tx) => gastosEnRevision(tx), acceso) : null;
  const porRevisar = enRevision?.ok ? enRevision.datos.length : 0;
  // y los avisos de los PMs que esperan respuesta (D-050)
  const abiertos = yo.rol !== 'pm' ? await comoMiembro((tx) => avisosAbiertos(tx), acceso) : null;
  const avisos = abiertos?.ok ? abiertos.datos : [];
  // el plan de esta semana, para el cumplimiento: se congela la primera vez que el dueño abre la app en la semana
  // (D-079). Si falla, el inicio se muestra igual: se vuelve a intentar al abrir otra vez.
  if (yo.rol !== 'pm')
    await comoMiembro((tx) => congelarPlanSemanal(tx), acceso).catch((e: unknown) =>
      console.error('No se pudo congelar el plan de la semana', e),
    );
  // la suscripción de la empresa, para su aviso; y si quien entra administra la plataforma (D-080)
  const cuenta = await comoMiembro(
    async (tx) => ({ suscripcion: await miSuscripcion(tx), plataforma: await esAdminPlataforma(tx) }),
    acceso,
  );
  return (
    <Marco titulo={t('hola', { nombre: yo.nombre })}>
      {cuenta.ok && cuenta.datos.suscripcion ? (
        <AvisoSuscripcion suscripcion={cuenta.datos.suscripcion} esPm={yo.rol === 'pm'} />
      ) : null}
      {copia?.ok && copia.datos ? <GuardarCopia copia={copia.datos} /> : null}
      {yo.rol === 'pm' ? <EstadoCola /> : null}
      {pm?.ok ? <InicioDelPm datos={pm.datos} /> : null}
      {pm && !pm.ok ? <MensajeError problema={pm} /> : null}
      {terminadas?.ok && terminadas.datos.length ? (
        <Link
          href="/obras/terminadas"
          className={`${estilos.botonSecundario} flex items-center justify-center`}
        >
          {t('terminadas', { n: terminadas.datos.length })}
        </Link>
      ) : null}
      {yo.rol !== 'pm' ? (
        <>
          {avisos.length ? (
            <Link
              href="/avisos"
              className={`flex min-h-12 items-center justify-center rounded-xl px-4 font-semibold ${avisos.some((a) => a.fueraDeSla) ? 'bg-red-100 text-red-900' : 'bg-amber-100 text-amber-900'}`}
            >
              {t('avisosPorContestar', { n: avisos.length })}
            </Link>
          ) : null}
          {porRevisar ? (
            <Link
              href="/gastos"
              className="flex min-h-12 items-center justify-center rounded-xl bg-amber-100 px-4 font-semibold text-amber-900"
            >
              {t('gastosPorRevisar', { n: porRevisar })}
            </Link>
          ) : null}
          <Link href="/obras" className={`${estilos.boton} flex items-center justify-center`}>
            {t('obras')}
          </Link>
          <Link href="/indicadores" className={`${estilos.botonSecundario} flex items-center justify-center`}>
            {t('indicadores')}
          </Link>
          <Link href="/historico" className={`${estilos.botonSecundario} flex items-center justify-center`}>
            {t('historico')}
          </Link>
          <Link href="/equipo" className={`${estilos.botonSecundario} flex items-center justify-center`}>
            {t('equipo')}
          </Link>
          <Link href="/cuadrilla" className={`${estilos.botonSecundario} flex items-center justify-center`}>
            {t('cuadrilla')}
          </Link>
          <Link
            href="/subcontratistas"
            className={`${estilos.botonSecundario} flex items-center justify-center`}
          >
            {t('subcontratistas')}
          </Link>
          <Link href="/catalogo" className={`${estilos.botonSecundario} flex items-center justify-center`}>
            {t('catalogo')}
          </Link>
          <Link href="/empresa" className={`${estilos.botonSecundario} flex items-center justify-center`}>
            {t('miEmpresa')}
          </Link>
        </>
      ) : null}
      {cuenta.ok && cuenta.datos.plataforma ? (
        <Link href="/plataforma" className={`${estilos.botonSecundario} flex items-center justify-center`}>
          {t('plataforma')}
        </Link>
      ) : null}
      <form action={salir} className="mt-auto flex flex-col gap-1">
        <button type="submit" className={estilos.botonSecundario}>
          {t('salir')}
        </button>
        <p className="text-center text-xs text-slate-500">{t('salirAyuda')}</p>
      </form>
    </Marco>
  );
}
