// src/main.js
import './style.css'

// API integration class to communicate with the backend
class PackageAPI {
    static baseURL = '/api';
    static async generatePackage(config) {
        console.log('Sending config to backend:', config);
        
        const response = await fetch(`${this.baseURL}/generate-package`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ config })
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Server error: ${response.status} - ${errorText}`);
        }
        
        return response.json();
    }

    static async downloadPackage(packageId) {
        const response = await fetch(`${this.baseURL}/download/${packageId}`);
        
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Download failed: ${response.status} - ${errorText}`);
        }
        
        // Get filename from Content-Disposition header or use default
        const contentDisposition = response.headers.get('Content-Disposition');
        let filename = `RLMazeTrainer_${Date.now()}.zip`;
        
        if (contentDisposition) {
            const filenameMatch = contentDisposition.match(/filename="(.+)"/);
            if (filenameMatch) {
                filename = filenameMatch[1];
            }
        }
        
        // Create download
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        
        return { success: true, filename };
    }
}


// Main application class
class RLMTApp {
    constructor() {
        this.currentUser = null;
        this.currentView = 'login';
        this.appConfig = {
            mazeRooms: 5,
            trainingSteps: 10000,
            algorithm: 'PPO',
            saveLocation: 'local', // Updated default
            autoStart: true
        };
        
        this.generatedPackageId = null; // To store the ID from the backend
        this.generatedPackageSize = null; // To store the generated package size
        this.loadingOverlayRemover = null; // To manage the loading overlay
        
        this.init();
    }
    
    init() {
        this.render();
        this.checkAuthStatus();
    }
    
    checkAuthStatus() {
        // Check if user is already logged in (for demo purposes)
        const savedUser = localStorage.getItem('rlmt_user');
        if (savedUser) {
            this.currentUser = JSON.parse(savedUser);
            this.navigateTo('configurator');
        }
    }
    
    navigateTo(view) {
        this.currentView = view;
        this.render();
    }
    
    handleLogin(userData) {
        this.currentUser = userData;
        localStorage.setItem('rlmt_user', JSON.stringify(userData));
        this.navigateTo('configurator');
    }
    
    handleLogout() {
        this.currentUser = null;
        localStorage.removeItem('rlmt_user');
        this.navigateTo('login');
    }
    
    updateConfig(newConfig) {
        this.appConfig = { ...this.appConfig, ...newConfig };
        this.render();
    }
    
    render() {
        const app = document.getElementById('app');
        app.innerHTML = this.getCurrentView();
    }
    
    getCurrentView() {
        const header = this.renderHeader();
        const mainContent = this.renderMainContent();
        
        return `
            <div class="app">
                ${header}
                <main class="main-content">
                    ${mainContent}
                </main>
            </div>
        `;
    }
    
    renderHeader() {
        return `
            <header class="header">
                <div class="header-content">
                    <div class="logo">
                        <h1>🎮 RL Maze Trainer</h1>
                        <p>Train AI Agents in 3D Mazes</p>
                    </div>
                    ${this.currentUser ? `
                        <div class="user-menu">
                            <span>Welcome, ${this.currentUser.name}</span>
                            <button class="btn btn-outline" onclick="app.handleLogout()">Logout</button>
                        </div>
                    ` : ''}
                </div>
            </header>
        `;
    }
    
    renderMainContent() {
        switch (this.currentView) {
            case 'login':
                return this.renderLogin();
            case 'configurator':
                return this.renderConfigurator();
            case 'download':
                return this.renderDownload();
            default:
                return this.renderLogin();
        }
    }
    
    renderLogin() {
        return `
            <div class="login-container">
                <div class="login-card">
                    <h2>Welcome to RL Maze Trainer</h2>
                    <p>Login to download your customized AI training package</p>
                    
                    <form class="login-form" onsubmit="app.handleLoginForm(event)">
                        <div class="form-group">
                            <label for="email">Email</label>
                            <input type="email" id="email" required placeholder="Enter your email">
                        </div>
                        
                        <div class="form-group">
                            <label for="password">Password</label>
                            <input type="password" id="password" required placeholder="Enter your password">
                        </div>
                        
                        <button type="submit" class="btn btn-primary btn-full">Login</button>
                    </form>
                    
                    <div class="login-footer">
                        <p>Don't have an account? <a href="#" onclick="app.handleSignup()">Sign up here</a></p>
                    </div>
                    
                    <div class="demo-note">
                        <p><strong>Demo:</strong> Use any email/password to login</p>
                    </div>
                </div>
            </div>
        `;
    }
    
