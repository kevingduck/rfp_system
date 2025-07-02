import axios from 'axios';
import cheerio from 'cheerio';
import puppeteer from 'puppeteer';

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
    console.error('Basic scraping failed, trying with Puppeteer:', error);
    return await scrapeWithPuppeteer(url);
  }
}

async function scrapeWithPuppeteer(url: string): Promise<ScrapedContent> {
  let browser;
  
  try {
    browser = await puppeteer.launch({ 
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    
    const title = await page.title();
    
    const content = await page.evaluate(() => {
      const scripts = document.querySelectorAll('script, style, nav, header, footer');
      scripts.forEach(el => el.remove());
      
      const mainContent = document.querySelector('main, article, [role="main"], #content, .content');
      return (mainContent || document.body).innerText;
    });
    
    return {
      url,
      title,
      content: content.trim(),
      scrapedAt: new Date()
    };
  } catch (error) {
    throw new Error(`Failed to scrape ${url}: ${error}`);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}