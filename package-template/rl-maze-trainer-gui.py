import tkinter as tk
from tkinter import ttk, scrolledtext
import subprocess
import threading
import queue
import os
import sys
import time
from pathlib import Path

class RLMTrainerGUI:
    def __init__(self, root):
        self.root = root
        self.root.title("RL Maze Trainer - Control Panel")
        self.root.geometry("1000x700")
        self.root.configure(bg='#2c3e50')
        
        # Processes
        self.python_process = None
        self.game_process = None
        self.is_running = False
        
        # Queues for output
        self.python_queue = queue.Queue()
        self.game_queue = queue.Queue()
        
        self.setup_gui()
        self.check_dependencies()
    
    def setup_gui(self):
        # Header
        header_frame = tk.Frame(self.root, bg='#34495e', height=80)
        header_frame.pack(fill='x', padx=10, pady=10)
        header_frame.pack_propagate(False)
        
        title_label = tk.Label(header_frame, text="RL Maze Trainer - Control Panel", 
                              font=('Arial', 20, 'bold'), 
                              fg='white', bg='#34495e')
        title_label.pack(expand=True)
        
        subtitle_label = tk.Label(header_frame, text="AI Training Control Panel", 
                                 font=('Arial', 12), 
                                 fg='#bdc3c7', bg='#34495e')
        subtitle_label.pack(expand=True)
        
        # Control Panel
        control_frame = tk.Frame(self.root, bg='#2c3e50')
        control_frame.pack(fill='x', padx=10, pady=5)
        
        # Status indicators
        status_frame = tk.Frame(control_frame, bg='#2c3e50')
        status_frame.pack(fill='x', pady=5)
        
        self.python_status = tk.Label(status_frame, text="[STOPPED] Python Server", 
                                     font=('Arial', 10), fg='#e74c3c', bg='#2c3e50')
        self.python_status.pack(side='left', padx=10)
        
        self.game_status = tk.Label(status_frame, text="[STOPPED] Game Server", 
                                   font=('Arial', 10), fg='#e74c3c', bg='#2c3e50')
        self.game_status.pack(side='left', padx=10)
        
        # Control buttons
        button_frame = tk.Frame(control_frame, bg='#2c3e50')
        button_frame.pack(fill='x', pady=10)
        
        self.start_btn = tk.Button(button_frame, text="START TRAINING", 
                                  command=self.start_servers,
                                  font=('Arial', 12, 'bold'),
                                  bg='#27ae60', fg='white', 
                                  width=15, height=2)
        self.start_btn.pack(side='left', padx=5)
        
        self.stop_btn = tk.Button(button_frame, text="STOP TRAINING", 
                                 command=self.stop_servers,
                                 font=('Arial', 12),
                                 bg='#e74c3c', fg='white',
                                 width=15, height=2,
                                 state='disabled')
        self.stop_btn.pack(side='left', padx=5)
        
        self.open_browser_btn = tk.Button(button_frame, text="OPEN GAME", 
                                         command=self.open_browser,
                                         font=('Arial', 12),
                                         bg='#3498db', fg='white',
                                         width=15, height=2)
        self.open_browser_btn.pack(side='left', padx=5)
        
        # Log Tabs
        notebook = ttk.Notebook(self.root)
        notebook.pack(fill='both', expand=True, padx=10, pady=10)
        
        # Python Server Log Tab
        python_frame = tk.Frame(notebook)
        notebook.add(python_frame, text="Python Training Logs")
        
        self.python_log = scrolledtext.ScrolledText(
            python_frame, 
            wrap=tk.WORD, 
            width=80, 
            height=20,
            bg='#1e1e1e',
            fg='#00ff00',
            font=('Consolas', 10)
        )
        self.python_log.pack(fill='both', expand=True, padx=5, pady=5)
        self.python_log.insert(tk.END, "Python training logs will appear here...\n")
        self.python_log.config(state='disabled')
        
        # Game Server Log Tab
        game_frame = tk.Frame(notebook)
        notebook.add(game_frame, text="Game Server Logs")
        
        self.game_log = scrolledtext.ScrolledText(
            game_frame, 
            wrap=tk.WORD, 
            width=80, 
            height=20,
            bg='#1e1e1e',
            fg='#ffff00',
            font=('Consolas', 10)
        )
        self.game_log.pack(fill='both', expand=True, padx=5, pady=5)
        self.game_log.insert(tk.END, "Game server logs will appear here...\n")
        self.game_log.config(state='disabled')
        
        # Training Progress Tab
        progress_frame = tk.Frame(notebook)
        notebook.add(progress_frame, text="Training Progress")
        
        self.progress_log = scrolledtext.ScrolledText(
            progress_frame,
            wrap=tk.WORD,
            width=80,
            height=20,
            bg='#1e1e1e',
            fg='#00ffff',
            font=('Consolas', 10)
        )
        self.progress_log.pack(fill='both', expand=True, padx=5, pady=5)
        self.progress_log.insert(tk.END, "Training progress and metrics will appear here...\n")
        self.progress_log.config(state='disabled')
        
        # Footer
        footer_frame = tk.Frame(self.root, bg='#34495e', height=30)
        footer_frame.pack(fill='x', padx=10, pady=5)
        footer_frame.pack_propagate(False)
        
        footer_label = tk.Label(footer_frame, text="Models save to: training/models/ | Close this window to stop everything", 
                               font=('Arial', 9), fg='#bdc3c7', bg='#34495e')
        footer_label.pack(expand=True)
    
    def check_dependencies(self):
        """Check if required software is installed"""
        try:
            # Check Python
            subprocess.run(['python', '--version'], check=True, capture_output=True)
            self.log_message("python", "SUCCESS: Python is installed\n")
        except:
            self.log_message("python", "ERROR: Python not found! Please install Python 3.9+\n")
            self.start_btn.config(state='disabled')
        
        try:
            # Check Node.js
            subprocess.run(['node', '--version'], check=True, capture_output=True)
            self.log_message("game", "SUCCESS: Node.js is installed\n")
        except:
            self.log_message("game", "ERROR: Node.js not found! Please install Node.js\n")
            self.start_btn.config(state='disabled')
    
    def log_message(self, log_type, message):
        """Add message to appropriate log with timestamp"""
        timestamp = time.strftime("%H:%M:%S")
        formatted_message = f"[{timestamp}] {message}"
        
        if log_type == "python":
            self.python_log.config(state='normal')
            self.python_log.insert(tk.END, formatted_message)
            self.python_log.see(tk.END)
            self.python_log.config(state='disabled')
        
        elif log_type == "game":
            self.game_log.config(state='normal')
            self.game_log.insert(tk.END, formatted_message)
            self.game_log.see(tk.END)
            self.game_log.config(state='disabled')
        
        elif log_type == "progress":
            self.progress_log.config(state='normal')
            self.progress_log.insert(tk.END, formatted_message)
            self.progress_log.see(tk.END)
            self.progress_log.config(state='disabled')
    
    def start_servers(self):
        """Start both servers in background"""
        if self.is_running:
            return
        
        self.is_running = True
        self.start_btn.config(state='disabled')
        self.stop_btn.config(state='normal')
        
        # Clear logs
        for log in [self.python_log, self.game_log, self.progress_log]:
            log.config(state='normal')
            log.delete(1.0, tk.END)
            log.config(state='disabled')
        
        self.log_message("progress", "STARTING: RL Maze Trainer...\n")
        
        # Start Python server
        python_thread = threading.Thread(target=self.start_python_server)
        python_thread.daemon = True
        python_thread.start()
        
        # Start queue monitoring
        self.monitor_queues()
    
    def start_python_server(self):
        """Start Python training server"""
        try:
            self.python_status.config(text="[STARTING] Python Server", fg='#f39c12')
            
            # Change to training directory
            training_dir = os.path.join(os.path.dirname(__file__), "training")
            
            self.log_message("python", "STARTING: Python training server...\n")
            self.log_message("python", "INFO: WebSocket will listen on port 8765\n")
            
            # Start the process
            self.python_process = subprocess.Popen(
                ['python', 'train_maze_solver.py'],
                cwd=training_dir,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                bufsize=1,
                universal_newlines=True,
                creationflags=subprocess.CREATE_NO_WINDOW  # No console window
            )
            
            # Start reading output in separate thread
            def read_python_output():
                while True:
                    line = self.python_process.stdout.readline()
                    if not line:
                        break
                    self.python_queue.put(("python", line))
                self.python_queue.put(("python", "Python process ended\n"))
            
            output_thread = threading.Thread(target=read_python_output)
            output_thread.daemon = True
            output_thread.start()
            
            # Wait a bit then start game server
            time.sleep(3)
            self.start_game_server()
            
        except Exception as e:
            error_msg = f"ERROR starting Python server: {str(e)}\n"
            self.python_queue.put(("python", error_msg))
    
    def start_game_server(self):
        """Start game development server"""
        try:
            self.game_status.config(text="[STARTING] Game Server", fg='#f39c12')
            
            # Change to game directory
            game_dir = os.path.join(os.path.dirname(__file__), "game")
            
            self.log_message("game", "STARTING: Game server...\n")
            self.log_message("game", "INFO: Game will be available at http://localhost:3000\n")
            
            # Start the process
            self.game_process = subprocess.Popen(
                ['cmd', '/c', 'npm', 'run', 'dev'],
                cwd=game_dir,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                bufsize=1,
                universal_newlines=True,
                creationflags=subprocess.CREATE_NO_WINDOW  # No console window
            )
            
            # Start reading output in separate thread
            def read_game_output():
                while True:
                    line = self.game_process.stdout.readline()
                    if not line:
                        break
                    self.game_queue.put(("game", line))
                self.game_queue.put(("game", "Game process ended\n"))
            
            output_thread = threading.Thread(target=read_game_output)
            output_thread.daemon = True
            output_thread.start()
            
        except Exception as e:
            error_msg = f"ERROR starting game server: {str(e)}\n"
            self.game_queue.put(("game", error_msg))
    
    def monitor_queues(self):
        """Monitor queues for output from subprocesses"""
        try:
            # Check Python queue
            while True:
                try:
                    log_type, message = self.python_queue.get_nowait()
                    self.log_message(log_type, message)
                    
                    # Update status based on messages
                    if "Starting Python training server" in message:
                        self.python_status.config(text="[RUNNING] Python Server", fg='#2ecc71')
                    elif "Game connected" in message:
                        self.log_message("progress", "SUCCESS: Game connected! Training starting...\n")
                    elif "Step" in message and "Reward" in message:
                        self.log_message("progress", message)
                        
                except queue.Empty:
                    break
            
            # Check Game queue  
            while True:
                try:
                    log_type, message = self.game_queue.get_nowait()
                    self.log_message(log_type, message)
                    
                    # Update status based on messages
                    if "Local:" in message or "http://localhost:3000" in message:
                        self.game_status.config(text="[RUNNING] Game Server", fg='#2ecc71')
                        self.log_message("progress", "SUCCESS: Game server ready! Opening browser...\n")
                        # Auto-open browser when game server is ready
                        self.open_browser()
                        
                except queue.Empty:
                    break
        
        except:
            pass
        
        # Continue monitoring
        if self.is_running:
            self.root.after(100, self.monitor_queues)
    
    def open_browser(self):
        """Open browser to game - FIXED VERSION"""
        try:
            # Try multiple methods to open browser
            import webbrowser
            
            # Get the default browser
            browser = webbrowser.get()
            
            # Try to open with a short timeout
            import threading
            
            def open_url():
                try:
                    browser.open('http://localhost:3000', new=2)  # new=2 opens in new tab if possible
                    self.log_message("progress", "SUCCESS: Browser opened to http://localhost:3000\n")
                except Exception as e:
                    self.log_message("progress", f"ERROR opening browser: {str(e)}\n")
                    # Fallback: provide manual instructions
                    self.log_message("progress", "MANUAL: Please open http://localhost:3000 in your browser\n")
            
            # Run in thread to avoid blocking
            browser_thread = threading.Thread(target=open_url)
            browser_thread.daemon = True
            browser_thread.start()
            
        except Exception as e:
            self.log_message("progress", f"ERROR: Could not open browser automatically: {str(e)}\n")
            self.log_message("progress", "MANUAL: Please open http://localhost:3000 in your browser manually\n")
    
    def stop_servers(self):
        """Stop both servers"""
        if not self.is_running:
            return
        
        self.is_running = False
        self.log_message("progress", "STOPPING: Servers...\n")
        
        # Stop processes
        if self.python_process:
            try:
                self.python_process.terminate()
                self.python_process.wait(timeout=5)
            except:
                try:
                    self.python_process.kill()
                except:
                    pass
            self.python_process = None
        
        if self.game_process:
            try:
                self.game_process.terminate()
                self.game_process.wait(timeout=5)
            except:
                try:
                    self.game_process.kill()
                except:
                    pass
            self.game_process = None
        
        # Update UI
        self.python_status.config(text="[STOPPED] Python Server", fg='#e74c3c')
        self.game_status.config(text="[STOPPED] Game Server", fg='#e74c3c')
        
        self.start_btn.config(state='normal')
        self.stop_btn.config(state='disabled')
        
        self.log_message("progress", "SUCCESS: Servers stopped\n")
    
    def on_closing(self):
        """Handle window closing"""
        self.stop_servers()
        self.root.destroy()

def main():
    # Check if we're in the right directory
    if not os.path.exists("training") or not os.path.exists("game"):
        print("ERROR: Please run this from the main RL Maze Trainer directory")
        print("The 'training' and 'game' folders should be in the same directory")
        input("Press Enter to exit...")
        return
    
    root = tk.Tk()
    app = RLMTrainerGUI(root)
    
    # Handle window closing
    root.protocol("WM_DELETE_WINDOW", app.on_closing)
    
    # Start the GUI
    root.mainloop()

if __name__ == "__main__":
    main()