    renderConfigurator() {
        return `
            <div class="configurator">
                <div class="config-header">
                    <h2>Configure Your Training Package</h2>
                    <p>Customize your AI maze training experience</p>
                </div>
                
                <div class="config-grid">
                    <!-- Maze Configuration -->
                    <div class="config-card">
                        <h3>🏰 Maze Settings</h3>
                        <div class="form-group">
                            <label for="mazeRooms">Number of Rooms: <span id="roomsValue">${this.appConfig.mazeRooms}</span></label>
                            <input type="range" id="mazeRooms" min="1" max="20" value="${this.appConfig.mazeRooms}" 
                                   oninput="app.updateSlider('roomsValue', this.value, 'mazeRooms')">
                            <div class="slider-labels">
                                <span>Simple</span>
                                <span>Complex</span>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Training Configuration -->
                    <div class="config-card">
                        <h3>🤖 Training Settings</h3>
                        <div class="form-group">
                            <label for="trainingSteps">Training Steps</label>
                            <select id="trainingSteps" onchange="app.updateConfig({trainingSteps: parseInt(this.value)})">
                                <option value="5000" ${this.appConfig.trainingSteps === 5000 ? 'selected' : ''}>5,000 (Quick)</option>
                                <option value="10000" ${this.appConfig.trainingSteps === 10000 ? 'selected' : ''}>10,000 (Standard)</option>
                                <option value="20000" ${this.appConfig.trainingSteps === 20000 ? 'selected' : ''}>20,000 (Extended)</option>
                                <option value="50000" ${this.appConfig.trainingSteps === 50000 ? 'selected' : ''}>50,000 (Comprehensive)</option>
                            </select>
                        </div>
                        
                        <div class="form-group">
                            <label for="algorithm">AI Algorithm</label>
                            <select id="algorithm" onchange="app.updateConfig({algorithm: this.value})">
                                <option value="PPO" ${this.appConfig.algorithm === 'PPO' ? 'selected' : ''}>PPO (Recommended)</option>
                                <option value="A2C" ${this.appConfig.algorithm === 'A2C' ? 'selected' : ''}>A2C</option>
                                <option value="DQN" ${this.appConfig.algorithm === 'DQN' ? 'selected' : ''}>DQN</option>
                            </select>
                        </div>
                    </div>
                    
                    <!-- System Configuration -->
                    <div class="config-card">
                        <h3>⚙️ System Settings</h3>
                        <div class="form-group">
                            <label for="saveLocation">Save Models To</label>
                            <select id="saveLocation" onchange="app.updateConfig({saveLocation: this.value})">
                                <option value="local" ${this.appConfig.saveLocation === 'local' ? 'selected' : ''}>Package Folder</option>
                                <option value="documents" ${this.appConfig.saveLocation === 'documents' ? 'selected' : ''}>Documents Folder</option>
                                <option value="desktop" ${this.appConfig.saveLocation === 'desktop' ? 'selected' : ''}>Desktop</option>
                            </select>
                        </div>
                        
                        <div class="form-group checkbox-group">
                            <label class="checkbox-label">
                                <input type="checkbox" ${this.appConfig.autoStart ? 'checked' : ''} 
                                       onchange="app.updateConfig({autoStart: this.checked})">
                                <span>Auto-start training when launched</span>
                            </label>
                        </div>
                    </div>
                </div>
                
                <div class="config-summary">
                    <h3>Package Summary</h3>
                    <div class="summary-grid">
                        <div class="summary-item">
                            <strong>Maze Complexity:</strong>
                            <span>${this.appConfig.mazeRooms} rooms</span>
                        </div>
                        <div class="summary-item">
                            <strong>Training Duration:</strong>
                            <span>${this.appConfig.trainingSteps.toLocaleString()} steps</span>
                        </div>
                        <div class="summary-item">
                            <strong>AI Algorithm:</strong>
                            <span>${this.appConfig.algorithm}</span>
                        </div>
                        <div class="summary-item">
                            <strong>File Size:</strong>
                            <span>~15 MB</span>
                        </div>
                    </div>
                    
                    <button class="btn btn-primary btn-large" onclick="app.generatePackage()">
                        🚀 Generate & Download Package
                    </button>

                    <div class="download-info-list">
                        <p><strong>What you'll get:</strong></p>
                        <ul>
                            <li>Complete RL Maze Trainer application</li>
                            <li>Graphical control panel (no command line needed)</li>
                            <li>Pre-configured with your settings</li>
                            <li>No installation required - just extract and run</li>
                            <li>All dependencies included</li>
                        </ul>
                    </div>
                </div>
            </div>
        `;
    }
    
