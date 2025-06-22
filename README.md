# FaselHD Link Extractor API

This Node.js application provides an API to extract video links from FaselHD URLs.

## Prerequisites (for Termux)

*   Termux application installed on your Android device.
*   Basic knowledge of using the command line.

## Setup & Installation in Termux

1.  **Install Node.js and npm:**
    Open Termux and type the following command:
    ```bash
    pkg update && pkg upgrade
    pkg install nodejs-lts
    ```
    (You can also try `pkg install nodejs` if `nodejs-lts` is not found, but LTS is generally recommended).
    Verify the installation by checking the versions:
    ```bash
    node -v
    npm -v
    ```

2.  **Create Project Files:**
    Create a directory for the project and navigate into it:
    ```bash
    mkdir faselhd-api
    cd faselhd-api
    ```
    You will need to create three files in this directory: `package.json`, `faselhd_extractor.js`, and `api.js`.

    **a. `package.json`:**
    Create this file with the following content:
    ```json
    {
      "name": "faselhd-link-extractor-api",
      "version": "1.0.0",
      "description": "API to extract video links from FaselHD URLs",
      "main": "api.js",
      "scripts": {
        "start": "node api.js",
        "test": "echo \"Error: no test specified\" && exit 1"
      },
      "keywords": [
        "api",
        "extractor",
        "faselhd"
      ],
      "author": "",
      "license": "ISC",
      "dependencies": {
        "axios": "^0.21.1",
        "express": "^4.17.1",
        "jsdom": "^16.6.0"
      }
    }
    ```

    **b. `faselhd_extractor.js`:**
    Create this file with the following content (reflecting the latest version with robust promise handling):
    ```javascript
    const { JSDOM } = require('jsdom');
    const axios = require('axios');

    async function extractFaselhdLinks(url) {
      try {
        const response = await axios.get(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Referer': 'https://faselhd.cafe/', // Adjust if the domain changes
            'Accept-Language': 'ar,en-US;q=0.9,en;q=0.8'
          },
          timeout: 15000 // Increased timeout
        });

        const dom = new JSDOM(response.data, {
          runScripts: "dangerously",
          pretendToBeVisual: true,
          resources: "usable"
        });

        // More robust waiting for dynamic content
        await new Promise(resolve => {
          let resolved = false;
          const resolveOnce = () => {
              if (!resolved) {
                  resolved = true;
                  resolve();
              }
          };
          // Fallback timeout
          const timeoutId = setTimeout(resolveOnce, 7000); // Adjusted timeout

          dom.window.addEventListener('DOMContentLoaded', () => {
            clearTimeout(timeoutId); // Clear timeout if DOMContentLoaded fires
            resolveOnce();
          });
        });

        const document = dom.window.document;
        const mediaLinks = new Set();

        // Search in iframe elements
        const iframes = document.querySelectorAll('iframe');
        iframes.forEach(iframe => {
          if (iframe.src && (iframe.src.includes('.m3u8') || iframe.src.includes('video') || iframe.src.includes('player'))) {
            mediaLinks.add(iframe.src);
          }
        });

        // Search in data attributes
        const dataElements = document.querySelectorAll('[data-src], [data-video], [data-file], [data-stream]');
        dataElements.forEach(element => {
          const dataAttrs = ['data-src', 'data-video', 'data-file', 'data-stream'];
          dataAttrs.forEach(attr => {
            const value = element.getAttribute(attr);
            if (value && (value.includes('.m3u8') || value.includes('master.m3u8') || value.includes('.mp4'))) {
              mediaLinks.add(value);
            }
          });
        });
        
        // Search in common video tags
        const videoElements = document.querySelectorAll('video, source');
        videoElements.forEach(element => {
            const src = element.src || element.getAttribute('src');
            if (src && (src.includes('.m3u8') || src.includes('.mp4'))) {
                mediaLinks.add(src);
            }
        });

        // Analyze script tags
        const scripts = document.querySelectorAll('script:not([src])');
        scripts.forEach(script => {
          const scriptContent = script.textContent;
          const urlRegex = /(https?:\/\/[^\s"'`<>]+/gi;
          let match;
          while((match = urlRegex.exec(scriptContent)) !== null) {
              const link = match[0];
              if (link.includes('.m3u8') || link.includes('.mp4') || link.includes('cdn') || link.includes('stream') || link.includes('player')) {
                  const cleanedLink = link.split(/[?"'`<>]/)[0];
                  if (cleanedLink.length > 10) {
                     mediaLinks.add(cleanedLink);
                  }
              }
          }
        });

        const filteredLinks = Array.from(mediaLinks).filter(link => {
          return (
            link.startsWith('http') &&
            !link.includes('adservice') && !link.includes('banner') &&
            !link.includes('track') && !link.includes('logo') &&
            !link.includes('advertisement') && !link.includes('static.zdassets.com') &&
            link.length > 20
          );
        });

        if (filteredLinks.length === 0) {
          throw new Error('No valid media links found on the page. The content might be protected or the page structure changed.');
        }
        
        return filteredLinks;

      } catch (error) {
        // console.error("Internal error in extractFaselhdLinks:", error); // For server logs
        if (error.message.startsWith('No valid media links found')) {
            throw error;
        }
        throw new Error(`Failed to extract links from FaselHD: ${error.message}`);
      }
    }

    module.exports = { extractFaselhdLinks };
    ```

    **c. `api.js`:**
    Create this file with the following content (reflecting latest version with logging and 404):
    ```javascript
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
      // Optional: Domain check
      // if (!url.includes('faselhd')) {
      //   return res.status(400).json({ error: 'URL must be from FaselHD' });
      // }

      try {
        console.log(`Attempting to extract links from: ${url}`); // Logging the URL
        const links = await extractFaselhdLinks(url);
        if (links.length > 0) {
          res.status(200).json({ links: links });
        } else {
          // This case might be covered by extractFaselhdLinks throwing an error
          // but as a fallback or if extractFaselhdLinks returns empty array:
          res.status(404).json({ error: 'No media links found at the provided URL.' });
        }
      } catch (error) {
        console.error('Error in /extract endpoint for URL ' + url + ':', error.message);
        // Check if the error message is the specific "No valid media links found"
        if (error.message.includes('No valid media links found')) {
             res.status(404).json({ error: 'No media links found at the provided URL.', details: error.message });
        } else {
             res.status(500).json({ error: 'Failed to extract links', details: error.message });
        }
      }
    });

    app.listen(port, () => {
      console.log(`API server listening at http://localhost:${port}`);
      console.log(`Open your browser or use curl to test, e.g., curl 'http://localhost:${port}/extract?url=YOUR_FASELHD_URL'`);
    });
    ```
    *Note: The content for `faselhd_extractor.js` and `api.js` above is based on the latest known versions and includes the suggested improvements for the README.*

3.  **Install Dependencies:**
    Once the files are created, run the following command in the `faselhd-api` directory to install the necessary packages:
    ```bash
    npm install
    ```

## Running the API

1.  **Start the Server:**
    Navigate to your project directory (`faselhd-api`) in Termux and run:
    ```bash
    npm start
    ```
    You should see a message like: `API server listening at http://localhost:3000`.

