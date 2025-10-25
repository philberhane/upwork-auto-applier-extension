// Content script for Upwork Auto Applier Extension

class UpworkContentScript {
  constructor() {
    this.isUpworkPage = window.location.hostname.includes('upwork.com');
    this.init();
  }

  init() {
    if (this.isUpworkPage) {
      console.log('Upwork Auto Applier: Content script loaded on Upwork page');
      this.setupUpworkPage();
    }
  }

  setupUpworkPage() {
    // Add visual indicator that extension is active
    this.addExtensionIndicator();
    
    // Listen for messages from background script
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      this.handleMessage(request, sendResponse);
    });
    
    // Monitor page changes for job applications
    this.monitorJobApplications();
  }

  addExtensionIndicator() {
    // Create floating indicator
    const indicator = document.createElement('div');
    indicator.id = 'upwork-auto-applier-indicator';
    indicator.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #4CAF50;
      color: white;
      padding: 8px 12px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: bold;
      z-index: 10000;
      box-shadow: 0 2px 8px rgba(0,0,0,0.3);
      cursor: pointer;
    `;
    indicator.textContent = '🚀 Auto Applier Active';
    
    // Add click handler to show status
    indicator.addEventListener('click', () => {
      this.showStatusPopup();
    });
    
    document.body.appendChild(indicator);
    
    // Hide after 5 seconds
    setTimeout(() => {
      if (indicator.parentNode) {
        indicator.style.opacity = '0.7';
      }
    }, 5000);
  }

  showStatusPopup() {
    // Create status popup
    const popup = document.createElement('div');
    popup.style.cssText = `
      position: fixed;
      top: 60px;
      right: 20px;
      background: white;
      border: 1px solid #ddd;
      border-radius: 8px;
      padding: 15px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      z-index: 10001;
      max-width: 250px;
      font-size: 12px;
    `;
    
    popup.innerHTML = `
      <div style="font-weight: bold; margin-bottom: 8px; color: #333;">
        Upwork Auto Applier
      </div>
      <div style="color: #666; margin-bottom: 8px;">
        Status: <span style="color: #4CAF50;">Active</span>
      </div>
      <div style="color: #666; margin-bottom: 8px;">
        Ready to apply to jobs automatically
      </div>
      <button id="close-status" style="
        background: #4CAF50;
        color: white;
        border: none;
        padding: 6px 12px;
        border-radius: 4px;
        cursor: pointer;
        font-size: 11px;
      ">Close</button>
    `;
    
    document.body.appendChild(popup);
    
    // Close button handler
    popup.querySelector('#close-status').addEventListener('click', () => {
      if (popup.parentNode) {
        popup.parentNode.removeChild(popup);
      }
    });
    
    // Auto-close after 10 seconds
    setTimeout(() => {
      if (popup.parentNode) {
        popup.parentNode.removeChild(popup);
      }
    }, 10000);
  }

  handleMessage(request, sendResponse) {
    switch (request.action) {
      case 'execute_instructions':
        this.executeInstructions(request.instructions)
          .then(result => sendResponse({ success: true, result }))
          .catch(error => sendResponse({ success: false, error: error.message }));
        return true; // Keep message channel open for async response
        
      case 'check_login_status':
        this.checkLoginStatus()
          .then(isLoggedIn => sendResponse({ isLoggedIn }))
          .catch(error => sendResponse({ isLoggedIn: false, error: error.message }));
        return true;
        
      case 'get_page_info':
        sendResponse({
          url: window.location.href,
          title: document.title,
          isUpwork: this.isUpworkPage
        });
        break;
        
      default:
        sendResponse({ success: false, error: 'Unknown action' });
    }
  }

  async executeInstructions(instructions) {
    console.log('Executing instructions:', instructions);
    
    for (const instruction of instructions) {
      try {
        await this.executeCommand(instruction);
        
        // Wait after command if specified
        if (instruction.waitAfter) {
          await this.wait(instruction.waitAfter);
        }
      } catch (error) {
        console.error('Command failed:', instruction, error);
        throw error;
      }
    }
    
    return { status: 'completed', message: 'All instructions executed' };
  }

  async executeCommand(command) {
    switch (command.type) {
      case 'navigate_to_job':
        if (window.location.href !== command.url) {
          window.location.href = command.url;
        }
        if (command.waitFor) {
          await this.wait(command.waitFor);
        }
        break;
        
      case 'wait_for_element':
        await this.waitForElement(command.selector, command.timeout || 5000);
        break;
        
      case 'fill_cover_letter':
        const textarea = document.querySelector(command.selector);
        if (textarea) {
          textarea.value = command.text;
          textarea.dispatchEvent(new Event('input', { bubbles: true }));
        } else {
          throw new Error(`Cover letter textarea not found: ${command.selector}`);
        }
        break;
        
      case 'click_apply_button':
        const button = document.querySelector(command.selector);
        if (button) {
          button.click();
        } else {
          throw new Error(`Apply button not found: ${command.selector}`);
        }
        break;
        
      case 'verify_success':
        const success = await this.verifySuccess(command.selectors, command.timeout || 10000);
        if (!success) {
          throw new Error('Success verification failed');
        }
        break;
        
      case 'wait':
        await this.wait(command.duration);
        break;
        
      default:
        console.warn('Unknown command type:', command.type);
    }
  }

  async waitForElement(selector, timeout = 5000) {
    return new Promise((resolve, reject) => {
      const element = document.querySelector(selector);
      if (element) {
        resolve(element);
        return;
      }
      
      const observer = new MutationObserver((mutations) => {
        const element = document.querySelector(selector);
        if (element) {
          observer.disconnect();
          resolve(element);
        }
      });
      
      observer.observe(document.body, {
        childList: true,
        subtree: true
      });
      
      setTimeout(() => {
        observer.disconnect();
        reject(new Error(`Element not found: ${selector}`));
      }, timeout);
    });
  }

  async verifySuccess(selectors, timeout = 10000) {
    return new Promise((resolve) => {
      const checkForSuccess = () => {
        for (const selector of selectors) {
          const element = document.querySelector(selector);
          if (element && element.textContent.includes('proposal') || element.textContent.includes('applied')) {
            resolve(true);
            return;
          }
        }
      };
      
      checkForSuccess();
      
      const observer = new MutationObserver(checkForSuccess);
      observer.observe(document.body, {
        childList: true,
        subtree: true
      });
      
      setTimeout(() => {
        observer.disconnect();
        resolve(false);
      }, timeout);
    });
  }

  async wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  findApplyButton() {
    const selectors = [
      'button[data-test="submit-btn"]',
      'button[data-cy="submit-btn"]',
      'button:contains("Submit Proposal")',
      'button:contains("Submit")',
      'input[type="submit"]',
      '.submit-proposal-btn',
      '.apply-btn'
    ];
    
    for (const selector of selectors) {
      const button = document.querySelector(selector);
      if (button && button.offsetParent !== null) { // Check if visible
        return button;
      }
    }
    
    return null;
  }

  findCoverLetterTextarea() {
    const selectors = [
      'textarea[name="coverLetter"]',
      'textarea[data-test="cover-letter"]',
      'textarea[placeholder*="cover letter"]',
      'textarea[placeholder*="proposal"]',
      'textarea[placeholder*="message"]'
    ];
    
    for (const selector of selectors) {
      const textarea = document.querySelector(selector);
      if (textarea && textarea.offsetParent !== null) {
        return textarea;
      }
    }
    
    return null;
  }

  async checkLoginStatus() {
    console.log('Checking login status on:', window.location.href);
    
    // Check for login indicators - more comprehensive list
    const loginIndicators = [
      '[data-test="user-menu"]',
      '.user-menu',
      '[data-cy="user-menu"]',
      '.upwork-header-user',
      'a[href*="/logout"]',
      '.user-profile',
      '[data-test="user-avatar"]',
      '.user-avatar',
      '.user-dropdown',
      '[data-test="user-dropdown"]',
      '.header-user',
      '.user-info',
      'button[aria-label*="user"]',
      'button[aria-label*="profile"]',
      '.user-menu-toggle',
      '[data-test="user-menu-toggle"]'
    ];
    
    for (const selector of loginIndicators) {
      const element = document.querySelector(selector);
      if (element && element.offsetParent !== null) { // Check if visible
        console.log('Found login indicator:', selector);
        return true;
      }
    }
    
    // Check URL for logged-in patterns
    const loggedInUrls = ['/nx/', '/dashboard', '/jobs/', '/messages/', '/proposals/', '/find-work/'];
    const isLoggedInUrl = loggedInUrls.some(pattern => window.location.href.includes(pattern));
    
    // Check for login page indicators (if we're on login page, we're not logged in)
    const loginPageIndicators = [
      'input[name="username"]',
      'input[name="email"]',
      'input[type="email"]',
      '.login-form',
      '[data-test="login-form"]',
      'button[type="submit"]'
    ];
    
    const isOnLoginPage = loginPageIndicators.some(selector => document.querySelector(selector));
    
    console.log('URL check:', isLoggedInUrl, 'Login page check:', isOnLoginPage);
    
    // If we're on a login page, we're definitely not logged in
    if (isOnLoginPage) {
      return false;
    }
    
    // If we're on a logged-in URL pattern, we're probably logged in
    return isLoggedInUrl;
  }

  async waitForPageLoad() {
    return new Promise((resolve) => {
      if (document.readyState === 'complete') {
        resolve();
      } else {
        window.addEventListener('load', resolve);
      }
    });
  }

  monitorJobApplications() {
    // Monitor for successful job applications
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'childList') {
          // Check for success messages
          const successMessages = document.querySelectorAll('.success-message, .alert-success, [data-test="success"]');
          successMessages.forEach((message) => {
            if (message.textContent.includes('proposal') || message.textContent.includes('applied')) {
              console.log('Job application successful detected');
              // Send success message to background
              chrome.runtime.sendMessage({
                type: 'job_application_success',
                message: message.textContent
              });
            }
          });
        }
      });
    });
    
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }
}

// Initialize content script
new UpworkContentScript();
