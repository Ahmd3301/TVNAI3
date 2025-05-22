const express = require('express');
const { extractFaselhdLinks } = require('./faselhd_extractor.js'); // Ensure this path is correct

const app = express();
const port = process.env.PORT || 3000;

// Middleware to parse JSON request bodies
app.use(express.json());

app.get('/extract', async (req, res) => {
  const url = req.query.url;

  if (!url) {
    return res.status(400).json({ error: 'URL query parameter is required' });
  }

  try {
    const links = await extractFaselhdLinks(url);
    res.status(200).json({ links: links });
  } catch (error) {
    console.error('Error in /extract endpoint:', error); // Log the error on the server for debugging
    res.status(500).json({ error: 'Failed to extract links', details: error.message });
  }
});

// Start the server
app.listen(port, () => {
  console.log(`API server listening at http://localhost:${port}`);
});
