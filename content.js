// // Content Script (content.js)

// // Declare a global variable to store unique links
const links = new Set();
let invocationCounter = 0;
let addingTabandWindowLinks = false;
const linksInfo = new Set();
const processedLinks = new Set(); // Keep track of processed links
const AWS_CONSOLE_URL = 'console.aws.amazon.com/';
const AWS_APPS_START_URL = '.awsapps.com/start/#/';
const AWS_CONSOLE_DEFAULT_REGION = 'us-east-2';



 // Global variable to store account information
 let accountInfo = { accountAlias: null, accountId: null };
// Set debug flag
// Function to get the debug status from storage
function getDebugStatus() {
  return browser.storage.local.get('enable-debug').then((result) => {
    return result['enable-debug'] || false;
  });
}

// Initialize IsDebug variable
let IsDebug = false;

// Set IsDebug from stored value
getDebugStatus().then((debugStatus) => {
  IsDebug = debugStatus;
  if (IsDebug) console.log('IsDebug:', IsDebug);
});

authenticationComplete = false;
cookiesCopied = false
// Define the JSON mapping for services
const serviceMapping = {
  "bedrock": "bedrock",
  "console": "console-home",
  "states": "step-functions",
  "redshiftv2": "redshift-home",
  "sqlworkbench": "redshift-query-editor",
  // Add more mappings as needed
};

document.addEventListener("DOMContentLoaded", (event) => {
  if (IsDebug) console.log("DOM fully loaded and parsed");
  if (window.location.href.includes(AWS_CONSOLE_URL)) {
    ExtractAccountInfoAndUpdatetitle();
  }
});

window.addEventListener("load", (event) => {
  if (IsDebug) console.log("Page fully loaded");
  browser.runtime.sendMessage({ action: 'SaveConsoleCookieExpiryDateTime' });
  browser.runtime.sendMessage({ action: 'SavePortalCookieExpiryDateTime' });
   
  if (window.location.href.includes(AWS_CONSOLE_URL)) {
    ExtractAccountInfoAndUpdatetitle();
  }
  if(window.location.href.includes(AWS_APPS_START_URL) || window.location.href.includes(AWS_CONSOLE_URL))
    AppendSessionExpiryTime();
});

if (document.readyState === "complete") {
  if (IsDebug) console.log("Document already fully loaded");
} else {
  document.addEventListener("readystatechange", (event) => {
      if (document.readyState === "complete") {
        if (IsDebug) console.log("Document now fully loaded");
          if (window.location.href.includes(AWS_CONSOLE_URL)) {
            ExtractAccountInfoAndUpdatetitle();
          }
      }
  });
}

// Function to get the default region from storage
function getDefaultRegion() {
  return browser.storage.local.get('default-region').then((result) => {
    return result['default-region'] || 'us-east-2';
  });
}



// Function to find the text inside a div within the strong element before a div with specific text using XPath
function getAccountName(text) {
  if (IsDebug) console.log("Searching for strong element before div with text:", text);
  
  // Create an XPath expression to find the strong element before the div with the specific text
  const xpath = `//div[contains(text(), '${text}')]/preceding::strong[1]`;
  if (IsDebug) console.log("XPath expression:", xpath);
  
  // Evaluate the XPath expression
  const result = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
  if (IsDebug) console.log("XPath evaluation result:", result);
  
  // Check if the strong element is found
  if (result.singleNodeValue) {
      if (IsDebug) console.log("Strong element found:", result.singleNodeValue);
      
      // Find the div inside the strong element
      const divInsideStrong = result.singleNodeValue.querySelector('div');
      if (IsDebug) console.log("Div inside strong element:", divInsideStrong);
      
      // Return the inner text of the div or null if not found
      return divInsideStrong ? divInsideStrong.textContent : null;
  }
  if (IsDebug) console.log("Strong element not found");
  return null; // Return null if the strong element is not found
}

