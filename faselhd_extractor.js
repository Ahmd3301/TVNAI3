const { JSDOM } = require('jsdom');
const axios = require('axios');

async function extractFaselhdLinks(url) {
  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Referer': 'https://faselhd.cafe/', // It's common for sites to check referer
        'Accept-Language': 'ar,en-US;q=0.9,en;q=0.8'
      },
      timeout: 15000 // Increased timeout for potentially slow loads
    });

    const dom = new JSDOM(response.data, {
      runScripts: "dangerously",
      pretendToBeVisual: true,
      resources: "usable" // Allow loading of subresources like scripts if needed, though might increase load time
    });

    // Wait for dynamic content - this might need adjustment based on site behavior
    await new Promise(resolve => {
        // More robust waiting: wait for a specific element or a network idle event if possible
        // For now, using a combination of DOMContentLoaded and a timeout as a fallback
        let resolved = false;
        const resolveOnce = () => {
            if (!resolved) {
                resolved = true;
                resolve();
            }
        };
        dom.window.addEventListener('DOMContentLoaded', resolveOnce);
        setTimeout(resolveOnce, 7000); // Adjusted timeout
    });

    const document = dom.window.document;
    const mediaLinks = new Set();

    // Search in iframe elements
    const iframes = document.querySelectorAll('iframe');
    iframes.forEach(iframe => {
      if (iframe.src) {
        if (iframe.src.includes('.m3u8') || iframe.src.includes('video') || iframe.src.includes('player')) {
          mediaLinks.add(iframe.src);
        }
      }
    });

    // Search in data attributes of various elements
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
        const src = element.src || element.getAttribute('src'); // element.src for <video>, getAttribute for <source>
        if (src && (src.includes('.m3u8') || src.includes('.mp4'))) {
            mediaLinks.add(src);
        }
    });


    // Analyze script tags for links
    const scripts = document.querySelectorAll('script:not([src])');
    scripts.forEach(script => {
      const scriptContent = script.textContent;
      // Regex to find URLs, then filter for common video/streaming patterns
      const urlRegex = /(https?:\/\/[^\s"'`<>]+/gi;
      let match;
      while((match = urlRegex.exec(scriptContent)) !== null) {
          const link = match[0];
          if (link.includes('.m3u8') || link.includes('.mp4') || link.includes('cdn') || link.includes('stream') || link.includes('player')) {
              // Basic cleanup of the link
              const cleanedLink = link.split(/[?"'`<>]/)[0];
              if (cleanedLink.length > 10) { // Avoid very short, likely incorrect matches
                 mediaLinks.add(cleanedLink);
              }
          }
      }
    });

    // Filter out non-HTTP links, ads, tracking, logos, and very short/invalid links
    const filteredLinks = Array.from(mediaLinks).filter(link => {
      return (
        link.startsWith('http') &&
        !link.includes('adservice') &&
        !link.includes('banner') &&
        !link.includes('track') &&
        !link.includes('logo') &&
        !link.includes('advertisement') &&
        !link.includes('static.zdassets.com') && // Example of a non-video link
        link.length > 20 // Ensure link is of reasonable length
      );
    });

    if (filteredLinks.length === 0) {
        // If after all attempts no links are found, it might be a specific issue or protected content
        throw new Error('No valid media links found on the page. The content might be protected or the page structure changed.');
    }
    
    return filteredLinks;

  } catch (error) {
    // Log the original error for server-side debugging if needed, but throw a more generic one to the client
    // console.error("Internal error in extractFaselhdLinks:", error); // For server logs
    if (error.message.startsWith('No valid media links found')) {
        throw error; // Re-throw our custom error
    }
    throw new Error(`Failed to extract links from FaselHD: ${error.message}`);
  }
}

module.exports = { extractFaselhdLinks };
