import axios from 'axios';
import cheerio from 'cheerio';

export interface ScrapedContent {
  url: string;
  title: string;
  content: string;
  scrapedAt: Date;
}

export async function scrapeWebPage(url: string): Promise<ScrapedContent> {
  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    const $ = cheerio.load(response.data);
    
    $('script, style, nav, header, footer').remove();
    
    const title = $('title').text() || $('h1').first().text() || 'Untitled';
    
    const contentSelectors = [
      'main',
      'article',
      '[role="main"]',
      '#content',
      '.content',
      'body'
    ];
    
    let content = '';
    for (const selector of contentSelectors) {
      const element = $(selector);
      if (element.length) {
        content = element.text();
        break;
      }
    }
    
    content = content
      .replace(/\s+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
    
    return {
      url,
      title: title.trim(),
      content,
      scrapedAt: new Date()
    };
  } catch (error) {
    console.error('Scraping failed:', error);
    throw new Error(`Failed to scrape ${url}: ${error}`);
  }
}