async function AppendSessionExpiryTime() {
  if (IsDebug) console.log('AppendSessionExpiryTime function called');

  try {
    const currentUrl = window.location.href;

    if (currentUrl.includes(AWS_CONSOLE_URL)) {
      const targetDiv = document.getElementById('h');
      
      if (targetDiv) {
        let newDiv = targetDiv.querySelector('.expires-div');
        if (!newDiv) {
          newDiv = document.createElement('div');
          newDiv.className = 'expires-div';
          newDiv.style.cssText = "align-items: center; font-size: large; color: red; flex-direction: column; display: flex;";
          targetDiv.appendChild(newDiv);
        }

        if (accountInfo) {
          if (IsDebug) console.log('Account Info:', accountInfo);
          let color = 'red';
          if (/beta|non prod|nonprod|uat/i.test(accountInfo.accountAlias)) {
            color = 'blue';
          } else if (/prod/i.test(accountInfo.accountAlias)) {
            color = 'red';
          } else if (/sandbox|test|dev/i.test(accountInfo.accountAlias)) {
            color = 'green';
          }

          newDiv.style.color = color;
          const requestId = Math.random().toString(36).substr(2, 9);

          browser.runtime.sendMessage({ action: 'getContainerName', requestId: requestId })
            .then(response => {
              
              if (response && response.containerName && response.containerName.startsWith(requestId)) {
                const containerName = response.containerName.replace(requestId + '-', '');

              browser.storage.local.get('ConsoleCookieExpiryDateTime' + containerName).then(result => {
                const expiryDateTime = result['ConsoleCookieExpiryDateTime' + containerName];
                if (IsDebug) console.log('Expiry Date Time:', expiryDateTime);

                if (containerName && expiryDateTime) {
                  
                  const currentTime = Date.now() / 1000;
                  if (expiryDateTime > currentTime) {
                    const diffInMinutes = Math.floor((expiryDateTime - currentTime) / 60);
                    const hours = Math.floor(diffInMinutes / 60);
                    const minutes = diffInMinutes % 60;
                    const formattedTime = `${hours} hour${hours !== 1 ? 's' : ''} ${minutes} min${minutes !== 1 ? 's' : ''}`;
                    if(color == 'red')
                      newDiv.textContent = '** PROD **    ' + containerName + ' | Session expires in ' + formattedTime + '    ** PROD ** ' ;    
                    else  
                      newDiv.textContent = containerName  + ' | Session expires in ' + formattedTime;
                  }
                } 
                else if (containerName) {
                  if(color == 'red')
                    newDiv.textContent = '** PROD **    ' + containerName +'    ** PROD ** ' ;
                  else
                    newDiv.textContent = containerName
                  browser.runtime.sendMessage({ action: 'SaveConsoleCookieExpiryDateTime', requestId: Math.random().toString(36).substr(2, 9) });
                }
                else if (accountInfo) {
                  if(color == 'red')
                    newDiv.textContent = '** PROD **    ' + accountInfo.accountAlias + ' | ' + accountInfo.accountId  +'    ** PROD ** ' ;
                  else
                    newDiv.textContent = accountInfo.accountAlias + ' | ' + accountInfo.accountId 
                  browser.runtime.sendMessage({ action: 'SaveConsoleCookieExpiryDateTime', requestId: Math.random().toString(36).substr(2, 9) });
                }

                if (!document.title.startsWith(accountInfo.accountAlias)) {
                  document.title = accountInfo.accountAlias + ' - ' + document.title;
                }
              }).catch(error => {
                console.error('Error retrieving ConsoleCookieExpiryDateTime:', error);
              });
            } else {
              console.error('Failed to get container name or invalid response');
            }
          });
        }
      } else {
        if (IsDebug) console.error('Target div not found');
      }
    }

    if (currentUrl.includes(AWS_APPS_START_URL)) {
  
      const result = await browser.storage.local.get('IICPortalCookieExpiryDateTime');
      if (IsDebug) console.log(result);
      const expiryDateTime = result.IICPortalCookieExpiryDateTime;
  
      if (expiryDateTime && expiryDateTime > Date.now() / 1000) {
        const diffInMinutes = Math.floor((expiryDateTime - Date.now() / 1000) / 60);
        const hours = Math.floor(diffInMinutes / 60);
        const minutes = diffInMinutes % 60;
        const formattedTime = `${hours} hour${hours !== 1 ? 's' : ''} ${minutes} min${minutes !== 1 ? 's' : ''}`;
  
        const spanElement = Array.from(document.getElementsByTagName('span')).find(span => span.textContent.includes('AWS access portal'));
  
        if (spanElement) {
          let expiryText = spanElement.querySelector('.session-expiry');
          if (!expiryText) {
            expiryText = document.createElement('span');
            expiryText.className = 'session-expiry';
            spanElement.appendChild(expiryText);
          }
  
          expiryText.textContent = ' (session expires in ' + formattedTime + ')';
          document.title = 'AWS IIC SSO-' + formattedTime;
        }
      } else {
        browser.runtime.sendMessage({ action: 'SavePortalCookieExpiryDateTime' });
      }
    }
  } catch (error) {
    console.error('Error retrieving or processing SavePortalCookieExpiryDateTime:', error);
  }
}

