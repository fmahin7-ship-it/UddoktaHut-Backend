import z from "zod";

const storeSchema = z.object({
  storeName: z.string({ message: "Store name is required" }),
});

const storeUpdateSchema = z.object({
  templateName: z.string().min(1, "Template name is required"),
});

export { storeSchema, storeUpdateSchema };
