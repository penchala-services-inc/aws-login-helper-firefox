// // Content Script (content.js)

// // Declare a global variable to store unique links
const links = new Set();
let invocationCounter = 0;
let addingTabandWindowLinks = false;
const linksInfo = new Set();
const processedLinks = new Set(); // Keep track of processed links
// Set debug flag
const IsDebug = true;
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
  console.log("DOM fully loaded and parsed");
});

window.addEventListener("load", (event) => {
  console.log("Page fully loaded");
  browser.runtime.sendMessage({ action: 'SaveCookieExpiryDateTime' });
  AppendSessionExpiryTime();
});

if (document.readyState === "complete") {
  console.log("Document already fully loaded");
} else {
  document.addEventListener("readystatechange", (event) => {
      if (document.readyState === "complete") {
          console.log("Document now fully loaded");
      }
  });
}

async function AppendSessionExpiryTime() {
  if (IsDebug) console.log('AppendSessionExpiryTime function called');
  try {
    // Retrieve the CookieExpiryDateTime from storage
    const result = await browser.storage.local.get('CookieExpiryDateTime');
    const expiryDateTime = result.CookieExpiryDateTime;

    if (expiryDateTime) {
      const currentTime = Date.now() / 1000; // Current time in seconds
      if (expiryDateTime > currentTime) {
        // Calculate the difference in minutes
        const diffInMinutes = Math.floor((expiryDateTime - currentTime) / 60);

        // Convert minutes to hours and minutes
        const hours = Math.floor(diffInMinutes / 60);
        const minutes = diffInMinutes % 60;
        const formattedTime = `${hours} hour${hours !== 1 ? 's' : ''} ${minutes} min${minutes !== 1 ? 's' : ''}`;

        // Check the current URL
        const currentUrl = window.location.href;

        if (currentUrl.includes('console.aws.amazon.com/')) {
          // Find the div with id "h"
          const targetDiv = document.getElementById('h');
          
          if (targetDiv) {
            // Check if the new div already exists
            let newDiv = targetDiv.querySelector('.expires-div');
            if (!newDiv) {
              // Create the new div if it doesn't exist
              newDiv = document.createElement('div');
              newDiv.className = 'expires-div';
              newDiv.style.cssText = "align-items: center; font-size: large; color: red; flex-direction: column; display: flex;";
              targetDiv.appendChild(newDiv);
            }
            // Update the text content of the new div
            newDiv.textContent = `Session expires in ${formattedTime}`;
          } else {
            console.error('Target div not found');
          }
        }

        if (currentUrl.includes('awsapps.com/start/#/')) {
          // Find the specified span element
          const spanElement = document.querySelector('.awsui_heading-text_2qdw9_zri8m_397.awsui_heading-text_105ke_268sp_5.awsui_heading-text-variant-h1_2qdw9_zri8m_400#heading\\:r1g\\:');

          if (spanElement) {
            // Check if the session expiry span already exists
            let expiryText = spanElement.querySelector('.session-expiry');
            if (!expiryText) {
              // Create a new span element if it doesn't exist
              expiryText = document.createElement('span');
              expiryText.className = 'session-expiry';
              spanElement.appendChild(expiryText);
            }

            // Update the text content of the session expiry span
            expiryText.textContent = ` (session expires in ${formattedTime})`;

            document.title = 'AWS IIC SSO-' + formattedTime;
          }
        }
      }
    }
  } catch (error) {
    console.error('Error retrieving or processing CookieExpiryDateTime:', error);
  }
}