if(window.location.href.includes(AWS_APPS_START_URL) || window.location.href.includes(AWS_CONSOLE_URL))
{
  if (window.location.href.includes(AWS_CONSOLE_URL)) {
    ExtractAccountInfoAndUpdatetitle();
  }
  AppendSessionExpiryTime();

  setInterval(AppendSessionExpiryTime, 60000);
}


// Function to create links from recent entries in storage
async function createLinksFromStorageEntries() {
  try {
      // Retrieve recent entries from storage
      const { recentfivelogins: recentEntries = [] } = await browser.storage.local.get('recentfivelogins');
            // Get recent service links from storage
      if (IsDebug) console.log('Recent Entries:')
      if (IsDebug) console.log(recentEntries);

      const { recentServicesByAccount = {} } = await browser.storage.local.get('recentServicesByAccount');

      // Exit early if there are no recent entries
      if (recentEntries.length === 0) {
        if (IsDebug) console.log('No recent entries found in storage.');
        return;
      }

       // Check if the recent logins container already exists in the DOM
       let parentContainer = document.querySelector('.recent-logins-container');
       if (!parentContainer) {
         // Create a parent container for recent logins if it doesn't exist
         parentContainer = document.createElement('div');
         parentContainer.className = 'recent-logins-container';
         
         // Instead of appending, prepend the container to the body
         document.body.prepend(parentContainer);
 
         // Apply CSS styles to center-align the container
         parentContainer.style.display = 'flex';
         parentContainer.style.flexDirection = 'column';
         parentContainer.style.alignItems = 'center'; // Center-align the content
         parentContainer.style.paddingTop = '10px'; // Add padding at the top
         
 
         // Create and append the recent logins text
         const recentLoginsText = document.createElement('div');
         recentLoginsText.textContent = 'Recent Logins & Services:';
         recentLoginsText.style.fontWeight = 'bold'; // Set the text to bold
         recentLoginsText.style.fontSize = '16px'; // Increase font size
         recentLoginsText.style.fontFamily = 'Amazon Ember';
         parentContainer.appendChild(recentLoginsText);
 
         // Create a solid line separator
         const separator = document.createElement('hr');
         separator.style.marginTop = '5px'; // Add some margin at the top
         separator.style.marginBottom = '10px'; // Add some margin at the bottom
         separator.style.width = '100%'; // Set the width to 100%
         separator.style.border = 'none'; // Remove the default border
         separator.style.borderTop = '1px solid black'; // Add a solid line
         
         parentContainer.appendChild(separator);
       } else {
        if (IsDebug) console.log('Recent logins container already exists in the DOM.');
         return;
       }

      // Select the parent element where links will be inserted
      let parentElement = parentContainer.querySelector('.recent-links');
      if (!parentElement) {
        // Create a parent element for the recent links
        parentElement = document.createElement('div');
        parentElement.className = 'recent-links';
        parentContainer.appendChild(parentElement);
      }

      // Iterate through recent entries and create links
      recentEntries.forEach(entry => {
        const { href, account_name: account_name, account_id, role_name: role_name, openIn } = entry;

       // Create a new span element
        const newText = document.createElement('span');
        newText.className = 'awsui_link_4c84z_7y59r_99 awsui_variant-secondary_4c84z_7y59r_168 awsui_font-size-body-m_4c84z_7y59r_432';
        newText.style.fontSize = '14px'; // Increase font size
        newText.style.marginBottom = '10px'; // Add some margin at the bottom
        newText.style.padding = '10px';
        newText.style.fontFamily = 'Amazon Ember';

        // Set the text content with the desired information
        newText.textContent =  account_id + ' | ' + account_name + ' | ' + role_name + ' - Container (' + openIn + ') : ';

        // Insert the new link element before the parent element
        parentElement.appendChild(newText);
        
        if (IsDebug) console.log("Recent Services By Account:", recentServicesByAccount);
        if (IsDebug) console.log(`Created link for ${account_name} (${account_id})`);
        if (IsDebug) console.log("account_id:", account_id);
        const recentServices = recentServicesByAccount[account_id];
        if (IsDebug) console.log('recentServices');
        if (IsDebug) console.log(recentServices);
  
        if (Array.isArray(recentServices) && recentServices.length > 0) {
          // Iterate over the recent services for the current account ID
          recentServices.forEach(entry => {
            if (IsDebug) console.log("Service Name:", entry.serviceName);
            if (IsDebug) console.log("URL:", entry.url);
            // Create a new link element for each entry
            const serviceLink = document.createElement('a');
            serviceLink.className = 'awsui_link_4c84z_7y59r_99 awsui_variant-secondary_4c84z_7y59r_168 awsui_font-size-body-m_4c84z_7y59r_432';
            serviceLink.rel = 'noopener noreferrer';
            serviceLink.target = '_self'; // Open in the same tab
            serviceLink.href = new URL(href, window.location.href.split('#')[0]).toString()+ '&destination=' + entry.url;
            
            if (IsDebug) console.log('createLinksFromStorageEntries - Absolute link href:', serviceLink.href);
            serviceLink.title = serviceMapping[entry.serviceName] || entry.serviceName; // Use account name as title
        
            // Set the link text with a pipe separator
            serviceLink.textContent = serviceLink.title;
            serviceLink.style.fontSize = '14px'; // Increase font size
            serviceLink.style.marginBottom = '10px'; // Add some margin at the bottom
            serviceLink.style.padding = '10px';
            serviceLink.style.fontFamily = 'Amazon Ember';
            
            // Add click event listener to handle link click
            serviceLink.addEventListener('click', (event) => {
              event.preventDefault();
              const containerName = account_id + ' | ' + cleanAndDecodeContainerName(account_name)+ ' | ' + role_name;
              browser.runtime.sendMessage({
                action: 'copyCookiesAndOpenLink',
                link: serviceLink.href,
                containerName,
                openIn: openIn,
                title: serviceLink.title,
                role_name: role_name,
                account_id: account_id,
                account_name: account_name
              });
            });
        
            // Insert the new link element before the parent element
            parentElement.appendChild(serviceLink);
          });
        } else {
          if (IsDebug) console.log("No recent services found for account ID", account_id);
        }
        
        
        // add links next to the newLink  on the same rowfor each service
        
        // Add a line break after each link
        parentElement.appendChild(document.createElement('br'));
        parentElement.appendChild(document.createElement('br'));

        
      });

  // Add a line break after the tip container
  parentContainer.appendChild(document.createElement('br'));
  parentContainer.appendChild(document.createElement('br'));
  parentContainer.appendChild(document.createElement('br'));
    // Add the parentContainer as a child of the specified class
   // Add the parentContainer as a child of the specified ID
    let targetDiv = document.getElementById('awsui-tabs-43-1710532311807-680-accounts-panel');
    if (targetDiv) {
        targetDiv.appendChild(parentContainer);
    }
    else if (!targetDiv) {
        targetDiv = document.getElementById('awsui_tabs-tab-label_14rmt_1ojt0_257');
        if (targetDiv) {
            targetDiv.appendChild(parentContainer);
        } else {
            console.warn('Target div not found.');
        }
      }
    else {
        console.warn('Target div not found.');
    }


  } catch (error) {
    console.error('Error creating links from recent entries:', error);
  }
}

