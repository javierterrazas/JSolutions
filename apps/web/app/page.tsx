import { copiaSinSenal, gastosEnRevision, inicioDelPm } from '@ijm/servidor';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { comoMiembro, exigirAcceso } from '@/lib/acceso';
import { salir } from './acciones/entrar';
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
  // las compras del PM arriba de su límite que el dueño tiene que revisar (D-049)
  const enRevision = yo.rol !== 'pm' ? await comoMiembro((tx) => gastosEnRevision(tx), acceso) : null;
  const porRevisar = enRevision?.ok ? enRevision.datos.length : 0;
  return (
    <Marco titulo={t('hola', { nombre: yo.nombre })}>
      {copia?.ok && copia.datos ? <GuardarCopia copia={copia.datos} /> : null}
      {yo.rol === 'pm' ? <EstadoCola /> : null}
      {pm?.ok ? <InicioDelPm datos={pm.datos} /> : null}
      {pm && !pm.ok ? <MensajeError problema={pm} /> : null}
      {yo.rol !== 'pm' ? (
        <>
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
          <Link href="/equipo" className={`${estilos.botonSecundario} flex items-center justify-center`}>
            {t('equipo')}
          </Link>
          <Link href="/catalogo" className={`${estilos.botonSecundario} flex items-center justify-center`}>
            {t('catalogo')}
          </Link>
        </>
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
