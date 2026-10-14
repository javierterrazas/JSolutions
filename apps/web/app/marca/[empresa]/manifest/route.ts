// El manifiesto de la app de una empresa (D-078); "general" es J Solutions.
import { manifiestoDe } from '../../manifiesto';

export async function GET(_peticion: Request, ctx: RouteContext<'/marca/[empresa]/manifest'>) {
  return manifiestoDe((await ctx.params).empresa);
}