// Function to find the closest button[data-testid="account-list-cell"] before the given element
function findClosestButtonBefore(element) {
  let currentElement = element;
  while (currentElement) {
      const button = currentElement.previousElementSibling;
      if (button && button.matches('button[data-testid="account-list-cell"]')) {
          return button;
      }
      currentElement = currentElement.parentElement;
  }
  return null;
}

// Function to extract the account name from the closest button before the given element
function extractAccountNameFromClosestButton(element) {
  const button = findClosestButtonBefore(element);
  if (IsDebug) console.log("Closest button found:", button);

  if (button) {
      const strongElement = button.querySelector('strong div');
      if (IsDebug) console.log("Strong element found:", strongElement);

      if (strongElement) {
          const accountName = strongElement.textContent.trim();
          if (IsDebug) console.log("Account name extracted:", accountName);
          return accountName;
      } else {
          if (IsDebug) console.log("Strong element not found");
      }
  } else {
      if (IsDebug) console.log("Button not found");
  }
  return null;
}

function extractLoginLinks_And_Add_Tab_And_Window_Urls() {
  addingTabandWindowLinks = true;
  const elementsWithClass = document.querySelectorAll('a[href^="#/console?account_id="][href*="&role_name="]');
  if (IsDebug) console.log('Elements with matching href pattern:', elementsWithClass);

  for (const element of elementsWithClass) {
    const href = element.getAttribute('href');
    console.log('Link href:', href);

    // Check if href is valid and not already processed
    if (href && !processedLinks.has(href)) {
      processedLinks.add(href); // Add href to processed links

      // Extract account_id, account_name, and role_name from href and parent element
      const { account_id, role_name } = extractAccountIdAndRoleName(href);

      if (!account_id || !role_name) {
        console.error('Failed to extract account_id or role_name from href:', href);
        alert("AWS Login Helper\n\nError: Couldn't determine account_id or role_name, extension may not function. \n\nPlease open an issue at: https://github.com/penchala-services-inc/aws-login-helper-firefox/issues");
        continue;
      }

      // Extract the account name using the provided logic
      const account_name = extractAccountNameFromClosestButton(element);

      if (!account_name) {
        console.error('Failed to extract account name from DOM');
        alert("AWS Login Helper\n\nError: Couldn't determine account name, extension may not function. \n\nPlease open an issue at: https://github.com/penchala-services-inc/aws-login-helper-firefox/issues");
        continue;
      }

      if (IsDebug) {
        console.log('Extracted info:', { account_id, role_name, account_name });
      }

      // Add the extracted information to linksInfo set
      linksInfo.add({ href, account_id, account_name, role_name });

      // Create a unique class based on account_id, role_name, and account_name
      const uniqueClass = `link-${account_id}-${role_name}-${account_name}-Tab`;

      // Check if a link with the unique class already exists
      if (document.getElementsByClassName(uniqueClass).length > 0) {
        if (IsDebug) console.log('Link with unique class already exists:', uniqueClass);
        continue; // Skip adding duplicate link
      }

      // Get the default region from storage
      browser.storage.local.get('default-region').then((result) => {
        const defaultRegion = result['default-region'] || 'us-east-2';
        let account_role_url = new URL(href, window.location.href.split('#')[0]).toString();
        if (IsDebug) console.log('account_role_url:', account_role_url);

        if (defaultRegion !== AWS_CONSOLE_DEFAULT_REGION) {
          const console_url = `https://${defaultRegion}.console.aws.amazon.com/console/home?region=${defaultRegion}#`;
          if (IsDebug) console.log('AWS Console URL:', console_url);

          const urlObj = new URL(account_role_url);
          if (!urlObj.searchParams.has('destination')) {
            account_role_url = `${account_role_url}&destination=${console_url}`;
          }

          if (IsDebug) console.log('Stored region:', defaultRegion);
          if (IsDebug) console.log('Console URL with region:', account_role_url);
        }

        // Create and append a new link element for tab
        const newLinkTab = document.createElement('a');
        newLinkTab.className = uniqueClass;
        newLinkTab.rel = 'noopener noreferrer';
        newLinkTab.target = '_self'; // Open in the same tab
        newLinkTab.href = account_role_url;
        newLinkTab.title = `${role_name}-Container(Tab)`;
        newLinkTab.textContent = `| ${role_name}-Container (Tab)`;
        if (IsDebug) console.log('New link text:', newLinkTab.textContent);

        newLinkTab.addEventListener('click', (event) => {
          event.preventDefault();
          const containerName = `${account_id} | ${cleanAndDecodeContainerName(account_name)} | ${role_name}`;
          browser.runtime.sendMessage({
            action: 'copyCookiesAndOpenLink',
            link: account_role_url,
            containerName,
            openIn: 'Tab',
            title: role_name,
            role_name,
            account_id,
            account_name
          });
        });

        element.insertAdjacentElement('afterend', newLinkTab);

        // Create a unique class based on account_id, role_name, and account_name for window
        const uniqueClassWindow = `link-${account_id}-${role_name}-${account_name}-Window`;

        // Check if a link with the unique class already exists
        if (document.getElementsByClassName(uniqueClassWindow).length > 0) {
          if (IsDebug) console.log('Link with unique class already exists:', uniqueClassWindow);
          return; // Skip adding duplicate link
        }

        // Create and append a new link element for window
        const newLinkWindow = document.createElement('a');
        newLinkWindow.className = uniqueClassWindow;
        newLinkWindow.rel = 'noopener noreferrer';
        newLinkWindow.target = '_self'; // Open in the same tab
        newLinkWindow.href = account_role_url;
        newLinkWindow.title = `${role_name}-Container(Window)`;
        newLinkWindow.textContent = `| ${role_name}-Container (Window)`;
        if (IsDebug) console.log('New link text:', newLinkWindow.textContent);

        newLinkWindow.addEventListener('click', (event) => {
          event.preventDefault();
          const containerName = `${account_id} | ${cleanAndDecodeContainerName(account_name)} | ${role_name}`;
          browser.runtime.sendMessage({
            action: 'copyCookiesAndOpenLink',
            link: account_role_url,
            containerName,
            openIn: 'Window',
            title: role_name,
            role_name,
            account_id,
            account_name
          });
        });

        newLinkTab.insertAdjacentElement('afterend', newLinkWindow);
      });
    }
  }

  if (IsDebug) console.log('Extracted links information:', linksInfo);
  addingTabandWindowLinks = false;
}
// function extractLoginLinks_And_Add_Tab_And_Window_Urls() {
//   addingTabandWindowLinks = true;
//   const elementsWithClass = document.querySelectorAll('a[href^="#/console?account_id="][href*="&role_name="]');
//   if (IsDebug) console.log('Elements with matching href pattern:', elementsWithClass);