if(window.location.href.includes('.awsapps.com/start/#/') || window.location.href.includes('console.aws.amazon.com'))
{
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
        newText.textContent = account_name + ' ' + account_id + ' ' + role_name + '-Container(' + openIn + ') - ';

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
              const containerName = account_id + '-' + cleanAndDecodeContainerName(account_name);
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

    // // Add a bordered rectangle with a tip message
      const privacyContainer = document.createElement('div');
      privacyContainer.style.border = '1px solid orange'; // Thin orange border
      privacyContainer.style.padding = '5px';
      privacyContainer.style.marginTop = '5px'; // Add margin at the top
      privacyContainer.style.fontSize = '14px'; // Increase font size
      privacyContainer.style.fontFamily = 'Amazon Ember';

      privacyContainer.textContent = 'Privacy Notice: By using this addon/extension (AWS Login Helper), you agree to its function of copying cookies from the awsapps.com domain to different containers in your browser. Rest assured, your information remains secure and is not leaked or copied elsewhere.';
      
      //parentContainer.appendChild(privacyContainer);

      const tipContainer = document.createElement('div');
    //Add a line break after the tip container
    parentContainer.appendChild(document.createElement('br'));
    parentContainer.appendChild(document.createElement('br'));
    parentContainer.appendChild(document.createElement('br'));
    parentContainer.appendChild(document.createElement('br'));

    tipContainer.style.border = '1px solid orange'; // Thin orange border
    tipContainer.style.padding = '5px';
    tipContainer.style.marginTop = '5px'; // Add margin at the top
    tipContainer.style.fontSize = '14px'; // Increase font size
    tipContainer.style.fontFamily = 'Amazon Ember';

    tipContainer.textContent = 'Tip: When your console pages expire (console.aws.amazon.com), come to this IIC page, re-login by refreshing/reloading, and go back to the console page. '
    +'\n\r'+ 'Then, hit the reload button to continue what you are doing without reopening everything again.';
    
    //parentContainer.appendChild(tipContainer);

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

function extractLoginLinks_And_Add_Tab_And_Window_Urls() {
  addingTabandWindowLinks = true;
  const elementsWithClass = document.querySelectorAll('a[href^="#/console?account_id="][href*="&role_name="]');
  if (IsDebug) console.log('Elements with matching href pattern:', elementsWithClass);


  for (const element of elementsWithClass) {
    const href = element.getAttribute('href');
    if (IsDebug) console.log('Link href:', href);

    // Check if href is valid and not already processed
    if (href && !processedLinks.has(href)) {
      processedLinks.add(href); // Add href to processed links

      // Extract account_id, account_name, and role_name from href and parent element
      const { account_id, role_name } = extractAccountIdAndRoleName(href);
      
      // Find the parent div element containing the account name
      const account_nameContainer = element.closest('.stw1bkrahhh9wPMNiZKU');
      
      // Find the <strong> element with the appropriate class within the parent container
      const account_name_element = account_nameContainer.querySelector('strong');

      // Extract account name from the found element
      const account_name = account_name_element ? account_name_element.textContent.trim() : '';

      

      if (!account_id || !role_name) {
        console.error('Failed to extract account_id or role_name from href:', href);
        // Create an alert box
        alert("AWS Login Helper\n\nError: Couldn't determine account_id or role_name, extension may not function. \n\nPlease open an issue at: https://github.com/penchala-services-inc/aws-login-helper-firefox/issues");

        continue;
      }

      if (IsDebug) {
        if (IsDebug) console.log('Extracted info:');
        if (IsDebug) console.log('Account ID:', account_id);
        if (IsDebug) console.log('Role Name:', role_name);
      }

      if (!account_name) {
        console.error('Failed to extract account name from DOM');
        // Create an alert box
        alert("AWS Login Helper\n\nError: Couldn't determine account name, extension may not function. \n\nPlease open an issue at: https://github.com/penchala-services-inc/aws-login-helper-firefox/issues");

        continue;
      }

      if (IsDebug) {
        console.log('Account Name:', account_name);
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

      // Create and append a new link element
      const newLinkTab = document.createElement('a');
      newLinkTab.className = `${uniqueClass}`;
      newLinkTab.rel = 'noopener noreferrer';
      newLinkTab.target = '_self'; // Open in the same tab
      newLinkTab.href = new URL(href, window.location.href.split('#')[0]).toString();
      newLinkTab.title = `${role_name}-Container(Tab)`;

      // Set the link text with a pipe separator
      newLinkTab.textContent = `| ${role_name}-Container (Tab)`;
      if (IsDebug) console.log('New link text:', newLinkTab.textContent);

      newLinkTab.addEventListener('click', (event) => {
        event.preventDefault();
        const containerName = account_id + '-' + cleanAndDecodeContainerName(account_name);
        browser.runtime.sendMessage({ 
          action: 'copyCookiesAndOpenLink', 
          link: newLinkTab.href, 
          containerName, 
          openIn: 'Tab',
          title: role_name,
          role_name: role_name,
          account_id: account_id,
          account_name: account_name
        });
      });

      // Insert the new link element after the original link
      element.insertAdjacentElement('afterend', newLinkTab);

      // Create a unique class based on account_id, role_name, and account_name
      const uniqueClassWindow = `link-${account_id}-${role_name}-${account_name}-Window`;

      // Check if a link with the unique class already exists
      if (document.getElementsByClassName(uniqueClassWindow).length > 0) {
        if (IsDebug) console.log('Link with unique class already exists:', uniqueClassWindow);
        continue; // Skip adding duplicate link
      }

      // Create and append a new link element
      const newLinkWindow = document.createElement('a');
      newLinkWindow.className = `${uniqueClassWindow}`;
      newLinkWindow.rel = 'noopener noreferrer';
      newLinkWindow.target = '_self'; // Open in the same tab
      newLinkWindow.href = new URL(href, window.location.href.split('#')[0]).toString();
      newLinkWindow.title = `${role_name}-Container(Window)`;

      // Set the link text with a pipe separator
      newLinkWindow.textContent = `| ${role_name}-Container (Window)`;
      if (IsDebug) console.log('New link text:', newLinkWindow.textContent);

      newLinkWindow.addEventListener('click', (event) => {
        event.preventDefault();
        const containerName = account_id + '-' + cleanAndDecodeContainerName(account_name);
        browser.runtime.sendMessage({ 
          action: 'copyCookiesAndOpenLink', 
          link: newLinkWindow.href, 
          containerName, 
          openIn: 'Window',
          title: role_name,
          role_name: role_name,
          account_id: account_id,
          account_name: account_name
        });
      });

      // Insert the new link element after the original link
      newLinkTab.insertAdjacentElement('afterend', newLinkWindow);

      // You can perform additional actions here, such as creating new link elements, etc.
    }
  }

  // Perform further processing with the extracted linksInfo set as needed

  if (IsDebug) console.log('Extracted links information:', linksInfo);

  addingTabandWindowLinks = false;
}


// Function to extract account_id and role_name from href
function extractAccountIdAndRoleName(href) {
  const urlSearchParams = new URLSearchParams(href.split('?')[1]);
  const account_id = urlSearchParams.get('account_id');
  const role_name = urlSearchParams.get('role_name');

  return { account_id, role_name };
}

async function removeCookieExpiryDateTime() {
  try {
    await browser.storage.local.remove('CookieExpiryDateTime');
    console.log('CookieExpiryDateTime has been removed from storage.');
  } catch (error) {
    console.error('Error removing CookieExpiryDateTime from storage:', error);
  }
}

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
      removeCookieExpiryDateTime();

      authenticationComplete = true;
      console.log('authenticationComplete set to true.');

    }
    if(window.location.href.includes('.awsapps.com/start/#/') && !window.location.href.includes('.awsapps.com/start/#/workflowResultHandle') && authenticationComplete && cookiesCopied == false){
      
      
      browser.runtime.sendMessage({ action: 'copyCookiesToAllContainers' });
      AppendSessionExpiryTime();
      console.log('copyCookiesToAllContainers message sent.');
     
      if (IsDebug) console.log('copyCookiesToAllContainers message sent.');
      
      cookiesCopied = true;
    }

    for (const mutation of mutationsList) {
      if (IsDebug) console.log('mutation.target.classList : ' + mutation.target.classList);
      if (mutation.target.classList.contains('ZA2Ih29gQPWWy47dDhuE')) {
        if (IsDebug) console.log('Account Role mutation observed.');
        if (IsDebug) console.log(' handleMutations Account Role mutation url '  + window.location.href);
        if (addingTabandWindowLinks === false)
          extractLoginLinks_And_Add_Tab_And_Window_Urls();
        if (IsDebug) console.log('Links:', links.size);
      } else if (mutationsList.length == 1 && mutation.target.classList.contains('stw1bkrahhh9wPMNiZKU')) {
        if (IsDebug) console.log('Account Collapse mutation observed.');
        if (IsDebug) console.log('mutationsList : ');
        if (IsDebug) console.log(mutation.target.classList);
          processedLinks.clear();
          extractLoginLinks_And_Add_Tab_And_Window_Urls();
      }
    }
  }