    renderDownload() {
        if (!this.generatedPackageId) {
            return this.renderConfigurator();
        }
        
        const fileSize = this.generatedPackageSize ? `~${this.generatedPackageSize} MB` : 'Calculating...';
        
        return `
            <div class="download-container">
                <div class="download-card">
                    <div class="download-icon">📦</div>
                    <h2>Your Package is Ready!</h2>
                    <p>Your customized RL Maze Trainer has been generated successfully.</p>
                    
                    <div class="download-info">
                        <div class="info-item">
                            <strong>Filename:</strong>
                            <span>RLMazeTrainer_${this.currentUser.name.replace(/\s+/g, '')}.zip</span>
                        </div>
                        <div class="info-item">
                            <strong>Size:</strong>
                            <span>${fileSize}</span>
                        </div>
                        <div class="info-item">
                            <strong>Configuration:</strong>
                            <span>${this.appConfig.mazeRooms} rooms, ${this.appConfig.trainingSteps.toLocaleString()} steps, ${this.appConfig.algorithm}</span>
                        </div>
                    </div>
                    
                    <div class="download-actions">
                        <button class="btn btn-primary btn-large" onclick="app.downloadPackage()">
                            ⬇️ Download Now
                        </button>
                        <button class="btn btn-outline" onclick="app.navigateTo('configurator')">
                            ← Back to Configurator
                        </button>
                    </div>
                    
                    <div class="download-instructions">
                        <h4>How to use:</h4>
                        <ol>
                            <li><strong>Extract</strong> the ZIP file to any folder</li>
                            <li><strong>Run</strong> start-gui.bat (Windows) for the graphical interface</li>
                            <li><strong>Click</strong> "START TRAINING" in the control panel</li>
                            <li><strong>Watch</strong> the AI learn in real-time with live logs</li>
                            <li>No installation required - everything is self-contained!</li>
                        </ol>
                    </div>
                </div>
            </div>
        `;
    }
    
    // --- Event Handlers & API Methods ---

    handleLoginForm(event) {
        event.preventDefault();
        const email = document.getElementById('email').value;
        const name = email.split('@')[0];
        
        this.handleLogin({
            email: email,
            name: name.charAt(0).toUpperCase() + name.slice(1),
            id: Date.now().toString()
        });
    }
    
    handleSignup() {
        alert('Signup functionality would be implemented here! For demo, use any email/password.');
    }
    
    updateSlider(displayId, value, configKey) {
        document.getElementById(displayId).textContent = value;
        this.updateConfig({ [configKey]: parseInt(value) });
    }
    
    async generatePackage() {
        const hideLoading = this.showLoading("Generating your customized package...");
        try {
            // Generate package
            const result = await PackageAPI.generatePackage(this.appConfig);
            this.generatedPackageId = result.packageId;
            this.generatedPackageSize = result.size;
            
            // Navigate to download page
            this.navigateTo('download');
            
        } catch (error) {
            this.showError("Failed to generate package: " + error.message);
        } finally {
            hideLoading();
        }
    }
    
    async downloadPackage() {
        this.showLoading("Preparing download...");
        try {
            const { filename } = await PackageAPI.downloadPackage(this.generatedPackageId);
            this.showSuccess(`Download started for ${filename}! Check your downloads folder.`);
        } catch (error) {
            this.showError("Download failed: " + error.message);
        } finally {
             this.hideLoading();
        }
    }

    // --- UI Utility Methods ---

    showLoading(message) {
        // Remove any existing loader
        this.hideLoading();
        
        const loader = document.createElement('div');
        loader.className = 'loading-overlay';
        loader.innerHTML = `
            <div class="loading-content">
                <div class="loading-spinner"></div>
                <p>${message}</p>
            </div>
        `;
        document.body.appendChild(loader);
        // Store a reference to the remove function
        const remover = () => {
            if (document.body.contains(loader)) {
                document.body.removeChild(loader);
            }
        };
        this.loadingOverlayRemover = remover;
        return remover; // Return the function for more direct control if needed
    }

    hideLoading() {
        if (this.loadingOverlayRemover) {
            this.loadingOverlayRemover();
            this.loadingOverlayRemover = null;
        }
    }
    
    showError(message) {
        // A more advanced app might use a modal, but alert is fine for now.
        this.hideLoading(); // Ensure loading is hidden on error
        alert("ERROR: " + message);
    }
    
    showSuccess(message) {
        // A more advanced app might use a modal.
        this.hideLoading(); // Ensure loading is hidden on success
        alert("SUCCESS: " + message);
    }
}

// Initialize the app
const app = new RLMTApp();
window.app = app;