//   for (const element of elementsWithClass) {
//     const href = element.getAttribute('href');
//     console.log('Link href:', href);
    

//     // Check if href is valid and not already processed
//     if (href && !processedLinks.has(href)) {
//       processedLinks.add(href); // Add href to processed links

//       // Extract account_id, account_name, and role_name from href and parent element
//       const { account_id, role_name } = extractAccountIdAndRoleName(href);

//       if (!account_id || !role_name) {
//         console.error('Failed to extract account_id or role_name from href:', href);
//         // Create an alert box
//         alert("AWS Login Helper\n\nError: Couldn't determine account_id or role_name, extension may not function. \n\nPlease open an issue at: https://github.com/penchala-services-inc/aws-login-helper-firefox/issues");

//         continue;
//       }

//         // Extract the account name using the provided logic
//         const account_name = extractAccountNameFromClosestButton(element);

//       if (!account_name) {
//         console.error('Failed to extract account name from DOM');
//         // Create an alert box
//         alert("AWS Login Helper\n\nError: Couldn't determine account name, extension may not function. \n\nPlease open an issue at: https://github.com/penchala-services-inc/aws-login-helper-firefox/issues");

//         continue;
//       }


//       if (IsDebug) {
//         if (IsDebug) console.log('Extracted info:');
//         if (IsDebug) console.log('Account ID:', account_id);
//         if (IsDebug) console.log('Role Name:', role_name);
//         if (IsDebug) console.log('Account Name:', account_name);
//       }
//       // Add the extracted information to linksInfo set
//       linksInfo.add({ href, account_id, account_name, role_name });

