# Ad-Compliance
This work is based on the online detection of digital ads that violate the standards prescribed in the Acceptable Ads Standards. Our work, which builds on prior works such as [AdHere](https://weihang-wang.github.io/papers/ICSE2023-AdHere.pdf), designs heuristics that match the descriptions of offending ads outlined in the Standard. 

The repository contains the necessary source files that may be used to find ads that violate the Standard. While the design of our tool is modular and these source files can be used in other ways, we describe in some detail the infrastructure design that we have used to crawl websites to apply our heuristics. 

`ad-detector.js`: contains the necessary heuristics that are used to find violating ads of six types that are forbidden under the Acceptable Ads Standard. This source file can be injected inside the DOM of 

`automatedCrawl.js`: contains the code for puppeteer that we use to interact with the browser. The script contains functionality for inserting the modified (you will have to perform the modification yourself) Adblock Plus extension. It further collects screenshots that are later used to manually validate some of the results.

`injector-abp.py`: as stated earlier, the ad detection can be applied in numerous ways. However, for our study, we choose to insert the ad detection code using MITMProxy. As such, the injector-abp.py contains code for setting up an injection script that is served by an active Mitmproxy server.

### How to modify the exception list for the extension
All extensions are locally present in the following directory.
/home/azafar2/AdCompliance/extensions/adblockchrome-5.22.0-mv3-modified/data/rules/abp