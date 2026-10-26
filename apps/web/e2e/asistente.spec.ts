// El asistente del dueño (D-114): con el módulo prendido, el dueño crea una llave en Mi empresa, y con su enlace un
// asistente se conecta por MCP (como lo haría Claude), lista las herramientas y consulta las obras. La consulta queda
// anotada; al quitar la llave, el enlace deja de servir.
import { MODULOS } from '@ijm/core';
import { expect, test } from '@playwright/test';
import { admin, entrar, es } from './apoyo';

const EMPRESA_A = 'e000000a-0000-4000-8000-000000000000';

test('el dueño conecta un asistente con su llave, el asistente consulta y la llave se quita', async ({
  page,
}) => {
  await admin()
    .from('empresas')
    .update({ modulos: [...MODULOS] })
    .eq('id', EMPRESA_A);
  await entrar(page, 'dueno');
  await page.goto('/empresa');
  await page.getByRole('link', { name: es.miEmpresa.asistente }).click();
  await expect(page.getByRole('heading', { level: 1, name: es.asistente.titulo })).toBeVisible();

  await page.getByLabel(es.asistente.nombre).fill('Claude de prueba');
  await page.getByRole('button', { name: es.asistente.crear }).click();
  const enlace = await page.getByRole('textbox', { name: es.asistente.copiar }).inputValue();
  expect(enlace).toMatch(/\/mcp\/jsa_[\w-]{32}$/);

  // el asistente se conecta
  const mcp = (cuerpo: object) => page.request.post(enlace, { data: cuerpo });
  const inicio = await mcp({
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'prueba', version: '1' } },
  });
  expect(inicio.status()).toBe(200);
  expect((await inicio.json()).result.serverInfo.name).toBe('j-solutions');
  expect((await mcp({ jsonrpc: '2.0', method: 'notifications/initialized' })).status()).toBe(202);
  const lista = await (await mcp({ jsonrpc: '2.0', id: 2, method: 'tools/list' })).json();
  expect(lista.result.tools.map((x: { name: string }) => x.name)).toContain('obras');
  const obras = await (
    await mcp({ jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'obras', arguments: {} } })
  ).json();
  expect(obras.result.isError).toBe(false);
  expect(obras.result.content[0].text).toContain('"folio":"OB-001"');
  expect((await page.request.get(enlace)).status()).toBe(405);

  // la consulta queda anotada
  await page.reload();
  const llave = page.getByRole('listitem').filter({ hasText: 'Claude de prueba' });
  await expect(llave).toContainText('1 consulta');
  await expect(page.getByRole('listitem').filter({ hasText: es.asistente.herramientas.obras })).toBeVisible();

  // quitarla: el enlace ya no sirve
  await llave.getByRole('button', { name: es.asistente.quitar }).click();
  await expect(page.getByText(es.asistente.quitadas.replace('{nombres}', 'Claude de prueba'))).toBeVisible();
  expect(
    (
      await mcp({ jsonrpc: '2.0', id: 4, method: 'tools/call', params: { name: 'obras', arguments: {} } })
    ).status(),
  ).toBe(404);
});
