// const puppeteer = require('puppeteer-core');
const fs = require('fs');
const { PuppeteerScreenRecorder } = require('puppeteer-screen-recorder');
const puppeteer = require('puppeteer-extra')

// In case puppeteer fails to load Chromium browser, visit this link:
// https://stackoverflow.com/questions/66214552/tmp-chromium-error-while-loading-shared-libraries-libnss3-so-cannot-open-sha

// Another issue that you might run into is chrome will fail to load with sandbox enabled. Visit this link:
// https://github.com/puppeteer/puppeteer/blob/main/docs/troubleshooting.md#setting-up-chrome-linux-sandbox

// read the adblock flag from the command line
const adblockFlag = process.argv[3] || '0';
const proxyPort = process.argv[4] || '8080';
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const { type } = require('os');
puppeteer.use(StealthPlugin())
puppeteer.use(require('puppeteer-extra-plugin-anonymize-ua')())
let consoleLog = [];
// configuration for the video recorder
const Config = {
  followNewTab: true,
  fps: 25,
  videoFrame: {
    width: 1366,
    height: 768,
  },
  videoCrf: 18,
  videoCodec: 'libx264',
  videoPreset: 'ultrafast',
  videoBitrate: 1000,
  autopad: {
    color: 'black' | '#35A5FF',
  },
  aspectRatio: '4:3',
};

// print typeof adblockFlag
// console.log('Adblock Flag:', typeof(adblockFlag));

// const adbExtensionRepacked = '/home/ahsan/Desktop/AdCompliance/adhere_linux/extension_3_7_0_0.crx'
// const adbExtensionUnpacked = '/home/ahsan/Desktop/AdCompliance/adblockchrome-5.22.0-mv3'