//       // Create a unique class based on account_id, role_name, and account_name
//       const uniqueClass = `link-${account_id}-${role_name}-${account_name}-Tab`;

//       // Check if a link with the unique class already exists
//       if (document.getElementsByClassName(uniqueClass).length > 0) {
//         if (IsDebug) console.log('Link with unique class already exists:', uniqueClass);
//         continue; // Skip adding duplicate link
//       }

//        // Get the default region from storage
//        browser.storage.local.get('default-region').then((result) => {
//         const defaultRegion = result['default-region'] || 'us-east-2';
//         let account_role_url = new URL(href, window.location.href.split('#')[0]).toString();
//         console.log('account_role_url:', account_role_url);

//         if (defaultRegion !== AWS_CONSOLE_DEFAULT_REGION) {
//           const console_url = `https://${defaultRegion}.console.aws.amazon.com/console/home?region=${defaultRegion}#`;
//           console.log('AWS Console URL:', console_url);

//           const urlObj = new URL(account_role_url);
//           if (!urlObj.searchParams.has('destination')) {
//             account_role_url = `${account_role_url}&destination=${console_url}`;
//           }

//           console.log('Stored region:', defaultRegion);
//           console.log('Console URL with region:', account_role_url);
//         }
//       },

//       // Create and append a new link element
//       const newLinkTab = document.createElement('a');
//       newLinkTab.className = `${uniqueClass}`;
//       newLinkTab.rel = 'noopener noreferrer';
//       newLinkTab.target = '_self'; // Open in the same tab
//       newLinkTab.href = account_role_url;
//       newLinkTab.title = `${role_name}-Container(Tab)`;

