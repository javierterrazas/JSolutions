// Después de la entrega, para el dueño (D-090; legacy: la cosecha y las garantías abiertas del tablero): los reclamos
// de garantía abiertos, las obras entregadas sin reseña y las visitas de los 11 meses que se acercan. Cada una lleva a
// donde se atiende.
import { pendientesDePosventa } from '@ijm/servidor';
import { getFormatter, getTranslations } from 'next-intl/server';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { comoMiembro, exigirDueno } from '@/lib/acceso';
import { Marco, estilos } from '../componentes/marco';
import { MensajeError } from '../componentes/mensaje-error';

function Seccion({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-xl font-bold text-marca">{titulo}</h2>
      <ul className="flex flex-col gap-2">{children}</ul>
    </section>
  );
}

function Fila({ href, titulo, detalle }: { href: string; titulo: string; detalle: string }) {
  return (
    <li>
      <Link href={href} className={`${estilos.tarjeta} flex flex-col gap-0.5 text-sm`}>
        <span className="font-semibold text-marca">{titulo}</span>
        <span className="text-slate-700">{detalle}</span>
      </Link>
    </li>
  );
}

export default async function Posventa() {
  const acceso = await exigirDueno();
  const r = await comoMiembro((tx) => pendientesDePosventa(tx), acceso);
  const [t, formato] = await Promise.all([getTranslations('posventa'), getFormatter()]);
  const volver = { href: '/', texto: t('volver') };
  if (!r.ok)
    return (
      <Marco titulo={t('titulo')} volver={volver}>
        <MensajeError problema={r} />
      </Marco>
    );
  const { garantias, sinResena, visitas } = r.datos;
  // un día de negocio a mediodía, para que ninguna zona horaria lo mueva de día
  const dia = (d: string) => formato.dateTime(new Date(`${d}T12:00:00`), { dateStyle: 'medium' });
  const obra = (x: { folio: string; cliente: string }) => `${x.folio} · ${x.cliente}`;

  return (
    <Marco titulo={t('titulo')} volver={volver}>
      <p className="text-slate-700">{t('intro')}</p>
      {garantias.length ? (
        <Seccion titulo={t('garantias')}>
          {garantias.map((g, i) => (
            <Fila
              key={`${g.obraId}-${i}`}
              href={`/obras/${g.obraId}/retrabajos`}
              titulo={obra(g)}
              detalle={`${g.reclamo} — ${t('reclamoDesde', { dia: formato.dateTime(g.desde, { dateStyle: 'medium' }) })}`}
            />
          ))}
        </Seccion>
      ) : null}
      {sinResena.length ? (
        <Seccion titulo={t('sinResena')}>
          {sinResena.map((x) => (
            <Fila
              key={x.obraId}
              href={`/obras/${x.obraId}/cerrar`}
              titulo={obra(x)}
              detalle={[t('entregada', { dia: dia(x.entrega) }), x.pedida ? t('pedida') : null]
                .filter(Boolean)
                .join(' — ')}
            />
          ))}
        </Seccion>
      ) : null}
      {visitas.length ? (
        <Seccion titulo={t('visitas')}>
          {visitas.map((x) => (
            <Fila
              key={x.obraId}
              href={`/obras/${x.obraId}/cerrar`}
              titulo={obra(x)}
              detalle={t('vence', { dia: dia(x.vence) })}
            />
          ))}
        </Seccion>
      ) : null}
      {!garantias.length && !sinResena.length && !visitas.length ? (
        <p className="rounded-xl bg-emerald-50 p-3 text-emerald-900">{t('nada')}</p>
      ) : null}
    </Marco>
  );
}
