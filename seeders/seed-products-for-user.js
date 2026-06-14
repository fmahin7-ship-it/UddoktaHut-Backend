/**
 * Seed 52 demo products for a merchant by email.
 *
 * Usage:
 *   npm run seed-products
 *   SEED_USER_EMAIL=other@email.com npm run seed-products
 *   npm run seed-products -- --replace   (delete prior UH-052-* seeds first)
 */
import dotenv from "dotenv";
import { Op } from "sequelize";
import { sequelize } from "../app/config/database.js";
import { User, Store, Product } from "../app/models/RootModel.js";

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

const NAME_PARTS = {
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

function buildProducts(userId, storeId) {
  const products = [];
  let index = 0;

  while (products.length < PRODUCT_COUNT) {
    const category = CATEGORIES[index % CATEGORIES.length];
    const names = NAME_PARTS[category];
    const baseName = names[index % names.length];
    const color = COLORS[(index + 2) % COLORS.length];
    const seq = String(products.length + 1).padStart(3, "0");

    products.push({
      name: `${color} ${baseName}`,
      image: IMAGE,
      price: Number((12 + (index % 18) * 3.75 + (index % 5) * 2.1).toFixed(2)),
      stock: 8 + ((index * 7) % 92),
      status: index % 7 === 0 ? "inactive" : "active",
      category,
      sku: `${SKU_PREFIX}-${seq}`,
      user_id: userId,
      store_id: storeId,
    });

    index += 1;
  }

  return products;
}

async function main() {
  const replace = process.argv.includes("--replace");

  await sequelize.authenticate();

  const user = await User.findOne({ where: { email: TARGET_EMAIL } });
  if (!user) {
    throw new Error(`User not found for email: ${TARGET_EMAIL}`);
  }

  const store = await Store.findOne({ where: { user_id: user.id } });
  if (!store) {
    throw new Error(
      `No store found for ${TARGET_EMAIL}. Complete onboarding first.`
    );
  }

  const existingWhere = {
    store_id: store.id,
    sku: { [Op.like]: `${SKU_PREFIX}-%` },
  };

  const existingCount = await Product.count({ where: existingWhere });

  if (existingCount >= PRODUCT_COUNT && !replace) {
    console.log(
      `Already seeded ${existingCount} products (${SKU_PREFIX}-*) for store "${store.store_name}".`
    );
    console.log("Use --replace to delete and re-seed.");
    await sequelize.close();
    return;
  }

  if (replace || existingCount > 0) {
    const deleted = await Product.destroy({ where: existingWhere });
    console.log(`Removed ${deleted} existing seeded product(s).`);
  }

  const products = buildProducts(user.id, store.id);
  await Product.bulkCreate(products);

  const total = await Product.count({ where: { store_id: store.id } });

  console.log(`Seeded ${products.length} products for ${TARGET_EMAIL}`);
  console.log(`Store: ${store.store_name} (id: ${store.id})`);
  console.log(`Total products in store: ${total}`);
  console.log(`SKU range: ${SKU_PREFIX}-001 .. ${SKU_PREFIX}-052`);

  await sequelize.close();
}

main().catch(async (err) => {
  console.error("Seed failed:", err.message);
  try {
    await sequelize.close();
  } catch {
    // ignore
  }
  process.exit(1);
});
