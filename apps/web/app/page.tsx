import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { exigirAcceso } from '@/lib/acceso';
import { salir } from './acciones/entrar';
import { Marco, estilos } from './componentes/marco';

export default async function Inicio() {
  const { yo } = await exigirAcceso();
  const t = await getTranslations('inicio');
  return (
    <Marco titulo={t('hola', { nombre: yo.nombre })}>
      <p className={estilos.tarjeta}>{t('pronto')}</p>
      {yo.rol !== 'pm' ? (
        <>
          <Link href="/obras" className={`${estilos.boton} flex items-center justify-center`}>
            {t('obras')}
          </Link>
          <Link href="/equipo" className={`${estilos.botonSecundario} flex items-center justify-center`}>
            {t('equipo')}
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
