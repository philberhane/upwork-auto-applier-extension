// Content script for Upwork Auto Applier Extension

class UpworkContentScript {
  constructor() {
    this.isUpworkPage = window.location.hostname.includes('upwork.com');
    this.init();
  }

  init() {
    console.log('🚀 Content script initializing...');
    console.log('🌐 Current URL:', window.location.href);
    console.log('🔍 Is Upwork page:', this.isUpworkPage);
    
    if (this.isUpworkPage) {
      console.log('Upwork Auto Applier: Content script loaded on Upwork page');
      this.setupUpworkPage();
      
      // Check if there's stored job data from a previous page reload
      this.checkForStoredJobData();
    } else {
      console.log('❌ Not an Upwork page, skipping initialization');
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

  checkForStoredJobData() {
    // Check if there's job data stored from a previous page reload
    console.log('🔍 Checking for stored job data...');
    
    // Check for job queue first
    const storedJobQueue = sessionStorage.getItem('upworkJobQueue');
    if (storedJobQueue) {
      console.log('📦 Found stored job queue:', storedJobQueue);
      try {
        const jobQueue = JSON.parse(storedJobQueue);
        console.log('📋 Parsed job queue with', jobQueue.length, 'jobs');
        // Process the job queue after a short delay
        setTimeout(() => {
          this.processJobQueueAfterReload(jobQueue);
        }, 2000);
        return;
      } catch (error) {
        console.error('❌ Failed to parse stored job queue:', error);
        sessionStorage.removeItem('upworkJobQueue');
      }
    }
    
    // Fallback to single job data
    const storedJobData = sessionStorage.getItem('upworkJobData');
    console.log('📦 Stored job data:', storedJobData);
    
    if (storedJobData) {
      console.log('🔄 Found stored job data from page reload, processing...');
      try {
        const jobData = JSON.parse(storedJobData);
        console.log('📋 Parsed job data:', jobData);
        // Process the job after a short delay to ensure page is ready
        setTimeout(() => {
          this.processJobAfterReload(jobData);
        }, 2000);
      } catch (error) {
        console.error('❌ Failed to parse stored job data:', error);
        sessionStorage.removeItem('upworkJobData');
      }
    } else {
      console.log('❌ No stored job data found');
    }
  }

  async processJobQueueAfterReload(jobQueue) {
    console.log('🔄 Processing job queue after page reload:', jobQueue.length, 'jobs');
    
    try {
      // Process jobs one by one
      for (let i = 0; i < jobQueue.length; i++) {
        const jobData = jobQueue[i];
        console.log(`🎯 Processing job ${i + 1}/${jobQueue.length}:`, jobData.jobUrl);
        
        // Navigate to job URL if not already there
        if (window.location.href !== jobData.jobUrl) {
          console.log('🌐 Navigating to job URL:', jobData.jobUrl);
          window.location.href = jobData.jobUrl;
          
          // Wait for page to reload and process this job
          sessionStorage.setItem('upworkJobQueue', JSON.stringify(jobQueue.slice(i)));
          return { success: true, message: `Navigating to job ${i + 1}...` };
        }
        
        // Process the current job
        await this.processJobAfterReload(jobData);
        
        // Wait between jobs
        if (i < jobQueue.length - 1) {
          console.log('⏳ Waiting before next job...');
          await this.wait(5000);
        }
      }
      
      // All jobs completed
      console.log('🎉 All jobs in queue completed successfully!');
      sessionStorage.removeItem('upworkJobQueue');
      
    } catch (error) {
      console.error('❌ Job queue processing failed:', error);
      sessionStorage.removeItem('upworkJobQueue');
    }
  }

  async processJobAfterReload(jobData) {
    console.log('🔄 Processing job after page reload:', jobData);
    
    try {
      // Wait longer for Cloudflare and page to be ready
      console.log('⏳ Waiting for Cloudflare and page to be ready after reload...');
      await this.wait(10000); // Wait 10 seconds for Cloudflare
      await this.waitForPageLoad();
      console.log('✅ Page is ready after reload');
      
      // Additional wait for dynamic content
      console.log('⏳ Waiting for dynamic content to load...');
      await this.wait(5000);
      
      // Fill cover letter
      if (jobData.coverLetter) {
        console.log('📝 Filling cover letter:', jobData.coverLetter.substring(0, 100) + '...');
        await this.fillCoverLetter(jobData.coverLetter);
        console.log('✅ Cover letter filled');
      }
      
      // Fill screening questions if any
      if (jobData.screeningResponses) {
        console.log('❓ Filling screening questions:', jobData.screeningResponses);
        await this.fillScreeningQuestions(jobData.screeningResponses);
        console.log('✅ Screening questions filled');
      }
      
      // Apply to job
      console.log('🎯 Applying to job...');
      await this.applyToJob();
      console.log('✅ Job application submitted');
      
      // Wait for success confirmation
      console.log('⏳ Waiting for confirmation...');
      await this.wait(jobData.timing?.delayAfterApply || 3000);
      
      console.log('🎉 Job application completed successfully!');
      
      // Clear stored job data
      sessionStorage.removeItem('upworkJobData');
      
      // Notify background script of completion
      chrome.runtime.sendMessage({
        type: 'job_completed',
        jobId: jobData.jobId,
        success: true,
        message: 'Job application completed successfully'
      });
      
    } catch (error) {
      console.error('❌ Job processing after reload failed:', error);
      sessionStorage.removeItem('upworkJobData');
      
      // Notify background script of failure
      chrome.runtime.sendMessage({
        type: 'job_failed',
        jobId: jobData.jobId,
        error: error.message
      });
    }
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
    console.log('📨 Content script received message:', request);
    
    switch (request.action) {
      case 'ping':
        console.log('🏓 Content script ping received');
        sendResponse({ pong: true });
        break;
        
      case 'process_job':
        console.log('🚀 Content script processing job:', request.jobData);
        let responseSent = false;
        
        this.processJob(request.jobData)
          .then(result => {
            console.log('✅ Content script job completed:', result);
            if (!responseSent) {
              responseSent = true;
              sendResponse({ success: true, result });
            }
          })
          .catch(error => {
            console.error('❌ Content script job failed:', error);
            if (!responseSent) {
              responseSent = true;
              sendResponse({ success: false, error: error.message });
            }
          });
          
        // Send immediate response for navigation case
        setTimeout(() => {
          if (!responseSent) {
            console.log('📤 Content script sending immediate response');
            responseSent = true;
            sendResponse({ success: true, message: 'Job processing initiated' });
          }
        }, 100);
        
        return true; // Keep message channel open for async response
        
      case 'process_job_queue':
        console.log('🚀 Content script processing job queue:', request.jobQueue);
        this.processJobQueue(request.jobQueue)
          .then(result => {
            console.log('✅ Content script job queue completed:', result);
            sendResponse({ success: true, result });
          })
          .catch(error => {
            console.error('❌ Content script job queue failed:', error);
            sendResponse({ success: false, error: error.message });
          });
        return true; // Keep message channel open for async response
        
      case 'check_login_status':
        this.checkLoginStatus()
          .then(isLoggedIn => {
            console.log('Login status check result:', isLoggedIn);
            sendResponse({ isLoggedIn });
          })
          .catch(error => {
            console.error('Login status check error:', error);
            sendResponse({ isLoggedIn: false, error: error.message });
          });
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

  async processJobQueue(jobQueue) {
    console.log('🚀 Processing job queue with', jobQueue.length, 'jobs');
    
    // Store job queue in sessionStorage
    sessionStorage.setItem('upworkJobQueue', JSON.stringify(jobQueue));
    console.log('💾 Job queue stored in sessionStorage');
    
    // Process the first job
    if (jobQueue.length > 0) {
      const firstJob = jobQueue[0];
      console.log('🎯 Processing first job from queue:', firstJob.jobUrl);
      
      // Navigate to first job URL
      if (window.location.href !== firstJob.jobUrl) {
        console.log('🌐 Navigating to job URL:', firstJob.jobUrl);
        window.location.href = firstJob.jobUrl;
        return { success: true, message: 'Navigating to first job...' };
      } else {
        // Already on the job page, process it
        return await this.processJobAfterReload(firstJob);
      }
    }
    
    return { success: true, message: 'No jobs in queue' };
  }

  async processJob(jobData) {
    console.log('🚀 Processing job with data:', jobData);
    
    try {
      // Store job data in sessionStorage to survive page reloads
      console.log('💾 Storing job data in sessionStorage:', jobData);
      sessionStorage.setItem('upworkJobData', JSON.stringify(jobData));
      console.log('✅ Job data stored in sessionStorage');
      
      // Verify storage
      const stored = sessionStorage.getItem('upworkJobData');
      console.log('🔍 Verification - stored data:', stored);
      
      // Navigate to job URL
      if (window.location.href !== jobData.jobUrl) {
        console.log('🌐 Navigating to job URL:', jobData.jobUrl);
        window.location.href = jobData.jobUrl;
        // Don't wait here - the page will reload and content script will restart
        // Return a promise that resolves after navigation
        return new Promise((resolve) => {
          setTimeout(() => {
            resolve({ success: true, message: 'Navigating to job page...' });
          }, 100);
        });
      }
      
      console.log('📄 Current URL after navigation:', window.location.href);
      
      // Wait for page to be ready
      console.log('⏳ Waiting for page to be ready...');
      await this.waitForPageLoad();
      console.log('✅ Page is ready');
      
      // Fill cover letter
      if (jobData.coverLetter) {
        console.log('📝 Filling cover letter:', jobData.coverLetter.substring(0, 100) + '...');
        await this.fillCoverLetter(jobData.coverLetter);
        console.log('✅ Cover letter filled');
      }
      
      // Fill screening questions if any
      if (jobData.screeningResponses) {
        console.log('❓ Filling screening questions:', jobData.screeningResponses);
        await this.fillScreeningQuestions(jobData.screeningResponses);
        console.log('✅ Screening questions filled');
      }
      
      // Apply to job
      console.log('🎯 Applying to job...');
      await this.applyToJob();
      console.log('✅ Job application submitted');
      
      // Wait for success confirmation
      console.log('⏳ Waiting for confirmation...');
      await this.wait(jobData.timing.delayAfterApply);
      
      console.log('🎉 Job application completed successfully!');
      return { 
        status: 'completed', 
        message: 'Job application completed successfully',
        jobId: jobData.jobId
      };
      
    } catch (error) {
      console.error('❌ Job processing failed:', error);
      throw error;
    }
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

  async fillCoverLetter(coverLetter) {
    console.log('🔍 Looking for cover letter textarea...');
    
    // Wait a bit for dynamic content to load
    await this.wait(2000);
    
    const textareaSelectors = [
      'textarea[name="coverLetter"]',
      'textarea[data-test="cover-letter"]',
      'textarea[placeholder*="cover letter"]',
      'textarea[placeholder*="proposal"]',
      'textarea[placeholder*="message"]',
      'textarea',
      'input[type="text"]'
    ];
    
    console.log('📄 Current page HTML preview:', document.body.innerHTML.substring(0, 500));
    
    for (const selector of textareaSelectors) {
      console.log(`🔍 Trying selector: ${selector}`);
      const textarea = document.querySelector(selector);
      console.log(`📝 Found element:`, textarea);
      
      if (textarea && textarea.offsetParent !== null) {
        console.log('✅ Found visible textarea, filling cover letter');
        textarea.value = coverLetter;
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
        textarea.dispatchEvent(new Event('change', { bubbles: true }));
        console.log('✅ Cover letter filled successfully');
        return;
      }
    }
    
    // Fallback: find any textarea by looking through all textareas
    console.log('Trying fallback method to find textarea...');
    const allTextareas = document.querySelectorAll('textarea');
    for (const textarea of allTextareas) {
      if (textarea.offsetParent !== null) {
        console.log('✅ Found textarea via fallback');
        textarea.focus();
        textarea.value = coverLetter;
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
        textarea.dispatchEvent(new Event('change', { bubbles: true }));
        console.log('✅ Cover letter filled successfully');
        return;
      }
    }
    
    console.error('❌ Cover letter textarea not found');
    throw new Error('Cover letter textarea not found');
  }

  async fillScreeningQuestions(responses) {
    // This is where you'd fill screening questions
    // For now, just log that we received them
    console.log('Screening responses received:', responses);
    // In a real implementation, you'd find and fill the screening question fields
  }

  async applyToJob() {
    console.log('🔍 Looking for apply/submit button...');
    
    // Wait a bit more for dynamic content
    await this.wait(3000);
    
    const buttonSelectors = [
      'button[data-test="submit-btn"]',
      'button[data-cy="submit-btn"]',
      'button[data-test="submit-proposal-btn"]',
      'button[data-cy="submit-proposal-btn"]',
      'button[type="submit"]',
      'input[type="submit"]',
      '.submit-proposal-btn',
      '.apply-btn',
      'button[class*="submit"]',
      'button[class*="proposal"]',
      'button[class*="apply"]',
      '[data-test*="submit"]',
      '[data-cy*="submit"]',
      'button[aria-label*="Submit"]',
      'button[aria-label*="Apply"]'
    ];
    
    console.log('📄 Current page HTML preview:', document.body.innerHTML.substring(0, 1000));
    
    for (const selector of buttonSelectors) {
      console.log(`🔍 Trying selector: ${selector}`);
      const button = document.querySelector(selector);
      console.log(`🔘 Found element:`, button);
      
      if (button && button.offsetParent !== null) {
        console.log('✅ Found visible apply button, clicking...');
        button.click();
        console.log('✅ Apply button clicked successfully');
        return;
      }
    }
    
    // Fallback: find button by text content
    console.log('🔍 Trying fallback method to find submit button...');
    const allButtons = document.querySelectorAll('button');
    console.log(`📊 Found ${allButtons.length} buttons on page`);
    
    for (const button of allButtons) {
      const text = button.textContent.trim();
      console.log(`🔘 Button text: "${text}"`);
      
      if (button.offsetParent !== null && 
          (text.includes('Submit Proposal') || 
           text.includes('Submit') ||
           text.includes('Apply') ||
           text.includes('Send Proposal') ||
           text.includes('Propose'))) {
        console.log('✅ Found apply button by text content, clicking...');
        button.click();
        console.log('✅ Apply button clicked successfully');
        return;
      }
    }
    
    // Last resort: look for any button that might be a submit button
    console.log('🔍 Last resort: looking for any submit-like button...');
    const allElements = document.querySelectorAll('*');
    for (const element of allElements) {
      if (element.tagName === 'BUTTON' || element.tagName === 'INPUT') {
        const text = element.textContent?.trim() || element.value?.trim() || '';
        if (text && (
          text.toLowerCase().includes('submit') ||
          text.toLowerCase().includes('apply') ||
          text.toLowerCase().includes('propose') ||
          text.toLowerCase().includes('send')
        )) {
          console.log(`🔘 Found potential submit element: "${text}"`);
          if (element.offsetParent !== null) {
            console.log('✅ Clicking potential submit button...');
            element.click();
            console.log('✅ Potential submit button clicked');
            return;
          }
        }
      }
    }
    
    console.error('❌ Apply button not found after exhaustive search');
    throw new Error('Apply button not found');
  }

  findApplyButton() {
    const selectors = [
      'button[data-test="submit-btn"]',
      'button[data-cy="submit-btn"]',
      'button[type="submit"]',
      'input[type="submit"]',
      '.submit-proposal-btn',
      '.apply-btn',
      'button[class*="submit"]',
      'button[class*="proposal"]'
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
