// // Content Script (content.js)

// // Declare a global variable to store unique links
const links = new Set();
let invocationCounter = 0;
let addingTabandWindowLinks = false;
const linksInfo = new Set();
const processedLinks = new Set(); // Keep track of processed links
// Set debug flag
const IsDebug = false;

// Function to create links from recent entries in storage
async function createLinksFromStorageEntries() {
  try {
    // Wait for the DOM to fully load
    
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
        recentLoginsText.textContent = 'Recent Logins:';
        recentLoginsText.style.fontWeight = 'bold'; // Set the text to bold
        recentLoginsText.style.fontSize = '16px'; // Increase font size
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
        console.log('Recent logins container already exists in the DOM.');
        return;
      }
      
      // Retrieve recent entries from storage
      const { recentfivelogins: recentEntries = [] } = await browser.storage.local.get('recentfivelogins');

      // Exit early if there are no recent entries
      if (recentEntries.length === 0) {
        console.log('No recent entries found in storage.');
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

        // Create a new link element
        const newLink = document.createElement('a');
        newLink.className = 'awsui_link_4c84z_7y59r_99 awsui_variant-secondary_4c84z_7y59r_168 awsui_font-size-body-m_4c84z_7y59r_432';
        newLink.rel = 'noopener noreferrer';
        newLink.target = '_self'; // Open in the same tab
        newLink.href = new URL(href, window.location.href.split('#')[0]).toString();
        
        console.log('createLinksFromStorageEntries - Absolute link href:', newLink.href);
        newLink.title = account_name + ' ' + account_id + ' ' + role_name + '-Container(' + openIn + ')'; // Use account name as title

        // Set the link text with a pipe separator
        newLink.textContent = newLink.title;
        newLink.style.fontSize = '14px'; // Increase font size
        newLink.style.marginBottom = '10px'; // Add some margin at the bottom
        newLink.style.padding = '10px';
        
        // Add click event listener to handle link click
        newLink.addEventListener('click', (event) => {
          event.preventDefault();
          const containerName = account_id + '-' + cleanAndDecodeContainerName(account_name);
          browser.runtime.sendMessage({
            action: 'copyCookiesAndOpenLink',
            link: newLink.href,
            containerName,
            openIn: openIn,
            title: newLink.title,
            role_name: role_name,
            account_id: account_id,
            account_name: account_name
          });
        });

        // Insert the new link element before the parent element
        parentElement.appendChild(newLink);

        // Add a line break after each link
        parentElement.appendChild(document.createElement('br'));
        parentElement.appendChild(document.createElement('br'));

        console.log(`Created link for ${account_name} (${account_id})`);
      });

    // // Add a bordered rectangle with a tip message
    //   const tipContainer = document.createElement('div');
    //   tipContainer.style.border = '1px solid orange'; // Thin orange border
    //   tipContainer.style.padding = '5px';
    //   tipContainer.style.marginTop = '10px'; // Add margin at the top
    //   tipContainer.style.fontSize = '14px'; // Increase font size

    //   tipContainer.textContent = 'Tip: When your console pages expire (console.aws.amazon.com), come to this IIC page, re-login by refreshing/reloading, and go back to the console page. '
    //   +'\n\r'+ 'Then, hit the reload button to continue what you are doing without reopening everything again.';
      
    //   parentContainer.appendChild(tipContainer);

    // // Add a line break after the tip container
    // parentContainer.appendChild(document.createElement('br'));
    // parentContainer.appendChild(document.createElement('br'));
    parentContainer.appendChild(document.createElement('br'));
    // Add the parentContainer as a child of the specified class
   // Add the parentContainer as a child of the specified ID
    let targetDiv = document.getElementById('awsui-tabs-43-1710532311807-680-accounts-panel');
    if (targetDiv) {
        targetDiv.appendChild(parentContainer);
    } else {
        console.warn('Target div not found.');
    }


  } catch (error) {
    console.error('Error creating links from recent entries:', error);
  }
}

