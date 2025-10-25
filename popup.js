// Popup script for Upwork Auto Applier Extension

class PopupController {
  constructor() {
    this.isConnected = false;
    this.sessionId = null;
    this.init();
  }

  async init() {
    // Get current status
    await this.updateStatus();
    
    // Set up event listeners
    document.getElementById('connectBtn').addEventListener('click', () => this.connect());
    document.getElementById('disconnectBtn').addEventListener('click', () => this.disconnect());
    
    // Update status every 5 seconds
    setInterval(() => this.updateStatus(), 5000);
  }

  async updateStatus() {
    try {
      const response = await chrome.runtime.sendMessage({ action: 'get_status' });
      this.isConnected = response.isConnected;
      this.sessionId = response.sessionId;
      
      this.updateUI();
    } catch (error) {
      console.error('Failed to get status:', error);
      this.isConnected = false;
      this.sessionId = null;
      this.updateUI();
    }
  }

  updateUI() {
    const statusDot = document.getElementById('statusDot');
    const statusText = document.getElementById('statusText');
    const sessionInfo = document.getElementById('sessionInfo');
    const connectBtn = document.getElementById('connectBtn');
    const disconnectBtn = document.getElementById('disconnectBtn');

    if (this.isConnected) {
      statusDot.className = 'status-dot connected';
      statusText.textContent = 'Connected';
      sessionInfo.textContent = `Session: ${this.sessionId?.substring(0, 8)}...`;
      connectBtn.style.display = 'none';
      disconnectBtn.style.display = 'block';
    } else {
      statusDot.className = 'status-dot disconnected';
      statusText.textContent = 'Disconnected';
      sessionInfo.textContent = 'No active session';
      connectBtn.style.display = 'block';
      disconnectBtn.style.display = 'none';
    }
  }

  async connect() {
    const connectBtn = document.getElementById('connectBtn');
    const originalText = connectBtn.textContent;
    
    try {
      connectBtn.textContent = 'Connecting...';
      connectBtn.disabled = true;
      
      const response = await chrome.runtime.sendMessage({ action: 'start_session' });
      
      if (response.success) {
        this.isConnected = true;
        this.sessionId = response.data.sessionId;
        this.updateUI();
        
        // Show success message
        this.showMessage('Connected successfully!', 'success');
      } else {
        throw new Error(response.error || 'Failed to connect');
      }
    } catch (error) {
      console.error('Connection failed:', error);
      this.showMessage(`Connection failed: ${error.message}`, 'error');
    } finally {
      connectBtn.textContent = originalText;
      connectBtn.disabled = false;
    }
  }

  async disconnect() {
    try {
      await chrome.runtime.sendMessage({ action: 'disconnect' });
      this.isConnected = false;
      this.sessionId = null;
      this.updateUI();
      this.showMessage('Disconnected successfully!', 'success');
    } catch (error) {
      console.error('Disconnect failed:', error);
      this.showMessage(`Disconnect failed: ${error.message}`, 'error');
    }
  }

  showMessage(message, type) {
    // Create temporary message element
    const messageEl = document.createElement('div');
    messageEl.style.cssText = `
      position: fixed;
      top: 10px;
      left: 10px;
      right: 10px;
      padding: 10px;
      border-radius: 4px;
      color: white;
      font-size: 12px;
      text-align: center;
      z-index: 1000;
      background: ${type === 'success' ? '#4CAF50' : '#FF5722'};
    `;
    messageEl.textContent = message;
    
    document.body.appendChild(messageEl);
    
    // Remove after 3 seconds
    setTimeout(() => {
      if (messageEl.parentNode) {
        messageEl.parentNode.removeChild(messageEl);
      }
    }, 3000);
  }
}

// Initialize popup when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new PopupController();
});
