// La app sin señal (fase 2, paso 5c; D-047). El service worker la guarda en el teléfono y la muestra cuando el
// servidor no contesta. No pide sesión: todo sale de la copia del teléfono, y el PIN lo revisa el teléfono. Lo que
// el PM cierra aquí va a la cola y lo revisa el servidor al llegar.
import { getTranslations } from 'next-intl/server';
import { Marco } from '../componentes/marco';
import { SinSenal } from './sin-senal';

export default async function PaginaSinSenal() {
  const t = await getTranslations('sinSenal');
  return (
    <Marco titulo={t('titulo')}>
      <SinSenal />
    </Marco>
  );
}
