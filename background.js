// Background Script (background.js)
//Idea and code from  [cookie-quick-manager](https://github.com/ysard/cookie-quick-manager/).

// Declare a global variable to store unique links
const links = new Set();
var currentCookieExpirationDateTimeEpoch = 0;
// Import necessary modules if not already imported
// Define a constant for the maximum number of recent entries to keep
const MAX_RECENT_ENTRIES = 5;

// Initialize an array to hold recent entries
let recentEntries = [];

// Adapted vAPI functions
const vAPI = {

  async getContainerNameById(containerId) {
    try {
      const containers = await browser.contextualIdentities.query({});
      const container = containers.find(container => container.cookieStoreId === containerId);
      return container ? container.name : null;
    } catch (error) {
      console.error('Error retrieving container name:', error);
      return null;
    }
  },
  // Function to get container ID from container name
  async getContainerIdByName(containerName) {
    try {
      // Get the list of containers
      const containers = await browser.contextualIdentities.query({});

      for (const container of containers) {
        if (container.name === containerName) {
          return container.cookieStoreId;
        }
      }

      throw new Error('Container not found: ' + containerName);
    } catch (error) {
      console.error('Error: ' + error);
    }
  },

   // Function to get the host URL for a cookie
   getHostUrl(cookie) {
    // If the modified cookie has the flag isSecure, the host protocol must be https:// in order to
    // modify or delete it.
    var host_protocol = cookie.secure ? 'https://' : 'http://';
    return host_protocol + cookie.domain + cookie.path;
  },
  
  isExpired(expirationDate) {
    // Detect expired date
    // Return true if expired, else otherwise
    // Get Unix timestamp (seconds)
    let current_date = new Date(); // milliseconds
    return (current_date / 1000 > expirationDate);
  },

  // Function to copy cookies to a specified container
  async copyCookiesToContainer(cookies, containerName) {
    try {
      const containerId = await vAPI.getContainerIdByName(containerName);
  
      let promises = [];
      for (let cookie of cookies) {
        if (!this.isExpired(cookie.expirationDate)) {
          let params = {
            url: vAPI.getHostUrl(cookie),
            name: cookie.name,
            value: cookie.value,
            path: cookie.path,
            httpOnly: cookie.httpOnly,
            secure: cookie.secure,
            storeId: containerId,
          };
  
          if (cookie.sameSite != null) {
            params['sameSite'] = cookie.sameSite;
          }

          if (!cookie.session) {
            if (cookie.expirationDate > (Date.now() / 1000 | 0)) {
              params['expirationDate'] = cookie.expirationDate;
              console.log('Path ' +  cookie.path);
              
              if (cookie.path && cookie.path.includes('/start/')) {
                console.log('The cookie path contains "/start/".');
                console.log('Expiration Date ' + cookie.expirationDate);
                currentCookieExpirationDateTimeEpoch = cookie.expirationDate;

              }
            }
          }
  
          if (cookie.firstPartyDomain !== undefined) {
            params.firstPartyDomain = cookie.firstPartyDomain;
          }
  
          promises.push(browser.cookies.set(params));
        }
      }
  
      await Promise.all(promises);
      console.log('Cookies copied to container:', containerName);
    } catch (error) {
      console.error('Error: ' + error);
    }
  },

// Function to add a recent entry to the list in storage
async addRecentLoginEntryToStorage(href, account_name, account_id, role_name, openIn) {
  // Retrieve the current list from storage
  const { recentfivelogins: storedEntries } = await browser.storage.local.get('recentfivelogins');

  // Initialize the list if it doesn't exist yet
  let recentEntries = storedEntries || [];

  // Check if the href already exists in the list
  const existingEntryIndex = recentEntries.findIndex(entry => entry.href === href);

  if (existingEntryIndex !== -1) {
    // If the href already exists, update the order and save the current date and time
    const existingEntry = recentEntries[existingEntryIndex];
    existingEntry.account_name = account_name;
    existingEntry.account_id = account_id;
    existingEntry.role_name = role_name;
    existingEntry.openIn = openIn;
    existingEntry.timestamp = new Date().toISOString().slice(0, 16).replace("T", " "); // Current date and time to the minute

    // Move the existing entry to the top of the list
    recentEntries.splice(existingEntryIndex, 1);
    recentEntries.unshift(existingEntry);
  } else {
    // If the href doesn't exist, add a new entry
    const newEntry = {
      href,
      account_name,
      account_id,
      role_name: role_name,
      openIn,
      timestamp: new Date().toISOString().slice(0, 16).replace("T", " ") // Current date and time to the minute
    };

    // Add the new entry to the beginning of the list
    recentEntries.unshift(newEntry);
  }

  // Keep only the top MAX_RECENT_ENTRIES entries
  const trimmedEntries = recentEntries.slice(0, MAX_RECENT_ENTRIES);

  // Save the updated list back to storage
  await browser.storage.local.set({ recentfivelogins: trimmedEntries });
},

// Open the URL in a specific container in the background
async openUrlInContainer(url, containerName) {
  try {

     // Clean and decode the container name
     const cleanedContainerName = vAPI.cleanAndDecodeContainerName(containerName);
    // Get the container ID
    const containerId = await vAPI.getContainerIdByName(cleanedContainerName);
    
    if (containerId) {
      // Construct the URL with the container ID
      const containerizedUrl = `${url}?container=${containerId}`;
      console.log('URL to open in container (background):', containerizedUrl);
      // Fetch the URL in the background
      //await fetch(containerizedUrl, { method: 'GET' });
      browser.tabs.create({ url: url, cookieStoreId: containerId , active: false});
      
      console.log('URL opened in container (background):', cleanedContainerName);
    } else {
      console.error('Failed to open URL in container (background):', cleanedContainerName);
    }
  } catch (error) {
    console.error('Error:', error);
  }
},

// Function to clean and decode a container name
cleanAndDecodeContainerName(name) {
  // Decode percent-encoded characters (e.g., "%20" to space)
  name = decodeURIComponent(name);

  // Replace special characters (space, parentheses, brackets) with hyphens
  name = name.replace(/[% ()[\]-]+/g, '-');

  // Remove hyphens at the beginning and end of the name
  name = name.replace(/^-+|-+$/g, '');

  return name;
},

async processOpenConsolePageContainers() {
  try {
    // Retrieve recent entries from storage
    const { recentfivelogins: recentEntries = [] } = await browser.storage.local.get('recentfivelogins');

    // Exit early if there are no recent entries
    if (recentEntries.length === 0) {
      console.log('No recent entries found in storage.');
      return;
    }

    console.log('Recent entries:', recentEntries);

    const tabs = await browser.tabs.query({ url: '*://*.console.aws.amazon.com/*' });

    // Extract distinct container IDs from the open tabs
    const distinctContainerIds = new Set(tabs.map(tab => tab.cookieStoreId));

    console.log('Distinct container IDs:', distinctContainerIds);

    // Retrieve container names for the distinct container IDs
    const containerNames = await Promise.all([...distinctContainerIds].map(containerId => vAPI.getContainerNameById(containerId)));

    console.log('Distinct container names:', containerNames);

    // Convert container names to a set for faster lookup
    const containerNameSet = new Set(containerNames);

    // Iterate through recent entries and open URLs in the background for distinct containers
    for (const entry of recentEntries) {
      const { href, account_name, account_id } = entry;
      const containerName = vAPI.cleanAndDecodeContainerName(`${account_id}-${account_name}`);
      console.log('Processing recent entry:', containerName);
      if (containerNameSet.has(containerName)) {
        console.log('Container already open:', containerName);
        await vAPI.openUrlInContainer(href, containerName);
        console.log('Opened URL in container (background):', containerName);
      }
    }
  } catch (error) {
    console.error('Error processing recent entries:', error);
  }
},
  
};