function extractLinksWithClass() {
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
      const account_name_element = account_nameContainer.querySelector('.awsui_root_18wu0_1qbfe_99');

      // Extract account name from the found element
      const account_name = account_name_element ? account_name_element.textContent.trim() : '';

      if (!account_id || !role_name) {
        if (IsDebug) console.error('Failed to extract account_id or role_name from href:', href);
        continue;
      }

      if (!account_name) {
        if (IsDebug) console.error('Failed to extract account name from DOM');
        continue;
      }

      if (IsDebug) {
        console.log('Extracted info:');
        console.log('Account ID:', account_id);
        console.log('Account Name:', account_name);
        console.log('Role Name:', role_name);
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
    if (IsDebug) console.log('Mutation observed:', mutationsList.length);
    if (IsDebug) console.log('mutationsList : ');
    if (IsDebug) console.log(mutationsList);
    for (const mutation of mutationsList) {
      if (IsDebug) console.log('mutation.target.classList : ' + mutation.target.classList);
      if (mutation.target.classList.contains('ZA2Ih29gQPWWy47dDhuE')) {
        if (IsDebug) console.log('Account Role mutation observed.');
        if (addingTabandWindowLinks === false)
          extractLinksWithClass();
        if (IsDebug) console.log('Links:', links.size);
      } else if (mutationsList.length == 1 && mutation.target.classList.contains('stw1bkrahhh9wPMNiZKU')) {
        if (IsDebug) console.log('Account Collapse mutation observed.');
        if (IsDebug) console.log('mutationsList : ');
        if (IsDebug) console.log(mutation.target.classList);
          processedLinks.clear();
      }
    }
  }
  

// Function to compare cookie expiration timestamps and prompt the user if they are different
function compareAndPromptForRefresh() {
  try {
    console.log('Invocation counter:', invocationCounter);
    // Send a message to background.js to request currentCookieExpirationDateTimeEpoch
    const response = browser.runtime.sendMessage({ action: 'getCurrentCookieExpirationDateTimeEpoch' });
    const currentCookieExpirationDateTimeEpoch = response.currentCookieExpirationDateTimeEpoch;
    console.log('Current cookie expiration datetime from background:', currentCookieExpirationDateTimeEpoch);

    // Get the stored cookie expiration timestamp from storage
    const storageData = browser.storage.local.get('cookieExpirationDateTimeEpoch');
    const storedCookieExpirationTimestamp = storageData.cookieExpirationDateTimeEpoch || 0;

    // If the stored timestamp is different from the current timestamp
    if (currentCookieExpirationDateTimeEpoch !== storedCookieExpirationTimestamp) {
      // Prompt the user for confirmation
      if (window.confirm('The session has expired. Do you want to refresh any open console page tabs?')) {
        // If the user confirms, refresh tabs with ".console.aws.amazon.com" in the URL
        const tabsToRefresh = browser.tabs.query({ url: '*://*.console.aws.amazon.com/*' });
        for (const tab of tabsToRefresh) {
          console.log(`Refreshing tab with URL: ${tab.url}`);
          browser.tabs.reload(tab.id);
        }
      }
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

// Check if the current URL contains ".awsapps.com/start#/"
if (window.location.href.includes('.awsapps.com/') && !window.location.href.includes('.awsapps.com/start/#/saml/custom/')){

  document.title = 'AWS IIC SSO';

  browser.runtime.sendMessage({ action: 'copyCookiesToAllContainers' });

  //compareAndPromptForRefresh();
  
  browser.runtime.sendMessage({ action: 'saveCookieExpiration' });

    // Options for the MutationObserver
    const observerOptions = { childList: true, subtree: true };
  
    // Create a MutationObserver with the callback function
    const observer = new MutationObserver(handleMutations);
  
    // Start observing the entire document
    observer.observe(document, observerOptions);

    createLinksFromStorageEntries();


    
  }

 // Function to update the title and log
 function updateTitleAndAddaccount_nameToLoginInfo() {
  const elements = document.querySelectorAll('span._hidden-on-mobile--inline_8hy5c_14._more-menu__button-content--label_znf2v_148');

  if (elements.length > 0) {
    for (const element of elements) {
      const titleAttribute = element.getAttribute('title');

      if (titleAttribute) { // Check if the title attribute is not null
        // Check if the title attribute contains "@" symbol
        if (titleAttribute.includes('@')) {
          const account_nameMatch = titleAttribute.match(/@ ([^\s]+)/);

          if (account_nameMatch && account_nameMatch[1]) {
            const account_name = account_nameMatch[1];

            // Check if the title already starts with the account name
            if (!document.title.startsWith(account_name + ' - ')) {
              // Set the new title combining the account name and the current title
              document.title = account_name + ' - ' + document.title;
              console.log('Title updated: ' + document.title);

           
            }

              // Append the element's text content with the account name
            if (!element.textContent.includes(account_name)) {
              element.textContent = element.textContent + ' ' + account_name;
              }

          } else {
            console.log('Account name not found in title attribute');
          }
        }
      }
    }
  } else {
    console.log('No elements found with the specified class');
  }
}

    // Check if the current URL contains "console.aws.amazon.com/"
    if (window.location.href.includes('console.aws.amazon.com/')) {
     
      updateTitleAndAddaccount_nameToLoginInfo();
  
      // Use a MutationObserver to monitor DOM changes
      const observer = new MutationObserver(updateTitleAndAddaccount_nameToLoginInfo);
  
      const config = { childList: true, subtree: true };
      observer.observe(document, config);
    }