// Background service worker for Upwork Auto Applier Extension

class UpworkAutoApplier {
  constructor() {
    this.apiUrl = 'https://upwork-auto-applier-backend-production.up.railway.app';
    this.sessionId = null;
    this.isConnected = false;
    this.ws = null;
    this.init();
  }

  async init() {
    console.log('Upwork Auto Applier Extension initialized');
    
    // Check if user is logged in
    const result = await chrome.storage.local.get(['sessionId', 'isLoggedIn']);
    if (result.sessionId && result.isLoggedIn) {
      this.sessionId = result.sessionId;
      this.connectToAPI();
    }
  }

  async connectToAPI() {
    try {
      console.log('Attempting to connect to API with sessionId:', this.sessionId);
      console.log('WebSocket URL:', `${this.apiUrl.replace('https', 'wss')}/ws/${this.sessionId}`);
      
      // Create WebSocket connection to API
      this.ws = new WebSocket(`${this.apiUrl.replace('https', 'wss')}/ws/${this.sessionId}`);
      
      this.ws.onopen = () => {
        console.log('✅ Connected to Upwork Auto Applier API');
        this.isConnected = true;
        this.updateBadge('ON');
        
        // Send extension connected message
        this.sendToBackend({
          type: 'extension_connected',
          sessionId: this.sessionId
        });
        
        // Check login status and start monitoring
        this.checkAndReportLoginStatus();
        this.startLoginMonitoring();
      };

      this.ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        this.handleMessage(data);
      };

      this.ws.onclose = (event) => {
        console.log('❌ Disconnected from API. Code:', event.code, 'Reason:', event.reason);
        this.isConnected = false;
        this.updateBadge('OFF');
        // Reconnect after 5 seconds
        setTimeout(() => this.connectToAPI(), 5000);
      };

      this.ws.onerror = (error) => {
        console.error('❌ WebSocket error:', error);
        this.updateBadge('ERR');
      };

    } catch (error) {
      console.error('Failed to connect to API:', error);
      this.updateBadge('ERR');
    }
  }

  async handleMessage(data) {
    console.log('Received message:', data);
    
    switch (data.type) {
      case 'job_application':
        await this.handleJobApplication(data.job);
        break;
      case 'login_required':
        await this.showLoginPrompt();
        break;
      case 'status_update':
        await this.updateStatus(data.status);
        break;
      default:
        console.log('Unknown message type:', data.type);
    }
  }

  async handleJobApplication(data) {
    console.log('Processing job application:', data);
    
    const jobData = data.jobData;
    
    // Get current tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (!tab || !tab.url.includes('upwork.com')) {
      // Navigate to Upwork
      await chrome.tabs.create({ url: 'https://www.upwork.com' });
      // Wait a bit for page to load
      setTimeout(() => this.handleJobApplication(data), 3000);
      return;
    }

    // Send job data to content script for processing
    try {
      const response = await chrome.tabs.sendMessage(tab.id, {
        action: 'process_job',
        jobData: jobData
      });
      
      // Send result back to backend
      this.sendToBackend({
        type: 'job_completed',
        jobId: jobData.jobId,
        success: response.success,
        message: response.message || 'Job application completed'
      });
      
    } catch (error) {
      console.error('Job application failed:', error);
      this.sendToBackend({
        type: 'job_failed',
        jobId: jobData.jobId,
        error: error.message
      });
    }
  }

  sendToBackend(message) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      console.log('Sending message to backend:', message);
      this.ws.send(JSON.stringify(message));
    } else {
      console.log('WebSocket not ready, cannot send message:', message);
    }
  }

  applyToJob(job) {
    // This function runs in the Upwork page context
    console.log('Applying to job:', job);
    
    // Navigate to job URL
    if (window.location.href !== job.jobUrl) {
      window.location.href = job.jobUrl;
      return;
    }

    // Wait for page to load
    setTimeout(() => {
      // Look for apply button
      const applyButton = document.querySelector('button[data-test="submit-btn"]') ||
                         document.querySelector('button[data-cy="submit-btn"]') ||
                         document.querySelector('button:contains("Submit Proposal")');
      
      if (applyButton) {
        // Fill in cover letter if textarea exists
        const coverLetterTextarea = document.querySelector('textarea[name="coverLetter"]') ||
                                   document.querySelector('textarea[data-test="cover-letter"]');
        
        if (coverLetterTextarea) {
          coverLetterTextarea.value = job.coverLetter;
          coverLetterTextarea.dispatchEvent(new Event('input', { bubbles: true }));
        }
        
        // Click apply button
        applyButton.click();
        
        // Send success message back to background
        chrome.runtime.sendMessage({
          type: 'job_applied',
          jobId: job.jobId,
          success: true
        });
      } else {
        console.log('Apply button not found');
        chrome.runtime.sendMessage({
          type: 'job_applied',
          jobId: job.jobId,
          success: false,
          error: 'Apply button not found'
        });
      }
    }, 2000);
  }

  async showLoginPrompt() {
    // Show notification to user
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icon48.png',
      title: 'Upwork Auto Applier',
      message: 'Please log into Upwork to continue with job applications'
    });
  }

  async updateStatus(status) {
    console.log('Status update:', status);
    // Update badge based on status
    this.updateBadge(status);
  }

  updateBadge(text) {
    chrome.action.setBadgeText({ text });
    chrome.action.setBadgeBackgroundColor({ color: text === 'ON' ? '#4CAF50' : '#FF5722' });
  }

  async checkAndReportLoginStatus() {
    try {
      // Get all Upwork tabs
      const tabs = await chrome.tabs.query({ url: ['https://www.upwork.com/*', 'https://upwork.com/*'] });
      
      if (tabs.length === 0) {
        // No Upwork tabs open, user not logged in
        this.sendToBackend({
          type: 'login_status',
          isLoggedIn: false,
          sessionId: this.sessionId
        });
        return;
      }

      // Check login status on the first Upwork tab
      const tab = tabs[0];
      const response = await chrome.tabs.sendMessage(tab.id, {
        action: 'check_login_status'
      });

      if (response && response.isLoggedIn !== undefined) {
        this.sendToBackend({
          type: 'login_status',
          isLoggedIn: response.isLoggedIn,
          sessionId: this.sessionId
        });
        
        // Update storage
        await chrome.storage.local.set({ isLoggedIn: response.isLoggedIn });
      }
    } catch (error) {
      console.error('Failed to check login status:', error);
      // Assume not logged in if we can't check
      this.sendToBackend({
        type: 'login_status',
        isLoggedIn: false,
        sessionId: this.sessionId
      });
    }
  }

  startLoginMonitoring() {
    // Check login status every 10 seconds
    this.loginCheckInterval = setInterval(() => {
      this.checkAndReportLoginStatus();
    }, 10000);
  }

  stopLoginMonitoring() {
    if (this.loginCheckInterval) {
      clearInterval(this.loginCheckInterval);
      this.loginCheckInterval = null;
    }
  }

  async connectToSession(sessionId) {
    try {
      console.log('🔗 Connecting to session:', sessionId);
      this.sessionId = sessionId;
      
      // Check if user is already logged in before storing session info
      console.log('🔍 Checking current login status...');
      const isAlreadyLoggedIn = await this.checkCurrentLoginStatus();
      console.log('📊 Login status:', isAlreadyLoggedIn);
      
      // Store session info
      await chrome.storage.local.set({
        sessionId: this.sessionId,
        isLoggedIn: isAlreadyLoggedIn
      });
      console.log('💾 Session info stored');
      
      // Connect to API with specific session
      console.log('🌐 Connecting to API...');
      this.connectToAPI();
      
      return { 
        sessionId: this.sessionId, 
        message: 'Connected to session',
        isLoggedIn: isAlreadyLoggedIn
      };
    } catch (error) {
      console.error('❌ Failed to connect to session:', error);
      throw error;
    }
  }

  async checkCurrentLoginStatus() {
    try {
      // Get all Upwork tabs
      const tabs = await chrome.tabs.query({ url: ['https://www.upwork.com/*', 'https://upwork.com/*'] });
      
      if (tabs.length === 0) {
        console.log('No Upwork tabs found - user not logged in');
        return false;
      }

      // Check login status on the first Upwork tab
      const tab = tabs[0];
      console.log('Checking login status on tab:', tab.url);
      
      const response = await chrome.tabs.sendMessage(tab.id, {
        action: 'check_login_status'
      });

      if (response && response.isLoggedIn !== undefined) {
        console.log('Login status detected:', response.isLoggedIn);
        return response.isLoggedIn;
      } else {
        console.log('No valid login status response:', response);
      }
      
      return false;
    } catch (error) {
      console.error('Failed to check current login status:', error);
      return false;
    }
  }

  async startSession() {
    try {
      const response = await fetch(`${this.apiUrl}/session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobs: [], // Will be populated by API
          applicationPreferences: {}
        })
      });
      
      const data = await response.json();
      this.sessionId = data.sessionId;
      
      // Store session info
      await chrome.storage.local.set({
        sessionId: this.sessionId,
        isLoggedIn: true
      });
      
      // Connect to API
      this.connectToAPI();
      
      return data;
    } catch (error) {
      console.error('Failed to start session:', error);
      throw error;
    }
  }
}

// Initialize extension
console.log('🚀 Starting Upwork Auto Applier Extension...');
const upworkApplier = new UpworkAutoApplier();
console.log('✅ Extension initialized successfully');

// Handle messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('📨 Background: Received message:', request);
  
  switch (request.action) {
    case 'connect_to_session':
      console.log('🔗 Background: Processing connect_to_session request');
      upworkApplier.connectToSession(request.sessionId)
        .then(data => {
          console.log('✅ Background: Connection successful:', data);
          sendResponse({ success: true, data });
        })
        .catch(error => {
          console.error('❌ Background: Connection failed:', error);
          sendResponse({ success: false, error: error.message });
        });
      return true; // Keep message channel open for async response
      
    case 'start_session':
      upworkApplier.startSession()
        .then(data => sendResponse({ success: true, data }))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true; // Keep message channel open for async response
      
    case 'get_status':
      sendResponse({
        isConnected: upworkApplier.isConnected,
        sessionId: upworkApplier.sessionId
      });
      break;
      
    case 'disconnect':
      upworkApplier.ws?.close();
      upworkApplier.stopLoginMonitoring();
      chrome.storage.local.clear();
      upworkApplier.sessionId = null;
      upworkApplier.isConnected = false;
      upworkApplier.updateBadge('OFF');
      sendResponse({ success: true });
      break;
  }
});
