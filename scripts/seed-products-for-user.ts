/**
 * Seed 52 demo products for a merchant by email.
 */
import dotenv from "dotenv";
import { and, count, eq, like } from "drizzle-orm";
import { connectDatabase, db, pool } from "../app/db/client.ts";
import { products, stores, users } from "../app/db/schema/index.ts";

dotenv.config();

const TARGET_EMAIL = process.env.SEED_USER_EMAIL || "f.mahin7@gmail.com";
const PRODUCT_COUNT = 52;
const SKU_PREFIX = "UH-052";

const CATEGORIES = [
  "T-Shirts",
  "Shirts",
  "Hoodies",
  "Pants",
  "Dresses",
  "Accessories",
  "Shoes",
  "Outerwear",
];

const NAME_PARTS: Record<string, string[]> = {
  "T-Shirts": ["Classic Cotton Tee", "Graphic Print Tee", "Polo Tee", "V-Neck Tee", "Oversized Tee"],
  Shirts: ["Formal Shirt", "Casual Shirt", "Linen Shirt", "Denim Shirt", "Flannel Shirt"],
  Hoodies: ["Zip Hoodie", "Pullover Hoodie", "Fleece Hoodie", "Lightweight Hoodie"],
  Pants: ["Slim Fit Chinos", "Cargo Pants", "Jogger Pants", "Formal Trousers", "Denim Jeans"],
  Dresses: ["Summer Dress", "Maxi Dress", "Casual Dress", "Party Dress"],
  Accessories: ["Leather Belt", "Canvas Tote", "Baseball Cap", "Sunglasses", "Scarf"],
  Shoes: ["Running Sneakers", "Casual Loafers", "Sports Sandals", "Canvas Shoes"],
  Outerwear: ["Denim Jacket", "Bomber Jacket", "Windbreaker", "Puffer Jacket"],
};

const COLORS = [
  "Black",
  "White",
  "Navy",
  "Olive",
  "Maroon",
  "Beige",
  "Charcoal",
  "Sky Blue",
];

const IMAGE =
  "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=400&q=80";

function buildProducts(userId: number, storeId: number) {
  const rows: Array<typeof products.$inferInsert> = [];
  let index = 0;

  while (rows.length < PRODUCT_COUNT) {
    const category = CATEGORIES[index % CATEGORIES.length]!;
    const names = NAME_PARTS[category]!;
    const baseName = names[index % names.length]!;
    const color = COLORS[(index + 2) % COLORS.length]!;
    const seq = String(rows.length + 1).padStart(3, "0");

    rows.push({
      name: `${color} ${baseName}`,
      image: IMAGE,
      price: String(
        Number((12 + (index % 18) * 3.75 + (index % 5) * 2.1).toFixed(2))
      ),
      stock: 8 + ((index * 7) % 92),
      status: index % 7 === 0 ? "inactive" : "active",
      category,
      sku: `${SKU_PREFIX}-${seq}`,
      user_id: userId,
      store_id: storeId,
    });

    index += 1;
  }

  return rows;
}

async function main() {
  const replace = process.argv.includes("--replace");

  await connectDatabase();

  const user = await db.query.users.findFirst({
    where: eq(users.email, TARGET_EMAIL),
  });
  if (!user) {
    throw new Error(`User not found for email: ${TARGET_EMAIL}`);
  }

  const store = await db.query.stores.findFirst({
    where: eq(stores.user_id, user.id),
  });
  if (!store) {
    throw new Error(
      `No store found for ${TARGET_EMAIL}. Complete onboarding first.`
    );
  }

  const existingWhere = and(
    eq(products.store_id, store.id),
    like(products.sku, `${SKU_PREFIX}-%`)
  );

  const [existingRow] = await db
    .select({ count: count() })
    .from(products)
    .where(existingWhere);
  const existingCount = existingRow?.count ?? 0;

  if (existingCount >= PRODUCT_COUNT && !replace) {
    console.log(
      `Already seeded ${existingCount} products (${SKU_PREFIX}-*) for store "${store.store_name}".`
    );
    console.log("Use --replace to delete and re-seed.");
    await pool.end();
    return;
  }

  if (replace || existingCount > 0) {
    await db.delete(products).where(existingWhere);
    console.log(`Removed existing seeded product(s).`);
  }

  const productRows = buildProducts(user.id, store.id);
  await db.insert(products).values(productRows);

  const [totalRow] = await db
    .select({ count: count() })
    .from(products)
    .where(eq(products.store_id, store.id));

  console.log(`Seeded ${productRows.length} products for ${TARGET_EMAIL}`);
  console.log(`Store: ${store.store_name} (id: ${store.id})`);
  console.log(`Total products in store: ${totalRow?.count ?? 0}`);
  console.log(`SKU range: ${SKU_PREFIX}-001 .. ${SKU_PREFIX}-052`);

  await pool.end();
}

main().catch(async (err) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error("Seed failed:", message);
  try {
    await pool.end();
  } catch {
    // ignore
  }
  process.exit(1);
});