(async () => {
  // let adblockExtension = '/home/azafar2/AdCompliance/extensions/adblockchrome-5.22.0-mv3'
  let adblockExtension = '/home/azafar2/AdCompliance/extensions/adblockchrome-5.22.0-mv3-modified'
  // let adblockExtension = '/home/azafar2/AdCompliance/extensions/adblockchrome-5.22.0-mv3-without-acceptableads'
  let adblockWithoutAcceptebleAdsExtension = '/home/azafar2/AdCompliance/extensions/adblockchrome-5.22.0-mv3-without-acceptableads'
  // Launch the browser and open a new blank page
  let args = [];
  console.log('Adblock Flag:', adblockFlag);
  if (adblockFlag == '1') {
    args = ['--disable-web-security', '--disable-application-cache', '--media-cache-size=1','--disk-cache-size=1', `--proxy-server=https=localhost:${proxyPort}`, '--ignore-certificate-errors', '--ignore-certificate-errors-spki-list',`--load-extension=${adblockExtension}`]
  } else if (adblockFlag == '2') {
    args = ['--disable-web-security', '--disable-application-cache', '--media-cache-size=1', '--disk-cache-size=1', `--proxy-server=https=localhost:${proxyPort}`, '--ignore-certificate-errors', '--ignore-certificate-errors-spki-list',`--load-extension=${adblockWithoutAcceptebleAdsExtension}`]
  } else {
    args = ['--disable-web-security', '--disable-application-cache', '--media-cache-size=1', '--disk-cache-size=1', `--proxy-server=https=localhost:${proxyPort}`, '--ignore-certificate-errors', '--ignore-certificate-errors-spki-list']
  }
  const browser = await puppeteer.launch({
    headless: true,
    args: args,
    executablePath: '/home/azafar2/AdCompliance/chrome-linux/chrome',
    timeout: 0
  });
  console.log('Browser launched successfully!');

  let website = '';
  // website name stripped of http or https so that we can use it as a folder name
  if (process.argv[2] === undefined) {
    console.log('Please pass a website URL as the second argument. Example: node automatedCrawl.js https://example.com');
    process.exit(1);
  } else {
    website = process.argv[2].replace(/(^\w+:|^)\/\//, '');
    console.log('Website:', website);
  }
  console.log('Page loaded successfully!')

  if (adblockFlag == '1' || adblockFlag == '2') {
    // console.log('Waiting for 10 seconds before crawling the target domain');
    // First navigate to a blank page and stay there for 10 seconds. Let me explain. When we load the extension in a setting, upon opening a page, the extension will also load its page. So this delay is to ensure that the extension has had its time to load its page and then we can crawl our target domain.
    const dummypage = await browser.newPage();
    // set viewport
    await dummypage.setViewport({width: 1366, height: 768});
    await dummypage.goto('about:blank', {
      waitUntil: 'networkidle0',
      timeout: 0
    });
    await delay(7000);
    // close the page
    await dummypage.close();
  }


  const page = await browser.newPage();

  // await page.setUserAgent("Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/44.0.2403.157 Safari/537.36");


  // Initiate the video recorder
  const recorder = new PuppeteerScreenRecorder(page, Config);

  // Start the video recording
  // const videoPath = '/home/azafar2/Desktop/adcompliance/AdCompliance/puppeteer/videos/video.mp4';
  const videoPath = `/home/azafar2/AdCompliance/puppeteer/videos/${website}_${adblockFlag}.mp4`;
  await recorder.start(videoPath);


  const url = 'https://' + website;

  // Save all the console logs in a file
  page.on('console', msg => {
    let message = `${msg.type().toUpperCase()} ${msg.text()}`;
    consoleLog.push(message);
  });
  
  /* 
  if (adblockFlag == '1' || adblockFlag == '2') {
    // First navigate to a blank page and stay there for 10 seconds. Let me explain. When we load the extension in a setting, upon opening a page, the extension will also load its page. So this delay is to ensure that the extension has had its time to load its page and then we can crawl our target domain.
    await page.setViewport({width: 1366, height: 768});
    await page.goto('about:blank', {
      waitUntil: 'networkidle0',
      timeout: 0
    }); 
  
    await delay(10000);
  }
  */
  
  // Navigate the page to the website (append https to it)
  // inifinite page load is an issue with some of the domains. Trying this: https://github.com/puppeteer/puppeteer/issues/3238#issuecomment-426849882
  try{
    await page.goto(url, {
      waitUntil: 'networkidle0',
      timeout: 120000 // 2 minutes timeout as we have telemetry overhead that takes time to load as well
  });
  } catch (error) {
    // each time we get a timeout, we will write the name of this domain in ./timeout_domains/{domain}.txt
    fs.writeFileSync(`/home/azafar2/AdCompliance/puppeteer/timeout_domains/${website}.txt`, '', { flag: 'w' });
    console.error('Timeout exceeded:', error);
  }
  // await page.goto(url, {
  //   waitUntil: 'networkidle0',
  //   timeout: 0
  // });
  

  // this function does not seem to make a lot of difference in terms of ensuring that the page is fully loaded
  await waitTillHTMLRendered(page);

  // Set the viewport to the full height of the page to capture the entire content
  // const fullPage = await page.evaluate(() => {
  //   return {
  //     width: document.documentElement.clientWidth,
  //     height: Math.max(document.documentElement.clientHeight, window.innerHeight)
  //   }
  // });

  // Set screen size
  // await page.setViewport({
  //   width: fullPage.width,
  //   height: fullPage.height
  // });

  // Scroll down and up the page
  await autoScrollDown(page, 50);  // set limit to 50 scrolls

  // Delay for 7 seconds
  await delay(7000);

  // Scroll up the page
  await autoScrollUp(page, 50);  // set limit to 50 scrolls

  // Delay for 7 seconds
  await delay(7000);

  const body = await page.$('body');


  // Take a screenshot of the page
  await page.screenshot({
    type: 'png',
    path: `/home/azafar2/AdCompliance/puppeteer/screenshots_modified/${website}_${adblockFlag}.png`,
    fullPage: true,
    // clip: await body.boundingBox()
  });

  // Stop the video recording
  await recorder.stop();  


  // Close the browser
  await browser.close();

  // Write the consoleLog to a file. Check if the file exists, if it doesn't then create it otherwise overwrite it
  const consoleLogPath = `/home/azafar2/AdCompliance/puppeteer/consoleLogs/${website}.txt`;
  fs.writeFileSync(consoleLogPath, consoleLog.join('\n'), { flag: 'w' });
})();

// https://stackoverflow.com/questions/46919013/puppeteer-wait-n-seconds-before-continuing-to-the-next-line
function delay(time) {
  return new Promise(function(resolve) { 
      setTimeout(resolve, time)
  });
}

// https://stackoverflow.com/questions/52497252/puppeteer-wait-until-page-is-completely-loaded
// Actually I am not sure if this is helping a lot
const waitTillHTMLRendered = async (page, timeout = 30000) => {
  const checkDurationMsecs = 1000;
  const maxChecks = timeout / checkDurationMsecs;
  let lastHTMLSize = 0;
  let checkCounts = 1;
  let countStableSizeIterations = 0;
  const minStableSizeIterations = 3;

  while(checkCounts++ <= maxChecks){
    let html = await page.content();
    let currentHTMLSize = html.length; 

    let bodyHTMLSize = await page.evaluate(() => document.body.innerHTML.length);

    console.log('last: ', lastHTMLSize, ' <> curr: ', currentHTMLSize, " body html size: ", bodyHTMLSize);

    if(lastHTMLSize != 0 && currentHTMLSize == lastHTMLSize) 
      countStableSizeIterations++;
    else 
      countStableSizeIterations = 0; //reset the counter

    if(countStableSizeIterations >= minStableSizeIterations) {
      console.log("Page rendered fully..");
      break;
    }

    lastHTMLSize = currentHTMLSize;
    // await page.waitForTimeout(checkDurationMsecs);
    await delay(checkDurationMsecs); // https://stackoverflow.com/questions/77078345/how-to-fix-issue-that-deprecated-page-waitfortimeout-method-usage
  }  
};


// https://stackoverflow.com/questions/51529332/puppeteer-scroll-down-until-you-cant-anymore
async function autoScrollDown(page, maxScrolls){
  await page.evaluate(async (maxScrolls) => {
      await new Promise((resolve) => {
          var totalHeight = 0;
          var distance = 100;
          var scrolls = 0;  // scrolls counter
          var timer = setInterval(() => {
              var scrollHeight = document.body.scrollHeight;
              window.scrollBy(0, distance);
              totalHeight += distance;
              scrolls++;  // increment counter

              // stop scrolling if reached the end or the maximum number of scrolls
              if(totalHeight >= scrollHeight - window.innerHeight || scrolls >= maxScrolls){
                  clearInterval(timer);
                  resolve();
              }
          }, 100);
      });
  }, maxScrolls);  // pass maxScrolls to the function
}

async function autoScrollUp(page, maxScrolls){
  await page.evaluate(async (maxScrolls) => {
      await new Promise((resolve) => {
          var totalHeight = 0;
          var distance = -100;
          var scrolls = 0;  // scrolls counter
          var timer = setInterval(() => {
              var scrollHeight = document.body.scrollHeight;
              window.scrollBy(0, distance);
              totalHeight += distance;
              scrolls++;  // increment counter

              // stop scrolling if reached the end or the maximum number of scrolls
              if(totalHeight <= 0 || scrolls >= maxScrolls){
                  clearInterval(timer);
                  resolve();
              }
          }, 100);
      });
  }, maxScrolls);  // pass maxScrolls to the function
}

