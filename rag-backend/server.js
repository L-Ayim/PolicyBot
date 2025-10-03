const express = require('express');
const cors = require('cors');

// In-memory document store with eBusiness content
const DOCUMENTS = [
  {
    id: 1,
    title: "E-commerce Fundamentals",
    content: "E-commerce involves buying and selling goods and services online. Key components include online stores, payment processing, shipping logistics, and customer service. Popular platforms include Shopify, WooCommerce, and Amazon."
  },
  {
    id: 2,
    title: "Digital Marketing Strategies",
    content: "Digital marketing encompasses SEO, social media marketing, email campaigns, PPC advertising, and content marketing. Effective strategies include targeting the right audience, creating valuable content, and measuring ROI through analytics."
  },
  {
    id: 3,
    title: "Online Business Models",
    content: "Common e-commerce business models include B2C (business-to-consumer), B2B (business-to-business), C2C (consumer-to-consumer), and D2C (direct-to-consumer). Each model has different customer acquisition and retention strategies."
  },
  {
    id: 4,
    title: "Payment Processing",
    content: "Online payment methods include credit cards, PayPal, Stripe, Apple Pay, and cryptocurrency. Security is crucial with PCI compliance, SSL certificates, and fraud prevention measures."
  },
  {
    id: 5,
    title: "Customer Service in E-commerce",
    content: "Excellent customer service includes fast response times, multiple contact channels (chat, email, phone), easy returns policies, and proactive communication. Tools like Zendesk and Intercom help manage customer interactions."
  },
  {
    id: 6,
    title: "E-commerce Analytics",
    content: "Key metrics to track include conversion rate, average order value, customer acquisition cost, lifetime value, bounce rate, and cart abandonment rate. Tools like Google Analytics and specialized e-commerce analytics platforms provide insights."
  },
  {
    id: 7,
    title: "Mobile Commerce",
    content: "Mobile commerce is growing rapidly with responsive design, mobile apps, and mobile payment solutions. Mobile users expect fast loading times, easy navigation, and seamless checkout experiences."
  },
  {
    id: 8,
    title: "Supply Chain Management",
    content: "Effective supply chain management includes inventory tracking, order fulfillment, shipping optimization, and vendor relationships. Tools like ShipBob and Oberlo help streamline operations."
  },
  {
    id: 9,
    title: "Legal Considerations",
    content: "E-commerce businesses must comply with consumer protection laws, data privacy regulations (GDPR, CCPA), tax collection, and international trade laws. Legal consultation is essential for compliance."
  },
  {
    id: 10,
    title: "Scaling E-commerce Business",
    content: "Scaling strategies include automating processes, expanding product lines, entering new markets, and building strategic partnerships. Technology infrastructure must support growth with scalable hosting and databases."
  }
];

const app = express();
const PORT = process.env.PORT || 3002;

// Middleware
app.use(cors());
app.use(express.json());

// Search endpoint with keyword-based retrieval
app.post('/search', (req, res) => {
  try {
    const { query } = req.body;

    if (!query || typeof query !== 'string') {
      return res.status(400).json({
        error: 'Query is required and must be a string',
        success: false
      });
    }

    const queryLower = query.toLowerCase();
    const matchingDocuments = DOCUMENTS.filter(doc =>
      doc.title.toLowerCase().includes(queryLower) ||
      doc.content.toLowerCase().includes(queryLower)
    );

    // Return top 3 most relevant documents (simple substring matching)
    const relevantDocs = matchingDocuments.slice(0, 3);

    res.json({
      query,
      documents: relevantDocs.map(doc => ({
        id: doc.id,
        title: doc.title,
        content: doc.content,
        citations: [{
          id: doc.id,
          title: doc.title,
          type: 'document'
        }]
      })),
      totalFound: matchingDocuments.length,
      success: true
    });
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({
      error: 'Search failed',
      details: error.message,
      success: false
    });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    documentCount: DOCUMENTS.length,
    timestamp: new Date().toISOString()
  });
});

// Get all documents (for debugging)
app.get('/documents', (req, res) => {
  res.json({
    documents: DOCUMENTS,
    total: DOCUMENTS.length
  });
});

app.listen(PORT, () => {
  console.log(`RAG Search API server running on port ${PORT}`);
  console.log(`Loaded ${DOCUMENTS.length} documents`);
});