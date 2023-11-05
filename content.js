// Content Script (content.js)

// Declare a global variable to store unique links
const links = new Set();

// Function to extract links with a specific class and create new links separated by a pipe
function extractLinksWithClass() {
  const elementsWithClass = document.querySelectorAll('.profile-link');
  for (const element of elementsWithClass) {
    const href = element.getAttribute('href');
    if (href && !links.has(href)) {
      links.add(href);

      // Create a new link element with the modified text
      const newLinkTab = document.createElement('a');
      newLinkTab.className = 'profile-link';
      newLinkTab.rel = 'noopener noreferrer';
      newLinkTab.target = '_self'; // Open in the same tab
      newLinkTab.href = href;
      newLinkTab.title = element.getAttribute('title') + '-Container(Tab)'; // Append "-Container"

      // Set the link text with a pipe separator
      newLinkTab.textContent = ' | ' + element.textContent + '-Container (Tab)'; // Appended text + " | " + Original text

      newLinkTab.addEventListener('click', (event) => {
        event.preventDefault();
        const containerName = cleanAndDecodeContainerName(extractContainerNameFromURL(href)); // Extract container name
        browser.runtime.sendMessage({ action: 'copyCookiesAndOpenLink', link: href, containerName,openIn:'Tab' });
      });

      // Insert the new link element after the original link
      element.parentNode.insertBefore(newLinkTab, element.nextSibling);

      // Create a new link element with the modified text
      const newLinkWindow  = document.createElement('a');
      newLinkWindow .className = 'profile-link';
      newLinkWindow .rel = 'noopener noreferrer';
      newLinkWindow .target = '_self'; // Open in the same tab
      newLinkWindow .href = href;
      newLinkWindow .title = element.getAttribute('title') + '-Container(Window)'; // Append "-Container"

      // Set the link text with a pipe separator
      newLinkWindow .textContent = ' | ' + element.textContent + '-Container (Window)'; // Appended text + " | " + Original text

      newLinkWindow .addEventListener('click', (event) => {
        event.preventDefault();
        const containerName = cleanAndDecodeContainerName(extractContainerNameFromURL(href)); // Extract container name
        browser.runtime.sendMessage({ action: 'copyCookiesAndOpenLink', link: href, containerName,openIn:'Window' });
      });

      // Insert the new link element after the newLinkTab link
      element.parentNode.insertBefore(newLinkWindow , newLinkTab.nextSibling);



    }
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
// Function to extract the container name from the URL
function extractContainerNameFromURL(url) {
    const urlParts = url.split('/');
    return urlParts[urlParts.length - 2]; // Get the second-to-last part of the URL
  }

// Callback function for the MutationObserver
function handleMutations(mutationsList, observer) {
  for (const mutation of mutationsList) {
    if (mutation.type === 'childList') {
      extractLinksWithClass();
     
    }
  }
}

// Check if the current URL contains ".awsapps.com/start#/"
if (window.location.href.includes('.awsapps.com/')) {

    // Options for the MutationObserver
    const observerOptions = { childList: true, subtree: true };
  
    // Create a MutationObserver with the callback function
    const observer = new MutationObserver(handleMutations);
  
    // Start observing the entire document
    observer.observe(document, observerOptions);
  }


// Wait for the DOM to be fully loaded

    // Check if the current URL contains "console.aws.amazon.com/"
    if (window.location.href.includes('console.aws.amazon.com/')) {
      // Function to update the title and log
      function updateTitleAndAddAccountNameToLoginInfo() {
        const elements = document.querySelectorAll('span._hidden-on-mobile--inline_8hy5c_14._more-menu__button-content--label_znf2v_148');
  
        if (elements.length > 0) {
          for (const element of elements) {
            const titleAttribute = element.getAttribute('title');
  
            if (titleAttribute) { // Check if the title attribute is not null
              // Check if the title attribute contains "@" symbol
              if (titleAttribute.includes('@')) {
                const accountNameMatch = titleAttribute.match(/@ ([^\s]+)/);
  
                if (accountNameMatch && accountNameMatch[1]) {
                  const accountName = accountNameMatch[1];
  
                  // Check if the title already starts with the account name
                  if (!document.title.startsWith(accountName + ' - ')) {
                    // Set the new title combining the account name and the current title
                    document.title = accountName + ' - ' + document.title;
                    console.log('Title updated: ' + document.title);
  
                 
                  }

                    // Append the element's text content with the account name
                  if (!element.textContent.includes(accountName)) {
                    element.textContent = element.textContent + ' ' + accountName;
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
  
      // Call the function on DOM content load
      updateTitleAndAddAccountNameToLoginInfo();
  
      // Use a MutationObserver to monitor DOM changes
      const observer = new MutationObserver(updateTitleAndAddAccountNameToLoginInfo);
  
      const config = { childList: true, subtree: true };
      observer.observe(document, config);
    }

