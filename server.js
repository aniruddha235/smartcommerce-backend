const express = require('express');
const cors = require('cors');
const { OpenAI } = require('openai');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

const PRODUCTS = [
  { id: 1, name: "Urban DryBack Backpack", price: 2499, category: "Bags", description: "Water-resistant commuter backpack with 15-inch laptop sleeve." },
  { id: 2, name: "TechShield Laptop Sleeve", price: 1299, category: "Accessories", description: "Padded neoprene laptop case for maximum drop protection." },
  { id: 3, name: "EcoFlask Thermal Bottle", price: 899, category: "Outdoor", description: "Insulated stainless steel water bottle that keeps drinks cold for 24 hours." }
];

// Initialize OpenAI client (supports standard OpenAI & Azure OpenAI)
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || process.env.AZURE_OPENAI_KEY || 'dummy_key',
  ...(process.env.AZURE_OPENAI_ENDPOINT && {
    baseURL: `${process.env.AZURE_OPENAI_ENDPOINT}/openai/deployments/${process.env.AZURE_OPENAI_DEPLOYMENT}`,
    defaultQuery: { 'api-version': '2024-02-01' },
    defaultHeaders: { 'api-key': process.env.AZURE_OPENAI_KEY }
  })
});

// Semantic AI Search Route
app.post('/api/search', async (req, res) => {
  const { query } = req.body;

  if (!query || query.trim() === '') {
    return res.json({ explanation: 'Showing all available products.', products: PRODUCTS });
  }

  try {
    // Fallback simulation if no live API keys are present in .env
    if (!process.env.OPENAI_API_KEY && !process.env.AZURE_OPENAI_KEY) {
      const lowerQuery = query.toLowerCase();
      const matched = PRODUCTS.filter(p => 
        p.name.toLowerCase().includes(lowerQuery) || 
        p.description.toLowerCase().includes(lowerQuery) ||
        p.category.toLowerCase().includes(lowerQuery)
      );

      return res.json({
        explanation: matched.length > 0 
          ? `Showing matched results for query: "${query}".`
          : `No direct keyword match found for "${query}". Showing store catalog.`,
        products: matched.length > 0 ? matched : PRODUCTS
      });
    }

    const prompt = `
You are an intelligent e-commerce recommendation engine. 
Given the product catalog below, select the most relevant products for the user query.

Catalog: ${JSON.stringify(PRODUCTS)}
User Query: "${query}"

Return ONLY a JSON object with this exact structure:
{
  "explanation": "A concise 1-sentence summary explaining why these products match.",
  "productIds": [1, 2]
}
    `;

    const response = await openai.chat.completions.create({
      model: process.env.AZURE_OPENAI_DEPLOYMENT || 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: "json_object" }
    });

    const aiResult = JSON.parse(response.choices[0].message.content);
    const filteredProducts = PRODUCTS.filter(p => aiResult.productIds?.includes(p.id));

    res.json({
      explanation: aiResult.explanation,
      products: filteredProducts.length > 0 ? filteredProducts : PRODUCTS
    });
  } catch (error) {
    console.error('AI Search Endpoint Error:', error);
    res.status(500).json({ error: 'Failed to process AI search' });
  }
});

app.get('/api/health', (req, res) => res.json({ status: 'ok', message: 'SmartCommerce Server Ready' }));
app.get('/api/products', (req, res) => res.json(PRODUCTS));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));