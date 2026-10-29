// import OpenAI from "openai";
// import { env } from "../../config/env.ts";

// const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });

// const generateStore = async (req, res) => {
//   const { niche } = req.body;

//   const prompt = `Generate a store for the niche: ${niche} and return a JSON like this:
//                     {
//                     "name": "",
//                     "description": "",
//                     "categories": [],
//                     "heroText": ""
//                     }
//   `;

//   try {
//     const chat = await openai.chat.completions.create({
//       model: "gpt-3.5-turbo",
//       messages: [{ role: "user", content: prompt }],
//       temperature: 0.8,
//     });

//     const json = chat.choices[0].message.content;
//     const data = JSON.parse(json);

//     // const store = await Store.create({
//     //   name: data.name,
//     //   niche,
//     //   description: data.description,
//     //   categories: data.categories,
//     //   heroText: data.heroText,
//     // });

//     // res.json(store);
//     res.json(data);
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ error: "Something went wrong" });
//   }
// };

// export { generateStore };
