import type { PageServerLoad } from './$types';
import { getDB, getAllEquipment, getProductsForEquipmentLinking } from '$lib/server/db';
import type { Equipment } from '$lib/types/equipment';

type LinkableProduct = { id: string; name: string; templateType: string | null };

export const load: PageServerLoad = async ({ platform, locals }) => {
  if (!platform?.env?.DB) {
    return { equipment: [] as Equipment[], products: [] as LinkableProduct[] };
  }

  try {
    const db = getDB(platform);
    const siteId = locals.siteId || 'default-site';
    const [equipment, products] = await Promise.all([
      getAllEquipment(db, siteId),
      getProductsForEquipmentLinking(db, siteId)
    ]);
    return { equipment, products };
  } catch (err) {
    console.error('Error loading equipment:', err);
    return { equipment: [] as Equipment[], products: [] as LinkableProduct[] };
  }
};