//       // Set the link text with a pipe separator
//       newLinkTab.textContent = `| ${role_name}-Container (Tab)`;
//       if (IsDebug) console.log('New link text:', newLinkTab.textContent);

//       newLinkTab.addEventListener('click', (event) => {
//         event.preventDefault();
//         const containerName = account_id + ' | ' + cleanAndDecodeContainerName(account_name)+ ' | ' + role_name ;
//         browser.runtime.sendMessage({ 
//           action: 'copyCookiesAndOpenLink', 
//           link: account_role_url,
//           containerName, 
//           openIn: 'Tab',
//           title: role_name,
//           role_name: role_name,
//           account_id: account_id,
//           account_name: account_name
//         });
//       });

//       // Insert the new link element after the original link
//       element.insertAdjacentElement('afterend', newLinkTab);

//       // Create a unique class based on account_id, role_name, and account_name
//       const uniqueClassWindow = `link-${account_id}-${role_name}-${account_name}-Window`;

//       // Check if a link with the unique class already exists
//       if (document.getElementsByClassName(uniqueClassWindow).length > 0) {
//         if (IsDebug) console.log('Link with unique class already exists:', uniqueClassWindow);
//         continue; // Skip adding duplicate link
//       }

//       // Create and append a new link element
//       const newLinkWindow = document.createElement('a');
//       newLinkWindow.className = `${uniqueClassWindow}`;
//       newLinkWindow.rel = 'noopener noreferrer';
//       newLinkWindow.target = '_self'; // Open in the same tab
//       newLinkWindow.href = account_role_url;
//       newLinkWindow.title = `${role_name}-Container(Window)`;

//       // Set the link text with a pipe separator
//       newLinkWindow.textContent = `| ${role_name}-Container (Window)`;
//       if (IsDebug) console.log('New link text:', newLinkWindow.textContent);

//       newLinkWindow.addEventListener('click', (event) => {
//         event.preventDefault();
//         const containerName = account_id + ' | ' + cleanAndDecodeContainerName(account_name)+ ' | ' + role_name ;
//         browser.runtime.sendMessage({ 
//           action: 'copyCookiesAndOpenLink', 
//           link: account_role_url,
//           containerName, 
//           openIn: 'Window',
//           title: role_name,
//           role_name: role_name,
//           account_id: account_id,
//           account_name: account_name
//         });
//       });

//       // Insert the new link element after the original link
//       newLinkTab.insertAdjacentElement('afterend', newLinkWindow);

//       // You can perform additional actions here, such as creating new link elements, etc.
//     }
//   }

//   // Perform further processing with the extracted linksInfo set as needed

//   if (IsDebug) console.log('Extracted links information:', linksInfo);

//   addingTabandWindowLinks = false;
// }


// Function to extract account_id and role_name from href
function extractAccountIdAndRoleName(href) {
  const urlSearchParams = new URLSearchParams(href.split('?')[1]);
  const account_id = urlSearchParams.get('account_id');
  const role_name = urlSearchParams.get('role_name');

  return { account_id, role_name };
}

// async function removeCookieExpiryDateTime() {
//   try {
//     await browser.storage.local.remove('CookieExpiryDateTime');
//     console.log('CookieExpiryDateTime has been removed from storage.');
//   } catch (error) {
//     console.error('Error removing CookieExpiryDateTime from storage:', error);
//   }
// }

