// Los subcontratistas de la empresa, para el dueño (D-073): darlos de alta, editarlos con sus papeles (seguro,
// licencia, W-9) y darlos de baja o reactivarlos. Avisa lo que le falta en papeles a cada uno. El PM los ve en sus
// órdenes, sin papeles ni dinero.
import { subcontratistas } from '@ijm/servidor';
import { getTranslations } from 'next-intl/server';
import { comoMiembro, exigirDueno } from '@/lib/acceso';
import { Marco, estilos } from '../componentes/marco';
import { MensajeError } from '../componentes/mensaje-error';
import { AgregarSub } from './agregar-sub';
import { TarjetaSub } from './tarjeta-sub';

export default async function Subcontratistas() {
  const acceso = await exigirDueno();
  const r = await comoMiembro((tx) => subcontratistas(tx), acceso);
  const t = await getTranslations('subcontratistas');
  const lista = r.ok ? r.datos.subcontratistas : [];
  const oficios = r.ok ? r.datos.oficios : [];
  const activos = lista.filter((x) => x.activo);
  const deBaja = lista.filter((x) => !x.activo);

  return (
    <Marco titulo={t('titulo')} volver={{ href: '/', texto: t('volver') }}>
      <p className="text-sm text-slate-700">{t('ayuda')}</p>
      {!r.ok ? <MensajeError problema={r} /> : null}
      <AgregarSub oficios={oficios} />
      {r.ok && activos.length === 0 ? <p className={estilos.tarjeta}>{t('vacio')}</p> : null}
      <ul className="flex flex-col gap-3">
        {activos.map((x) => (
          <TarjetaSub key={x.id} sub={x} oficios={oficios} />
        ))}
      </ul>
      {deBaja.length ? (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-bold text-marca">{t('dadosDeBaja')}</h2>
          <ul className="flex flex-col gap-3">
            {deBaja.map((x) => (
              <TarjetaSub key={x.id} sub={x} oficios={oficios} />
            ))}
          </ul>
        </section>
      ) : null}
    </Marco>
  );
}