// Listen for messages from the content script
browser.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
    console.log('Message received:', message.action);
    if (message.action === 'copyCookiesAndOpenLink') {
      const containerName = message.containerName || 'DefaultContainer'; // Use a default name if not provided
      const containerColor = getContainerColor(containerName); // Determine the container color
  
      try {
        // Check if the container exists, and if not, create it
        const existingContainers = await browser.contextualIdentities.query({});
        const matchingContainer = existingContainers.find(container => container.name === containerName);
  
        if (!matchingContainer) {
          // Create a new container with the provided name and color
          await browser.contextualIdentities.create({
            name: containerName,
            color: containerColor, // Set the container color
            icon: 'circle', // Choose an icon for the new container
          });
        }
  
        // Get cookies for the specified domain
        const cookies = await browser.cookies.getAll({ domain: 'awsapps.com' });

        const containerId = await vAPI.getContainerIdByName(containerName);

  
        // Copy cookies to the container
        await vAPI.copyCookiesToContainer(cookies, containerName);
        console.log('message.account_id ' +  message.account_id);
        // Add the current link to recent entries in storage
        await vAPI.addRecentLoginEntryToStorage(message.link, message.account_name, message.account_id, message.role_name,message.openIn);
        
        if(message.openIn=='Tab')
        {
            console.log('Opening link in a new tab: ' + message.link + ' in container: ' + containerName + ' with ID: ' + containerId + ' and color: ' + containerColor);
            // Open the link in the container
            browser.tabs.create({ url: message.link, cookieStoreId: containerId });
        }
        else
        {    
            browser.windows.create({ url: message.link, cookieStoreId: containerId,incognito: false, state: 'normal' });
        }

      } catch (error) {
        console.error('Error: ' + error);
      }
    }
    else if (message.action === 'copyCookiesToAllContainers') {
      try {

        console.log('Copying cookies to all containers...message received.');
        // Step 1: Retrieve cookie expiration timestamp from storage
        const result = await browser.storage.local.get('cookieExpirationDateTimeEpoch');
        const cookieExpirationTimestamp = result.cookieExpiration || currentCookieExpirationDateTimeEpoch || 0;
        const currentTimestamp = Math.floor(Date.now() / 1000);
        console.log('Cookie expiration timestamp:', cookieExpirationTimestamp);
        console.log('Current timestamp:', currentTimestamp);
        
        let isExpired = true;
    
        // Step 2: Check if cookies are still valid
        if (cookieExpirationTimestamp > currentTimestamp) {
          console.log('Cookies are still valid');
          isExpired = true;
        } 
    
        // Step 3: If cookies are expired, proceed with copying cookies to all containers
        if (isExpired) {
          // Get cookies for the specified domain
          const cookies = await browser.cookies.getAll({ domain:  'awsapps.com' });
    
          // // Copy cookies to all containers
          // const allContainers = await browser.contextualIdentities.query({});
          // for (const container of allContainers) {
          //   console.log(`Copying cookies to container: ${container.name}`);
          //   await vAPI.copyCookiesToContainer(cookies, container.name);
          // }
          // console.log('Cookies copied to all containers successfully.');

          // vAPI.processOpenConsolePageContainers();

          const allContainers = await browser.contextualIdentities.query({});
          const copyOperations = allContainers.map(container => {
              console.log(`Copying cookies to container: ${container.name}`);
              return vAPI.copyCookiesToContainer(cookies, container.name);
          });

          await Promise.all(copyOperations);
          console.log('Cookies copied to all containers successfully.');

          // Call processOpenConsolePageContainers after all cookies are copied
          vAPI.processOpenConsolePageContainers();
                  

      } 
    }
    catch (error) {
        console.error('Error copying cookies to all containers: ' + error);
      }
    }
    else  if (message.action === 'getCurrentCookieExpirationDateTimeEpoch') {
      // Send currentCookieExpirationDateTimeEpoch to the content script
      sendResponse({ currentCookieExpirationDateTimeEpoch });
    }
    else if (message.action === 'saveCookieExpiration') {
      try {
          browser.storage.local.set({ cookieExpirationDateTimeEpoch: currentCookieExpirationDateTimeEpoch });
      } catch (error) {
        console.error('saveCookieExpiration Error: ' + error);
      }
    }
  });
 // Function to determine the container color based on the container name
function getContainerColor(containerName) {
    const lowerCaseName = containerName.toLowerCase();
    if (lowerCaseName.includes('nonprod') || lowerCaseName.includes('test') || lowerCaseName.includes('dev') || lowerCaseName.includes('beta')) {
      return 'blue';
    } else if (lowerCaseName.includes('prod')) {
      return 'red';
    } else if (lowerCaseName.includes('sandbox')) {
      return 'green';
    } else {
      // Use a default color if none of the keywords are found
      return 'red';
    }
  }