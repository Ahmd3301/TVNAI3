const express = require('express');
const { extractFaselhdLinks } = require('./faselhd_extractor.js');

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

app.get('/extract', async (req, res) => {
  const url = req.query.url;

  if (!url) {
    return res.status(400).json({ error: 'URL query parameter is required' });
  }

  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    return res.status(400).json({ error: 'Invalid URL format. Must start with http:// or https://' });
  }
  // Optional: Domain check - you can enable this if you want to restrict to FaselHD only
  // if (!url.includes('faselhd')) { // Be mindful of domain variations e.g. .cafe, .io, .com
  //   return res.status(400).json({ error: 'URL must be from a FaselHD domain' });
  // }

  try {
    console.log(`Attempting to extract links from: ${url}`); // Logging the URL being processed
    const links = await extractFaselhdLinks(url);
    // extractFaselhdLinks now throws an error if no links are found,
    // so we don't need to check for links.length === 0 here explicitly for 404.
    // That specific error will be caught in the catch block.
    res.status(200).json({ links: links });
  } catch (error) {
    console.error('Error in /extract endpoint for URL ' + url + ':', error.message); // Server-side log
    
    // Check if the error is the specific "No valid media links found"
    if (error.message.includes('No valid media links found')) {
         res.status(404).json({ error: 'No media links found at the provided URL.', details: error.message });
    } else {
         // For all other errors (network, internal logic errors in extractor, etc.)
         res.status(500).json({ error: 'Failed to process the request or extract links.', details: error.message });
    }
  }
});

app.listen(port, () => {
  console.log(`API server listening at http://localhost:${port}`);
  console.log(`Open your browser or use curl to test, e.g., curl 'http://localhost:${port}/extract?url=YOUR_FASELHD_URL'`);
});
