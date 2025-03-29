document.addEventListener('DOMContentLoaded', function () {
    const defaultRegionInput = document.getElementById('default-region');
    const enableDebugCheckbox = document.getElementById('enable-debug');
    const saveButton = document.getElementById('save');
    const closeButton = document.getElementById('close');
  
    // Load saved values from storage
    browser.storage.local.get(['default-region', 'enable-debug']).then((result) => {
      if (result['default-region']) {
        defaultRegionInput.value = result['default-region'];
      }
      enableDebugCheckbox.checked = result['enable-debug'] || false;
    });
  
    // Save values to storage and close the options page
    saveButton.addEventListener('click', () => {
      const defaultRegion = defaultRegionInput.value;
      const enableDebug = enableDebugCheckbox.checked;
      browser.storage.local.set({
        'default-region': defaultRegion,
        'enable-debug': enableDebug
      }).then(() => {
        window.close();
      });
    });
  
    // Close the options page
    closeButton.addEventListener('click', () => {
      window.close();
    });
  });