// Check if the current URL contains ".awsapps.com/start#/"
if (window.location.href.includes('.awsapps.com/start/#/') && !window.location.href.includes('.awsapps.com/start/#/saml/custom/')
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

 // Function to update the title and log
 function updateTitleAndAddaccount_nameToLoginInfoOnConsolePages() {
  if (IsDebug) console.log('updateTitleAndAddaccount_nameToLoginInfoOnConsolePages function called');
  // Use the 'data-testid' attribute to select the DOM element
  const elements = document.querySelectorAll('span[data-testid="awsc-nav-account-menu-button"]');
  if (IsDebug) console.log('Elements found: ', elements.length);

  if (elements.length > 0) {
    for (const element of elements) {
      if (IsDebug) console.log('Processing element: ', element);

      // Select the nested span element and get its 'title' attribute
      const nestedSpan = element.querySelector('span');
      if (!nestedSpan) { 
        return
      }
      if (IsDebug) console.log('Nested span element: ', nestedSpan);

      const titleAttribute = nestedSpan.getAttribute('title');
      if (IsDebug) console.log('Title attribute: ', titleAttribute);

      if (titleAttribute) { // Check if the title attribute is not null
        // Check if the title attribute contains "@" symbol
        if (titleAttribute.includes('@')) {
          const account_nameMatch = titleAttribute.match(/@ ([^\s]+)/);
          if (IsDebug) console.log('Account name match: ', account_nameMatch);

          if (account_nameMatch && account_nameMatch[1]) {
            const account_name = account_nameMatch[1];
            if (IsDebug) console.log('Account name: ', account_name);

            // Check if the title already starts with the account name
            if (!document.title.startsWith(account_name + ' - ')) {
              // Set the new title combining the account name and the current title
              document.title = account_name + ' - ' + document.title;
              if (IsDebug) console.log('Title updated: ' + document.title);
            }

            // Append the element's text content with the account name
            if (!element.textContent.includes(account_name)) {
              element.textContent = element.textContent + ' ' + account_name;
              if (IsDebug) console.log('Element text content updated: ' + element.textContent);
            }

          } else {
            console.warn('Account name not found in title attribute');
          }
        }
      }
    }
  } else {
    console.warn('No elements found with the specified data-testid');
  }
}


    // Check if the current URL contains "console.aws.amazon.com/"
    if (window.location.href.includes('console.aws.amazon.com/')) {
     
      updateTitleAndAddaccount_nameToLoginInfoOnConsolePages();
  
      // Use a MutationObserver to monitor DOM changes
      const observer = new MutationObserver(updateTitleAndAddaccount_nameToLoginInfoOnConsolePages);
  
      const config = { childList: true, subtree: true };
      observer.observe(document, config);
    }

