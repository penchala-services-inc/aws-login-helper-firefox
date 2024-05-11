// Background Script (background.js)
//Idea and code from  [cookie-quick-manager](https://github.com/ysard/cookie-quick-manager/).
const IsDebug = false;
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
              if (IsDebug) console.log('Path ' +  cookie.path);
              
              if (cookie.path && cookie.path.includes('/start/')) {
                if (IsDebug) console.log('The cookie path contains "/start/".');
                if (IsDebug) console.log('Expiration Date ' + cookie.expirationDate);
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
      if (IsDebug) console.log('Cookies copied to container:', containerName);
    } catch (error) {
      console.error('Error: ' + error);
    }
  },

// Function to add a recent entry to the list in storage
async addRecentLoginEntryToStorage(link, account_name, account_id, role_name, openIn) {
  
  // Split the URL based on "&destination" and take the first part
  const href = link.split('&destination')[0];

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
      if (IsDebug) console.log('URL to open in container (background):', containerizedUrl);
      // Fetch the URL in the background
      //await fetch(containerizedUrl, { method: 'GET' });
      browser.tabs.create({ url: url, cookieStoreId: containerId , active: false});
      
      if (IsDebug) console.log('URL opened in container (background):', cleanedContainerName);
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
      if (IsDebug) console.log('No recent entries found in storage.');
      return;
    }

    if (IsDebug) console.log('Recent entries:', recentEntries);

    const tabs = await browser.tabs.query({ url: '*://*.console.aws.amazon.com/*' });

    // Extract distinct container IDs from the open tabs
    const distinctContainerIds = new Set(tabs.map(tab => tab.cookieStoreId));

    if (IsDebug) console.log('Distinct container IDs:', distinctContainerIds);

    // Retrieve container names for the distinct container IDs
    const containerNames = await Promise.all([...distinctContainerIds].map(containerId => vAPI.getContainerNameById(containerId)));

    if (IsDebug) console.log('Distinct container names:', containerNames);

    // Convert container names to a set for faster lookup
    const containerNameSet = new Set(containerNames);

    // Iterate through recent entries and open URLs in the background for distinct containers
    for (const entry of recentEntries) {
      const { href, account_name, account_id } = entry;
      const containerName = vAPI.cleanAndDecodeContainerName(`${account_id}-${account_name}`);
      if (IsDebug) console.log('Processing recent entry:', containerName);
      if (containerNameSet.has(containerName)) {
        if (IsDebug) console.log('Container already open:', containerName);
        await vAPI.openUrlInContainer(href, containerName);
        if (IsDebug) console.log('Opened URL in container (background):', containerName);
      }
    }
  } catch (error) {
    console.error('Error processing recent entries:', error);
  }
},
  
};

// Listen for messages from the content script
browser.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
    if (IsDebug) console.log('Message received:', message.action);
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
        if (IsDebug) console.log('message.account_id ' +  message.account_id);
        // Add the current link to recent entries in storage
        await vAPI.addRecentLoginEntryToStorage(message.link, message.account_name, message.account_id, message.role_name,message.openIn);
        
        if(message.openIn=='Tab')
        {
            if (IsDebug) console.log('Opening link in a new tab: ' + message.link + ' in container: ' + containerName + ' with ID: ' + containerId + ' and color: ' + containerColor);
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

        if (IsDebug) console.log('Copying cookies to all containers...message received.');
      
        const cookies = await browser.cookies.getAll({ domain:  'awsapps.com' });

        const allContainers = await browser.contextualIdentities.query({});
        const copyOperations = allContainers.map(container => {
            if (IsDebug) console.log(`Copying cookies to container: ${container.name}`);
            return vAPI.copyCookiesToContainer(cookies, container.name);
        });

        await Promise.all(copyOperations);
        if (IsDebug) console.log('Cookies copied to all containers successfully.');

        // Call processOpenConsolePageContainers after all cookies are copied
        vAPI.processOpenConsolePageContainers();

    }
    catch (error) {
        console.error('Error copying cookies to all containers: ' + error);
      }
    }
    else  if (message.action === 'saveConsoleServiceLink') {
      if (IsDebug) console.log('saveConsoleServiceLink...message received.');
      try {
        await saveConsoleServiceLink(message.url);
      } catch (error) {
        console.error('Error saving console service link:', error);
      }
    }

  });

// Function to get the container name of the current tab
async function getContainerName() {
  try {
      const tabs = await browser.tabs.query({ active: true, currentWindow: true });
      const tab = tabs[0];
      if (tab) {
          const tabId = tab.cookieStoreId;
          if (tabId !== "firefox-default") {
              const containers = await browser.contextualIdentities.query({});
              const container = containers.find(c => c.cookieStoreId === tabId);
              if (container) {
                  return container.name;
              } else {
                  return null;
              }
          } else {
              return "Default Container";
          }
      } else {
          return null;
      }
  } catch (error) {
      console.error("Error getting container name:", error);
      return null;
  }
}

// Function to handle AWS console URLs and save recent service links
async function saveConsoleServiceLink(url) {
  if (isAWSConsoleURL(url)) {
      if (IsDebug) console.log('AWS Console URL detected:', url);
      
      // Extract service name from the URL
      const serviceName = extractServiceName(url);
      if (IsDebug) console.log('Service Name:', serviceName);
      
      try {
          // Request container name from background script
          const containerName = await getContainerName();
          if (containerName !== null && containerName !== "") {
              if (IsDebug) console.log('Container Name:', containerName);
              
              // Extract account number from the container name
              const accountId = containerName.split('-')[0];
              
              // Check if account ID is all numeric
              if (!isNaN(accountId)) {
                  if (IsDebug) console.log('Account ID:', accountId);

                  // Save the recent service link
                  await addRecentServiceLinkToStorage(accountId, serviceName, url);
              } else {
                  if (IsDebug) console.log('Skipping saving entry: Account ID is not all numeric');
              }
          } else {
              if (IsDebug) console.log('Skipping saving entry: Container name not found');
          }
      } catch (error) {
          console.error('Error:', error);
      }
  }
}


// Function to extract service name from URL
function extractServiceName(url) {
  const path = new URL(url).pathname;
  const serviceName = path.split('/')[1]; // Get the part after the first slash
  return serviceName;
}

// Function to check if the URL is an AWS console URL
function isAWSConsoleURL(url) {
  return /\.console\.aws\.amazon\.com\//i.test(url);
}
// Function to add recent service link to storage
async function addRecentServiceLinkToStorage(accountId, serviceName, url) {
  try {
      // Get recent service links from storage
      let recentServicesByAccount = await browser.storage.local.get('recentServicesByAccount');
      recentServicesByAccount = recentServicesByAccount.recentServicesByAccount || {}; // Ensure recentServicesByAccount is initialized

      // Get or initialize recent services array for the account
      let recentServicesForAccount = recentServicesByAccount[accountId] || [];
      
      // Filter out duplicate entries
      recentServicesForAccount = recentServicesForAccount.filter(entry => entry.serviceName !== serviceName);

      // Add the new service link to the top
      recentServicesForAccount.unshift({ serviceName, url });

      // Keep only the recent 5 entries
      recentServicesForAccount = recentServicesForAccount.slice(0, 5);

      // Update storage with recent service links for the account
      recentServicesByAccount[accountId] = recentServicesForAccount;
      await browser.storage.local.set({ recentServicesByAccount });
      if (IsDebug) console.log('Successfully added recent service link to storage');
  } catch (error) {
      console.error('Error adding recent service link to storage:', error);
  }
}


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