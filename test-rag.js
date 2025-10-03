// Quick test of RAG API
fetch('http://localhost:3002/search', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ query: 'ecommerce' })
})
.then(res => res.json())
.then(data => console.log('RAG API Response:', JSON.stringify(data, null, 2)))
.catch(err => console.error('Error:', err));