## Testing the API in Termux

1.  **Using `curl`:**
    Open a new Termux session (swipe from the left edge and tap "New Session") or use your current one if the server is running in the background (you can run `npm start &` to run it in the background).
    Replace `YOUR_FASELHD_URL_HERE` with an actual FaselHD video page URL.
    ```bash
    curl 'http://localhost:3000/extract?url=YOUR_FASELHD_URL_HERE'
    ```
    For example:
    ```bash
    curl 'http://localhost:3000/extract?url=https://faselhd.cafe/some-movie-page'
    ```

2.  **Interpreting the Response:**
    You will see a JSON response in the console.
    *   **Success:** `{"links":["http://link1.m3u8", "http://link2.mp4", ...]}`
    *   **Error (e.g., URL not found or no links):** `{"error":"No media links found at the provided URL."}` or `{"error":"URL query parameter is required"}`

3.  **Using a Browser (Alternative):**
    If you have a web browser on your phone, you might be able to open `http://localhost:3000/extract?url=YOUR_FASELHD_URL_HERE` directly. Some Android browsers might require you to use `http://127.0.0.1:3000/...` instead of `localhost`.

## Troubleshooting

*   Ensure you have a stable internet connection in Termux.
*   Double-check the FaselHD URL you are trying to use. The site structure might change, which could break the extractor.
*   The `faselhd.cafe` domain might change. If so, update the `Referer` header in `faselhd_extractor.js`.
*   If `npm install` fails, check your internet connection and ensure Node.js/npm were installed correctly.
*   The extractor logic in `faselhd_extractor.js` might need updates if FaselHD changes its website structure significantly. Check for errors like "No valid media links found".
```
