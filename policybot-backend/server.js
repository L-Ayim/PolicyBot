const express = require('express');
const math = require('mathjs');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Calculator endpoint
app.post('/calculate', (req, res) => {
  try {
    const { expression } = req.body;

    if (!expression || typeof expression !== 'string') {
      return res.status(400).json({ error: 'Expression is required and must be a string' });
    }

    // Evaluate the expression safely using mathjs
    const result = math.evaluate(expression);

    // Format the result
    const formattedResult = typeof result === 'number' ? result.toString() : result;

    res.json({
      expression,
      result: formattedResult,
      success: true
    });
  } catch (error) {
    console.error('Calculation error:', error);
    res.status(400).json({
      error: 'Invalid mathematical expression',
      details: error.message,
      success: false
    });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`Calculator API server running on port ${PORT}`);
});