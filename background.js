// Background Script (background.js)
//Idea and code from  [cookie-quick-manager](https://github.com/ysard/cookie-quick-manager/).

// Declare a global variable to store unique links
const links = new Set();

// Adapted vAPI functions
const vAPI = {
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

  // Function to copy cookies to a specified container
  async copyCookiesToContainer(cookies, containerName) {
    try {
      const containerId = await vAPI.getContainerIdByName(containerName);

      let promises = [];
      for (let cookie of cookies) {
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
          }
        }

        if (cookie.firstPartyDomain !== undefined) {
          params.firstPartyDomain = cookie.firstPartyDomain;
        }
        
        promises.push(browser.cookies.set(params));
      }

      await Promise.all(promises);
      console.log('Cookies copied to container:', containerName);
    } catch (error) {
      console.error('Error: ' + error);
    }
  },
};

// Listen for messages from the content script
browser.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
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
        const cookies = await browser.cookies.getAll({ domain: 'foc-sso.awsapps.com' });

        const containerId = await vAPI.getContainerIdByName(containerName);

  
        // Copy cookies to the container
        await vAPI.copyCookiesToContainer(cookies, containerName);
        
        if(message.openIn=='Tab')
        {
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
      return 'your-choice-of-default-color';
    }
  }