// Function to clean and decode a container name
function cleanAndDecodeContainerName(name) {
    // Decode percent-encoded characters (e.g., "%20" to space)
    name = decodeURIComponent(name);
  
    // Replace special characters (space, parentheses, brackets) with hyphens
    name = name.replace(/[% ()[\]-]+/g, '-');
  
    // Remove hyphens at the beginning and end of the name
    name = name.replace(/^-+|-+$/g, '');
  
    return name;
  }
  // Callback function for the MutationObserver
  function handleMutations(mutationsList, observer) {
    if (IsDebug) console.log(' handleMutations url '  + window.location.href);
    if (IsDebug) console.log('Mutation observed:', mutationsList.length);
    if (IsDebug) console.log('mutationsList : ');
    if (IsDebug) console.log(mutationsList);

    //we want to wait until the authentication is done before copying cookies
    if(window.location.href.includes('.awsapps.com/start/#/workflowResultHandle'))
    {
      //removeCookieExpiryDateTime();

      authenticationComplete = true;
      if (IsDebug) console.log('authenticationComplete set to true.');

    }
    if(window.location.href.includes(AWS_APPS_START_URL) && !window.location.href.includes('.awsapps.com/start/#/workflowResultHandle') && authenticationComplete && cookiesCopied == false){
      
      
      browser.runtime.sendMessage({ action: 'copyCookiesToAllContainers' });
      AppendSessionExpiryTime();
      console.log('copyCookiesToAllContainers message sent.');
     
      if (IsDebug) console.log('copyCookiesToAllContainers message sent.');
      
      cookiesCopied = true;
    }

    for (const mutation of mutationsList) {
      if (IsDebug) console.log('mutation.target.classList : ' + mutation.target.classList);
      if (mutation.target.classList.contains('ggXus_2CiDezyLYZFJdc') || mutation.target.classList.contains('Lg4DhdV0kd6Nqg0kTBPs')) {
        if (IsDebug) console.log('Account Role mutation observed.');
        if (IsDebug) console.log(' handleMutations Account Role mutation url '  + window.location.href);
        if (addingTabandWindowLinks === false)
          extractLoginLinks_And_Add_Tab_And_Window_Urls();
        if (IsDebug) console.log('Links:', links.size);
      } else if (mutationsList.length == 1 && mutation.target.classList.contains('UQDbz64f0aRBYmzupdOU')) {
        if (IsDebug) console.log('Account Collapse mutation observed.');
        if (IsDebug) console.log('mutationsList : ');
        if (IsDebug) console.log(mutation.target.classList);
          processedLinks.clear();
          extractLoginLinks_And_Add_Tab_And_Window_Urls();
      }
    }
  }

// Check if the current URL contains ".awsapps.com/start#/"
if (window.location.href.includes(AWS_APPS_START_URL) && !window.location.href.includes('.awsapps.com/start/#/saml/custom/')
&& !window.location.href.includes('.awsapps.com/start/#/console')) {
  document.title = 'AWS IIC SSO';

    // Options for the MutationObserver
    const observerOptions = { childList: true, subtree: true };
  
    // Create a MutationObserver with the callback function
    const observer = new MutationObserver(handleMutations);
  
    // Start observing the entire document
    observer.observe(document, observerOptions);

    createLinksFromStorageEntries();
    
  }

// Function to check if the URL is an AWS console URL
function isAWSConsoleURL(url) {
  return /\.console\.aws\.amazon\.com\//i.test(url);
}

if (isAWSConsoleURL(window.location.href)&& !window.location.href.includes('.awsapps.com/start/#/console')) {
  if (IsDebug) console.log('AWS Console URL detected:', window.location.href);
    browser.runtime.sendMessage({ 
      action: 'saveConsoleServiceLink', 
      url: window.location.href 
    });

  }


// Function to extract accountAlias and accountId from the meta tag
function ExtractAccountInfoAndUpdatetitle() {
 

  if(accountInfo && accountInfo.accountAlias)
    {
      if(!document.title.startsWith(accountInfo.accountAlias))
        {
          document.title = accountInfo.accountAlias + ' - ' + document.title;
        }
      return;
    }
    // Find the meta tag with the name "awsc-session-data"
    const metaTag = document.querySelector('meta[name="awsc-session-data"]');
    if (IsDebug) console.log("Meta tag found:", metaTag);

    if (metaTag) {
        // Parse the content attribute as JSON
        const sessionData = JSON.parse(metaTag.getAttribute('content').replace(/&quot;/g, '"'));
        if (IsDebug) console.log("Parsed session data:", sessionData);

        // Extract accountAlias and accountId
        accountInfo.accountAlias = sessionData.accountAlias;
        accountInfo.accountId = sessionData.accountId;

        if (IsDebug) console.log("Account Alias:", accountInfo.accountAlias);
        if (IsDebug) console.log("Account ID:", accountInfo.accountId);

        if(!document.title.startsWith(accountInfo.accountAlias))
          {
            document.title = accountInfo.accountAlias + ' - ' + document.title;
          }

    } else {
        if (IsDebug) console.log("Meta tag not found");      
    }
}

