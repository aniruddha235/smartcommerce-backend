const express = require('express');
const cors = require('cors');
require('dotenv').config();
const { OpenAI } = require('openai');
const Razorpay = require('razorpay');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Mock Product Database
const PRODUCTS = [
  {
    id: 1,
    name: "Urban DryBack Backpack",
    price: 79.99,
    category: "Bags",
    description: "Waterproof commuter backpack with a dedicated 15-inch laptop sleeve and ergonomic support.",
    image: "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&q=80&w=400"
  },
  {
    id: 2,
    name: "TechShield Laptop Sleeve",
    price: 29.99,
    category: "Accessories",
    description: "Shock-absorbing protective sleeve for laptops up to 14 inches with accessory pocket.",
    image: "https://images.unsplash.com/photo-1544816155-12df9643f363?auto=format&fit=crop&q=80&w=400"
  },
  {
    id: 3,
    name: "EcoFlask Thermal Bottle",
    price: 24.99,
    category: "Lifestyle",
    description: "Double-wall insulated stainless steel water bottle that keeps drinks cold for 24 hours.",
    image: "https://images.unsplash.com/photo-1602143407151-7111542de6e8?auto=format&fit=crop&q=80&w=400"
  },
  {
    id: 4,
    name: "NoiseCancel Wireless Headphones",
    price: 149.99,
    category: "Electronics",
    description: "Over-ear Bluetooth headphones with active noise cancellation and 30-hour battery life.",
    image: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&q=80&w=400"
  }
];

// Initialize OpenAI client safely
let openai = null;
if (process.env.OPENAI_API_KEY && !process.env.OPENAI_API_KEY.includes('dummy')) {
  openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

// Initialize Razorpay client
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || 'dummy_key_id',
  key_secret: process.env.RAZORPAY_KEY_SECRET || 'dummy_key_secret'
});

// Health check endpoint
app.get('/', (req, res) => {
  res.send('SmartCommerce AI Backend is running live.');
});

// Fetch product catalog endpoint
app.get('/api/products', (req, res) => {
  res.json(PRODUCTS);
});

// AI Search endpoint with fail-safe fallback
app.post('/api/search', async (req, res) => {
  const { query } = req.body;

  if (!query) {
    return res.status(400).json({ error: 'Search query is required' });
  }

  const executeFallback = () => {
    const lowerQuery = query.toLowerCase();
    const matched = PRODUCTS.filter(p =>
      p.name.toLowerCase().includes(lowerQuery) ||
      p.description.toLowerCase().includes(lowerQuery) ||
      p.category.toLowerCase().includes(lowerQuery)
    );

    return res.json({
      explanation: matched.length > 0
        ? `Showing search results for "${query}".`
        : `No direct matches found for "${query}". Displaying full catalog.`,
      products: matched.length > 0 ? matched : PRODUCTS
    });
  };

  if (!openai) {
    return executeFallback();
  }

  try {
    const prompt = `
      You are an AI search assistant for an e-commerce store.
      User Query: "${query}"

      Product Catalog:
      ${JSON.stringify(PRODUCTS, null, 2)}

      Tasks:
      1. Select the IDs of products that best fit the query.
      2. Write a clear 1-2 sentence explanation of why these products match.

      Respond ONLY in valid JSON with this format:
      {
        "matchingIds": [1, 2],
        "explanation": "Your explanation here"
      }
    `;

    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.2,
      response_format: { type: "json_object" }
    });

    const parsed = JSON.parse(completion.choices[0].message.content);
    const matchingIds = parsed.matchingIds || [];
    const filteredProducts = PRODUCTS.filter(p => matchingIds.includes(p.id));

    return res.json({
      explanation: parsed.explanation || `Recommendations for "${query}".`,
      products: filteredProducts.length > 0 ? filteredProducts : PRODUCTS
    });

  } catch (error) {
    console.error('OpenAI Search Error:', error.message);
    return executeFallback();
  }
});

// Create Razorpay Order endpoint
app.post('/api/payment/order', async (req, res) => {
  try {
    const { amount, currency = 'INR' } = req.body;

    if (!amount) {
      return res.status(400).json({ error: 'Order amount is required' });
    }

    const options = {
      amount: Math.round(amount * 100), // Amount in smallest currency unit (paise)
      currency,
      receipt: `receipt_${Date.now()}`
    };

    const order = await razorpay.orders.create(options);
    res.json(order);
  } catch (error) {
    console.error('Razorpay Order Error:', error);
    res.status(500).json({ error: 'Failed to create Razorpay order' });
  }
});

// Verify Razorpay Payment Signature endpoint
app.post('/api/payment/verify', (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ error: 'Missing required payment verification parameters' });
    }

    const body = razorpay_order_id + '|' + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET || 'dummy_key_secret')
      .update(body.toString())
      .digest('hex');

    if (expectedSignature === razorpay_signature) {
      return res.json({ success: true, message: 'Payment verified successfully' });
    } else {
      return res.status(400).json({ success: false, message: 'Invalid payment signature' });
    }
  } catch (error) {
    console.error('Payment Verification Error:', error);
    res.status(500).json({ error: 'Failed to verify payment' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Create Razorpay Order endpoint
app.post('/api/payment/order', async (req, res) => {
  try {
    const { amount, currency = 'INR' } = req.body;

    // Validate incoming amount
    const parsedAmount = parseFloat(amount);
    if (!amount || isNaN(parsedAmount) || parsedAmount <= 0) {
      return res.status(400).json({ error: 'Valid order amount is required' });
    }

    const options = {
      amount: Math.round(parsedAmount * 100), // Amount in paise
      currency,
      receipt: `receipt_${Date.now()}`
    };

    const order = await razorpay.orders.create(options);
    return res.json(order);
  } catch (error) {
    // Log complete error stack to Render console
    console.error('Razorpay Order Execution Error:', error);
    
    return res.status(500).json({ 
      error: 'Failed to create Razorpay order',
      details: error.description || error.message || error 
    });
  }
});