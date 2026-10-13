// El álbum de fotos de una obra (fase 2, paso 6f; legacy: vFotos de PM.html): por día, cada registro con sus fotos,
// lo más nuevo primero y por páginas (?pagina=). Lo ven el PM de la obra y el dueño; cada quien solo las fotos que
// puede ver (RLS). El PM ve también el de sus obras terminadas mientras dura la garantía (D-060). Las fotos se abren
// por /fotos/[id], con un enlace firmado de pocos minutos.
import { albumDeObra, albumEnGarantia, type RegistroDelAlbum, TIPOS_FOTO_CLIENTE } from '@ijm/servidor';
import { getFormatter, getLocale, getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { comoMiembro, exigirAcceso } from '@/lib/acceso';
import { marcarFoto } from '../../../acciones/portal';
import { Marco, estilos } from '../../../componentes/marco';

export default async function Album({ params, searchParams }: PageProps<'/obras/[id]/album'>) {
  const { id } = await params;
  const consulta = await searchParams;
  const pagina = Math.max(0, Math.min(1000, Number(consulta.pagina) || 0));
  const acceso = await exigirAcceso();
  const pm = acceso.yo.rol === 'pm';
  const activa = await comoMiembro((tx) => albumDeObra(tx, { obraId: id, pagina }), acceso);
  // una obra que el PM ya no ve: la terminada en garantía, de solo lectura
  const terminada =
    activa.ok && !activa.datos && pm
      ? await comoMiembro((tx) => albumEnGarantia(tx, { obraId: id, pagina }), acceso)
      : null;
  const r = terminada ?? activa;
  if (!r.ok || !r.datos) notFound();
  const a = r.datos;
  const [t, formato, idioma] = await Promise.all([getTranslations('album'), getFormatter(), getLocale()]);
  const nombre = (n: { es: string; en: string | null }) => (idioma === 'en' ? n.en : null) ?? n.es;
  const volver = terminada ? '/obras/terminadas' : pm ? '/' : '/obras';

  // por día, en el orden en que llegan (lo más nuevo primero)
  const dias: { dia: string; registros: RegistroDelAlbum[] }[] = [];
  for (const reg of a.registros) {
    const ultimo = dias.at(-1);
    if (ultimo?.dia === reg.dia) ultimo.registros.push(reg);
    else dias.push({ dia: reg.dia, registros: [reg] });
  }

  const descripcion = (reg: RegistroDelAlbum) => {
    const partes = [
      reg.folio,
      reg.titulo ? nombre(reg.titulo) : null,
      reg.detalle,
      reg.resultado && t.has(`resultados.${reg.resultado}` as never)
        ? t(`resultados.${reg.resultado}` as never)
        : null,
    ].filter(Boolean);
    return partes.join(' · ');
  };

  return (
    <Marco
      titulo={t('titulo')}
      subtitulo={t('obra', { folio: a.obra.folio, cliente: a.obra.cliente })}
      volver={{ href: volver, texto: t('volver') }}
    >
      {a.registros.length === 0 ? <p className={estilos.tarjeta}>{t('vacio')}</p> : null}
      {/* las fotos que ve el cliente en su portal (D-066); no en una obra en garantía, que es de solo lectura */}
      {!terminada && a.registros.length ? (
        <p className="text-sm text-slate-700">{t('ayudaCliente')}</p>
      ) : null}
      {dias.map((d) => (
        <section key={d.dia} className="flex flex-col gap-3">
          <h2 className="text-lg font-bold text-marca">
            {formato.dateTime(new Date(`${d.dia}T12:00:00`), {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
            })}
          </h2>
          {d.registros.map((reg) => (
            <article key={`${reg.tipo}-${reg.id}`} className={`${estilos.tarjeta} flex flex-col gap-2`}>
              <p className="font-semibold">{t(`tipos.${reg.tipo}`)}</p>
              {descripcion(reg) ? <p className="text-sm text-slate-600">{descripcion(reg)}</p> : null}
              <ul className="grid grid-cols-3 gap-2">
                {reg.fotos.map((f) => (
                  <li key={f} className="flex flex-col gap-1">
                    <a href={`/fotos/${f}`} target="_blank" rel="noreferrer">
                      {/* eslint-disable-next-line @next/next/no-img-element -- un enlace firmado de pocos minutos, no se optimiza */}
                      <img
                        src={`/fotos/${f}`}
                        alt=""
                        loading="lazy"
                        className="aspect-square w-full rounded-lg bg-slate-100 object-cover"
                      />
                    </a>
                    {!terminada && TIPOS_FOTO_CLIENTE.includes(reg.tipo) ? (
                      <form action={marcarFoto.bind(null, a.obra.id, f, !reg.paraCliente.includes(f))}>
                        <button
                          type="submit"
                          aria-pressed={reg.paraCliente.includes(f)}
                          aria-label={t('paraCliente')}
                          className="min-h-10 w-full rounded-lg border-2 border-marca/30 px-1 text-sm font-semibold text-marca aria-pressed:border-marca aria-pressed:bg-marca aria-pressed:text-white"
                        >
                          {reg.paraCliente.includes(f) ? t('loVeCliente') : t('cliente')}
                        </button>
                      </form>
                    ) : null}
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </section>
      ))}
      <div className="flex gap-2">
        {pagina > 0 ? (
          <Link
            href={`/obras/${a.obra.id}/album${pagina > 1 ? `?pagina=${pagina - 1}` : ''}`}
            className={`${estilos.botonSecundario} flex flex-1 items-center justify-center`}
          >
            {t('recientes')}
          </Link>
        ) : null}
        {a.hayMas ? (
          <Link
            href={`/obras/${a.obra.id}/album?pagina=${pagina + 1}`}
            className={`${estilos.botonSecundario} flex flex-1 items-center justify-center`}
          >
            {t('anteriores')}
          </Link>
        ) : null}
      </div>
    </Marco>
  );
}
