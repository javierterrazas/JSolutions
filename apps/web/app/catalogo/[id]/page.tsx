// Un tipo de obra del catálogo: su nombre y sus partidas en orden, para agregar, editar o dar de baja. Los espacios
// que ya existen tienen su propia copia: lo que se cambie aquí vale para los espacios nuevos.
import { tipoParaEditar } from '@ijm/servidor';
import { getLocale, getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { comoMiembro, exigirDueno } from '@/lib/acceso';
import { cambiarActivoDeTipo } from '../../acciones/catalogo';
import { Marco, estilos } from '../../componentes/marco';
import { FormularioPartida, type Opciones } from './formulario-partida';
import { Partida } from './partida';
import { RenombrarTipo } from './renombrar-tipo';

export default async function TipoDeObra({ params }: PageProps<'/catalogo/[id]'>) {
  const { id } = await params;
  const acceso = await exigirDueno();
  const r = await comoMiembro((tx) => tipoParaEditar(tx, { tipoId: id }), acceso);
  if (!r.ok || !r.datos) notFound();
  const d = r.datos;
  const [t, idioma] = await Promise.all([getTranslations('catalogo'), getLocale()]);
  const nombre = (n: { es: string; en: string | null }) => (idioma === 'en' ? n.en : null) ?? n.es;
  const opciones: Opciones = {
    etapas: d.etapas.map((e) => ({ id: e.id, nombre: nombre(e.nombre) })),
    hitos: d.hitos.map((h) => ({ id: h.id, nombre: `${h.clave} ${nombre(h.nombre)}` })),
    oficios: d.oficios.map((o) => ({ id: o.id, nombre: nombre(o.nombre) })),
  };
  const activas = d.partidas.filter((p) => p.activa);
  const pesoTotal = activas.reduce((a, p) => a + p.peso, 0);
  return (
    <Marco titulo={nombre(d.tipo.nombre)}>
      <Link href="/catalogo" className="text-sm font-medium text-marca">
        {t('volverCatalogo')}
      </Link>
      {d.tipo.activo ? null : <p className={estilos.error}>{t('tipoDeBaja')}</p>}
      <p className="text-sm text-slate-600">{t('tipoAyuda')}</p>
      <RenombrarTipo tipoId={d.tipo.id} nombre={d.tipo.nombre} />
      <p className="text-sm text-slate-600">
        {t('resumen', { n: activas.length, peso: Math.round(pesoTotal * 100) / 100 })}
      </p>
      <ul className="flex flex-col gap-2">
        {d.partidas.map((p) => (
          <Partida key={p.id} tipoId={d.tipo.id} partida={p} opciones={opciones} nombre={nombre(p.nombre)} />
        ))}
      </ul>
      <FormularioPartida
        tipoId={d.tipo.id}
        partida={null}
        opciones={opciones}
        siguiente={activas.reduce((m, p) => Math.max(m, p.orden), 0) + 1}
      />
      {d.tipo.generales ? null : (
        <form action={cambiarActivoDeTipo.bind(null, d.tipo.id, !d.tipo.activo)} className="mt-4">
          <button type="submit" className={`${estilos.botonSecundario} w-full`}>
            {d.tipo.activo ? t('darDeBajaTipo') : t('reactivarTipo')}
          </button>
          {d.tipo.activo ? (
            <p className="mt-1 text-center text-xs text-slate-500">{t('darDeBajaAyuda')}</p>
          ) : null}
        </form>
      )}
    </Marco>
  );
}
