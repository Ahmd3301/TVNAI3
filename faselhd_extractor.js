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
      const urlRegex = /(https?:\/\/[^\s"'`<>]+/gi);
      let match;
      while((match = urlRegex.exec(scriptContent)) !== null) {
          const link = match[0];
          if (link.includes('.m3u8') || link.includes('.mp4') || link.includes('cdn') || link.includes('stream') || link.includes('player')) {
              const cleanedLink = link.split(/[?"'`<>]/)[0];
              if (cleanedLink.length > 10) { // Basic sanity check for link length
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
        !link.includes('advertisement') && !link.includes('static.zdassets.com') && // filter out common non-video service links
        link.length > 20 // filter out very short, likely invalid links
      );
    });

    if (filteredLinks.length === 0) {
      // This error will be caught by the API and returned as a 404 or 500
      throw new Error('No valid media links found on the page. The content might be protected or the page structure changed.');
    }
    
    return filteredLinks;

  } catch (error) {
    // console.error("Internal error in extractFaselhdLinks:", error.message); // Optional: for server-side debugging only
    // Re-throw specific errors or a generic one
    if (error.message.startsWith('No valid media links found')) {
        throw error; // Propagate the specific error
    }
    // For other errors (network, parsing, etc.), wrap them
    throw new Error(`Failed to extract links from FaselHD: ${error.message}`);
  }
}

module.exports = { extractFaselhdLinks };
