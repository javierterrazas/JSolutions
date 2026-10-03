// globalSetup de la paridad: simula el mes del legacy una sola vez, antes de que las pruebas corran en paralelo.
import { prepararMesSimulado } from './mesSimulado';

export default function preparar(): void {
  prepararMesSimulado();
}
